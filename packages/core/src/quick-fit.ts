import type { JobData, ParsedProfile, QuickFitResult } from './types.js';

export function quickFitCheck(
  job: JobData,
  profile: ParsedProfile
): QuickFitResult {
  const jdLower = (job.description + ' ' + job.requirements.join(' ') + ' ' + job.nice_to_haves.join(' ')).toLowerCase();

  // Deal-breaker check — instant reject
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
      // Only count skills that appear in the JD
      if (jdLower.includes(skill.toLowerCase())) {
        score += w;
        maxScore += w;
        matched.push(skill);
      }
      // Don't penalize for skills the JD doesn't mention
    }
  }

  // Also check what the JD asks for that we didn't match
  // Extract JD keywords and see which of our skills are missing from JD
  const allSkills = [
    ...profile.skills_expert,
    ...profile.skills_proficient,
    ...profile.skills_familiar,
  ];

  for (const skill of allSkills) {
    if (!jdLower.includes(skill.toLowerCase())) {
      // This skill of ours isn't in the JD (not necessarily a gap)
    }
  }

  // Normalize: what % of matched skills (weighted) vs total possible from JD mentions
  const normalizedScore = maxScore > 0
    ? Math.round((score / maxScore) * 100)
    : 50;

  // Bonus: title match
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
