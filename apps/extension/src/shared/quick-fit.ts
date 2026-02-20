import type { JobData, ParsedProfile, QuickFitResult } from './types.js';

// Browser-compatible port of packages/core/src/quick-fit.ts
export function quickFitCheck(
  job: JobData,
  profile: ParsedProfile
): QuickFitResult {
  const jdLower = (
    job.description + ' ' +
    job.requirements.join(' ') + ' ' +
    job.nice_to_haves.join(' ')
  ).toLowerCase();

  // Deal-breaker check
  for (const breaker of profile.deal_breakers) {
    if (jdLower.includes(breaker.toLowerCase())) {
      return {
        score: 0,
        pass: false,
        matched: [],
        missing: [],
        deal_breaker_hit: breaker,
      };
    }
  }

  // Weighted skill matching
  let score = 0;
  let maxScore = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  const weights = { expert: 3, proficient: 2, familiar: 1 };

  const skillGroups = {
    expert: profile.skills_expert,
    proficient: profile.skills_proficient,
    familiar: profile.skills_familiar,
  };

  for (const [level, skills] of Object.entries(skillGroups)) {
    const w = weights[level as keyof typeof weights];
    for (const skill of skills) {
      if (jdLower.includes(skill.toLowerCase())) {
        score += w;
        maxScore += w;
        matched.push(skill);
      }
    }
  }

  const normalizedScore = maxScore > 0
    ? Math.round((score / maxScore) * 100)
    : 50;

  // Title match bonus
  let titleBonus = 0;
  for (const title of profile.target_titles) {
    if (jdLower.includes(title.toLowerCase())) {
      titleBonus = 10;
      break;
    }
  }
  for (const title of profile.titles_held) {
    if (jdLower.includes(title.toLowerCase())) {
      titleBonus = Math.max(titleBonus, 5);
      break;
    }
  }

  const finalScore = Math.min(100, normalizedScore + titleBonus);

  return {
    score: finalScore,
    pass: finalScore >= 40,
    matched,
    missing,
  };
}
