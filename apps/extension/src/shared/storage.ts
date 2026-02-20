import type { SeerSettings, ScrapedJob } from './types.js';

const DEFAULT_SUMMARIES = {
  gen_ai: 'GenAI focused: LLMs, RAG, transformers, RLHF/DPO, fine-tuning, inference optimization (vLLM, TensorRT), foundation models',
  mle: 'ML Engineering focused: computer vision, reinforcement learning, sensor fusion, edge deployment, quantization, MLOps, production ML systems',
  mix: 'Generalist: combines GenAI + MLE strengths, full-stack ML from foundation models to edge deployment, broadest skill coverage',
};

export async function getSettings(): Promise<SeerSettings> {
  const data: Record<string, any> = await chrome.storage.local.get([
    'geminiApiKey',
    'profile',
    'baseResumeSummaries',
    'prompts',
  ]);
  return {
    geminiApiKey: (data.geminiApiKey as string) || '',
    profile: data.profile || null,
    baseResumeSummaries: data.baseResumeSummaries || DEFAULT_SUMMARIES,
    prompts: data.prompts || { gen_ai: '', mle: '', mix: '' },
  };
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
