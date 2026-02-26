import type { SeerSettings, ScrapedJob } from './types.js';

const DEFAULT_SUMMARIES = {
  gen_ai: 'GenAI focused: LLMs, RAG, transformers, RLHF/DPO, fine-tuning, inference optimization (vLLM, TensorRT), foundation models',
  mle: 'ML Engineering focused: computer vision, reinforcement learning, sensor fusion, edge deployment, quantization, MLOps, production ML systems',
  mix: 'Generalist: combines GenAI + MLE strengths, full-stack ML from foundation models to edge deployment, broadest skill coverage',
};

export const DEFAULT_GROK_MODEL = 'Fast';
export const DEFAULT_CLAUDE_MODEL = 'Sonnet 4.5';

export async function getSettings(): Promise<SeerSettings> {
  const data: Record<string, any> = await chrome.storage.local.get([
    'geminiApiKey',
    'profile',
    'baseResumeSummaries',
    'prompts',
    'grokModel',
    'claudeModel',
    'claudeExtendedThinking',
    'seerContext',
  ]);
  return {
    geminiApiKey: (data.geminiApiKey as string) || '',
    profile: data.profile || null,
    baseResumeSummaries: data.baseResumeSummaries || DEFAULT_SUMMARIES,
    prompts: data.prompts || { gen_ai: '', mle: '', mix: '' },
    grokModel: (data.grokModel as string) || DEFAULT_GROK_MODEL,
    claudeModel: (data.claudeModel as string) || DEFAULT_CLAUDE_MODEL,
    claudeExtendedThinking: data.claudeExtendedThinking === true, // default off
    seerContext: data.seerContext === true, // default off
  };
}

export interface ModelPrefs {
  grokModel: string;
  claudeModel: string;
  claudeExtendedThinking: boolean;
  seerContext: boolean;
}

export async function getModelPrefs(): Promise<ModelPrefs> {
  const data: Record<string, any> = await chrome.storage.local.get(['grokModel', 'claudeModel', 'claudeExtendedThinking', 'seerContext']);
  return {
    grokModel: (data.grokModel as string) || DEFAULT_GROK_MODEL,
    claudeModel: (data.claudeModel as string) || DEFAULT_CLAUDE_MODEL,
    claudeExtendedThinking: data.claudeExtendedThinking === true,
    seerContext: data.seerContext === true, // default off
  };
}

export async function saveModelPrefs(prefs: ModelPrefs): Promise<void> {
  await chrome.storage.local.set(prefs);
}

export async function saveSettings(settings: Partial<SeerSettings>): Promise<void> {
  await chrome.storage.local.set(settings);
}

export async function saveCurrentJob(job: ScrapedJob): Promise<void> {
  await chrome.storage.local.set({ currentJob: job });
}

export async function getCurrentJob(): Promise<ScrapedJob | null> {
  const data: Record<string, any> = await chrome.storage.local.get('currentJob');
  return (data.currentJob as ScrapedJob) || null;
}

// ─── Per-tab job storage ──────────────────────────────────────────────

export async function saveJobForTab(tabId: number, job: ScrapedJob): Promise<void> {
  const data: Record<string, any> = await chrome.storage.local.get('tabJobs');
  const tabJobs: Record<string, ScrapedJob> = data.tabJobs || {};
  tabJobs[String(tabId)] = job;
  await chrome.storage.local.set({ tabJobs });
}

export async function getJobForTab(tabId: number): Promise<ScrapedJob | null> {
  const data: Record<string, any> = await chrome.storage.local.get('tabJobs');
  const tabJobs: Record<string, ScrapedJob> = data.tabJobs || {};
  return tabJobs[String(tabId)] || null;
}

export async function removeJobForTab(tabId: number): Promise<void> {
  const data: Record<string, any> = await chrome.storage.local.get('tabJobs');
  const tabJobs: Record<string, ScrapedJob> = data.tabJobs || {};
  delete tabJobs[String(tabId)];
  await chrome.storage.local.set({ tabJobs });
}

export async function isConfigured(): Promise<boolean> {
  const settings = await getSettings();
  return !!settings.profile;
}

export async function getEnabled(): Promise<boolean> {
  const data: Record<string, any> = await chrome.storage.local.get('seerEnabled');
  return data.seerEnabled !== false; // default on
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ seerEnabled: enabled });
}

// ─── System prompt overrides ──────────────────────────────────────────

export async function getSystemPrompts(): Promise<Record<string, string>> {
  const data: Record<string, any> = await chrome.storage.local.get('systemPrompts');
  return (data.systemPrompts as Record<string, string>) || {};
}

export async function saveSystemPrompt(key: string, value: string): Promise<void> {
  const current = await getSystemPrompts();
  current[key] = value;
  await chrome.storage.local.set({ systemPrompts: current });
}

export async function deleteSystemPrompt(key: string): Promise<void> {
  const current = await getSystemPrompts();
  delete current[key];
  await chrome.storage.local.set({ systemPrompts: current });
}
