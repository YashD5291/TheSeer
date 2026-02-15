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
