# The Seer — Implementation Blueprint

---

## What I Need From You

Drop these files into a folder and share them. No forms, no manual data entry.

| # | File | Format | What We Extract |
|---|---|---|---|
| 1 | Career story | `.md` | Years of experience, career trajectory, industries, titles, preferences, deal-breakers |
| 2 | Gen AI resume | `.md` | Skills, tech stack, projects, experience bullets |
| 3 | MLE resume | `.md` | Same — cross-referenced with #2 for skill proficiency |
| 4 | Mix resume | `.md` | Same — skills appearing in all 3 = expert tier |
| 5 | Prompt for Gen AI | `.md` | Stored as-is, injected during Claude.ai generation |
| 6 | Prompt for MLE | `.md` | Same |
| 7 | Prompt for Mix | `.md` | Same |
| 8 | LaTeX template | `.tex` + sample `.pdf` | Resume compilation template |
| 9 | Job platforms you use most | Just tell me | Prioritize scraper development |
| 10 | Chat title format preference | Just tell me | e.g. "Google - Senior MLE" or "2025-02-15_Google_SeniorMLE" |

---

## How It Works

```
You open a job page
       │
       ▼
Extension content script scrapes JD automatically (what if we give a floating button to run the fit check, bcz i dont only use job boards but career pages also so its kinda hard to define platforms)
       │
       ▼
Pass 1: Local keyword match (<100ms, no API)
  └─ Badge on extension icon: "82" (green) or "32" (red)
       │
       ▼
You click extension icon → popup shows fit preview
       │
       ▼
You click "Create Tailored Resume"
       │
       ▼
┌─────────────────────────────────────────────┐
│  AUTOMATED PIPELINE (~45-75 seconds)        │
│                                             │
│  1. Scrape JD from page                     │
│  2. Gemini API: deep fit analysis           │
│     → fit score, base selection,            │
│       ATS keywords, gap mitigation          │
│  3. Build tailored prompt using:            │
│     → selected base resume                  │
│     → its matching prompt template          │
│     → strategic context from Gemini         │
│  4. Open claude.ai tab (your RMS project)   │
│  5. Inject prompt into chat                 │
│  6. Click send                              │
│  7. Wait for response to finish streaming   │
│  8. Extract tailored resume from response   │
│  9. Save job + resume to Supabase           │
│  10. Compile LaTeX → PDF                    │
│  11. Upload PDF to Supabase storage         │
└─────────────────────────────────────────────┘
       │
       ▼
Extension popup: "Resume Ready!"
  ├─ Download PDF
  ├─ View in Dashboard
  ├─ Open Claude Chat (for manual iteration)
  └─ Regenerate
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BROWSER EXTENSION (Chrome, Manifest V3)         │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────────┐│
│  │JD Scraper│→│ Local Fit     │→│ "Create Tailored Resume"       ││
│  │(content  │  │ Check (Pass 1)│  │  Button                       ││
│  │ script)  │  │ No API needed │  │                                ││
│  └──────────┘  └──────────────┘  └──────────┬─────────────────────┘│
│                                              │                      │
│  ┌───────────────────────────────────────────▼─────────────────────┐│
│  │  GEMINI API (free)                                              ││
│  │  Deep fit analysis → score, base selection, ATS keywords        ││
│  └───────────────────────────────────────────┬─────────────────────┘│
│                                              │                      │
│  ┌───────────────────────────────────────────▼─────────────────────┐│
│  │  CLAUDE.AI AUTOMATION ENGINE                                    ││
│  │  Opens tab → injects prompt → sends → waits → extracts         ││
│  └───────────────────────────────────────────┬─────────────────────┘│
│                                              │                      │
│  ┌───────────────────────────────────────────▼─────────────────────┐│
│  │  POST-PROCESSING                                                ││
│  │  Parse response → save to Supabase → compile PDF → done        ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Next.js on Vercel, free)               │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────────┐ │
│  │ /api/jobs      │  │ /api/compile   │  │ /api/profile          │ │
│  │ CRUD + search  │  │ LaTeX → PDF    │  │ Auto-parsed profile   │ │
│  └───────┬───────┘  └───────┬───────┘  └────────────┬───────────┘ │
│          │                  │                        │             │
│  ┌───────▼──────────────────▼────────────────────────▼───────────┐ │
│  │                    Supabase (free tier)                        │ │
│  │  Jobs · Resumes · Profile · PDFs · Analytics                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              Dashboard (Next.js Frontend)                     │ │
│  │  Job tracker · Resume viewer · Analytics · Settings           │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Cost |
|---|---|---|
| Browser Extension | TypeScript, Chrome Manifest V3, Plasmo | Free |
| Fit Analysis | Gemini 2.0 Flash API (free tier: 15 RPM, 1M TPD) | $0 |
| Resume Tailoring | Your existing claude.ai subscription (automated) | $0 extra |
| Backend API | Next.js API Routes on Vercel | $0 |
| Database | Supabase Postgres (free tier) | $0 |
| File Storage | Supabase Storage (free tier) | $0 |
| LaTeX Compilation | tinyTeX on Railway or Fly.io | $0-5/mo |
| Dashboard | Next.js + Tailwind + shadcn/ui on Vercel | $0 |
| **Total** | | **$0-5/mo** |

---

## Auto-Profile Extraction

Instead of manually listing your skills, we parse your files automatically.

```
career-story.md + gen-ai.md + mle.md + mix.md
                        │
                        ▼
                 Profile Parser
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Skills from      Experience       Preferences
   3 resumes        from career      from career
                    story            story
        │               │               │
        ▼               ▼               ▼
  In all 3 = expert  Titles held     Deal-breakers
  In 2 = proficient  Years counted   Location prefs
  In 1 = familiar    Companies       Target roles
```

Generated once, stored in Supabase, editable in dashboard settings.

---

## Phase Plan

```
Phase 1 ─ Foundation (profile parser + prompt builder + CLI)
   │       "I can parse my files, test fit scoring, and verify prompt quality"
   │
Phase 2 ─ Chrome Extension + Gemini + Claude.ai Automation
   │       "One click on a job page generates a tailored resume"
   │
Phase 3 ─ LaTeX Pipeline
   │       "One click gives me a finished PDF"
   │
Phase 4 ─ Dashboard
   │       "I can track all jobs, view resumes, see analytics"
   │
Phase 5 ─ Intelligence Layer
           "The system learns what works and gets smarter"
```

Each phase is independently useful.

---

## Phase 1 — Foundation

**Goal:** Parse your files, build profile, generate prompts, test quality.
**Time:** 3-4 days
**You get:** CLI tool to verify everything works before building automation.

### 1.1 Project Structure

```
the-seer/
├── apps/
│   ├── web/                          # Next.js dashboard (Phase 4)
│   └── extension/                    # Chrome extension (Phase 2)
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── profile-parser.ts     # Parses your md files → profile
│   │   │   ├── fit-analyzer.ts       # Gemini API fit analysis
│   │   │   ├── prompt-builder.ts     # Builds claude.ai prompt
│   │   │   ├── response-parser.ts    # Parses Claude's response
│   │   │   ├── quick-fit.ts          # Local Pass 1 scoring (no API)
│   │   │   ├── types.ts
│   │   │   └── config.ts
│   │   └── package.json
│   ├── db/
│   │   ├── schema.sql
│   │   └── client.ts
│   └── cli/
│       └── src/
│           └── index.ts
├── data/                             # YOUR FILES GO HERE
│   ├── career-story.md
│   ├── resumes/
│   │   ├── gen-ai.md
│   │   ├── mle.md
│   │   └── mix.md
│   ├── prompts/
│   │   ├── gen-ai.md
│   │   ├── mle.md
│   │   └── mix.md
│   └── templates/
│       ├── resume.tex
│       └── sample-output.pdf
├── turbo.json
├── package.json
└── .env.local
```

### 1.2 Types

```typescript
// packages/core/src/types.ts

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
  location_preferences: Record<string, any>;
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
```

### 1.3 Database Schema

```sql
-- ============================================
-- THE SEER — Database Schema
-- ============================================

