import { GoogleGenerativeAI } from '@google/generative-ai';
import type { JobData, ParsedProfile, FitAnalysis, BaseResumeSlug } from './types.js';

// Ordered by preference: quality first, then fast fallbacks
const MODELS = [
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
];

export interface GeminiResponse {
  text: string;
  model: string;
}

export async function callGemini(apiKey: string, prompt: string): Promise<GeminiResponse> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const errors: { model: string; message: string; isQuota: boolean }[] = [];

  // Round 1: Try each model once
  for (const modelName of MODELS) {
    try {
      console.log(`[Seer Gemini] Trying ${modelName} (${prompt.length} chars)...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log(`[Seer Gemini] ${modelName} OK (${text.length} chars)`);
      return { text, model: modelName };
    } catch (err: any) {
      const msg = err?.message || String(err);
      const status = err?.status || (msg.includes('429') ? 429 : 0);

      // Log the FULL error so we can debug
      console.log(`[Seer Gemini] ${modelName} FAILED (status ${status}): ${msg.slice(0, 200)}`);

      // Only mark as daily quota if the error explicitly mentions daily limit
      // Google returns "Resource has been exhausted" for ALL rate limits, so that alone is NOT enough
      const isQuota = msg.includes('limit: 0') ||
        (msg.includes('quota') && msg.includes('daily')) ||
        (msg.includes('RATE_LIMIT_EXCEEDED') && msg.includes('per day'));

      errors.push({ model: modelName, message: msg, isQuota });

      if (isQuota) {
        console.log(`[Seer Gemini] ${modelName} → daily quota exhausted, skipping`);
      } else {
        console.log(`[Seer Gemini] ${modelName} → retryable error, trying next model...`);
      }
      continue;
    }
  }

  // Round 2: All failed. Find models that were only rate-limited (not quota-exhausted) and retry one
  const retryable = errors.filter(e => !e.isQuota);
  if (retryable.length === 0) {
    console.error('[Seer Gemini] All models quota-exhausted:', errors.map(e => e.model).join(', '));
    throw new Error(
      `All Gemini models exhausted for today. Tried: ${errors.map(e => e.model).join(', ')}. Wait for daily reset or use a different API key.`
    );
  }

  const lastMsg = retryable[retryable.length - 1].message;
  const retryMatch = lastMsg.match(/retry in ([\d.]+)s/i);
  const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : 15;
  const retryModel = retryable[0].model;

  console.log(`[Seer Gemini] All models failed round 1. Waiting ${waitSec}s, then retrying ${retryModel}...`);
  await new Promise(r => setTimeout(r, waitSec * 1000));

  try {
    const genAI2 = new GoogleGenerativeAI(apiKey);
    const model = genAI2.getGenerativeModel({ model: retryModel });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log(`[Seer Gemini] Retry ${retryModel} OK (${text.length} chars)`);
    return { text, model: retryModel };
  } catch (err: any) {
    console.error(`[Seer Gemini] Retry ${retryModel} failed:`, err.message);
    throw new Error(`Gemini failed after retry. Last error: ${err.message?.slice(0, 150)}`);
  }
}

export interface CombinedResult {
  job: JobData;
  analysis: FitAnalysis;
  model: string;
}

/**
 * Single Gemini call that extracts structured job data from raw page content
 * AND performs fit analysis against the candidate profile.
 * Used when JSON-LD extraction fails and we only have raw text/HTML.
 */
export async function extractAndAnalyze(params: {
  rawText: string;
  jsonLd: any | null;
  profile: ParsedProfile;
  baseResumeSummaries: Record<BaseResumeSlug, string>;
  apiKey: string;
  url: string;
  pageTitle: string;
}): Promise<CombinedResult> {
  const { rawText, jsonLd, profile, baseResumeSummaries, apiKey, url, pageTitle } = params;

  const prompt = `You are The Seer, an expert resume strategist and job market analyst.

Given the following page content from a job posting, perform TWO tasks in a single response:
1. EXTRACT structured job data from the content. CRITICAL: The "description" field must be the ORIGINAL job description copied VERBATIM from the posting. Only strip surrounding site noise (nav, sidebar, footer, other job listings). Do NOT rephrase, summarize, or rewrite any part of the JD.
2. ANALYZE fit against the candidate profile and select the optimal base resume

## Page Information
URL: ${url}
Page Title: ${pageTitle}
${jsonLd ? `\n## Structured Data (JSON-LD - HIGH TRUST, prefer this over raw text)\n${JSON.stringify(jsonLd, null, 2)}\n` : ''}
## Page Content (cleaned HTML — use the semantic structure to identify sections)
${rawText.slice(0, 15000)}

## Candidate Profile
- Expert skills (core strengths): ${profile.skills_expert.join(', ')}
- Proficient skills: ${profile.skills_proficient.join(', ')}
- Familiar skills: ${profile.skills_familiar.join(', ')}
- Experience: ${profile.experience_years} years
- Past titles: ${profile.titles_held.join(', ')}
- Target titles: ${profile.target_titles.join(', ') || 'Not specified'}
- Deal-breakers: ${profile.deal_breakers.join(', ') || 'None specified'}

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
  "job": {
    "title": "<extracted job title>",
    "company": "<company name>",
    "url": "${url}",
    "location": "<location or null>",
    "salary_range": "<salary range or null>",
    "job_type": "<full-time/contract/etc or null>",
    "description": "<EXACT original job description text, copied verbatim from the posting. Remove ONLY site noise (navigation, sidebar jobs, footer, ads). Do NOT rephrase, summarize, or alter the JD in any way.>",
    "requirements": ["<requirement 1>", "..."],
    "nice_to_haves": ["<nice to have 1>", "..."],
    "platform": "gemini-extracted"
  },
  "analysis": {
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
  }
}`;

  const { text, model } = await callGemini(apiKey, prompt);
  const parsed = parseGeminiJson(text);

  if (!parsed.job?.title || parsed.analysis?.fit_score == null) {
    throw new Error('Incomplete Gemini response — missing job title or fit score');
  }
  parsed.job.requirements = parsed.job.requirements || [];
  parsed.job.nice_to_haves = parsed.job.nice_to_haves || [];
  parsed.analysis.key_matches = parsed.analysis.key_matches || [];
  parsed.analysis.gaps = parsed.analysis.gaps || [];
  parsed.analysis.gap_mitigation = parsed.analysis.gap_mitigation || [];
  parsed.analysis.tailoring_priorities = parsed.analysis.tailoring_priorities || [];
  parsed.analysis.ats_keywords = parsed.analysis.ats_keywords || [];
  parsed.analysis.red_flags = parsed.analysis.red_flags || [];
  return { ...parsed, model };
}

/**
 * Robust JSON parser for Gemini responses.
 * Handles: markdown fences, trailing commas, truncated responses, unescaped newlines in strings.
 */
function parseGeminiJson(raw: string): { job: JobData; analysis: FitAnalysis } {
  // Strip markdown fences
  let text = raw.replace(/```json\n?|\n?```/g, '').trim();

  // Extract JSON object if surrounded by other text
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    text = text.slice(jsonStart, jsonEnd + 1);
  }

  // Try parsing as-is first
  try {
    return JSON.parse(text);
  } catch { /* fall through to repairs */ }

  // Repair 1: Remove trailing commas before ] or }
  let repaired = text.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(repaired);
  } catch { /* fall through */ }

  // Repair 2: Fix unescaped newlines inside JSON string values
  repaired = repaired.replace(/"([^"]*?)"/gs, (_match, content: string) => {
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `"${escaped}"`;
  });

  try {
    return JSON.parse(repaired);
  } catch { /* fall through */ }

  // Repair 3: Response might be truncated — try to close open brackets
  let closable = repaired;
  const opens = (closable.match(/\[/g) || []).length;
  const closes = (closable.match(/\]/g) || []).length;
  const openBraces = (closable.match(/\{/g) || []).length;
  const closeBraces = (closable.match(/\}/g) || []).length;

  // Trim to last complete value (before a trailing incomplete string/key)
  closable = closable.replace(/,\s*"[^"]*$/, '');
  closable = closable.replace(/,\s*$/, '');

  for (let i = 0; i < opens - closes; i++) closable += ']';
  for (let i = 0; i < openBraces - closeBraces; i++) closable += '}';

  try {
    return JSON.parse(closable);
  } catch (e) {
    console.error('[Seer Gemini] All JSON repair attempts failed. Raw response (first 500):', raw.slice(0, 500));
    throw new Error(`Failed to parse Gemini response: ${e}`);
  }
}
