import { getSettings, saveSettings, getSystemPrompts, saveSystemPrompt, deleteSystemPrompt } from '../shared/storage.js';
import { PROMPT_REGISTRY, getDefaultPrompt } from '../shared/prompt-defaults.js';
import type { ParsedProfile, BaseResumeSlug } from '../shared/types.js';

const fileDrop = document.getElementById('file-drop')!;
const browseBtn = document.getElementById('browse-btn')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const importStatus = document.getElementById('import-status')!;
const profileSummary = document.getElementById('profile-summary')!;

const currentProfile = document.getElementById('current-profile')!;
const profileActions = document.getElementById('profile-actions')!;
const clearProfileBtn = document.getElementById('clear-profile')!;

// Load existing settings
async function init() {
  const settings = await getSettings();

  if (settings.profile) {
    renderCurrentProfile(settings.profile);
  }
}

// File import via drag & drop
fileDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileDrop.classList.add('border-zinc-400', 'bg-zinc-50');
});

fileDrop.addEventListener('dragleave', () => {
  fileDrop.classList.remove('border-zinc-400', 'bg-zinc-50');
});

fileDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDrop.classList.remove('border-zinc-400', 'bg-zinc-50');

  const file = e.dataTransfer?.files[0];
  if (file) handleFile(file);
});

browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
});

async function handleFile(file: File) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate structure
    if (!data.profile || !data.profile.skills_expert) {
      throw new Error('Invalid profile export file. Run "pnpm seer export" to generate.');
    }

    const profile: ParsedProfile = data.profile;
    const baseResumeSummaries: Record<BaseResumeSlug, string> = data.baseResumeSummaries;
    const prompts: Record<BaseResumeSlug, string> = data.prompts || {};

    await saveSettings({
      profile,
      baseResumeSummaries,
      prompts,
    });

    showStatus(importStatus, 'Profile imported successfully.', 'success');
    await loadPrompts();

    // Show summary
    profileSummary.classList.remove('hidden');
    profileSummary.innerHTML = `
      <div class="mt-4 rounded-lg bg-zinc-50 border border-zinc-200 divide-y divide-zinc-100">
        <div class="flex justify-between px-4 py-2.5 text-sm">
          <span class="text-zinc-500">Expert skills</span>
          <span class="font-medium text-zinc-800">${profile.skills_expert.length}</span>
        </div>
        <div class="flex justify-between px-4 py-2.5 text-sm">
          <span class="text-zinc-500">Proficient skills</span>
          <span class="font-medium text-zinc-800">${profile.skills_proficient.length}</span>
        </div>
        <div class="flex justify-between px-4 py-2.5 text-sm">
          <span class="text-zinc-500">Familiar skills</span>
          <span class="font-medium text-zinc-800">${profile.skills_familiar.length}</span>
        </div>
        <div class="flex justify-between px-4 py-2.5 text-sm">
          <span class="text-zinc-500">Experience</span>
          <span class="font-medium text-zinc-800">${profile.experience_years} years</span>
        </div>
        <div class="flex justify-between px-4 py-2.5 text-sm">
          <span class="text-zinc-500">Prompt templates</span>
          <span class="font-medium text-zinc-800">${Object.values(prompts).filter(p => p.length > 0).length}/3</span>
        </div>
      </div>
    `;

    renderCurrentProfile(profile);
  } catch (err: any) {
    showStatus(importStatus, err.message || 'Failed to import file.', 'error');
  }
}

