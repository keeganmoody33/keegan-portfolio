-- Supabase Schema for Keegan Moody Portfolio
-- Generated: 2026-01-19
-- Source: Portfolio Assembly Agent System v2.1

-- ============================================
-- TABLE: candidate_profiles
-- Core identity and summary information
-- ============================================
CREATE TABLE candidate_profiles (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  location TEXT,
  headline TEXT,
  summary TEXT,
  primary_role_type TEXT,
  ideal_company_stage TEXT[],
  ideal_environment TEXT[],
  work_style TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: experiences
-- Work history with verified metrics
-- ============================================
CREATE TABLE experiences (
  id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_url TEXT,
  role_title TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  duration_months INT,
  location TEXT,
  employment_type TEXT, -- Full-time, Contract, Research Position
  company_stage TEXT,   -- Seed, Series A, Series B, etc.
  company_funding TEXT,
  company_industry TEXT,
  description TEXT,
  key_deliverables TEXT[],
  metrics JSONB,        -- Flexible storage for role-specific metrics
  honest_assessment TEXT,
  exit_reason TEXT,
  verification_status TEXT, -- VERIFIED, MODERATE, UNVERIFIED
  verification_sources TEXT[],
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: skills
-- Categorized skills with proficiency levels
-- ============================================
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- GTM / Sales, Technical / Tools, Research / Analysis, etc.
  skill_name TEXT NOT NULL,
  proficiency_level TEXT NOT NULL, -- STRONG, MODERATE, GAP
  evidence TEXT,
  notes TEXT,
  years_experience INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: achievements
-- Verified accomplishments with metrics
-- ============================================
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  experience_id TEXT REFERENCES experiences(id) ON DELETE SET NULL,
  achievement_type TEXT, -- METHODOLOGY, DISCOVERY, QUOTA, REVENUE, DEAL_VELOCITY, PUBLICATION, etc.
  title TEXT NOT NULL,
  description TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  verification_status TEXT, -- VERIFIED, UNVERIFIED_WITH_HONEST_FRAMING
  verification_source TEXT,
  honest_framing TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: ai_instructions
-- Guidelines for AI assistants
-- ============================================
CREATE TABLE ai_instructions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  version TEXT,
  voice_guidelines JSONB,      -- {tone, perspective_portfolio, perspective_bios, do_say[], dont_say[]}
  critical_distinctions JSONB, -- [{context, incorrect, correct, reason}]
  honest_framing JSONB,        -- {terminations, mixmax_gap, gap_period}
  success_patterns TEXT[],
  failure_patterns TEXT[],
  environment_fit JSONB,       -- {thrives_in[], struggles_in[]}
  one_liners JSONB,            -- {general, metrics, methodology, honesty, healthcare}
  methodologies JSONB,         -- [{name, use_when, process, output}]
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for common queries
-- ============================================
CREATE INDEX idx_experiences_candidate ON experiences(candidate_id);
CREATE INDEX idx_experiences_featured ON experiences(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_experiences_display_order ON experiences(display_order);

CREATE INDEX idx_skills_candidate ON skills(candidate_id);
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_proficiency ON skills(proficiency_level);

CREATE INDEX idx_achievements_candidate ON achievements(candidate_id);
CREATE INDEX idx_achievements_experience ON achievements(experience_id);
CREATE INDEX idx_achievements_featured ON achievements(is_featured) WHERE is_featured = TRUE;

-- ============================================
-- ROW LEVEL SECURITY (Enable for production)
-- ============================================
-- ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_instructions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_candidate_profiles_updated_at
  BEFORE UPDATE ON candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiences_updated_at
  BEFORE UPDATE ON experiences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_instructions_updated_at
  BEFORE UPDATE ON ai_instructions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE candidate_profiles IS 'Core identity and career summary';
COMMENT ON TABLE experiences IS 'Work history with verified metrics and honest assessments';
COMMENT ON TABLE skills IS 'Categorized skills with evidence-based proficiency levels';
COMMENT ON TABLE achievements IS 'Verified accomplishments with supporting metrics';
COMMENT ON TABLE ai_instructions IS 'Guidelines for AI assistants representing the candidate';

COMMENT ON COLUMN experiences.metrics IS 'JSONB for flexible metric storage (demos_booked, quota_attainment_percent, connection_rate_percent, closed_won_revenue, etc.)';
COMMENT ON COLUMN experiences.honest_assessment IS 'Candid evaluation including gaps and areas for improvement';
COMMENT ON COLUMN achievements.honest_framing IS 'Alternative wording when claims need qualification';
