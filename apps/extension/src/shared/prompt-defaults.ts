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