function renderCurrentProfile(profile: ParsedProfile) {
  currentProfile.innerHTML = `
    <div class="rounded-lg bg-zinc-50 border border-zinc-200 divide-y divide-zinc-100">
      <div class="flex justify-between px-4 py-2.5 text-sm">
        <span class="text-zinc-500">Expert skills</span>
        <span class="font-medium text-zinc-800">${profile.skills_expert.length} <span class="text-zinc-400 font-normal">(${profile.skills_expert.slice(0, 5).join(', ')}${profile.skills_expert.length > 5 ? '...' : ''})</span></span>
      </div>
      <div class="flex justify-between px-4 py-2.5 text-sm">
        <span class="text-zinc-500">Proficient skills</span>
        <span class="font-medium text-zinc-800">${profile.skills_proficient.length}</span>
      </div>
      <div class="flex justify-between px-4 py-2.5 text-sm">
        <span class="text-zinc-500">Familiar skills</span>
        <span class="font-medium text-zinc-800">${profile.skills_familiar.length}</span>
      </div>
      <div class="flex justify-between px-4 py-2.5 text-sm">
        <span class="text-zinc-500">Experience</span>
        <span class="font-medium text-zinc-800">${profile.experience_years} years</span>
      </div>
      <div class="flex justify-between px-4 py-2.5 text-sm">
        <span class="text-zinc-500">Titles</span>
        <span class="font-medium text-zinc-800">${profile.titles_held.join(', ') || 'None'}</span>
      </div>
    </div>
  `;
  profileActions.classList.remove('hidden');
}

clearProfileBtn.addEventListener('click', async () => {
  await saveSettings({
    profile: null,
    prompts: { gen_ai: '', mle: '', mix: '' },
  });
  currentProfile.innerHTML = '<p class="text-sm text-zinc-400">No profile loaded.</p>';
  profileActions.classList.add('hidden');
  profileSummary.classList.add('hidden');
  showStatus(importStatus, 'Profile cleared.', 'success');
  await loadPrompts();
});

function showStatus(el: HTMLElement, message: string, type: 'success' | 'error') {
  el.textContent = message;
  el.className = type === 'success'
    ? 'mt-3 text-sm rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'mt-3 text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200';
  setTimeout(() => { el.className = 'mt-3 text-sm rounded-lg px-3 py-2 hidden'; }, 4000);
}

// ─── Prompt management ────────────────────────────────────────────────

const promptsList = document.getElementById('prompts-list')!;

/** Map from prompt key → current saved value (empty = use default). */
let promptValues: Record<string, string> = {};

async function loadPrompts() {
  const settings = await getSettings();
  const systemOverrides = await getSystemPrompts();

  promptValues = {};

  for (const meta of PROMPT_REGISTRY) {
    if (meta.category === 'system') {
      promptValues[meta.key] = systemOverrides[meta.key] || '';
    } else {
      // Claude templates: map key to storage slug
      const slug = meta.key.replace('claude_', '') as BaseResumeSlug;
      promptValues[meta.key] = settings.prompts[slug] || '';
    }
  }

  renderPromptCards();
}

function renderPromptCards() {
  promptsList.innerHTML = '';

  for (const meta of PROMPT_REGISTRY) {
    const saved = promptValues[meta.key];
    const displayValue = saved || meta.defaultValue;
    const isModified = meta.category === 'system' && !!saved;
    const isEmpty = !displayValue;

    const card = document.createElement('div');
    card.className = 'rounded-lg border border-zinc-200 bg-zinc-50/50 overflow-hidden';
    card.dataset.key = meta.key;

    const categoryClass = meta.category === 'system'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-violet-50 text-violet-700 border-violet-200';

    card.innerHTML = `
      <div class="flex items-center justify-between px-4 py-3 cursor-pointer select-none" data-toggle>
        <div class="flex items-center gap-2.5">
          <svg class="w-3.5 h-3.5 text-zinc-400 transition-transform duration-200" data-chevron fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span class="text-sm font-medium text-zinc-800">${meta.title}</span>
          ${isModified ? '<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Modified</span>' : ''}
          <span class="text-[10px] font-medium px-1.5 py-0.5 rounded border ${categoryClass}">${meta.category}</span>
        </div>
        <button class="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors px-2 py-1 cursor-pointer" data-edit-btn>Edit</button>
      </div>
      <div class="hidden" data-body>
        <div class="px-4 pb-4">
          <p class="text-xs text-zinc-400 mb-3">${meta.description}</p>
          ${isEmpty
            ? '<p class="text-xs italic text-zinc-400 py-4 text-center">No template loaded. Import a profile to populate.</p>'
            : `<div class="rounded-lg overflow-hidden border border-zinc-800">
                <textarea readonly class="editor-textarea w-full px-4 py-3 text-xs font-mono leading-relaxed bg-zinc-900 text-zinc-300 focus:outline-none">${escapeHtml(displayValue)}</textarea>
              </div>`
          }
        </div>
      </div>
    `;

    // Toggle expand/collapse
    const toggleEl = card.querySelector('[data-toggle]')!;
    const bodyEl = card.querySelector('[data-body]')!;
    const chevron = card.querySelector('[data-chevron]') as HTMLElement;
    const editBtn = card.querySelector('[data-edit-btn]') as HTMLButtonElement;

    toggleEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-edit-btn]')) return;
      bodyEl.classList.toggle('hidden');
      chevron.style.transform = bodyEl.classList.contains('hidden') ? '' : 'rotate(90deg)';
    });

    editBtn.addEventListener('click', () => {
      // Expand if collapsed
      if (bodyEl.classList.contains('hidden')) {
        bodyEl.classList.remove('hidden');
        chevron.style.transform = 'rotate(90deg)';
      }
      enterEditMode(card, meta);
    });

    promptsList.appendChild(card);
  }
}

