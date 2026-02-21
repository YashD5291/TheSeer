import { callGemini } from './gemini-client.js';
import type { JobData, ParsedProfile, FitAnalysis, BaseResumeSlug } from './types.js';
import { getDefaultPrompt, interpolateTemplate } from './prompt-defaults.js';
import { getSystemPrompts } from './storage.js';

export interface DeepFitResult {
  analysis: FitAnalysis;
  model: string;
}

export async function deepFitAnalysis(
  job: JobData,
  profile: ParsedProfile,
  baseResumeSummaries: Record<BaseResumeSlug, string>,
  apiKey: string
): Promise<DeepFitResult> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Go to extension Options to set it.');
  }

  const overrides = await getSystemPrompts();
  const template = overrides['gemini_fit_analysis'] || getDefaultPrompt('gemini_fit_analysis');

  const vars: Record<string, string> = {
    skillsExpert: profile.skills_expert.join(', '),
    skillsProficient: profile.skills_proficient.join(', '),
    skillsFamiliar: profile.skills_familiar.join(', '),
    experienceYears: String(profile.experience_years),
    titlesHeld: profile.titles_held.join(', '),
    targetTitles: profile.target_titles.join(', ') || 'Not specified',
    dealBreakers: profile.deal_breakers.join(', ') || 'None specified',
    jobTitle: job.title,
    jobCompany: job.company,
    jobLocation: job.location || 'Not specified',
    jobType: job.job_type || 'Not specified',
    jobSalary: job.salary_range || 'Not specified',
    jobDescription: job.description,
    jobRequirements: job.requirements.length > 0
      ? `Requirements:\n${job.requirements.map(r => `- ${r}`).join('\n')}`
      : '',
    jobNiceToHaves: job.nice_to_haves.length > 0
      ? `Nice to have:\n${job.nice_to_haves.map(r => `- ${r}`).join('\n')}`
      : '',
    baseSummaryGenAi: baseResumeSummaries.gen_ai,
    baseSummaryMle: baseResumeSummaries.mle,
    baseSummaryMix: baseResumeSummaries.mix,
  };

  const prompt = interpolateTemplate(template, vars);
  const { text, model } = await callGemini(apiKey, prompt);
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  try {
    const analysis = JSON.parse(cleaned) as FitAnalysis;
    return { analysis, model };
  } catch (e) {
    throw new Error(`Failed to parse Gemini response: ${e}`);
  }
}
