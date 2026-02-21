import { getSettings, saveSettings, getSystemPrompts, saveSystemPrompt, deleteSystemPrompt } from '../shared/storage.js';
import { PROMPT_REGISTRY, getDefaultPrompt } from '../shared/prompt-defaults.js';
import type { ParsedProfile, BaseResumeSlug } from '../shared/types.js';

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const saveKeyBtn = document.getElementById('save-key')!;
const keyStatus = document.getElementById('key-status')!;

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

  if (settings.geminiApiKey) {
    apiKeyInput.value = settings.geminiApiKey;
  }

  if (settings.profile) {
    renderCurrentProfile(settings.profile);
  }
}

// API Key save
saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus(keyStatus, 'Please enter an API key.', 'error');
    return;
  }

  await saveSettings({ geminiApiKey: key });
  showStatus(keyStatus, 'API key saved.', 'success');
});

// File import via drag & drop
fileDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileDrop.style.borderColor = '#3f3f46';
  fileDrop.style.background = '#fafafa';
});

fileDrop.addEventListener('dragleave', () => {
  fileDrop.style.borderColor = '#d1d5db';
  fileDrop.style.background = '';
});

fileDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDrop.style.borderColor = '#d1d5db';
  fileDrop.style.background = '';

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
    profileSummary.style.display = 'block';
    profileSummary.innerHTML = `
      <div class="stat">
        <span class="stat-label">Expert skills</span>
        <span class="stat-value">${profile.skills_expert.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Proficient skills</span>
        <span class="stat-value">${profile.skills_proficient.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Familiar skills</span>
        <span class="stat-value">${profile.skills_familiar.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Experience</span>
        <span class="stat-value">${profile.experience_years} years</span>
      </div>
      <div class="stat">
        <span class="stat-label">Prompt templates</span>
        <span class="stat-value">${Object.values(prompts).filter(p => p.length > 0).length}/3</span>
      </div>
    `;

    renderCurrentProfile(profile);
  } catch (err: any) {
    showStatus(importStatus, err.message || 'Failed to import file.', 'error');
  }
}

function renderCurrentProfile(profile: ParsedProfile) {
  currentProfile.innerHTML = `
    <div class="profile-summary">
      <div class="stat">
        <span class="stat-label">Expert skills</span>
        <span class="stat-value">${profile.skills_expert.length} (${profile.skills_expert.slice(0, 5).join(', ')}${profile.skills_expert.length > 5 ? '...' : ''})</span>
      </div>
      <div class="stat">
        <span class="stat-label">Proficient skills</span>
        <span class="stat-value">${profile.skills_proficient.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Familiar skills</span>
        <span class="stat-value">${profile.skills_familiar.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Experience</span>
        <span class="stat-value">${profile.experience_years} years</span>
      </div>
      <div class="stat">
        <span class="stat-label">Titles held</span>
        <span class="stat-value">${profile.titles_held.join(', ') || 'None'}</span>
      </div>
    </div>
  `;
  profileActions.style.display = 'flex';
}

clearProfileBtn.addEventListener('click', async () => {
  await saveSettings({
    profile: null,
    prompts: { gen_ai: '', mle: '', mix: '' },
  });
  currentProfile.innerHTML = '<p style="font-size: 14px; color: #9ca3af;">No profile loaded.</p>';
  profileActions.style.display = 'none';
  profileSummary.style.display = 'none';
  showStatus(importStatus, 'Profile cleared.', 'success');
  await loadPrompts();
});

function showStatus(el: HTMLElement, message: string, type: 'success' | 'error') {
  el.textContent = message;
  el.className = `status status-${type}`;
  setTimeout(() => { el.className = 'status'; }, 4000);
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
    card.className = 'prompt-card';
    card.dataset.key = meta.key;

    card.innerHTML = `
      <div class="prompt-header">
        <div>
          <span class="prompt-title">${meta.title}</span>
          ${isModified ? '<span class="prompt-modified-badge">Modified</span>' : ''}
          <span class="prompt-category prompt-category-${meta.category}">${meta.category}</span>
        </div>
        <div class="prompt-actions" data-mode="view">
          <button class="btn btn-secondary prompt-edit-btn">Edit</button>
        </div>
      </div>
      <p class="prompt-description">${meta.description}</p>
      ${isEmpty
        ? '<p class="prompt-empty">No template loaded. Import a profile to populate Claude templates.</p>'
        : `<textarea class="prompt-textarea" readonly>${escapeHtml(displayValue)}</textarea>`
      }
    `;

    const editBtn = card.querySelector('.prompt-edit-btn') as HTMLButtonElement;
    editBtn.addEventListener('click', () => enterEditMode(card, meta));

    promptsList.appendChild(card);
  }
}

function enterEditMode(card: HTMLElement, meta: typeof PROMPT_REGISTRY[number]) {
  const saved = promptValues[meta.key];
  const displayValue = saved || meta.defaultValue;

  // Replace card content with edit mode
  const actionsDiv = card.querySelector('.prompt-actions') as HTMLElement;
  actionsDiv.dataset.mode = 'edit';
  actionsDiv.innerHTML = `
    <button class="btn btn-primary prompt-save-btn">Save</button>
    <button class="btn btn-secondary prompt-cancel-btn">Cancel</button>
    ${meta.category === 'system'
      ? '<button class="btn btn-danger prompt-reset-btn">Reset to Default</button>'
      : '<button class="btn btn-danger prompt-clear-btn">Clear</button>'
    }
  `;

  // Ensure there's a textarea (may not exist if empty)
  let textarea = card.querySelector('.prompt-textarea') as HTMLTextAreaElement | null;
  const emptyMsg = card.querySelector('.prompt-empty');
  if (!textarea) {
    textarea = document.createElement('textarea');
    textarea.className = 'prompt-textarea';
    if (emptyMsg) emptyMsg.replaceWith(textarea);
    else card.querySelector('.prompt-description')!.insertAdjacentElement('afterend', textarea);
  }

  textarea.readOnly = false;
  textarea.value = displayValue;

  // Show variables hint for system prompts
  if (meta.variables && meta.variables.length > 0) {
    let varsHint = card.querySelector('.prompt-vars');
    if (!varsHint) {
      varsHint = document.createElement('p');
      varsHint.className = 'prompt-vars';
      textarea.insertAdjacentElement('afterend', varsHint);
    }
    varsHint.innerHTML = `Available: ${meta.variables.map(v => `<code>{{${v}}}</code>`).join(' ')}`;
  }

  // Wire buttons
  card.querySelector('.prompt-save-btn')!.addEventListener('click', () => savePrompt(card, meta, textarea!));
  card.querySelector('.prompt-cancel-btn')!.addEventListener('click', () => loadPrompts());

  const resetBtn = card.querySelector('.prompt-reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => resetPrompt(meta));

  const clearBtn = card.querySelector('.prompt-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => clearClaudePrompt(meta));
}

async function savePrompt(card: HTMLElement, meta: typeof PROMPT_REGISTRY[number], textarea: HTMLTextAreaElement) {
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

// ─── Init ─────────────────────────────────────────────────────────────

async function initAll() {
  await init();
  await loadPrompts();
}

initAll();
