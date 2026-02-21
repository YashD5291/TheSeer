import { extractPageContent } from '../scrapers/index.js';

// Avoid injecting multiple times
if (!(window as any).__seerInjected) {
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
      const panelHost = document.getElementById('seer-panel-host');
      if (!panelHost?.shadowRoot) return;
      const statusEl = panelHost.shadowRoot.querySelector('[data-resume-status]');
      const statusText = panelHost.shadowRoot.querySelector('[data-status-text]');
      if (!statusEl || !statusText) return;

      statusEl.querySelector('.resume-spinner')?.remove();
      if (msg.type === 'SEER_CLAUDE_DONE') {
        statusEl.classList.add('ready');
        statusText.textContent = 'Prompt submitted — switch to Claude tab';
      } else {
        statusEl.classList.add('error');
        statusText.textContent = 'Claude submission failed — prompt copied to clipboard';
      }
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
      togglePanel();
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
        showResultsPanel({
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
        });
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
    position: fixed; top: 16px; right: -420px;
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
  .panel.visible { right: 16px; }

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
  .resume-status.error { background: #fef3c7; color: #92400e; }
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

function togglePanel() {
  const host = document.getElementById('seer-panel-host');
  if (host?.shadowRoot) {
    const panel = host.shadowRoot.querySelector('.panel');
    panel?.classList.remove('visible');
    setTimeout(() => host.remove(), 300);
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
