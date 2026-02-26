import type { JobData, FitAnalysis, BaseResumeSlug } from './types.js';

// Browser-compatible port of packages/core/src/prompt-builder.ts
export function buildClaudePrompt(params: {
  job: JobData;
  analysis: FitAnalysis;
  promptTemplate: string;
  selectedBase: BaseResumeSlug;
  includeContext?: boolean;
}): string {
  const { job, analysis, promptTemplate, includeContext = true } = params;

  const jdMarker = '## JOB DESCRIPTION:';
  const inputsEnd = '</inputs>';

  const jdIdx = promptTemplate.indexOf(jdMarker);
  const inputsEndIdx = promptTemplate.indexOf(inputsEnd, jdIdx > -1 ? jdIdx : 0);

  if (jdIdx === -1 || inputsEndIdx === -1) {
    let prompt = promptTemplate + formatJDSection(job);
    if (includeContext) prompt += formatStrategicContext(analysis);
    return prompt;
  }

  const before = promptTemplate.slice(0, jdIdx + jdMarker.length);
  const after = promptTemplate.slice(inputsEndIdx);

  let prompt = `${before}\n${formatJobDescription(job)}\n${after}`;
  if (includeContext) prompt += formatStrategicContext(analysis);

  return prompt;
}

function formatJobDescription(job: JobData): string {
  let jd = '';
  if (job.title) jd += `${job.title}\n`;
  if (job.company) jd += `${job.company}\n`;
  if (job.location) jd += `${job.location}\n`;
  if (job.salary_range) jd += `${job.salary_range}\n`;
  jd += '\n';
  jd += job.description;

  if (job.requirements.length > 0) {
    jd += `\n\nRequirements:\n${job.requirements.map(r => `- ${r}`).join('\n')}`;
  }
  if (job.nice_to_haves.length > 0) {
    jd += `\n\nNice to have:\n${job.nice_to_haves.map(r => `- ${r}`).join('\n')}`;
  }
  return jd;
}

function formatJDSection(job: JobData): string {
  return `\n\n## JOB DESCRIPTION:\n${formatJobDescription(job)}\n`;
}

function formatStrategicContext(analysis: FitAnalysis): string {
  return `

## Strategic Context from The Seer
The following analysis was performed to optimize this resume for maximum impact:

- **Fit Score:** ${analysis.fit_score}/100 (Confidence: ${analysis.confidence}%)
- **Recommended Base:** ${analysis.recommended_base} - ${analysis.base_reasoning}
- **ATS Keywords** (MUST appear verbatim in resume): ${analysis.ats_keywords.join(', ')}
- **Key Strengths to Emphasize:** ${analysis.key_matches.join(', ')}
- **Gaps to Mitigate:** ${analysis.gap_mitigation.join('; ')}
- **Tailoring Priorities:** ${analysis.tailoring_priorities.join('; ')}
- **Estimated Competition:** ${analysis.estimated_competition}
- **Apply Recommendation:** ${analysis.apply_recommendation}

Use these insights to make the resume as targeted as possible for this specific role.`;
}
