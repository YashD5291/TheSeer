import { extractPageContent } from '../scrapers/index.js';

// Avoid injecting on non-web pages and multiple times
const _href = window.location.href;
if (/^https?:\/\//.test(_href) && !(window as any).__seerInjected) {
  (window as any).__seerInjected = true;
  init();
}

// ─── Shared overlay shadow (FAB, badge, toast) ───────────────────────

const OVERLAY_CSS = `
  :host { all: initial; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .fab {
    position: fixed; bottom: 24px; right: 24px; z-index: 999999;
    cursor: grab; display: flex; align-items: center; gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none; -webkit-user-select: none; touch-action: none;
  }
  .fab:active { cursor: grabbing; }
  .fab:hover .fab-tooltip { opacity: 1; transform: translateX(0); }
  .fab-icon {
    width: 44px; height: 44px; border-radius: 12px;
    background: #1a1a2e; color: #e0e0e8;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 700;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .fab-icon:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08);
  }
  .fab-icon.loading { animation: pulse 1s infinite; }
  .fab-tooltip {
    background: #27272a; color: #e4e4e7;
    padding: 6px 10px; border-radius: 6px; font-size: 12px;
    white-space: nowrap; opacity: 0; transform: translateX(8px);
    transition: opacity 0.15s, transform 0.15s;
    pointer-events: none; order: -1;
  }

  .badge {
    position: fixed; bottom: 72px; right: 28px; z-index: 999999;
    width: 36px; height: 36px; border-radius: 8px;
    display: none; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2); animation: pop 0.3s ease-out;
  }
  .badge.show { display: flex; }
  .badge-pass { background: #16a34a; color: white; }
  .badge-fail { background: #dc2626; color: white; }

  .toast {
    position: fixed; bottom: 80px; right: 80px; z-index: 999999;
    padding: 10px 16px; border-radius: 8px; font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12); animation: slide-in 0.3s ease-out;
    max-width: 360px; border: 1px solid; display: none;
  }
  .toast.show { display: block; }
  .toast-success { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
  .toast-warning { background: #fffbeb; color: #92400e; border-color: #fde68a; }
  .toast-error { background: #fef2f2; color: #991b1b; border-color: #fecaca; }

  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes pop { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
  @keyframes slide-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
`;

let overlayShadow: ShadowRoot | null = null;
let pdfPath: string | null = null;

