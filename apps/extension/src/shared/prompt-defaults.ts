export interface PromptMeta {
  key: string;
  title: string;
  description: string;
  category: 'system' | 'claude';
  defaultValue: string;
  variables?: string[];
}

export const PROMPT_REGISTRY: PromptMeta[] = [
  {
    key: 'grok_extraction',
    title: 'Grok Extraction + Fit',
    description: 'Extracts job data and performs fit analysis via Grok when no JSON-LD is available.',
    category: 'system',
    defaultValue: `You are The Seer, an expert resume strategist. Analyze this job posting and respond in EXACTLY the format below. Each field must be on its own line. Do not add any other text.

===PAGE===
URL: {{url}}
Title: {{pageTitle}}
{{jsonLdSection}}

===CONTENT===
{{rawText}}

===PROFILE===
Expert: {{skillsExpert}}
Proficient: {{skillsProficient}}
Familiar: {{skillsFamiliar}}
Experience: {{experienceYears}} years
Past titles: {{titlesHeld}}
Target titles: {{targetTitles}}
Deal-breakers: {{dealBreakers}}

===BASES===
gen_ai: {{baseSummaryGenAi}}
mle: {{baseSummaryMle}}
mix: {{baseSummaryMix}}
Pick gen_ai for LLM/GenAI/RAG roles, mle for ML infra/pipelines/MLOps, mix for broad AI/ML.

===RESPOND EXACTLY LIKE THIS===
JOB_TITLE: <title>
COMPANY: <company>
LOCATION: <location or Unknown>
SALARY: <salary or Unknown>
JOB_TYPE: <full-time/contract/etc or Unknown>
DESCRIPTION: <copy the FULL original job description verbatim, only remove nav/footer noise>
===END_DESCRIPTION===
REQUIREMENTS: <req1> | <req2> | <req3>
NICE_TO_HAVES: <nice1> | <nice2>
FIT_SCORE: <0-100>
CONFIDENCE: <0-100>
RECOMMENDED_BASE: <gen_ai or mle or mix>
BASE_REASONING: <1-2 sentences>
KEY_MATCHES: <match1> | <match2> | <match3>
GAPS: <gap1> | <gap2>
GAP_MITIGATION: <mitigation1> | <mitigation2>
TAILORING_PRIORITIES: <priority1> | <priority2>
ATS_KEYWORDS: <keyword1> | <keyword2> | <keyword3>
RED_FLAGS: <flag1> | <flag2>
COMPETITION: <low or medium or high>
RECOMMENDATION: <strong_yes or yes or maybe or no>`,
    variables: [
      'url', 'pageTitle', 'jsonLdSection', 'rawText',
      'skillsExpert', 'skillsProficient', 'skillsFamiliar',
      'experienceYears', 'titlesHeld', 'targetTitles', 'dealBreakers',
      'baseSummaryGenAi', 'baseSummaryMle', 'baseSummaryMix',
    ],
  },
  {
    key: 'gemini_extraction',
    title: 'Gemini Extraction + Fit',
    description: 'Extracts job data and performs fit analysis via Gemini API (fallback path).',
    category: 'system',
    defaultValue: `You are The Seer, an expert resume strategist and job market analyst.

Given the following page content from a job posting, perform TWO tasks in a single response:
1. EXTRACT structured job data from the content. CRITICAL: The "description" field must be the ORIGINAL job description copied VERBATIM from the posting. Only strip surrounding site noise (nav, sidebar, footer, other job listings). Do NOT rephrase, summarize, or rewrite any part of the JD.
2. ANALYZE fit against the candidate profile and select the optimal base resume

## Page Information
URL: {{url}}
Page Title: {{pageTitle}}
{{jsonLdSection}}
## Page Content (cleaned HTML \u2014 use the semantic structure to identify sections)
{{rawText}}

## Candidate Profile
- Expert skills (core strengths): {{skillsExpert}}
- Proficient skills: {{skillsProficient}}
- Familiar skills: {{skillsFamiliar}}
- Experience: {{experienceYears}} years
- Past titles: {{titlesHeld}}
- Target titles: {{targetTitles}}
- Deal-breakers: {{dealBreakers}}

## Base Resumes Available
1. gen_ai - {{baseSummaryGenAi}}
2. mle - {{baseSummaryMle}}
3. mix - {{baseSummaryMix}}

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
    "url": "{{url}}",
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
}`,
    variables: [
      'url', 'pageTitle', 'jsonLdSection', 'rawText',
      'skillsExpert', 'skillsProficient', 'skillsFamiliar',
      'experienceYears', 'titlesHeld', 'targetTitles', 'dealBreakers',
      'baseSummaryGenAi', 'baseSummaryMle', 'baseSummaryMix',
    ],
  },
  {
    key: 'gemini_fit_analysis',
    title: 'Gemini Deep Fit Analysis',
    description: 'Deep fit analysis via Gemini when structured job data IS available (JSON-LD path).',
    category: 'system',
    defaultValue: `You are The Seer, an expert resume strategist and job market analyst.

Analyze this job against the candidate profile. Determine fit and select the optimal base resume.

## Candidate Profile
- Expert skills (core strengths): {{skillsExpert}}
- Proficient skills: {{skillsProficient}}
- Familiar skills: {{skillsFamiliar}}
- Experience: {{experienceYears}} years
- Past titles: {{titlesHeld}}
- Target titles: {{targetTitles}}
- Deal-breakers: {{dealBreakers}}

## Job Description
Title: {{jobTitle}}
Company: {{jobCompany}}
Location: {{jobLocation}}
Type: {{jobType}}
Salary: {{jobSalary}}

{{jobDescription}}

{{jobRequirements}}
{{jobNiceToHaves}}

## Base Resumes Available
1. gen_ai - {{baseSummaryGenAi}}
2. mle - {{baseSummaryMle}}
3. mix - {{baseSummaryMix}}

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
}`,
    variables: [
      'skillsExpert', 'skillsProficient', 'skillsFamiliar',
      'experienceYears', 'titlesHeld', 'targetTitles', 'dealBreakers',
      'jobTitle', 'jobCompany', 'jobLocation', 'jobType', 'jobSalary',
      'jobDescription', 'jobRequirements', 'jobNiceToHaves',
      'baseSummaryGenAi', 'baseSummaryMle', 'baseSummaryMix',
    ],
  },
  {
    key: 'claude_gen_ai',
    title: 'Claude Resume \u2014 GenAI',
    description: 'Claude resume prompt for GenAI/LLM/RAG roles. Imported from profile export.',
    category: 'claude',
    defaultValue: '',
  },
  {
    key: 'claude_mle',
    title: 'Claude Resume \u2014 MLE',
    description: 'Claude resume prompt for ML Engineering/MLOps roles. Imported from profile export.',
    category: 'claude',
    defaultValue: '',
  },
  {
    key: 'claude_mix',
    title: 'Claude Resume \u2014 Generalist',
    description: 'Claude resume prompt for broad AI/ML generalist roles. Imported from profile export.',
    category: 'claude',
    defaultValue: '',
  },
];

/**
 * Replace {{key}} placeholders in a template with values from the vars object.
 * Unknown placeholders are left as-is.
 */
export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return key in vars ? vars[key] : `{{${key}}}`;
  });
}

/** Look up a prompt's default value by key. */
export function getDefaultPrompt(key: string): string {
  const meta = PROMPT_REGISTRY.find(p => p.key === key);
  return meta?.defaultValue ?? '';
}