-- Auto-parsed profile from your files (singleton)
CREATE TABLE profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skills_expert TEXT[] NOT NULL DEFAULT '{}',
  skills_proficient TEXT[] NOT NULL DEFAULT '{}',
  skills_familiar TEXT[] NOT NULL DEFAULT '{}',
  experience_years INTEGER,
  titles_held TEXT[] DEFAULT '{}',
  target_titles TEXT[] DEFAULT '{}',
  target_industries TEXT[] DEFAULT '{}',
  location_preferences JSONB DEFAULT '{}',
  deal_breakers TEXT[] DEFAULT '{}',
  source_files JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Your 3 base resumes + their prompts
CREATE TABLE base_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug IN ('gen_ai', 'mle', 'mix')),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  skills_extracted TEXT[] DEFAULT '{}',
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Every job you encounter
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  url TEXT UNIQUE,
  location TEXT,
  salary_range TEXT,
  job_type TEXT,
  description TEXT NOT NULL,
  requirements TEXT[],
  nice_to_haves TEXT[],
  platform TEXT,

  -- Pass 1 (local, no API)
  quick_fit_score INTEGER,

  -- Pass 2 (Gemini analysis)
  fit_score INTEGER CHECK (fit_score BETWEEN 0 AND 100),
  fit_analysis JSONB,
  recommended_base TEXT REFERENCES base_resumes(slug),
  apply_recommendation TEXT CHECK (apply_recommendation IN
    ('strong_yes', 'yes', 'maybe', 'no')),

  -- Tracking
  status TEXT DEFAULT 'analyzed' CHECK (status IN
    ('analyzed', 'resume_created', 'applied', 'phone_screen',
     'technical', 'onsite', 'offer', 'rejected', 'withdrawn', 'ghosted')),
  applied_at TIMESTAMPTZ,
  notes TEXT,

  -- Claude.ai reference
  claude_chat_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated resumes
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  base_used TEXT NOT NULL REFERENCES base_resumes(slug),
  tailored_text TEXT NOT NULL,
  customization_notes TEXT,
  interview_prep TEXT[],
  raw_claude_response TEXT,
  latex_source TEXT,
  pdf_storage_path TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application event timeline
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  notes TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_fit_score ON jobs(fit_score DESC);
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);
CREATE INDEX idx_resumes_job ON resumes(job_id);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER base_resumes_updated BEFORE UPDATE ON base_resumes
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER profile_updated BEFORE UPDATE ON profile
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
```

### 1.4 Profile Parser

```typescript
// packages/core/src/profile-parser.ts

const TECH_SKILLS = new Set([
  // Languages
  'python', 'java', 'javascript', 'typescript', 'go', 'rust', 'c++', 'scala', 'r', 'sql',
  // ML/AI
  'pytorch', 'tensorflow', 'keras', 'scikit-learn', 'huggingface', 'transformers',
  'llm', 'llms', 'rag', 'langchain', 'llamaindex', 'openai', 'gpt', 'bert',
  'fine-tuning', 'prompt engineering', 'embeddings', 'vector databases',
  'computer vision', 'nlp', 'natural language processing', 'deep learning',
  'machine learning', 'reinforcement learning', 'generative ai',
  // MLOps / Infra
  'mlflow', 'kubeflow', 'sagemaker', 'vertex ai', 'mlops',
  'feature store', 'model serving', 'a/b testing',
  // Data
  'spark', 'kafka', 'airflow', 'dbt', 'snowflake', 'bigquery', 'redshift',
  'postgresql', 'mongodb', 'redis', 'elasticsearch', 'pinecone', 'weaviate', 'chromadb',
  // Cloud
  'aws', 'gcp', 'azure', 'ec2', 's3', 'lambda', 'ecs', 'eks',
  // DevOps
  'docker', 'kubernetes', 'terraform', 'ci/cd', 'github actions', 'jenkins',
  // Web
  'react', 'next.js', 'node.js', 'fastapi', 'flask', 'django',
  'rest api', 'graphql', 'grpc',
  // General
  'git', 'linux', 'agile', 'scrum',
]);

export function parseProfile(
  careerStory: string,
  resumes: { gen_ai: string; mle: string; mix: string }
): ParsedProfile {

  // Extract skills from each resume
  const skillSets = {
    gen_ai: extractSkillsFromText(resumes.gen_ai),
    mle: extractSkillsFromText(resumes.mle),
    mix: extractSkillsFromText(resumes.mix),
  };

  // Count occurrences across resumes
  const skillCounts = new Map<string, number>();
  for (const skills of Object.values(skillSets)) {
    for (const skill of skills) {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    }
  }

  // Categorize by frequency
  const expert: string[] = [];
  const proficient: string[] = [];
  const familiar: string[] = [];

  for (const [skill, count] of skillCounts) {
    if (count >= 3) expert.push(skill);
    else if (count === 2) proficient.push(skill);
    else familiar.push(skill);
  }

  // Parse career story for metadata
  const years = extractYearsOfExperience(careerStory);
  const titles = extractTitles(careerStory);

  return {
    skills_expert: expert.sort(),
    skills_proficient: proficient.sort(),
    skills_familiar: familiar.sort(),
    experience_years: years,
    titles_held: titles,
    target_titles: extractTargetTitles(careerStory),
    target_industries: extractIndustries(careerStory),
    deal_breakers: extractDealBreakers(careerStory),
    location_preferences: extractLocationPrefs(careerStory),
  };
}