function getOverlay(): ShadowRoot {
  let host = document.getElementById('seer-overlay');
  if (host?.shadowRoot) {
    overlayShadow = host.shadowRoot;
    return overlayShadow;
  }

  host = document.createElement('div');
  host.id = 'seer-overlay';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${OVERLAY_CSS}</style>
    <div class="badge" data-badge></div>
    <div class="toast" data-toast></div>
  `;
  document.body.appendChild(host);
  overlayShadow = shadow;
  return shadow;
}

// ─── Main init ───────────────────────────────────────────────────────

function init() {
  console.log('[Seer] Content script initialized on:', window.location.href);

  // ─── Claude response relay (ISOLATED world picks up MAIN world postMessage) ───
  if (window.location.hostname === 'claude.ai') {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== '__seer_claude_response_complete__') return;

      const { chatUrl, responseText } = event.data;
      console.log(`[Seer] Claude response complete (${responseText?.length || 0} chars) — relaying to background`);
      chrome.runtime.sendMessage({
        type: 'SEER_CLAUDE_RESPONSE_READY',
        chatUrl,
        responseText,
      }).catch(() => {});
    });
  }

  // ─── Toggle listener: show/hide FAB when popup toggle changes ───
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SEER_TOGGLE') {
      const shadow = getOverlay();
      if (msg.enabled) {
        if (!shadow.querySelector('.fab')) {
          injectFabInto(shadow);
        }
      } else {
        shadow.querySelector('.fab')?.remove();
        document.getElementById('seer-panel-host')?.remove();
        const badge = shadow.querySelector('[data-badge]') as HTMLElement;
        if (badge) { badge.classList.remove('show'); }
        const toast = shadow.querySelector('[data-toast]') as HTMLElement;
        if (toast) { toast.classList.remove('show'); }
      }
    }
    // Claude submission status updates
    if (msg.type === 'SEER_CLAUDE_DONE' || msg.type === 'SEER_CLAUDE_ERROR') {
      claudeStatus = msg.type === 'SEER_CLAUDE_DONE' ? 'done' : 'error';
      applyClaudeStatus(claudeStatus as 'done' | 'error');
    }
    // Claude finished responding — show response in panel
    if (msg.type === 'SEER_CLAUDE_RESPONSE_COMPLETE') {
      claudeStatus = 'complete';
      claudeChatUrl = msg.chatUrl || '';
      claudeResponseText = msg.responseText || '';
      console.log(`[Seer] Claude response received (${claudeResponseText.length} chars)`);
      applyClaudeStatus('complete', claudeChatUrl, claudeResponseText);
    }
    // PDF generation completed
    if (msg.type === 'SEER_PDF_READY') {
      pdfPath = msg.pdfPath;
      console.log(`[Seer] PDF ready: ${pdfPath}`);
      addViewPdfButton();
    }
    if (msg.type === 'SEER_PDF_ERROR') {
      console.log(`[Seer] PDF generation failed: ${msg.error}`);
    }
  });

  // Check initial enabled state
  chrome.storage.local.get('seerEnabled', (data) => {
    if (data.seerEnabled === false) {
      console.log('[Seer] Extension disabled — skipping FAB injection');
      return;
    }
    const shadow = getOverlay();
    injectFabInto(shadow);

    // Re-inject if SPA frameworks remove our overlay host
    const observer = new MutationObserver(() => {
      if (!document.getElementById('seer-overlay')) {
        chrome.storage.local.get('seerEnabled', (d) => {
          if (d.seerEnabled === false) return;
          console.log('[Seer] Overlay was removed — re-injecting');
          overlayShadow = null;
          const s = getOverlay();
          injectFabInto(s);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  let isAnalyzing = false;
  let pageAnalyzed = false;
  let lastPanelData: PanelData | null = null;
  let claudeStatus: 'pending' | 'done' | 'error' | 'complete' = 'pending';
  let claudeChatUrl: string = '';
  let claudeResponseText: string = '';

  // ─── Draggable logic ──────────────────────────────────────────────
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let fabStartX = 0;
  let fabStartY = 0;

  function injectFabInto(shadow: ShadowRoot) {
    const fab = document.createElement('div');
    fab.className = 'fab';
    fab.innerHTML = `
      <div class="fab-icon" data-icon>S</div>
      <div class="fab-tooltip">Analyze with Seer</div>
    `;
    shadow.appendChild(fab);
    attachDragHandler(fab);
  }

  function attachDragHandler(target: HTMLDivElement) {
    target.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = target.getBoundingClientRect();
      fabStartX = rect.left;
      fabStartY = rect.top;

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          isDragging = true;
          target.style.left = `${fabStartX + dx}px`;
          target.style.top = `${fabStartY + dy}px`;
          target.style.right = 'auto';
          target.style.bottom = 'auto';
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (!isDragging) {
          handleClick();
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  // ─── Click handler: extract + send to background ─────────────────
  async function handleClick() {
    // If already analyzed, toggle the panel instead
    if (pageAnalyzed) {
      console.log('[Seer] Page already analyzed — toggling results panel');
      togglePanel(lastPanelData, claudeStatus, claudeChatUrl, claudeResponseText);
      return;
    }

    if (isAnalyzing) return;
    isAnalyzing = true;

    const shadow = getOverlay();
    const icon = shadow.querySelector('[data-icon]') as HTMLElement;
    icon.textContent = '...';
    icon.classList.add('loading');
    console.log('[Seer] ─── Analysis started ───');

    try {
      // Step 1: Extract
      console.log('[Seer] Step 1/3: Extracting page content...');
      const extraction = extractPageContent();

      if (!extraction.success && !(extraction.iframeUrls && extraction.iframeUrls.length > 0)) {
        console.log('[Seer] Extraction failed — not enough content on this page');
        showToast('Could not extract job data from this page.', 'error');
        return;
      }

      if (!extraction.success && extraction.iframeUrls?.length) {
        console.log(`[Seer] DOM empty but found ${extraction.iframeUrls.length} iframe(s) — sending to background to fetch`);
      }

      console.log(`[Seer] Step 1 done: method=${extraction.extractionMethod}, hasJobData=${!!extraction.jobData}, rawText=${extraction.rawText.length} chars`);

      // Step 2: Send to background
      console.log('[Seer] Step 2/3: Sending to background for analysis...');
      const response = await chrome.runtime.sendMessage({
        type: 'PAGE_EXTRACTED',
        extraction,
      });
      console.log('[Seer] Step 2 done: received response type:', response?.type);

      // Step 3: Show results
      console.log('[Seer] Step 3/3: Rendering results...');

      if (response?.type === 'DEEP_ANALYSIS_RESULT') {
        const { result, job, model, claudePrompt } = response;
        const pass = result.fit_score >= 40;
        console.log(`[Seer] Analysis: ${result.fit_score}/100, base: ${result.recommended_base}, model: ${model}`);
        showScoreBadge(result.fit_score, pass);
        showToast(
          `Fit: ${result.fit_score}/100 - ${result.apply_recommendation.replace('_', ' ')} | ${job.title} @ ${job.company}`,
          pass ? 'success' : 'warning'
        );
        lastPanelData = {
          job,
          score: result.fit_score,
          pass,
          model: model || 'grok-chat',
          recommendation: result.apply_recommendation,
          base: result.recommended_base,
          baseReasoning: result.base_reasoning || '',
          keyMatches: result.key_matches || [],
          gaps: result.gaps || [],
          atsKeywords: result.ats_keywords || [],
          claudePrompt,
        };
        showResultsPanel(lastPanelData);
        pageAnalyzed = true;
      } else if (response?.type === 'ERROR') {
        console.log('[Seer] Error from background:', response.message);
        showToast(response.message, 'error');
      }

      console.log('[Seer] ─── Analysis complete ───');
    } catch (err: any) {
      console.error('[Seer] Error:', err);
      showToast(err.message || 'Analysis failed', 'error');
    } finally {
      isAnalyzing = false;
      const s = getOverlay();
      const ic = s.querySelector('[data-icon]') as HTMLElement;
      ic.classList.remove('loading');
      ic.textContent = pageAnalyzed ? '✓' : 'S';
    }
  }
}

// ─── Floating results panel (own Shadow DOM) ─────────────────────────

interface PanelData {
  job: any;
  score: number;
  pass: boolean;
  model: string;
  recommendation: string;
  base: string;
  baseReasoning: string;
  keyMatches: string[];
  gaps: string[];
  atsKeywords: string[];
  claudePrompt?: string;
}

const PANEL_CSS = `
  :host { all: initial; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .panel {
    position: fixed; top: 16px; right: -480px;
    width: 390px; max-height: calc(100vh - 32px);
    background: #fff; border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06);
    border: 1px solid #e4e4e7;
    overflow: hidden; display: flex; flex-direction: column;
    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px; line-height: 1.5; color: #18181b;
    z-index: 999998;
  }
  .panel.visible { right: 76px; }

  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; background: #1a1a2e; color: #f0f0f4; flex-shrink: 0;
  }
  .header-title { font-size: 13px; font-weight: 600; letter-spacing: 0.2px; }
  .header-close {
    background: none; border: none; color: #8b8b9e;
    font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1;
    transition: color 0.15s; font-family: inherit;
  }
  .header-close:hover { color: #f0f0f4; }

  .body { padding: 16px; overflow-y: auto; flex: 1; }

  .score {
    display: flex; align-items: baseline; justify-content: center;
    gap: 2px; padding: 16px 0 12px;
  }
  .score-num { font-size: 44px; font-weight: 800; line-height: 1; }
  .score-label { font-size: 16px; font-weight: 600; color: #a1a1aa; }
  .score-pass .score-num { color: #16a34a; }
  .score-fail .score-num { color: #dc2626; }

  .job {
    text-align: center; padding-bottom: 12px;
    border-bottom: 1px solid #e4e4e7; margin-bottom: 12px;
  }
  .job-title { font-size: 15px; font-weight: 700; color: #18181b; margin-bottom: 4px; }
  .job-company { font-size: 13px; color: #71717a; font-weight: 500; }
  .job-meta { font-size: 12px; color: #a1a1aa; margin-top: 4px; }

  .meta {
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-bottom: 14px; justify-content: center;
  }
  .tag {
    font-size: 11px; padding: 3px 8px; border-radius: 4px;
    background: #f4f4f5; color: #3f3f46; font-weight: 500;
    display: inline-block;
  }
  .rec-strong_yes { background: #dcfce7; color: #166534; }
  .rec-yes { background: #dbeafe; color: #1e40af; }
  .rec-maybe { background: #fef3c7; color: #92400e; }
  .rec-no { background: #fee2e2; color: #991b1b; }
  .tag-model { background: #f4f4f5; color: #52525b; font-family: monospace; font-size: 10px; }

  .section { margin-bottom: 16px; }
  .section-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.5px; color: #71717a; margin-bottom: 6px;
  }
  .section-body { font-size: 13px; color: #3f3f46; line-height: 1.5; }
  .section-body strong { font-weight: 700; }

  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag-match {
    font-size: 12px; padding: 3px 8px; border-radius: 4px;
    background: #dcfce7; color: #166534; font-weight: 500;
    line-height: 1.3; display: inline-block;
  }
  .tag-gap {
    font-size: 12px; padding: 3px 8px; border-radius: 4px;
    background: #fee2e2; color: #991b1b; font-weight: 500;
    line-height: 1.3; display: inline-block;
  }
  .tag-kw {
    font-size: 12px; padding: 3px 8px; border-radius: 4px;
    background: #e0f2fe; color: #0c4a6e; font-weight: 500;
    line-height: 1.3; display: inline-block;
  }

  .desc-header { display: flex; align-items: center; justify-content: space-between; }
  .desc {
    font-size: 12px; color: #52525b; line-height: 1.6;
    white-space: pre-wrap; max-height: 400px; overflow-y: auto;
    background: #fafafa; padding: 10px; border-radius: 6px;
    border: 1px solid #e4e4e7;
  }
  .copy-btn {
    font-size: 11px; padding: 2px 10px; border-radius: 4px;
    border: 1px solid #d4d4d8; background: #fff; color: #3f3f46;
    cursor: pointer; font-weight: 600; transition: background 0.15s, border-color 0.15s;
    font-family: inherit;
  }
  .copy-btn:hover { background: #f4f4f5; border-color: #a1a1aa; }

  .resume-status {
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; font-weight: 600; color: #52525b;
    background: #fafafa; flex-shrink: 0;
  }
  .resume-status.ready { background: #dcfce7; color: #166534; }
  .resume-status.complete { background: #dbeafe; color: #1e40af; }
  .resume-status.error { background: #fef3c7; color: #92400e; }
  .resume-link {
    color: #1d4ed8; text-decoration: underline; cursor: pointer;
    font-weight: 600; font-size: 13px;
  }
  .resume-link:hover { color: #1e3a8a; }
  .resume-view-btn {
    font-size: 11px; padding: 4px 12px; border-radius: 4px;
    border: 1px solid #1d4ed8; background: #fff; color: #1d4ed8;
    cursor: pointer; font-weight: 600; transition: background 0.15s;
    font-family: inherit; flex-shrink: 0;
  }
  .resume-view-btn:hover { background: #eff6ff; }
  .resume-spinner {
    width: 16px; height: 16px; border: 2px solid #d4d4d8;
    border-top-color: #3f3f46; border-radius: 50%;
    animation: spin 0.8s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .resume-copy-btn {
    margin-left: auto; font-size: 11px; padding: 4px 12px;
    border-radius: 4px; border: 1px solid #16a34a; background: #fff;
    color: #166534; cursor: pointer; font-weight: 600;
    transition: background 0.15s; font-family: inherit; flex-shrink: 0;
  }
  .resume-copy-btn:hover { background: #f0fdf4; }
  .resume-pdf-btn {
    font-size: 11px; padding: 4px 12px; border-radius: 4px;
    border: 1px solid #7c3aed; background: #fff; color: #6d28d9;
    cursor: pointer; font-weight: 600; transition: background 0.15s;
    font-family: inherit; flex-shrink: 0;
  }
  .resume-pdf-btn:hover { background: #f5f3ff; }
`;

function showResultsPanel(data: PanelData) {
  document.getElementById('seer-panel-host')?.remove();

  const host = document.createElement('div');
  host.id = 'seer-panel-host';
  const shadow = host.attachShadow({ mode: 'open' });

  const recLabel: Record<string, string> = {
    'strong_yes': 'Strong Yes', 'yes': 'Yes',
    'maybe': 'Maybe', 'no': 'No',
  };

  let body = `
    <div class="score ${data.pass ? 'score-pass' : 'score-fail'}">
      <span class="score-num">${data.score}</span>
      <span class="score-label">/100</span>
    </div>
    <div class="job">
      <div class="job-title">${esc(data.job.title || 'Unknown Title')}</div>
      <div class="job-company">${esc(data.job.company || 'Unknown Company')}</div>
      ${data.job.location ? `<div class="job-meta">${esc(data.job.location)}</div>` : ''}
      ${data.job.salary_range ? `<div class="job-meta">${esc(data.job.salary_range)}</div>` : ''}
    </div>
    <div class="meta">
      <span class="tag rec-${data.recommendation}">${recLabel[data.recommendation] || data.recommendation}</span>
      <span class="tag tag-model">${data.model}</span>
    </div>
    <div class="section">
      <div class="section-title">Recommended Base</div>
      <div class="section-body"><strong>${data.base}</strong> — ${esc(data.baseReasoning)}</div>
    </div>
  `;

  if (data.keyMatches.length > 0) {
    body += `
      <div class="section">
        <div class="section-title">Key Matches (${data.keyMatches.length})</div>
        <div class="tags">${data.keyMatches.map(s => `<span class="tag-match">${esc(s)}</span>`).join('')}</div>
      </div>`;
  }
  if (data.gaps.length > 0) {
    body += `
      <div class="section">
        <div class="section-title">Gaps (${data.gaps.length})</div>
        <div class="tags">${data.gaps.map(s => `<span class="tag-gap">${esc(s)}</span>`).join('')}</div>
      </div>`;
  }
  if (data.atsKeywords.length > 0) {
    body += `
      <div class="section">
        <div class="section-title">ATS Keywords</div>
        <div class="tags">${data.atsKeywords.map(s => `<span class="tag-kw">${esc(s)}</span>`).join('')}</div>
      </div>`;
  }
  if (data.job.description) {
    body += `
      <div class="section">
        <div class="section-title desc-header">
          <span>Full Description</span>
          <button class="copy-btn" data-copy>Copy JD</button>
        </div>
        <div class="desc">${esc(data.job.description)}</div>
      </div>`;
  }

  // Resume status bar
  let statusHtml = '';
  if (data.claudePrompt) {
    statusHtml = `
      <div class="resume-status" data-resume-status>
        <div class="resume-spinner"></div>
        <span data-status-text>Submitting prompt to Claude...</span>
      </div>`;
  } else {
    statusHtml = `
      <div class="resume-status error">
        <span>No prompt template found — import profile in Options</span>
      </div>`;
  }

  shadow.innerHTML = `
    <style>${PANEL_CSS}</style>
    <div class="panel">
      <div class="header">
        <span class="header-title">As told by The Seer</span>
        <button class="header-close">&times;</button>
      </div>
      <div class="body">${body}</div>
      ${statusHtml}
    </div>
  `;

  document.body.appendChild(host);

  const panel = shadow.querySelector('.panel') as HTMLElement;
  requestAnimationFrame(() => panel.classList.add('visible'));

  shadow.querySelector('.header-close')!.addEventListener('click', () => {
    panel.classList.remove('visible');
    setTimeout(() => host.remove(), 300);
  });

  const copyBtn = shadow.querySelector('[data-copy]');
  if (copyBtn && data.job.description) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(data.job.description).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy JD'; }, 2000);
      });
    });
  }

  // Silently copy prompt to clipboard as fallback (in case Claude automation fails)
  if (data.claudePrompt) {
    navigator.clipboard.writeText(data.claudePrompt).catch(() => {});
  }
}

function togglePanel(panelData?: PanelData | null, status?: string, chatUrl?: string, responseText?: string) {
  const host = document.getElementById('seer-panel-host');
  if (host?.shadowRoot) {
    // Panel exists — close it
    const panel = host.shadowRoot.querySelector('.panel');
    panel?.classList.remove('visible');
    setTimeout(() => host.remove(), 300);
  } else if (panelData) {
    // Panel was removed — re-create it
    showResultsPanel(panelData);
    if (status && status !== 'pending') {
      applyClaudeStatus(status as any, chatUrl, responseText);
    }
  }
}

/** Update the panel's status bar to reflect current Claude state */
function applyClaudeStatus(status: 'done' | 'error' | 'complete', chatUrl?: string, responseText?: string) {
  const panelHost = document.getElementById('seer-panel-host');
  if (!panelHost?.shadowRoot) return;
  const statusEl = panelHost.shadowRoot.querySelector('[data-resume-status]');
  const statusText = panelHost.shadowRoot.querySelector('[data-status-text]');
  if (!statusEl || !statusText) return;

  statusEl.querySelector('.resume-spinner')?.remove();
  statusEl.classList.remove('ready', 'error', 'complete');

  if (status === 'complete') {
    statusEl.classList.add('complete');
    statusText.textContent = 'Resume ready';

    if (responseText) {
      const viewBtn = document.createElement('button');
      viewBtn.className = 'resume-view-btn';
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', () => showResponseModal(responseText, chatUrl));
      statusEl.appendChild(viewBtn);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'resume-copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(responseText).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        });
      });
      statusEl.appendChild(copyBtn);
    } else if (chatUrl) {
      const link = document.createElement('a');
      link.className = 'resume-link';
      link.textContent = 'Review in Claude';
      link.href = chatUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      statusEl.appendChild(link);
    }
  } else if (status === 'done') {
    statusEl.classList.add('ready');
    statusText.textContent = 'Prompt submitted — Claude is writing your resume...';
  } else {
    statusEl.classList.add('error');
    statusText.textContent = 'Claude submission failed — prompt copied to clipboard';
  }
}

/** Add "View PDF" button to panel status bar (and modal if open) */
function addViewPdfButton() {
  // Panel status bar
  const panelHost = document.getElementById('seer-panel-host');
  if (panelHost?.shadowRoot) {
    const statusEl = panelHost.shadowRoot.querySelector('[data-resume-status]');
    if (statusEl && !statusEl.querySelector('.resume-pdf-btn')) {
      const btn = document.createElement('button');
      btn.className = 'resume-pdf-btn';
      btn.textContent = 'View PDF';
      btn.addEventListener('click', openPdf);
      // Insert before the Copy button
      const copyBtn = statusEl.querySelector('.resume-copy-btn');
      if (copyBtn) {
        statusEl.insertBefore(btn, copyBtn);
      } else {
        statusEl.appendChild(btn);
      }
    }
  }

  // Modal (if currently open)
  const modalHost = document.getElementById('seer-response-modal');
  if (modalHost?.shadowRoot) {
    const actions = modalHost.shadowRoot.querySelector('.modal-actions');
    if (actions && !actions.querySelector('.resume-pdf-btn')) {
      const btn = document.createElement('button');
      btn.className = 'modal-btn resume-pdf-btn';
      btn.textContent = 'View PDF';
      btn.style.border = '1px solid #7c3aed';
      btn.style.color = '#c4b5fd';
      btn.addEventListener('click', openPdf);
      // Insert before the Copy Resume button
      const copyBtn = actions.querySelector('[data-copy]');
      if (copyBtn) {
        actions.insertBefore(btn, copyBtn);
      } else {
        actions.insertBefore(btn, actions.querySelector('.modal-close'));
      }
    }
  }
}

function openPdf() {
  if (pdfPath) {
    chrome.runtime.sendMessage({ type: 'SEER_OPEN_PDF', pdfPath });
  }
}

// ─── Claude response modal (own Shadow DOM) ───────────────────────────

const MODAL_CSS = `
  :host { all: initial; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .backdrop {
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(0,0,0,0.5); display: flex;
    align-items: center; justify-content: center;
    animation: fade-in 0.2s ease-out;
  }
  .modal {
    width: 860px; max-width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
    background: #fff; border-radius: 14px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.25);
    display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: scale-in 0.2s ease-out;
    overflow: hidden;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 24px; background: #1a1a2e; color: #f0f0f4; flex-shrink: 0;
  }
  .modal-title { font-size: 14px; font-weight: 600; }
  .modal-actions { display: flex; gap: 8px; align-items: center; }
  .modal-btn {
    font-size: 12px; padding: 5px 14px; border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08);
    color: #e0e0e8; cursor: pointer; font-weight: 600;
    font-family: inherit; transition: background 0.15s; text-decoration: none;
  }
  .modal-btn:hover { background: rgba(255,255,255,0.15); }
  .modal-close {
    background: none; border: none; color: #8b8b9e;
    font-size: 22px; cursor: pointer; padding: 0 4px; line-height: 1;
    font-family: inherit; transition: color 0.15s;
  }
  .modal-close:hover { color: #f0f0f4; }
  .modal-body {
    padding: 0; overflow-y: auto; flex: 1;
    font-size: 14px; color: #27272a; line-height: 1.7;
  }

  /* ── Resume highlighted section ── */
  .resume-section {
    padding: 28px 32px;
    background: linear-gradient(135deg, #f0f9ff 0%, #e8f4fe 100%);
    border-bottom: 2px solid #7dd3fc;
  }
  .resume-section-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: #0369a1; margin-bottom: 16px;
    display: flex; align-items: center; gap: 6px;
  }
  .resume-section-label::before {
    content: ''; width: 8px; height: 8px; border-radius: 50%;
    background: #0ea5e9; flex-shrink: 0;
  }

  /* ── Rest / analysis section ── */
  .rest-section {
    padding: 28px 32px; color: #3f3f46; font-size: 13px; line-height: 1.7;
  }
  .rest-section-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: #71717a; margin-bottom: 16px;
  }

  /* ── Markdown rendered typography ── */
  .md h1 {
    font-size: 22px; font-weight: 800; color: #0f172a;
    margin: 0 0 4px; line-height: 1.3;
  }
  .md h2 {
    font-size: 16px; font-weight: 700; color: #1e293b;
    margin: 20px 0 8px; padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
  }
  .md h3 {
    font-size: 14px; font-weight: 700; color: #334155;
    margin: 16px 0 6px;
  }
  .md p { margin: 0 0 10px; }
  .md strong { font-weight: 700; color: #0f172a; }
  .md em { font-style: italic; }
  .md hr {
    border: none; border-top: 1px solid #e2e8f0;
    margin: 18px 0;
  }
  .md ul, .md ol {
    margin: 6px 0 12px 20px; padding: 0;
  }
  .md li {
    margin-bottom: 5px; padding-left: 2px;
  }
  .md li::marker { color: #94a3b8; }
  .md table {
    width: 100%; border-collapse: collapse;
    margin: 12px 0; font-size: 12px;
  }
  .md th {
    text-align: left; padding: 8px 10px; font-weight: 700;
    background: #f1f5f9; color: #334155;
    border-bottom: 2px solid #cbd5e1;
  }
  .md td {
    padding: 7px 10px; border-bottom: 1px solid #e2e8f0;
    vertical-align: top; color: #475569;
  }
  .md tr:last-child td { border-bottom: none; }
  .md .contact-line {
    font-size: 13px; color: #475569; margin: 0 0 2px;
  }

  /* resume section overrides */
  .resume-section .md h2 { color: #0369a1; border-color: #bae6fd; }
  .resume-section .md th { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
  .resume-section .md td { border-color: #bae6fd; }

  /* rest section overrides */
  .rest-section .md h2 { font-size: 15px; color: #475569; border-color: #e4e4e7; }
  .rest-section .md h3 { font-size: 13px; color: #52525b; }

  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
`;

/** Lightweight markdown → HTML renderer for Claude's structured output */
function renderMarkdown(md: string): string {
  // Escape HTML first
  const escaped = esc(md);
  const lines = escaped.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (trimmed === '') { i++; continue; }

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed)) {
      out.push('<hr>');
      i++; continue;
    }

    // Table (starts with |)
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      out.push(renderTable(tableLines));
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      out.push(`<h1>${inline(trimmed.slice(2))}</h1>`);
      i++; continue;
    }
    if (trimmed.startsWith('## ')) {
      out.push(`<h2>${inline(trimmed.slice(3))}</h2>`);
      i++; continue;
    }
    if (trimmed.startsWith('### ')) {
      out.push(`<h3>${inline(trimmed.slice(4))}</h3>`);
      i++; continue;
    }

    // Unordered list
    if (/^[-*] /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*] /, '').trim());
        i++;
      }
      out.push('<ul>' + items.map(it => `<li>${inline(it)}</li>`).join('') + '</ul>');
      continue;
    }

    // Contact lines (starts with **Email:** / **Phone:** / **LinkedIn:** / **GitHub:**)
    if (/^\*\*(?:Email|Phone|LinkedIn|GitHub|Location)\*\*/.test(trimmed)) {
      out.push(`<p class="contact-line">${inline(trimmed)}</p>`);
      i++; continue;
    }

    // Regular paragraph — collect consecutive non-empty, non-special lines
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (l === '' || l.startsWith('#') || l.startsWith('|') || /^-{3,}$/.test(l) || /^[-*] /.test(l)) break;
      para.push(l);
      i++;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

/** Render inline markdown: bold, italic */
function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/** Render a markdown table from lines */
function renderTable(lines: string[]): string {
  if (lines.length < 2) return lines.map(l => `<p>${inline(l)}</p>`).join('');

  const parseRow = (line: string) =>
    line.split('|').map(c => c.trim()).filter(c => c !== '');

  const headers = parseRow(lines[0]);
  // Skip separator line (|---|---|)
  const startIdx = /^[\s|:-]+$/.test(lines[1].replace(/\|/g, '').replace(/[-: ]/g, '')) ? 2 : 1;
  const rows = lines.slice(startIdx).map(parseRow);

  let html = '<table><thead><tr>';
  for (const h of headers) html += `<th>${inline(h)}</th>`;
  html += '</tr></thead><tbody>';
  for (const row of rows) {
    html += '<tr>';
    for (let c = 0; c < headers.length; c++) {
      html += `<td>${inline(row[c] || '')}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function parseClaudeResponse(text: string): { resume: string; rest: string } {
  // Extract between "## TAILORED RESUME" and "## CHANGELOG"
  const resumeStart = text.indexOf('## TAILORED RESUME');
  const changelogStart = text.indexOf('## CHANGELOG');

  if (resumeStart === -1) {
    // No structured resume found — treat entire text as resume
    return { resume: text.trim(), rest: '' };
  }

  // Resume content: everything after the "## TAILORED RESUME" header + any leading ---
  let resumeBody = text.slice(resumeStart + '## TAILORED RESUME'.length);
  // Strip leading whitespace and --- separator
  resumeBody = resumeBody.replace(/^\s*---\s*/, '').trim();

  let rest = '';
  if (changelogStart !== -1) {
    // Cut resume at changelog
    const resumeEnd = text.indexOf('## CHANGELOG');
    resumeBody = text.slice(resumeStart + '## TAILORED RESUME'.length, resumeEnd);
    resumeBody = resumeBody.replace(/^\s*---\s*/, '').replace(/\s*---\s*$/, '').trim();

    // Rest = everything before resume + changelog onwards
    const before = text.slice(0, resumeStart).replace(/\s*---\s*$/, '').trim();
    const after = text.slice(changelogStart).trim();
    rest = [before, after].filter(Boolean).join('\n\n---\n\n');
  } else {
    // No changelog — everything before resume is the rest
    rest = text.slice(0, resumeStart).replace(/\s*---\s*$/, '').trim();
  }

  return { resume: resumeBody, rest };
}

function showResponseModal(responseText: string, chatUrl?: string) {
  // Remove existing modal
  document.getElementById('seer-response-modal')?.remove();

  const { resume, rest } = parseClaudeResponse(responseText);

  const host = document.createElement('div');
  host.id = 'seer-response-modal';
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>${MODAL_CSS}</style>
    <div class="backdrop">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Claude's Response</span>
          <div class="modal-actions">
            ${chatUrl ? `<a class="modal-btn" href="${chatUrl}" target="_blank" rel="noopener">Open in Claude</a>` : ''}
            <button class="modal-btn" data-copy>Copy Resume</button>
            <button class="modal-close">&times;</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="resume-section">
            <div class="resume-section-label">Tailored Resume</div>
            <div class="md">${renderMarkdown(resume)}</div>
          </div>
          ${rest ? `
            <div class="rest-section">
              <div class="rest-section-label">Analysis &amp; Notes</div>
              <div class="md">${renderMarkdown(rest)}</div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(host);

  const close = () => host.remove();

  shadow.querySelector('.modal-close')!.addEventListener('click', close);
  shadow.querySelector('.backdrop')!.addEventListener('click', (e) => {
    if (e.target === shadow.querySelector('.backdrop')) close();
  });

  const copyBtn = shadow.querySelector('[data-copy]')!;
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(resume).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Resume'; }, 2000);
    });
  });

  // If PDF is already ready, inject the View PDF button
  if (pdfPath) {
    const actions = shadow.querySelector('.modal-actions');
    if (actions && !actions.querySelector('.resume-pdf-btn')) {
      const pdfBtn = document.createElement('button');
      pdfBtn.className = 'modal-btn resume-pdf-btn';
      pdfBtn.textContent = 'View PDF';
      pdfBtn.style.border = '1px solid #7c3aed';
      pdfBtn.style.color = '#c4b5fd';
      pdfBtn.addEventListener('click', openPdf);
      const copyBtnEl = actions.querySelector('[data-copy]');
      if (copyBtnEl) {
        actions.insertBefore(pdfBtn, copyBtnEl);
      } else {
        actions.insertBefore(pdfBtn, actions.querySelector('.modal-close'));
      }
    }
  }
}

// ─── Score badge + toast (via overlay shadow) ────────────────────────

function showScoreBadge(score: number, pass: boolean) {
  const shadow = getOverlay();
  const badge = shadow.querySelector('[data-badge]') as HTMLElement;
  badge.textContent = `${score}`;
  badge.className = `badge show ${pass ? 'badge-pass' : 'badge-fail'}`;
}

function showToast(message: string, type: 'success' | 'warning' | 'error') {
  const shadow = getOverlay();
  const toast = shadow.querySelector('[data-toast]') as HTMLElement;
  toast.textContent = message;
  toast.className = `toast show toast-${type}`;
  setTimeout(() => { toast.classList.remove('show'); }, 5000);
}

function esc(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
