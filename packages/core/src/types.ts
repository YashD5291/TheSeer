export type BaseResumeSlug = 'gen_ai' | 'mle' | 'mix';

export interface JobData {
  title: string;
  company: string;
  url?: string;
  location?: string;
  salary_range?: string;
  job_type?: string;
  description: string;
  requirements: string[];
  nice_to_haves: string[];
  platform?: string;
}

export interface ParsedProfile {
  skills_expert: string[];
  skills_proficient: string[];
  skills_familiar: string[];
  experience_years: number;
  titles_held: string[];
  target_titles: string[];
  target_industries: string[];
  deal_breakers: string[];
  location_preferences: Record<string, boolean>;
}

export interface FitAnalysis {
  fit_score: number;
  confidence: number;
  recommended_base: BaseResumeSlug;
  base_reasoning: string;
  key_matches: string[];
  gaps: string[];
  gap_mitigation: string[];
  tailoring_priorities: string[];
  ats_keywords: string[];
  red_flags: string[];
  estimated_competition: 'low' | 'medium' | 'high';
  apply_recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no';
}

export interface TailoredResume {
  chat_title: string;
  tailored_text: string;
  customization_notes: string;
  interview_prep: string[];
}

export interface GenerationResult {
  job: JobData;
  analysis: FitAnalysis;
  resume: TailoredResume;
  claude_chat_url?: string;
  pdf_url?: string;
}

export interface QuickFitResult {
  score: number;
  pass: boolean;
  matched: string[];
  missing: string[];
  deal_breaker_hit?: string;
}