function extractSkillsFromText(text: string): Set<string> {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const skill of TECH_SKILLS) {
    const regex = new RegExp(
      `\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'
    );
    if (regex.test(lower)) found.add(skill);
  }
  return found;
}

function extractYearsOfExperience(story: string): number {
  const match = story.match(/(\d+)\+?\s*years?\s*(of)?\s*(experience|in)/i);
  if (match) return parseInt(match[1]);
  const years = story.match(/20\d{2}/g);
  if (years?.length) {
    return new Date().getFullYear() - Math.min(...years.map(Number));
  }
  return 0;
}

function extractTitles(story: string): string[] {
  const titlePatterns = [
    /(?:worked as|role as|position as|titled?)\s+["']?([^"'\n,]+)/gi,
    /(?:Senior|Staff|Lead|Principal|Junior|Mid)?\s*(?:ML|Machine Learning|AI|Data|Software|Backend|Full.?Stack)\s*(?:Engineer|Scientist|Developer|Architect)/gi,
  ];
  const titles = new Set<string>();
  for (const pattern of titlePatterns) {
    let match;
    while ((match = pattern.exec(story)) !== null) {
      titles.add(match[1]?.trim() || match[0].trim());
    }
  }
  return [...titles];
}

function extractDealBreakers(story: string): string[] {
  const breakers: string[] = [];
  const patterns = [
    /(?:not interested in|avoid|don't want|deal.?breaker|won't consider)\s*[:\-]?\s*([^\n.]+)/gi,
    /(?:no|never)\s+(on.?site|relocation|clearance|travel)/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(story)) !== null) {
      breakers.push(match[1]?.trim() || match[0].trim());
    }
  }
  return breakers;
}

function extractTargetTitles(story: string): string[] {
  const match = story.match(
    /(?:targeting|looking for|interested in|want)\s*[:\-]?\s*([^\n.]+)/gi
  );
  return match?.map(m => m.replace(/^.*?[:\-]\s*/, '').trim()) || [];
}

function extractIndustries(story: string): string[] {
  const known = ['fintech', 'healthcare', 'e-commerce', 'saas', 'ai', 'crypto',
    'autonomous', 'robotics', 'defense', 'education', 'media', 'gaming'];
  const lower = story.toLowerCase();
  return known.filter(i => lower.includes(i));
}

function extractLocationPrefs(story: string): Record<string, any> {
  const remote = /remote/i.test(story);
  const hybrid = /hybrid/i.test(story);
  return { remote, hybrid };
}
```

### 1.5 Local Fit Check (Pass 1 — No API)

```typescript
// packages/core/src/quick-fit.ts

export function quickFitCheck(
  job: JobData,
  profile: ParsedProfile
): { score: number; pass: boolean; matched: string[]; missing: string[] } {

  const jdLower = job.description.toLowerCase();

  // Deal-breaker check — instant reject
  for (const breaker of profile.deal_breakers) {
    if (jdLower.includes(breaker.toLowerCase())) {
      return { score: 0, pass: false, matched: [], missing: [] };
    }
  }

  // Weighted skill matching
  let score = 0;
  let maxScore = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  const weights = { expert: 3, proficient: 2, familiar: 1 };

  for (const [level, skills] of Object.entries({
    expert: profile.skills_expert,
    proficient: profile.skills_proficient,
    familiar: profile.skills_familiar,
  })) {
    for (const skill of skills) {
      const w = weights[level as keyof typeof weights];
      maxScore += w;
      if (jdLower.includes(skill.toLowerCase())) {
        score += w;
        matched.push(skill);
      } else {
        missing.push(skill);
      }
    }
  }

  const normalizedScore = maxScore > 0
    ? Math.round((score / maxScore) * 100) : 50;

  return {
    score: normalizedScore,
    pass: normalizedScore >= 40, // configurable threshold
    matched,
    missing,
  };
}
```

### 1.6 Gemini Fit Analysis (Pass 2)

```typescript
// packages/core/src/fit-analyzer.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { JobData, ParsedProfile, FitAnalysis, BaseResumeSlug } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function deepFitAnalysis(
  job: JobData,
  profile: ParsedProfile,
  baseResumeSummaries: Record<BaseResumeSlug, string>
): Promise<FitAnalysis> {

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are The Seer, an expert resume strategist and job market analyst.

Analyze this job against the candidate profile. Determine fit and select the optimal base resume.

## Candidate Profile
- Expert skills (core strengths): ${profile.skills_expert.join(", ")}
- Proficient skills: ${profile.skills_proficient.join(", ")}
- Familiar skills: ${profile.skills_familiar.join(", ")}
- Experience: ${profile.experience_years} years
- Past titles: ${profile.titles_held.join(", ")}
- Target titles: ${profile.target_titles.join(", ")}
- Deal-breakers: ${profile.deal_breakers.join(", ") || "None specified"}

## Job Description
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
Type: ${job.job_type || "Not specified"}

${job.description}

## Base Resumes Available
1. gen_ai — ${baseResumeSummaries.gen_ai}
2. mle — ${baseResumeSummaries.mle}
3. mix — ${baseResumeSummaries.mix}

## Base Selection Strategy
- Heavy LLM/GenAI/RAG/agents/prompting → gen_ai
- ML infra, pipelines, deployment, MLOps → mle
- Mixed signals or broad "AI/ML" role → mix
- GenAI title but heavy systems requirements → mle (systems > title)
- MLE title but heavy LLM requirements → gen_ai (content > title)

## Respond with ONLY valid JSON:
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
  return JSON.parse(cleaned) as FitAnalysis;
}
```

### 1.7 Claude.ai Prompt Builder

```typescript
// packages/core/src/prompt-builder.ts

export function buildClaudePrompt(params: {
  job: JobData;
  analysis: FitAnalysis;
  baseResume: { content: string; prompt_template: string };
  selectedBase: BaseResumeSlug;
}): string {

  // Start with the user's existing prompt template
  // The template should have a {{JD}} placeholder for injection
  let prompt = params.baseResume.prompt_template;

  // Inject the JD
  prompt = prompt.replace(/\{\{JD\}\}/gi, params.job.description);

  // Augment with strategic context from Gemini analysis
  prompt += `

## Strategic Context from The Seer
The following analysis was performed to optimize this resume for maximum impact:

- ATS Keywords (MUST appear verbatim in resume): ${params.analysis.ats_keywords.join(", ")}
- Key Strengths to Emphasize: ${params.analysis.key_matches.join(", ")}
- Gaps to Mitigate: ${params.analysis.gap_mitigation.join("; ")}
- Tailoring Priorities: ${params.analysis.tailoring_priorities.join("; ")}
- Estimated Competition: ${params.analysis.estimated_competition}
- Fit Score: ${params.analysis.fit_score}/100

Use these insights to make the resume as targeted as possible for this specific role.`;

  return prompt;
}
```

### 1.8 Response Parser

```typescript
// packages/core/src/response-parser.ts

// Parses Claude's response from claude.ai
// Your prompts already define the output format — this parser adapts to it
// If your prompts produce a specific format (e.g., sections with headers),
// we'll customize this after seeing your actual prompt output

export function parseClaudeResponse(
  rawResponse: string,
  company: string,
  title: string
): TailoredResume {

  // Default chat title
  const chatTitle = `${company} - ${title}`;

  // Strategy 1: If response contains structured markers
  // (we'll customize these based on your actual prompt output format)
  const sections = {
    resume: '',
    notes: '',
    prep: [] as string[],
  };

  // Try to find resume content between known markers
  // This will be tuned to your specific prompt output
  const resumePatterns = [
    /---TAILORED RESUME---([\s\S]*?)---/,
    /## Resume\n([\s\S]*?)(?=## |$)/,
    /## Tailored Resume\n([\s\S]*?)(?=## |$)/,
  ];

  for (const pattern of resumePatterns) {
    const match = rawResponse.match(pattern);
    if (match) {
      sections.resume = match[1].trim();
      break;
    }
  }

  // Fallback: if no markers found, treat entire response as resume
  // (we'll refine this after seeing your prompt output)
  if (!sections.resume) {
    sections.resume = rawResponse.trim();
  }

  // Extract notes if present
  const notesMatch = rawResponse.match(
    /(?:## )?(?:Customization |Changes |Notes)([\s\S]*?)(?=## |$)/i
  );
  sections.notes = notesMatch?.[1]?.trim() || '';

  // Extract interview prep if present
  const prepMatch = rawResponse.match(
    /(?:## )?(?:Interview |Prep|Talking Points)([\s\S]*?)(?=## |$)/i
  );
  if (prepMatch) {
    sections.prep = prepMatch[1].trim().split('\n')
      .map(l => l.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }

  return {
    chat_title: chatTitle,
    tailored_text: sections.resume,
    customization_notes: sections.notes,
    interview_prep: sections.prep,
  };
}
```

### 1.9 CLI for Testing

```typescript
// packages/cli/src/index.ts

import { parseProfile } from '@the-seer/core/profile-parser';
import { quickFitCheck } from '@the-seer/core/quick-fit';
import { deepFitAnalysis } from '@the-seer/core/fit-analyzer';
import { buildClaudePrompt } from '@the-seer/core/prompt-builder';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(__dirname, '../../data');

// Load files
const careerStory = fs.readFileSync(`${dataDir}/career-story.md`, 'utf-8');
const resumes = {
  gen_ai: fs.readFileSync(`${dataDir}/resumes/gen-ai.md`, 'utf-8'),
  mle: fs.readFileSync(`${dataDir}/resumes/mle.md`, 'utf-8'),
  mix: fs.readFileSync(`${dataDir}/resumes/mix.md`, 'utf-8'),
};
const prompts = {
  gen_ai: fs.readFileSync(`${dataDir}/prompts/gen-ai.md`, 'utf-8'),
  mle: fs.readFileSync(`${dataDir}/prompts/mle.md`, 'utf-8'),
  mix: fs.readFileSync(`${dataDir}/prompts/mix.md`, 'utf-8'),
};

const command = process.argv[2];
const jdPath = process.argv[3];

async function main() {
  // Parse profile from files
  const profile = parseProfile(careerStory, resumes);

  switch (command) {
    case 'profile':
      console.log('\n=== THE SEER — Auto-Parsed Profile ===\n');
      console.log(`Expert (${profile.skills_expert.length}):`, profile.skills_expert.join(', '));
      console.log(`Proficient (${profile.skills_proficient.length}):`, profile.skills_proficient.join(', '));
      console.log(`Familiar (${profile.skills_familiar.length}):`, profile.skills_familiar.join(', '));
      console.log(`\nExperience: ${profile.experience_years} years`);
      console.log(`Titles: ${profile.titles_held.join(', ')}`);
      console.log(`Target: ${profile.target_titles.join(', ')}`);
      console.log(`Deal-breakers: ${profile.deal_breakers.join(', ') || 'None'}`);
      break;

    case 'quick-fit':
      if (!jdPath) { console.log('Usage: pnpm seer quick-fit ./jd.txt'); return; }
      const jd1 = fs.readFileSync(jdPath, 'utf-8');
      const job1 = { title: 'Role', company: 'Company', description: jd1,
        requirements: [], nice_to_haves: [] };
      const quick = quickFitCheck(job1, profile);
      console.log('\n=== Quick Fit (local, no API) ===');
      console.log(`Score: ${quick.score}/100`);
      console.log(`Pass: ${quick.pass ? 'YES' : 'NO'}`);
      console.log(`Matched: ${quick.matched.join(', ')}`);
      console.log(`Not in JD: ${quick.missing.join(', ')}`);
      break;

    case 'analyze':
      if (!jdPath) { console.log('Usage: pnpm seer analyze ./jd.txt'); return; }
      const jd2 = fs.readFileSync(jdPath, 'utf-8');
      const job2 = { title: 'Role', company: 'Company', description: jd2,
        requirements: [], nice_to_haves: [] };
      console.log('\n=== Deep Fit Analysis (Gemini) ===\n');
      const analysis = await deepFitAnalysis(job2, profile, {
        gen_ai: 'GenAI focused: LLMs, RAG, prompt engineering, fine-tuning',
        mle: 'ML Engineering focused: ML systems, pipelines, deployment, MLOps',
        mix: 'Generalist: full-stack ML, breadth across AI/ML/DE',
      });
      console.log(JSON.stringify(analysis, null, 2));
      break;

    case 'prompt':
      if (!jdPath) { console.log('Usage: pnpm seer prompt ./jd.txt'); return; }
      const jd3 = fs.readFileSync(jdPath, 'utf-8');
      const job3 = { title: 'Role', company: 'Company', description: jd3,
        requirements: [], nice_to_haves: [] };

      // Run Gemini analysis first
      console.log('Running Gemini analysis...');
      const fitResult = await deepFitAnalysis(job3, profile, {
        gen_ai: 'GenAI focused: LLMs, RAG, prompt engineering, fine-tuning',
        mle: 'ML Engineering focused: ML systems, pipelines, deployment, MLOps',
        mix: 'Generalist: full-stack ML, breadth across AI/ML/DE',
      });

      console.log(`\nBase selected: ${fitResult.recommended_base} (score: ${fitResult.fit_score})`);

      // Build claude.ai prompt using selected base
      const selectedBase = fitResult.recommended_base;
      const claudePrompt = buildClaudePrompt({
        job: job3,
        analysis: fitResult,
        baseResume: {
          content: resumes[selectedBase],
          prompt_template: prompts[selectedBase],
        },
        selectedBase,
      });

      // Save to file
      const outPath = `${dataDir}/generated-prompt.txt`;
      fs.writeFileSync(outPath, claudePrompt);
      console.log(`\nClaude.ai prompt saved to: ${outPath}`);
      console.log(`Prompt length: ${claudePrompt.length} chars`);
      console.log('\n→ Paste this into claude.ai to test output quality.');
      break;

    default:
      console.log('The Seer CLI');
      console.log('  pnpm seer profile              — View auto-parsed profile');
      console.log('  pnpm seer quick-fit ./jd.txt   — Local fit check (no API)');
      console.log('  pnpm seer analyze ./jd.txt     — Gemini deep analysis');
      console.log('  pnpm seer prompt ./jd.txt      — Generate claude.ai prompt');
  }
}

main().catch(console.error);
```

### 1.10 Phase 1 Deliverable

```bash
# See your auto-parsed profile
pnpm seer profile

# Quick local fit check (no API)
pnpm seer quick-fit ./sample-jd.txt

# Deep fit analysis via Gemini
pnpm seer analyze ./sample-jd.txt

# Generate full claude.ai prompt (analyze + build prompt)
pnpm seer prompt ./sample-jd.txt
# → Saves to data/generated-prompt.txt
# → You paste into claude.ai to verify quality before we automate
```

**Phase 1 is validation.** You verify the profile parser is accurate, Gemini picks the right base, and the generated prompt produces good output in claude.ai. Once you're happy, we automate it.

---

## Phase 2 — Chrome Extension + Automation

**Goal:** One-click from any job page.
**Time:** 5-7 days
**Depends on:** Phase 1 verified

### 2.1 Extension Structure

```
apps/extension/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.ts         # Orchestrates the full pipeline
│   ├── content/
│   │   ├── job-scraper.ts            # Runs on job pages
│   │   ├── claude-automator.ts       # Runs on claude.ai pages
│   │   └── platforms/
│   │       ├── linkedin.ts
│   │       ├── greenhouse.ts
│   │       ├── lever.ts
│   │       ├── workday.ts
│   │       ├── indeed.ts
│   │       └── generic.ts
│   ├── popup/
│   │   ├── Popup.tsx
│   │   └── components/
│   │       ├── FitScore.tsx
│   │       ├── MatchBreakdown.tsx
│   │       ├── GenerateButton.tsx
│   │       └── StatusTracker.tsx
│   ├── options/
│   │   └── Options.tsx
│   ├── claude-automation/
│   │   ├── engine.ts                 # Core tab automation logic
│   │   ├── selectors.ts             # Versioned CSS selectors
│   │   └── health-check.ts
│   └── shared/
│       ├── storage.ts
│       ├── api-client.ts
│       ├── profile.ts
│       └── quick-fit.ts
├── plasmo.config.ts
└── tailwind.config.js
```

### 2.2 Manifest

```json
{
  "manifest_version": 3,
  "name": "The Seer",
  "version": "1.0.0",
  "description": "One-click tailored resume generation",
  "permissions": [
    "activeTab", "storage", "tabs", "scripting",
    "clipboardWrite", "clipboardRead"
  ],
  "host_permissions": [
    "https://www.linkedin.com/jobs/*",
    "https://boards.greenhouse.io/*",
    "https://jobs.lever.co/*",
    "https://*.myworkdayjobs.com/*",
    "https://www.indeed.com/*",
    "https://claude.ai/*",
    "<all_urls>"
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "exclude_matches": ["https://claude.ai/*"],
      "js": ["content/job-scraper.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://claude.ai/*"],
      "js": ["content/claude-automator.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/seer-16.png",
      "48": "icons/seer-48.png",
      "128": "icons/seer-128.png"
    }
  },
  "background": { "service_worker": "background/service-worker.js" },
  "options_page": "options.html"
}
```

### 2.3 Platform Scrapers

```typescript
// apps/extension/src/content/platforms/linkedin.ts

export const linkedin = {
  match: (url: string) => url.includes('linkedin.com/jobs'),

  scrape: (): JobData => {
    const title = document.querySelector(
      '.job-details-jobs-unified-top-card__job-title'
    )?.textContent?.trim() || '';

    const company = document.querySelector(
      '.job-details-jobs-unified-top-card__company-name'
    )?.textContent?.trim() || '';

    const description = document.querySelector(
      '.jobs-description__content'
    )?.textContent?.trim() || '';

    const location = document.querySelector(
      '.job-details-jobs-unified-top-card__bullet'
    )?.textContent?.trim() || '';

    return {
      title, company, description, location,
      url: window.location.href,
      platform: 'linkedin',
      requirements: [], nice_to_haves: [],
    };
  },
};

// apps/extension/src/content/platforms/greenhouse.ts
export const greenhouse = {
  match: (url: string) => url.includes('greenhouse.io'),
  scrape: (): JobData => {
    const title = document.querySelector('h1.app-title')?.textContent?.trim() || '';
    const company = document.querySelector('.company-name')?.textContent?.trim() || '';
    const description = document.querySelector('#content .content')?.textContent?.trim() || '';
    const location = document.querySelector('.location')?.textContent?.trim() || '';
    return { title, company, description, location, url: window.location.href,
      platform: 'greenhouse', requirements: [], nice_to_haves: [] };
  },
};

// apps/extension/src/content/platforms/lever.ts
export const lever = {
  match: (url: string) => url.includes('jobs.lever.co'),
  scrape: (): JobData => {
    const title = document.querySelector('.posting-headline h2')?.textContent?.trim() || '';
    const company = document.querySelector('.posting-headline .company')?.textContent?.trim()
      || document.querySelector('.main-header-logo img')?.getAttribute('alt') || '';
    const description = document.querySelectorAll('.posting-page .section');
    let desc = '';
    description.forEach(s => desc += s.textContent + '\n');
    const location = document.querySelector('.posting-categories .sort-by-time')?.textContent?.trim() || '';
    return { title, company, description: desc.trim(), location, url: window.location.href,
      platform: 'lever', requirements: [], nice_to_haves: [] };
  },
};

// apps/extension/src/content/platforms/generic.ts
export const generic = {
  match: () => true, // fallback for any page
  scrape: (): JobData => {
    const title = document.querySelector('h1')?.textContent?.trim() || document.title;
    const description = findLargestTextBlock();
    const company = document.querySelector('meta[property="og:site_name"]')
      ?.getAttribute('content')
      || new URL(window.location.href).hostname.replace('www.', '').split('.')[0];
    return { title, company: capitalize(company), description, url: window.location.href,
      platform: 'generic', requirements: [], nice_to_haves: [] };
  },
};

function findLargestTextBlock(): string {
  const blocks = document.querySelectorAll('div, section, article, main');
  let largest = '';
  blocks.forEach(b => {
    const text = b.textContent?.trim() || '';
    if (text.length > largest.length && text.length > 200) {
      largest = text;
    }
  });
  return largest;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

### 2.4 Job Scraper Content Script

```typescript
// apps/extension/src/content/job-scraper.ts

import { linkedin } from './platforms/linkedin';
import { greenhouse } from './platforms/greenhouse';
import { lever } from './platforms/lever';
import { generic } from './platforms/generic';

const platforms = [linkedin, greenhouse, lever, generic];

// Detect platform and scrape
function scrapeCurrentPage(): JobData | null {
  const url = window.location.href;
  for (const platform of platforms) {
    if (platform.match(url)) {
      try {
        const data = platform.scrape();
        if (data.description.length > 100) return data;
      } catch (e) {
        console.warn(`[The Seer] ${platform} scraper failed:`, e);
      }
    }
  }
  return null;
}

// Send scraped data to background script
const jobData = scrapeCurrentPage();
if (jobData) {
  chrome.runtime.sendMessage({
    type: 'JOB_PAGE_DETECTED',
    data: jobData,
  });
}

// Listen for explicit scrape requests from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE_PAGE') {
    const data = scrapeCurrentPage();
    sendResponse({ success: !!data, data });
  }
});
```

### 2.5 Claude.ai Automation Engine

```typescript
// apps/extension/src/claude-automation/engine.ts

