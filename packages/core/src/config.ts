import path from 'path';
import { fileURLToPath } from 'url';
import type { BaseResumeSlug } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CONFIG = {
  dataDir: path.resolve(__dirname, '../../../data'),

  files: {
    careerStory: 'career-story.md',
    resumes: {
      gen_ai: 'resumes/gen-ai.md',
      mle: 'resumes/mle.md',
      mix: 'resumes/mix.md',
    } as Record<BaseResumeSlug, string>,
    prompts: {
      gen_ai: 'prompts/gen-ai.md',
      mle: 'prompts/mle.md',
      mix: 'prompts/mix.md',
    } as Record<BaseResumeSlug, string>,
  },

  fitThreshold: 40,

  baseResumeSummaries: {
    gen_ai: 'GenAI focused: LLMs, RAG, transformers, RLHF/DPO, fine-tuning, inference optimization (vLLM, TensorRT), foundation models',
    mle: 'ML Engineering focused: computer vision, reinforcement learning, sensor fusion, edge deployment, quantization, MLOps, production ML systems',
    mix: 'Generalist: combines GenAI + MLE strengths, full-stack ML from foundation models to edge deployment, broadest skill coverage',
  } as Record<BaseResumeSlug, string>,
};

export function getDataPath(relativePath: string): string {
  return path.join(CONFIG.dataDir, relativePath);
}
