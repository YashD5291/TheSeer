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

  const ringColor = pass ? 'border-emerald-500' : 'border-red-500';
  const scoreColor = pass ? 'text-emerald-600' : 'text-red-500';
  const labelColor = pass ? 'text-emerald-600' : 'text-red-500';

  let html = `
    <div class="text-center pb-4 mb-4 border-b border-zinc-200">
      <div class="inline-flex items-center justify-center w-[72px] h-[72px] rounded-full border-[3px] ${ringColor} mb-2">
        <span class="text-2xl font-bold ${scoreColor}">${score}</span>
      </div>
      <div class="text-sm font-semibold ${labelColor} mb-1">${pass ? 'Good Fit' : 'Weak Fit'}</div>
      <div class="text-xs text-zinc-500">${job.title} @ ${job.company}</div>
      ${job.location ? `<div class="text-xs text-zinc-400">${job.location}</div>` : ''}
      ${job.salary_range ? `<div class="text-xs text-zinc-400">${job.salary_range}</div>` : ''}
    </div>
  `;

  if (deepAnalysis && deepAnalysis.key_matches.length > 0) {
    html += `
      <div class="mb-4">
        <h3 class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Key Matches (${deepAnalysis.key_matches.length})</h3>
        <div class="flex flex-wrap gap-1">
          ${deepAnalysis.key_matches.map(s => `<span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">${s}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (deepAnalysis) {
    html += renderDeepAnalysis(deepAnalysis);
  }

  if (deepAnalysis && !claudePrompt) {
    html += `<button class="w-full py-2.5 rounded-lg text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer border-none mb-2" id="btn-prompt">Generate Claude Prompt</button>`;
  }

  if (claudePrompt) {
    html += `<button class="w-full py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer border-none mb-2" id="btn-copy">Copy Prompt to Clipboard</button>`;
  }

  contentEl.innerHTML = html;

  document.getElementById('btn-prompt')?.addEventListener('click', () => generatePrompt(data));
  document.getElementById('btn-copy')?.addEventListener('click', () => copyPrompt(data));
}

function renderDeepAnalysis(analysis: FitAnalysis): string {
  const recClass: Record<string, string> = {
    strong_yes: 'bg-emerald-50 text-emerald-700',
    yes: 'bg-blue-50 text-blue-700',
    maybe: 'bg-amber-50 text-amber-700',
    no: 'bg-red-50 text-red-700',
  };

  let html = `
    <div class="mb-4">
      <h3 class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Deep Analysis</h3>
      <div class="divide-y divide-zinc-100">
        <div class="flex justify-between py-1.5 text-sm">
          <span class="text-zinc-500">Confidence</span>
          <span class="font-semibold text-zinc-800">${analysis.confidence}%</span>
        </div>
        <div class="flex justify-between py-1.5 text-sm">
          <span class="text-zinc-500">Recommended Base</span>
          <span class="font-semibold text-zinc-800">${analysis.recommended_base}</span>
        </div>
        <div class="flex justify-between py-1.5 text-sm">
          <span class="text-zinc-500">Competition</span>
          <span class="font-semibold text-zinc-800">${analysis.estimated_competition}</span>
        </div>
        <div class="flex justify-between py-1.5 text-sm">
          <span class="text-zinc-500">Recommendation</span>
          <span class="font-semibold">
            <span class="text-xs px-2 py-0.5 rounded ${recClass[analysis.apply_recommendation] || 'bg-zinc-100 text-zinc-600'}">
              ${analysis.apply_recommendation.replace('_', ' ')}
            </span>
          </span>
        </div>
      </div>
    </div>
  `;

  if (analysis.gaps.length > 0) {
    html += `
      <div class="mb-4">
        <h3 class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Gaps (${analysis.gaps.length})</h3>
        <div class="flex flex-wrap gap-1">
          ${analysis.gaps.map(g => `<span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">${g}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (analysis.red_flags.length > 0) {
    html += `
      <div class="mb-4">
        <h3 class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Red Flags</h3>
        ${analysis.red_flags.map(f => `<div class="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 mb-1.5">${f}</div>`).join('')}
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
    btn.classList.add('opacity-40', 'cursor-not-allowed');
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_PROMPT',
      job: data.job,
      analysis: data.deepAnalysis,
      tabId: activeTabId,
    });

    if (response?.type === 'ERROR') {
      contentEl.innerHTML += `<div class="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 mb-2">${response.message}</div>`;
      return;
    }

    if (response?.type === 'PROMPT_RESULT') {
      data.claudePrompt = response.prompt;
      renderJobData(data);
    }
  } catch (err: any) {
    contentEl.innerHTML += `<div class="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 mb-2">${err.message}</div>`;
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