import { SELECTORS, resilientQuery } from './selectors';

export class ClaudeAutomationEngine {
  private claudeTabId: number | null = null;
  private projectPath: string; // configured in settings

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async generateResume(prompt: string): Promise<{
    response: string;
    chatUrl: string;
  }> {
    // 1. Open or reuse claude.ai tab
    const tabId = await this.getOrCreateTab();

    // 2. Navigate to project + new chat
    await this.navigateToNewChat(tabId);

    // 3. Wait for input ready
    await this.waitForReady(tabId);

    // 4. Inject prompt
    await this.injectPrompt(tabId, prompt);

    // 5. Send
    await this.clickSend(tabId);

    // 6. Wait for complete response
    const response = await this.waitForResponse(tabId);

    // 7. Get chat URL
    const chatUrl = await this.getChatUrl(tabId);

    return { response, chatUrl };
  }

  private async getOrCreateTab(): Promise<number> {
    // Reuse existing claude.ai tab if available
    const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });
    const existing = tabs.find(t => t.id === this.claudeTabId);

    if (existing?.id) {
      return existing.id;
    }

    // Create in background
    const tab = await chrome.tabs.create({
      url: 'https://claude.ai',
      active: false,
    });
    this.claudeTabId = tab.id!;
    await this.waitForTabLoad(tab.id!);
    return tab.id!;
  }

  private async navigateToNewChat(tabId: number): Promise<void> {
    await chrome.tabs.update(tabId, {
      url: `https://claude.ai${this.projectPath}`,
    });
    await this.waitForTabLoad(tabId);
    // Extra wait for SPA hydration
    await this.sleep(2500);
  }

  private async injectPrompt(tabId: number, prompt: string): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (text: string, selectors: string[]) => {
        // Find input using resilient selectors
        let editor: HTMLElement | null = null;
        for (const sel of selectors) {
          editor = document.querySelector(sel) as HTMLElement;
          if (editor) break;
        }
        // Heuristic fallback
        if (!editor) {
          const all = document.querySelectorAll('[contenteditable="true"]');
          editor = Array.from(all).sort(
            (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width
          )[0] as HTMLElement;
        }
        if (!editor) throw new Error('Chat input not found');

        // Paste via clipboard API
        editor.focus();
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        editor.dispatchEvent(new ClipboardEvent('paste', {
          clipboardData: dt, bubbles: true, cancelable: true,
        }));
      },
      args: [prompt, SELECTORS.chatInput],
    });
  }

  private async clickSend(tabId: number): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (selectors: string[]) => {
        let btn: HTMLButtonElement | null = null;
        for (const sel of selectors) {
          if (!sel) continue;
          btn = document.querySelector(sel) as HTMLButtonElement;
          if (btn) break;
        }
        // Heuristic: button near bottom-right of input area
        if (!btn) {
          const input = document.querySelector('[contenteditable="true"]');
          if (input) {
            const rect = input.getBoundingClientRect();
            const buttons = document.querySelectorAll('button');
            btn = Array.from(buttons).filter(b => {
              const r = b.getBoundingClientRect();
              return Math.abs(r.bottom - rect.bottom) < 100 && r.left > rect.right - 200;
            }).pop() as HTMLButtonElement || null;
          }
        }
        if (!btn) throw new Error('Send button not found');
        btn.click();
      },
      args: [SELECTORS.sendButton],
    });
  }

  private async waitForResponse(tabId: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Response timeout (180s)')), 180000);
      let lastLength = 0;
      let stableCount = 0;

      const poll = setInterval(async () => {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (msgSelectors: string[], stopSelectors: string[]) => {
              // Find last assistant message
              let lastMsg: Element | null = null;
              for (const sel of msgSelectors) {
                if (!sel) continue;
                const msgs = document.querySelectorAll(sel);
                if (msgs.length) { lastMsg = msgs[msgs.length - 1]; break; }
              }

              // Check if still streaming
              let isStreaming = false;
              for (const sel of stopSelectors) {
                if (!sel) continue;
                if (document.querySelector(sel)) { isStreaming = true; break; }
              }

              return {
                text: lastMsg?.textContent || '',
                isStreaming,
              };
            },
            args: [SELECTORS.assistantMessage, SELECTORS.stopButton],
          });

          const { text, isStreaming } = results[0].result as any;

          if (!isStreaming && text.length > 100) {
            if (text.length === lastLength) {
              stableCount++;
              if (stableCount >= 3) {
                clearInterval(poll);
                clearTimeout(timeout);
                resolve(text);
              }
            } else {
              stableCount = 0;
              lastLength = text.length;
            }
          } else {
            lastLength = text.length;
            stableCount = 0;
          }
        } catch {
          // Transient error, keep polling
        }
      }, 1500);
    });
  }

  private async getChatUrl(tabId: number): Promise<string> {
    const tab = await chrome.tabs.get(tabId);
    return tab.url || '';
  }

  private waitForTabLoad(tabId: number): Promise<void> {
    return new Promise(resolve => {
      chrome.tabs.onUpdated.addListener(function listener(id, info) {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 1500);
        }
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  // Health check: verify all selectors work
  async healthCheck(): Promise<{ healthy: boolean; broken: string[] }> {
    const broken: string[] = [];
    try {
      const tabId = await this.getOrCreateTab();
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (allSelectors: Record<string, string[]>) => {
          const failures: string[] = [];
          for (const [key, sels] of Object.entries(allSelectors)) {
            const found = sels.some(s => s && document.querySelector(s));
            if (!found) failures.push(key);
          }
          return failures;
        },
        args: [SELECTORS],
      });
      broken.push(...(results[0].result as string[]));
    } catch (e) {
      broken.push('tab_access');
    }
    return { healthy: broken.length === 0, broken };
  }
}
```

### 2.6 Resilient Selectors

```typescript
// apps/extension/src/claude-automation/selectors.ts