function enterEditMode(card: HTMLElement, meta: typeof PROMPT_REGISTRY[number]) {
  const saved = promptValues[meta.key];
  const displayValue = saved || meta.defaultValue;
  const bodyEl = card.querySelector('[data-body]')!;

  const resetOrClear = meta.category === 'system'
    ? '<button class="text-xs font-medium text-red-400 hover:text-red-500 transition-colors cursor-pointer" data-reset-btn>Reset to Default</button>'
    : '<button class="text-xs font-medium text-red-400 hover:text-red-500 transition-colors cursor-pointer" data-clear-btn>Clear</button>';

  bodyEl.innerHTML = `
    <div class="px-4 pb-4">
      <p class="text-xs text-zinc-400 mb-3">${meta.description}</p>
      ${meta.variables && meta.variables.length > 0 ? `
        <div class="flex flex-wrap gap-1.5 mb-3" data-vars>
          ${meta.variables.map(v => `<button class="text-[10px] font-mono px-2 py-1 rounded bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200 hover:text-zinc-700 transition-colors cursor-pointer" data-var="{{${v}}}">{{${v}}}</button>`).join('')}
        </div>
      ` : ''}
      <div class="rounded-lg overflow-hidden border border-zinc-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
        <textarea class="editor-textarea w-full px-4 py-3 text-xs font-mono leading-relaxed bg-zinc-900 text-zinc-100 focus:outline-none placeholder:text-zinc-600" data-editor>${escapeHtml(displayValue)}</textarea>
      </div>
      <div class="flex items-center justify-between mt-3">
        <div class="flex gap-2">
          <button class="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer" data-save-btn>Save</button>
          <button class="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors cursor-pointer" data-cancel-btn>Cancel</button>
        </div>
        ${resetOrClear}
      </div>
    </div>
  `;

  const editor = bodyEl.querySelector('[data-editor]') as HTMLTextAreaElement;

  // Tab key inserts tab instead of moving focus
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
    }
  });

  // Variable chip insertion
  bodyEl.querySelectorAll('[data-var]').forEach(btn => {
    btn.addEventListener('click', () => {
      const varText = (btn as HTMLElement).dataset.var!;
      const start = editor.selectionStart;
      editor.value = editor.value.substring(0, start) + varText + editor.value.substring(editor.selectionEnd);
      editor.selectionStart = editor.selectionEnd = start + varText.length;
      editor.focus();
    });
  });

  // Wire buttons
  bodyEl.querySelector('[data-save-btn]')!.addEventListener('click', () => savePrompt(meta, editor));
  bodyEl.querySelector('[data-cancel-btn]')!.addEventListener('click', () => loadPrompts());

  const resetBtn = bodyEl.querySelector('[data-reset-btn]');
  if (resetBtn) resetBtn.addEventListener('click', () => resetPrompt(meta));

  const clearBtn = bodyEl.querySelector('[data-clear-btn]');
  if (clearBtn) clearBtn.addEventListener('click', () => clearClaudePrompt(meta));

  editor.focus();
}

