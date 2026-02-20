import type { ScrapedJob, FitAnalysis } from '../shared/types.js';

const contentEl = document.getElementById('content')!;
const optionsLink = document.getElementById('options-link')!;

optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

async function init() {
  // Fetch current job data from background
  const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_JOB' });

  if (!response?.data) {
    // Show empty state (already in HTML)
    return;
  }

  const data: ScrapedJob = response.data;
  renderJobData(data);
}

function renderJobData(data: ScrapedJob) {
  const { job, quickFit, deepAnalysis, claudePrompt } = data;

  const score = deepAnalysis?.fit_score ?? quickFit?.score ?? 0;
  const pass = deepAnalysis ? deepAnalysis.fit_score >= 40 : (quickFit?.pass ?? false);
  const isDeep = !!deepAnalysis;

  let html = `
    <div class="score-section">
      <div class="score-circle ${pass ? 'score-pass' : 'score-fail'}">${score}</div>
      <div class="score-label">${pass ? 'Good Fit' : 'Weak Fit'} ${isDeep ? '(Deep)' : '(Quick)'}</div>
      <div class="job-info">${job.title} @ ${job.company}</div>
      ${job.location ? `<div class="job-info">${job.location}</div>` : ''}
      ${job.salary_range ? `<div class="job-info">${job.salary_range}</div>` : ''}
    </div>
  `;

  // Quick fit skills (from local matching)
  if (quickFit && quickFit.matched.length > 0) {
    html += `
      <div class="section">
        <h3>Matched Skills (${quickFit.matched.length})</h3>
        <div class="skills-list">
          ${quickFit.matched.map(s => `<span class="skill-tag skill-matched">${s}</span>`).join('')}
        </div>
      </div>
    `;
  } else if (!quickFit && deepAnalysis && deepAnalysis.key_matches.length > 0) {
    // Gemini extraction path: show key_matches from deep analysis instead
    html += `
      <div class="section">
        <h3>Key Matches (${deepAnalysis.key_matches.length})</h3>
        <div class="skills-list">
          ${deepAnalysis.key_matches.map(s => `<span class="skill-tag skill-matched">${s}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (quickFit?.deal_breaker_hit) {
    html += `<div class="error">Deal-breaker hit: ${quickFit.deal_breaker_hit}</div>`;
  }

  // Deep analysis details
  if (deepAnalysis) {
    html += renderDeepAnalysis(deepAnalysis);
  }

  // Action buttons
  if (!deepAnalysis) {
    html += `<button class="btn btn-primary" id="btn-deep">Run Deep Analysis (Gemini)</button>`;
  }

  if (deepAnalysis && !claudePrompt) {
    html += `<button class="btn btn-primary" id="btn-prompt">Generate Claude Prompt</button>`;
  }

  if (claudePrompt) {
    html += `<button class="btn btn-success" id="btn-copy">Copy Prompt to Clipboard</button>`;
  }

  contentEl.innerHTML = html;

  // Bind button events
  document.getElementById('btn-deep')?.addEventListener('click', () => runDeepAnalysis(data));
  document.getElementById('btn-prompt')?.addEventListener('click', () => generatePrompt(data));
  document.getElementById('btn-copy')?.addEventListener('click', () => copyPrompt(data));
}

function renderDeepAnalysis(analysis: FitAnalysis): string {
  let html = `
    <div class="section">
      <h3>Deep Analysis</h3>
      <div class="analysis-row">
        <span class="analysis-label">Confidence</span>
        <span class="analysis-value">${analysis.confidence}%</span>
      </div>
      <div class="analysis-row">
        <span class="analysis-label">Recommended Base</span>
        <span class="analysis-value">${analysis.recommended_base}</span>
      </div>
      <div class="analysis-row">
        <span class="analysis-label">Competition</span>
        <span class="analysis-value">${analysis.estimated_competition}</span>
      </div>
      <div class="analysis-row">
        <span class="analysis-label">Recommendation</span>
        <span class="analysis-value">
          <span class="recommendation rec-${analysis.apply_recommendation}">
            ${analysis.apply_recommendation.replace('_', ' ')}
          </span>
        </span>
      </div>
    </div>
  `;

  if (analysis.gaps.length > 0) {
    html += `
      <div class="section">
        <h3>Gaps (${analysis.gaps.length})</h3>
        <div class="skills-list">
          ${analysis.gaps.map(g => `<span class="skill-tag skill-gap">${g}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (analysis.red_flags.length > 0) {
    html += `
      <div class="section">
        <h3>Red Flags</h3>
        ${analysis.red_flags.map(f => `<div class="error">${f}</div>`).join('')}
      </div>
    `;
  }

  return html;
}

async function runDeepAnalysis(data: ScrapedJob) {
  const btn = document.getElementById('btn-deep') as HTMLButtonElement;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Analyzing...';
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DEEP_ANALYSIS_REQUEST',
      job: data.job,
    });

    if (response?.type === 'ERROR') {
      contentEl.innerHTML += `<div class="error">${response.message}</div>`;
      return;
    }

    if (response?.type === 'DEEP_ANALYSIS_RESULT') {
      data.deepAnalysis = response.result;
      renderJobData(data);
    }
  } catch (err: any) {
    contentEl.innerHTML += `<div class="error">${err.message}</div>`;
  }
}

async function generatePrompt(data: ScrapedJob) {
  const btn = document.getElementById('btn-prompt') as HTMLButtonElement;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating...';
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_PROMPT',
      job: data.job,
      analysis: data.deepAnalysis,
    });

    if (response?.type === 'ERROR') {
      contentEl.innerHTML += `<div class="error">${response.message}</div>`;
      return;
    }

    if (response?.type === 'PROMPT_RESULT') {
      data.claudePrompt = response.prompt;
      renderJobData(data);
    }
  } catch (err: any) {
    contentEl.innerHTML += `<div class="error">${err.message}</div>`;
  }
}

async function copyPrompt(data: ScrapedJob) {
  if (!data.claudePrompt) return;

  try {
    await navigator.clipboard.writeText(data.claudePrompt);
    const btn = document.getElementById('btn-copy')!;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Prompt to Clipboard'; }, 2000);
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = data.claudePrompt;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    const btn = document.getElementById('btn-copy')!;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Prompt to Clipboard'; }, 2000);
  }
}

init();