// Multiple strategies per element — falls through on failure
// Update this file when claude.ai changes their UI

export const SELECTORS = {
  chatInput: [
    '[contenteditable="true"].ProseMirror',
    '[role="textbox"]',
    '[data-testid="chat-input"]',
    'div[contenteditable="true"]',
  ],

  sendButton: [
    'button[aria-label="Send message"]',
    'button[data-testid="send-button"]',
    'button[type="submit"]',
  ],

  assistantMessage: [
    '[data-testid="assistant-message"]',
    '.font-claude-message',
    '[class*="assistant"]',
  ],

  stopButton: [
    'button[aria-label="Stop response"]',
    'button[data-testid="stop-button"]',
  ],
};
```

### 2.7 Background Service Worker (Orchestrator)

```typescript
// apps/extension/src/background/service-worker.ts

import { ClaudeAutomationEngine } from '../claude-automation/engine';
import { deepFitAnalysis } from '@the-seer/core/fit-analyzer';
import { buildClaudePrompt } from '@the-seer/core/prompt-builder';
import { parseClaudeResponse } from '@the-seer/core/response-parser';
import { quickFitCheck } from '@the-seer/core/quick-fit';

let claudeEngine: ClaudeAutomationEngine;

// Initialize from stored settings
chrome.storage.local.get(['projectPath'], (result) => {
  claudeEngine = new ClaudeAutomationEngine(result.projectPath || '/project/default');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Job page detected — update badge with quick fit score
  if (msg.type === 'JOB_PAGE_DETECTED') {
    chrome.storage.local.get(['profile'], (result) => {
      if (result.profile) {
        const quick = quickFitCheck(msg.data, result.profile);
        const color = quick.score >= 70 ? '#22c55e'
                    : quick.score >= 40 ? '#eab308'
                    : '#ef4444';
        chrome.action.setBadgeText({ text: `${quick.score}`, tabId: sender.tab?.id });
        chrome.action.setBadgeBackgroundColor({ color, tabId: sender.tab?.id });
      }
    });
  }

  // Full generation pipeline
  if (msg.type === 'GENERATE_RESUME') {
    handleGeneration(msg.jobData).then(
      result => sendResponse({ success: true, data: result }),
      err => sendResponse({ success: false, error: err.message }),
    );
    return true; // async response
  }

  // Health check
  if (msg.type === 'HEALTH_CHECK') {
    claudeEngine.healthCheck().then(sendResponse);
    return true;
  }
});

