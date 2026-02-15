import { GoogleGenerativeAI } from '@google/generative-ai';
import type { JobData, ParsedProfile, FitAnalysis, BaseResumeSlug } from './types.js';

export async function deepFitAnalysis(
  job: JobData,
  profile: ParsedProfile,
  baseResumeSummaries: Record<BaseResumeSlug, string>
): Promise<FitAnalysis> {

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Get a free key at https://ai.google.dev/gemini-api');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are The Seer, an expert resume strategist and job market analyst.

Analyze this job against the candidate profile. Determine fit and select the optimal base resume.

## Candidate Profile
- Expert skills (core strengths): ${profile.skills_expert.join(', ')}
- Proficient skills: ${profile.skills_proficient.join(', ')}
- Familiar skills: ${profile.skills_familiar.join(', ')}
- Experience: ${profile.experience_years} years
- Past titles: ${profile.titles_held.join(', ')}
- Target titles: ${profile.target_titles.join(', ') || 'Not specified'}
- Deal-breakers: ${profile.deal_breakers.join(', ') || 'None specified'}

## Job Description
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Type: ${job.job_type || 'Not specified'}
Salary: ${job.salary_range || 'Not specified'}

${job.description}

${job.requirements.length > 0 ? `Requirements:\n${job.requirements.map(r => `- ${r}`).join('\n')}` : ''}
${job.nice_to_haves.length > 0 ? `Nice to have:\n${job.nice_to_haves.map(r => `- ${r}`).join('\n')}` : ''}

## Base Resumes Available
1. gen_ai - ${baseResumeSummaries.gen_ai}
2. mle - ${baseResumeSummaries.mle}
3. mix - ${baseResumeSummaries.mix}

## Base Selection Strategy
- Heavy LLM/GenAI/RAG/agents/prompting -> gen_ai
- ML infra, pipelines, deployment, MLOps, computer vision, RL -> mle
- Mixed signals or broad "AI/ML" role -> mix
- GenAI title but heavy systems requirements -> mle (systems > title)
- MLE title but heavy LLM requirements -> gen_ai (content > title)

## Respond with ONLY valid JSON (no markdown fences):
{
  "fit_score": <0-100>,
  "confidence": <0-100>,
  "recommended_base": "<gen_ai|mle|mix>",
  "base_reasoning": "<1-2 sentences on why this base>",
  "key_matches": ["<matching skill/experience 1>", "..."],
  "gaps": ["<missing requirement 1>", "..."],
  "gap_mitigation": ["<how to frame gap 1 positively>", "..."],
  "tailoring_priorities": ["<what to emphasize>", "..."],
  "ats_keywords": ["<exact keywords from JD to include in resume>", "..."],
  "red_flags": ["<concerns about the role>"],
  "estimated_competition": "<low|medium|high>",
  "apply_recommendation": "<strong_yes|yes|maybe|no>"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Clean potential markdown code fences
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(cleaned) as FitAnalysis;
  } catch (e) {
    throw new Error(`Failed to parse Gemini response as JSON:\n${cleaned}\n\nError: ${e}`);
  }
}
