import type { ScrapedJob, FitAnalysis } from '../shared/types.js';
import { getEnabled, setEnabled, getModelPrefs, saveModelPrefs } from '../shared/storage.js';

const contentEl = document.getElementById('content')!;
const optionsLink = document.getElementById('options-link')!;
const toggle = document.getElementById('seer-toggle') as HTMLInputElement;
const grokSelect = document.getElementById('grok-model') as HTMLSelectElement;
const claudeSelect = document.getElementById('claude-model') as HTMLSelectElement;
const thinkingToggle = document.getElementById('claude-thinking') as HTMLInputElement;
const contextToggle = document.getElementById('seer-context') as HTMLInputElement;

optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});


// ─── Toggle ──────────────────────────────────────────────────────────
getEnabled().then(on => { toggle.checked = on; });

// ─── Model preferences ──────────────────────────────────────────────
getModelPrefs().then(prefs => {
  grokSelect.value = prefs.grokModel;
  claudeSelect.value = prefs.claudeModel;
  thinkingToggle.checked = prefs.claudeExtendedThinking;
  contextToggle.checked = prefs.seerContext;
});

const savePrefs = () => saveModelPrefs({
  grokModel: grokSelect.value,
  claudeModel: claudeSelect.value,
  claudeExtendedThinking: thinkingToggle.checked,
  seerContext: contextToggle.checked,
});
grokSelect.addEventListener('change', savePrefs);
claudeSelect.addEventListener('change', savePrefs);
thinkingToggle.addEventListener('change', savePrefs);
contextToggle.addEventListener('change', savePrefs);

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked;
  await setEnabled(enabled);

  // Notify all tabs so content script can show/hide FAB immediately
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SEER_TOGGLE', enabled }).catch(() => {});
    }
  }
});

let activeTabId: number | undefined;

async function init() {
  // Determine which tab is currently active
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = activeTab?.id;

  if (!activeTabId) return;

  // Fetch job data for the active tab
  const response = await chrome.runtime.sendMessage({ type: 'GET_JOB_FOR_TAB', tabId: activeTabId });

  if (!response?.data) {
    // Show empty state (already in HTML)
    return;
  }

  const data: ScrapedJob = response.data;
  renderJobData(data);
}

function renderJobData(data: ScrapedJob) {
  const { job, deepAnalysis, claudePrompt } = data;

  const score = deepAnalysis?.fit_score ?? 0;
  const pass = deepAnalysis ? deepAnalysis.fit_score >= 40 : false;

  let html = `
    <div class="score-section">
      <div class="score-circle ${pass ? 'score-pass' : 'score-fail'}">${score}</div>
      <div class="score-label">${pass ? 'Good Fit' : 'Weak Fit'}</div>
      <div class="job-info">${job.title} @ ${job.company}</div>
      ${job.location ? `<div class="job-info">${job.location}</div>` : ''}
      ${job.salary_range ? `<div class="job-info">${job.salary_range}</div>` : ''}
    </div>
  `;

  if (deepAnalysis && deepAnalysis.key_matches.length > 0) {
    html += `
      <div class="section">
        <h3>Key Matches (${deepAnalysis.key_matches.length})</h3>
        <div class="skills-list">
          ${deepAnalysis.key_matches.map(s => `<span class="skill-tag skill-matched">${s}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (deepAnalysis) {
    html += renderDeepAnalysis(deepAnalysis);
  }

  if (deepAnalysis && !claudePrompt) {
    html += `<button class="btn btn-primary" id="btn-prompt">Generate Claude Prompt</button>`;
  }

  if (claudePrompt) {
    html += `<button class="btn btn-success" id="btn-copy">Copy Prompt to Clipboard</button>`;
  }

  contentEl.innerHTML = html;

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
      tabId: activeTabId,
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