async function handleGeneration(jobData: JobData) {
  // Load stored data
  const stored = await chrome.storage.local.get([
    'profile', 'baseResumes', 'promptTemplates', 'baseResumeSummaries',
  ]);

  // Step 1: Gemini fit analysis
  broadcast('gemini_analyzing');
  const analysis = await deepFitAnalysis(
    jobData,
    stored.profile,
    stored.baseResumeSummaries,
  );

  // Step 2: Build Claude prompt using selected base
  broadcast('building_prompt');
  const selectedBase = analysis.recommended_base;
  const claudePrompt = buildClaudePrompt({
    job: jobData,
    analysis,
    baseResume: {
      content: stored.baseResumes[selectedBase],
      prompt_template: stored.promptTemplates[selectedBase],
    },
    selectedBase,
  });

  // Step 3: Automate claude.ai
  broadcast('opening_claude');
  const { response: rawResponse, chatUrl } = await claudeEngine.generateResume(claudePrompt);

  // Step 4: Parse response
  broadcast('parsing');
  const resume = parseClaudeResponse(rawResponse, jobData.company, jobData.title);

  // Step 5: Save to Supabase
  broadcast('saving');
  const saved = await saveToSupabase({
    job: jobData,
    analysis,
    resume,
    rawResponse,
    chatUrl,
  });

  // Step 6: Compile PDF (Phase 3)
  broadcast('compiling_pdf');
  // await compilePDF(...)

  broadcast('complete');

  return {
    analysis,
    resume,
    chatUrl,
    jobId: saved.jobId,
  };
}

