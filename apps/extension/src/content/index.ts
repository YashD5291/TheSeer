import { extractPageContent } from '../scrapers/index.js';

// Avoid injecting multiple times
if (!(window as any).__seerInjected) {
  (window as any).__seerInjected = true;
  init();
}

function init() {
  console.log('[Seer] Content script initialized on:', window.location.href);

  // ─── Toggle listener: show/hide FAB when popup toggle changes ───
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SEER_TOGGLE') {
      const fab = document.getElementById('seer-fab');
      if (msg.enabled) {
        if (!fab) {
          const newFab = createFab();
          document.body.appendChild(newFab);
          attachDragHandler(newFab);
        }
      } else {
        fab?.remove();
        document.getElementById('seer-results-panel')?.remove();
        document.getElementById('seer-score-badge')?.remove();
        document.getElementById('seer-toast')?.remove();
      }
    }
  });

  // Check initial enabled state
  chrome.storage.local.get('seerEnabled', (data) => {
    if (data.seerEnabled === false) {
      console.log('[Seer] Extension disabled — skipping FAB injection');
      return;
    }
    injectFab();
  });

  // Create floating button
  function createFab(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = 'seer-fab';
    el.innerHTML = `
      <div id="seer-fab-icon">S</div>
      <div id="seer-fab-tooltip">Analyze with Seer</div>
    `;
    return el;
  }

  let isAnalyzing = false;
  let pageAnalyzed = false;

  // ─── Draggable logic ──────────────────────────────────────────────
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let fabStartX = 0;
  let fabStartY = 0;

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
  function injectFab() {
    let fab = createFab();
    document.body.appendChild(fab);
    attachDragHandler(fab);

    // Re-inject if SPA frameworks remove our FAB
    const fabObserver = new MutationObserver(() => {
      if (!document.getElementById('seer-fab')) {
        // Only re-inject if still enabled
        chrome.storage.local.get('seerEnabled', (data) => {
          if (data.seerEnabled === false) return;
          console.log('[Seer] FAB was removed — re-injecting');
          fab = createFab();
          document.body.appendChild(fab);
          attachDragHandler(fab);
        });
      }
    });
    fabObserver.observe(document.body, { childList: true, subtree: true });
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

    const icon = document.getElementById('seer-fab-icon')!;
    icon.textContent = '...';
    icon.classList.add('seer-loading');
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
        const { result, job, model } = response;
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
      const icon = document.getElementById('seer-fab-icon')!;
      icon.classList.remove('seer-loading');
      icon.textContent = pageAnalyzed ? '✓' : 'S';
    }
  }
}

// ─── Floating results panel ──────────────────────────────────────────

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
}

function showResultsPanel(data: PanelData) {
  document.getElementById('seer-results-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'seer-results-panel';

  const recLabel: Record<string, string> = {
    'strong_yes': 'Strong Yes',
    'yes': 'Yes',
    'maybe': 'Maybe',
    'no': 'No',
  };

  let html = `
    <div id="seer-panel-header">
      <span id="seer-panel-title">As told by The Seer</span>
      <button id="seer-panel-close">&times;</button>
    </div>
    <div id="seer-panel-body">
      <div class="seer-panel-score ${data.pass ? 'seer-panel-pass' : 'seer-panel-fail'}">
        <span class="seer-panel-score-num">${data.score}</span>
        <span class="seer-panel-score-label">/100</span>
      </div>

      <div class="seer-panel-job">
        <div class="seer-panel-job-title">${esc(data.job.title || 'Unknown Title')}</div>
        <div class="seer-panel-job-company">${esc(data.job.company || 'Unknown Company')}</div>
        ${data.job.location ? `<div class="seer-panel-job-meta">${esc(data.job.location)}</div>` : ''}
        ${data.job.salary_range ? `<div class="seer-panel-job-meta">${esc(data.job.salary_range)}</div>` : ''}
      </div>

      <div class="seer-panel-meta">
        <span class="seer-panel-tag seer-panel-rec-${data.recommendation}">${recLabel[data.recommendation] || data.recommendation}</span>
        <span class="seer-panel-tag seer-panel-tag-model">${data.model}</span>
      </div>

      <div class="seer-panel-section">
        <div class="seer-panel-section-title">Recommended Base</div>
        <div class="seer-panel-section-body"><strong>${data.base}</strong> — ${esc(data.baseReasoning)}</div>
      </div>
  `;

  if (data.keyMatches.length > 0) {
    html += `
      <div class="seer-panel-section">
        <div class="seer-panel-section-title">Key Matches (${data.keyMatches.length})</div>
        <div class="seer-panel-tags">${data.keyMatches.map(s => `<span class="seer-panel-tag-match">${esc(s)}</span>`).join('')}</div>
      </div>
    `;
  }

  if (data.gaps.length > 0) {
    html += `
      <div class="seer-panel-section">
        <div class="seer-panel-section-title">Gaps (${data.gaps.length})</div>
        <div class="seer-panel-tags">${data.gaps.map(s => `<span class="seer-panel-tag-gap">${esc(s)}</span>`).join('')}</div>
      </div>
    `;
  }

  if (data.atsKeywords.length > 0) {
    html += `
      <div class="seer-panel-section">
        <div class="seer-panel-section-title">ATS Keywords</div>
        <div class="seer-panel-tags">${data.atsKeywords.map(s => `<span class="seer-panel-tag-kw">${esc(s)}</span>`).join('')}</div>
      </div>
    `;
  }

  if (data.job.description) {
    html += `
      <div class="seer-panel-section">
        <div class="seer-panel-section-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>Full Description</span>
          <button id="seer-copy-jd" class="seer-copy-btn">Copy JD</button>
        </div>
        <div class="seer-panel-desc">${esc(data.job.description)}</div>
      </div>
    `;
  }

  html += `</div>`;
  panel.innerHTML = html;
  document.body.appendChild(panel);

  requestAnimationFrame(() => panel.classList.add('seer-panel-visible'));

  document.getElementById('seer-panel-close')!.addEventListener('click', () => {
    panel.classList.remove('seer-panel-visible');
    setTimeout(() => panel.remove(), 300);
  });

  const copyBtn = document.getElementById('seer-copy-jd');
  if (copyBtn && data.job.description) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(data.job.description).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy JD'; }, 2000);
      });
    });
  }
}

function togglePanel() {
  const panel = document.getElementById('seer-results-panel');
  if (panel) {
    panel.classList.remove('seer-panel-visible');
    setTimeout(() => panel.remove(), 300);
  }
}

function esc(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ─── Score badge + toast ─────────────────────────────────────────────

function showScoreBadge(score: number, pass: boolean) {
  let badge = document.getElementById('seer-score-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'seer-score-badge';
    document.body.appendChild(badge);
  }
  badge.textContent = `${score}`;
  badge.className = pass ? 'seer-badge-pass' : 'seer-badge-fail';
}

function showToast(message: string, type: 'success' | 'warning' | 'error') {
  const existing = document.getElementById('seer-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'seer-toast';
  toast.className = `seer-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 5000);
}
