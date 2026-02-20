import { getSettings, saveSettings } from '../shared/storage.js';
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
  fileDrop.style.borderColor = '#6366f1';
  fileDrop.style.background = '#f5f3ff';
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
});

function showStatus(el: HTMLElement, message: string, type: 'success' | 'error') {
  el.textContent = message;
  el.className = `status status-${type}`;
  setTimeout(() => { el.className = 'status'; }, 4000);
}

init();