async function savePrompt(meta: typeof PROMPT_REGISTRY[number], textarea: HTMLTextAreaElement) {
  const value = textarea.value;

  if (meta.category === 'system') {
    // If value matches default exactly, treat as "no override"
    if (value === meta.defaultValue) {
      await deleteSystemPrompt(meta.key);
      promptValues[meta.key] = '';
    } else {
      await saveSystemPrompt(meta.key, value);
      promptValues[meta.key] = value;
    }
  } else {
    const slug = meta.key.replace('claude_', '') as BaseResumeSlug;
    const settings = await getSettings();
    settings.prompts[slug] = value;
    await saveSettings({ prompts: settings.prompts });
    promptValues[meta.key] = value;
  }

  renderPromptCards();
}

async function resetPrompt(meta: typeof PROMPT_REGISTRY[number]) {
  await deleteSystemPrompt(meta.key);
  promptValues[meta.key] = '';
  renderPromptCards();
}

async function clearClaudePrompt(meta: typeof PROMPT_REGISTRY[number]) {
  const slug = meta.key.replace('claude_', '') as BaseResumeSlug;
  const settings = await getSettings();
  settings.prompts[slug] = '';
  await saveSettings({ prompts: settings.prompts });
  promptValues[meta.key] = '';
  renderPromptCards();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── PDF Generator download section ───────────────────────────────────

const GITHUB_REPO = 'theseer-app/theseer'; // Update this to your actual repo

function initPdfGenerator() {
  const downloadDiv = document.getElementById('pdf-gen-download')!;
  const statusDiv = document.getElementById('pdf-gen-status')!;
  const extIdInput = document.getElementById('ext-id-display') as HTMLInputElement;

  // Show extension ID
  extIdInput.value = chrome.runtime.id;

  // Detect user's OS
  const ua = navigator.userAgent.toLowerCase();
  let detectedOs = 'unknown';
  if (ua.includes('mac')) detectedOs = 'macos';
  else if (ua.includes('win')) detectedOs = 'windows';

  const assets = [
    { os: 'macos', label: 'macOS (Apple Silicon)', file: 'theseer-pdf-macos-arm64.tar.gz' },
    { os: 'macos', label: 'macOS (Intel)', file: 'theseer-pdf-macos-x64.tar.gz' },
    { os: 'windows', label: 'Windows (x64)', file: 'theseer-pdf-windows-x64.zip' },
  ];

  // Fetch latest release URL
  fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`GitHub API: ${r.status}`)))
    .then((release: any) => {
      const tag = release.tag_name;
      statusDiv.innerHTML = `<span class="text-xs font-medium px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">${tag}</span>`;

      for (const asset of assets) {
        const ghAsset = release.assets?.find((a: any) => a.name === asset.file);
        const url = ghAsset?.browser_download_url
          || `https://github.com/${GITHUB_REPO}/releases/latest/download/${asset.file}`;
        const isRecommended = asset.os === detectedOs;
        renderDownloadBtn(downloadDiv, url, asset.label, isRecommended);
      }
    })
    .catch(() => {
      statusDiv.innerHTML = '<span class="text-xs text-zinc-400">Could not check for latest version.</span>';
      for (const asset of assets) {
        const url = `https://github.com/${GITHUB_REPO}/releases/latest/download/${asset.file}`;
        const isRecommended = asset.os === detectedOs;
        renderDownloadBtn(downloadDiv, url, asset.label, isRecommended);
      }
    });
}

function renderDownloadBtn(container: HTMLElement, url: string, label: string, recommended: boolean) {
  const btn = document.createElement('a');
  btn.href = url;
  btn.target = '_blank';
  btn.className = recommended
    ? 'text-xs font-medium px-3 py-2 rounded-lg no-underline bg-zinc-900 text-white hover:bg-zinc-800 transition-colors'
    : 'text-xs font-medium px-3 py-2 rounded-lg no-underline bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors border border-zinc-200';
  btn.textContent = recommended ? `${label} (Recommended)` : label;
  container.appendChild(btn);
}

// ─── Init ─────────────────────────────────────────────────────────────

async function initAll() {
  await init();
  await loadPrompts();
  initPdfGenerator();
}

initAll();