function broadcast(status: string) {
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status });
}

async function saveToSupabase(data: any) {
  const apiUrl = await chrome.storage.local.get(['apiUrl']);
  const res = await fetch(`${apiUrl.apiUrl}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
```

### 2.8 Extension Popup UI

```
Job page detected → badge shows quick fit score
                         │
Click extension icon → popup
                         │
┌────────────────────────────────────────┐
│     THE SEER                           │
│                                        │
│  Quick Fit: 78/100                     │
│                                        │
│  Skills Found: 12 of 18               │
│  ✓ Python, PyTorch, LLMs, RAG         │
│  ✓ AWS, Docker, FastAPI                │
│  ✗ Kubernetes, Go                      │
│                                        │
│  Deal-breakers: None found             │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │      Create Tailored Resume        │ │
│ └────────────────────────────────────┘ │
│                                        │
│  Opens Claude.ai briefly (~45-60s)     │
└────────────────────────────────────────┘
             │
      Click button
             │
┌────────────────────────────────────────┐
│  Generating...                         │
│                                        │
│  ▸ Analyzing with Gemini          ✓   │
│    → Score: 82 | Base: Gen AI         │
│  ▸ Opening Claude.ai              ✓   │
│  ▸ Sending prompt                 ✓   │
│  ▸ Waiting for Claude             ⏳  │
│    (streaming... 35s)                  │
│  ○ Parsing response                    │
│  ○ Saving to dashboard                 │
│  ○ Compiling PDF                       │
│                                        │
│  [Cancel]                              │
└────────────────────────────────────────┘
             │
        Complete
             │
┌────────────────────────────────────────┐
│  Resume Ready!                         │
│                                        │
│  Fit Score: 82/100                     │
│  Base Used: Gen AI                     │
│  Verdict: Strong Yes                   │
│                                        │
│  [ Download PDF ]                      │
│  [ View in Dashboard ]                 │
│  [ Open Claude Chat ]                  │
│  [ Regenerate ]                        │
└────────────────────────────────────────┘
```

### 2.9 Graceful Degradation

If claude.ai automation fails (UI update, login expired, etc.):

```
Full automation failed
       │
       ▼
Semi-auto fallback:
  1. Prompt auto-copied to clipboard
  2. Claude.ai opens (your RMS project, new chat)
  3. You paste (Cmd+V) and send (Enter)
  4. Extension detects the response automatically
  5. Parsing + saving + PDF still automated
       │
  Result: 2 manual steps instead of 0
  (still better than your current 8 steps)
```

### 2.10 Extension Settings Page

```
┌────────────────────────────────────────┐
│  THE SEER — Settings                   │
│                                        │
│  Claude.ai Project Path:               │
│  [/project/your-rms-project-id    ]   │
│                                        │
│  Gemini API Key:                       │
│  [AIza...                         ]   │
│  (free at ai.google.dev/gemini-api)   │
│                                        │
│  Dashboard URL:                        │
│  [https://the-seer.vercel.app     ]   │
│                                        │
│  Fit Score Threshold:                  │
│  [ 40 ] (skip jobs below this)        │
│                                        │
│  Chat Title Format:                    │
│  ( ) Company - Role                    │
│  ( ) Date_Company_Role                 │
│                                        │
│  [ Run Health Check ]                  │
│  Status: All systems operational ✓    │
│                                        │
│  [ Save Settings ]                     │
└────────────────────────────────────────┘
```

---

## Phase 3 — LaTeX Pipeline

**Goal:** Auto-compile tailored text into PDF using your template.
**Time:** 3-4 days
**Depends on:** Phase 1 + your LaTeX template

### 3.1 Template System

Convert your LaTeX template into a Handlebars template:

```
packages/core/src/templates/
├── resume.tex.hbs          # Your template with {{placeholders}}
├── compile.ts              # Handlebars → .tex → PDF
└── section-parser.ts       # Splits tailored text into template sections
```

### 3.2 Two Compilation Strategies

**Strategy A — Template injection**

Parse the tailored resume text into sections (header, experience, education, skills, etc.) and inject into your LaTeX template slots.

```typescript
export async function compileResume(
  tailoredText: string,
  templateSource: string
): Promise<{ tex: string; pdf: Buffer }> {
  const sections = parseResumeIntoSections(tailoredText);
  const template = Handlebars.compile(templateSource);
  const tex = template(sections);
  const pdf = await runLatex(tex);
  return { tex, pdf };
}
```

**Strategy B — LLM generates LaTeX directly**

Add to your Claude prompt: "Output the resume in this exact LaTeX format: {template}". This mirrors your current Cursor workflow but is automated.

We'll decide which works better based on your template complexity.

### 3.3 Compilation Service

```typescript
// apps/web/app/api/compile/route.ts

export async function POST(req: Request) {
  const { tailored_text, job_id } = await req.json();

  // Load LaTeX template from Supabase or local
  const template = await loadTemplate();

  // Compile
  const { tex, pdf } = await compileResume(tailored_text, template);

  // Upload to Supabase storage
  const pdfPath = `resumes/${job_id}/resume.pdf`;
  await supabase.storage.from('resumes').upload(pdfPath, pdf, {
    contentType: 'application/pdf',
  });

  // Also store .tex source
  await supabase.from('resumes').update({
    latex_source: tex,
    pdf_storage_path: pdfPath,
  }).eq('job_id', job_id);

  return Response.json({ pdf_path: pdfPath });
}
```

### 3.4 Output Per Job

```
Supabase Storage:
resumes/
├── {job_id_1}/
│   ├── resume.pdf
│   └── resume.tex
├── {job_id_2}/
│   ├── resume.pdf
│   └── resume.tex
```

---

## Phase 4 — Dashboard

**Goal:** Web app to manage everything. Free on Vercel.
**Time:** 7-10 days

### 4.1 Tech Stack

- Next.js 14 (App Router) + Tailwind + shadcn/ui
- Supabase client for data
- Recharts for analytics
- Supabase Auth (magic link, just your email)

### 4.2 Pages

```
/ ─────────────── Command Center (stats, recent activity, funnel)
/jobs ─────────── Job Tracker (table + kanban view, filters)
/jobs/[id] ────── Job Detail (PDF viewer, analysis, timeline, Claude chat link)
/resumes ──────── Base Resume Manager (edit content + prompts)
/analytics ────── Success Insights (charts, patterns, recommendations)
/settings ─────── Profile editor, Gemini key, Claude project path, LaTeX template
```

### 4.3 Command Center

```
┌────────────────────────────────────────────────────────────────────┐
│ THE SEER                                              [Settings]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │    47    │  │    31    │  │     8    │  │     3    │         │
│  │ Analyzed │  │ Applied  │  │Interview │  │  Offers  │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                    │
│  Recent Activity                    Fit Score Distribution         │
│  ├ Google - Sr MLE (85)             12 high fit (70+)             │
│  ├ Meta - AI Eng (78)               8 medium fit (40-69)          │
│  ├ Stripe - ML (45)                 4 low fit (<40)               │
│  └ OpenAI - Research (91)           Avg: 72                       │
│                                                                    │
│  Base Resume Usage        Success by Base                         │
│  Gen AI: 40%              Gen AI:  3/12 callbacks (25%)           │
│  MLE:    35%              MLE:     5/15 callbacks (33%)           │
│  Mix:    25%              Mix:     2/10 callbacks (20%)           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 4.4 Job Detail Page

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Back                                                             │
│                                                                    │
│ Google — Senior Machine Learning Engineer                          │
│ Mountain View, CA (Hybrid) · $180-250K                            │
│                                                                    │
│ Status: [Applied ▼]  Fit: 85/100  Base: Gen AI                   │
│                                                                    │
│ [Resume] [JD Analysis] [Timeline] [Notes]                         │
│                                                                    │
│ ┌─ PDF Viewer ───────────────────────────────────────────────────┐│
│ │                                                                 ││
│ │  (Your LaTeX-compiled resume rendered here)                    ││
│ │                                                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ [Download PDF] [View LaTeX] [Open Claude Chat] [Regenerate]      │
│                                                                    │
│ Customization Notes:                                               │
│ "Emphasized RAG pipeline experience from Project X. Reframed      │
│  Kubernetes gap through Docker orchestration. Added MLflow..."    │
│                                                                    │
│ Interview Prep:                                                    │
│ - Be ready to discuss RAG architecture at scale                   │
│ - Prepare examples of cross-functional ML projects                │
│ - Know Google's ML infra stack (TFX, Vertex AI)                  │
└────────────────────────────────────────────────────────────────────┘
```

### 4.5 API Routes

```
POST   /api/jobs              — Save job + analysis + resume
GET    /api/jobs              — List jobs (filterable)
GET    /api/jobs/[id]         — Job detail with resumes
PATCH  /api/jobs/[id]         — Update status, notes
DELETE /api/jobs/[id]         — Remove job

POST   /api/jobs/[id]/regenerate  — Re-run generation
POST   /api/jobs/[id]/events      — Add timeline event

POST   /api/compile           — LaTeX → PDF
GET    /api/profile           — Get parsed profile
PUT    /api/profile           — Update profile

GET    /api/analytics         — Aggregated stats
GET    /api/base-resumes      — List base resumes
PUT    /api/base-resumes/[slug] — Update base resume or prompt
```

---

## Phase 5 — Intelligence Layer

**Goal:** Learn what works, optimize over time.
**Time:** Ongoing after 50+ applications with tracked outcomes.

### 5.1 What Gets Tracked Automatically

Every generation records: fit score, base used, Gemini analysis, ATS keywords included, competition level, prompt version.

Every status update feeds the funnel: analyzed → applied → phone screen → technical → onsite → offer/rejected.

### 5.2 Insights the Dashboard Surfaces

```sql
-- Which base resume gets callbacks?
SELECT base_used, COUNT(*) as applied,
  COUNT(*) FILTER (WHERE j.status IN ('phone_screen','technical','onsite','offer')) as callbacks,
  ROUND(100.0 * COUNT(*) FILTER (WHERE j.status IN ('phone_screen','technical','onsite','offer'))
    / COUNT(*), 1) as callback_rate
FROM resumes r JOIN jobs j ON j.id = r.job_id
WHERE j.status != 'analyzed'
GROUP BY base_used;

-- Fit score sweet spot
SELECT
  CASE WHEN fit_score >= 80 THEN '80-100'
       WHEN fit_score >= 60 THEN '60-79'
       WHEN fit_score >= 40 THEN '40-59'
       ELSE '0-39' END as range,
  COUNT(*) as applied,
  COUNT(*) FILTER (WHERE status IN ('phone_screen','technical','onsite','offer')) as callbacks
FROM jobs WHERE status != 'analyzed'
GROUP BY 1 ORDER BY 1 DESC;

-- Common gaps in rejected vs successful
SELECT gap,
  COUNT(*) FILTER (WHERE j.status = 'rejected') as in_rejected,
  COUNT(*) FILTER (WHERE j.status IN ('phone_screen','technical','onsite','offer')) as in_success
FROM jobs j, LATERAL jsonb_array_elements_text(j.fit_analysis->'gaps') as gap
WHERE j.status != 'analyzed'
GROUP BY gap ORDER BY in_rejected DESC;
```

### 5.3 Smart Recommendations

Over time the dashboard shows:
- "Gen AI base has 33% callback rate vs 20% for Mix — prefer Gen AI for ambiguous roles"
- "Kubernetes appears as a gap in 80% of rejections — consider adding a project or cert"
- "Fit scores above 75 have 3x the callback rate — focus on these"
- "Average time to response: 8 days. 5 jobs pending past that — likely ghosted"

---

## Environment Variables

```env
# .env.local (Next.js backend)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Extension stores in chrome.storage.local:
# - gemini_api_key (free from ai.google.dev/gemini-api)
# - claude_project_path (/project/your-rms-folder-id)
# - dashboard_url
# - profile (auto-parsed)
# - base_resumes (content)
# - prompt_templates (your 3 prompts)
# - base_resume_summaries
# - fit_threshold (default 40)
```

---

## Deployment

```bash
# Backend + Dashboard
vercel deploy

# Database
# Supabase Dashboard → SQL Editor → run schema.sql

# Extension
cd apps/extension && pnpm build
# Load unpacked at chrome://extensions (dev mode)
# Publish to Chrome Web Store later ($5 one-time)
```

---

## Cost

| Component | Cost |
|---|---|
| Claude.ai (your existing subscription) | $0 extra |
| Gemini API (free tier) | $0 |
| Supabase (free tier) | $0 |
| Vercel (hobby) | $0 |
| Chrome Extension (dev mode) | $0 |
| LaTeX compilation (Railway, if needed) | $0-5/mo |
| **Total** | **$0-5/mo** |

---

## Deliverables Per Phase

| Phase | Time | Deliverable | How You Test |
|---|---|---|---|
| **1** | 3-4 days | Profile parser + Gemini analyzer + prompt builder + CLI | Run CLI, verify profile, paste generated prompt in claude.ai manually |
| **2** | 5-7 days | Chrome extension with Gemini + claude.ai automation | Browse LinkedIn, click button, watch it generate |
| **3** | 3-4 days | LaTeX pipeline + PDF in Supabase | Verify PDFs match your template |
| **4** | 7-10 days | Full dashboard on Vercel | Track jobs, download resumes, view analytics |
| **5** | Ongoing | Analytics + smart recommendations | Apply to 50+ jobs, review patterns |

---

## Ready to Start?

Share these and we begin Phase 1:

1. `career-story.md`
2. `gen-ai.md` (base resume)
3. `mle.md` (base resume)
4. `mix.md` (base resume)
5. `prompt-gen-ai.md`
6. `prompt-mle.md`
7. `prompt-mix.md`
8. Your `.tex` template + sample compiled PDF
9. Which job platforms you use most (LinkedIn, Greenhouse, etc.)
10. Chat title format preference
