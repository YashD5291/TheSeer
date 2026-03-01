// Re-declare types here to avoid importing from @the-seer/core (Node-only)
// These mirror packages/core/src/types.ts exactly

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

// Extraction result from content script scrapers
export interface ExtractionResult {
  success: boolean;
  /** Structured job data if found via JSON-LD */
  jobData: JobData | null;
  /** Raw page text fallback */
  rawText: string;
  /** JSON-LD data if found */
  jsonLd: any | null;
  url: string;
  pageTitle: string;
  /** Which tier succeeded */
  extractionMethod: 'json-ld' | 'embedded' | 'page-text' | 'iframe' | 'none';
  /** Cross-origin iframe URLs found on page (for background to fetch) */
  iframeUrls?: string[];
}

// Extension-specific types

export interface SeerSettings {
  profile: ParsedProfile | null;
  baseResumeSummaries: Record<BaseResumeSlug, string>;
  prompts: Record<BaseResumeSlug, string>;
  grokModel: string;
  claudeModel: string;
  claudeExtendedThinking: boolean;
  seerContext: boolean;
  dashboardUrl: string;
  promptIds: Record<string, string>;
}

export interface ScrapedJob {
  job: JobData;
  extraction: ExtractionResult | null;
  deepAnalysis: FitAnalysis | null;
  claudePrompt: string | null;
  scrapedAt: string;
}

// Messages between content script <-> background
export type MessageType =
  | { type: 'PAGE_EXTRACTED'; extraction: ExtractionResult }
  | { type: 'DEEP_ANALYSIS_RESULT'; result: FitAnalysis; job: JobData; model?: string; claudePrompt?: string }
  | { type: 'GENERATE_PROMPT'; job: JobData; analysis: FitAnalysis; tabId?: number }
  | { type: 'PROMPT_RESULT'; prompt: string }
  | { type: 'GET_CURRENT_JOB' }
  | { type: 'CURRENT_JOB_RESULT'; data: ScrapedJob | null }
  | { type: 'GET_JOB_FOR_TAB'; tabId: number }
  | { type: 'SEER_PDF_READY'; pdfPath: string; folderName: string }
  | { type: 'SEER_PDF_ERROR'; error: string }
  | { type: 'SEER_OPEN_PDF'; pdfPath: string }
  | { type: 'ERROR'; message: string };
