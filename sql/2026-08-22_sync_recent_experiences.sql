-- ============================================================
-- SYNC RECENT EXPERIENCES, SKILLS, AND CODING GAP
-- Generated: 2026-08-22
-- Author: Devin
-- Purpose: Add four new experiences (AssetMule, BCOFA 2025, Kivira,
--          Morph) plus new skills and the coding "actively developing"
--          gap to the live Supabase portfolio DB.
-- Notes:
--   - Column names match the live schema confirmed from
--     archive/sql/insert_data.sql (2026-07-24) and chat/index.ts.
--   - `display_order` is reassigned so the timeline remains chronological
--     (most-recent first) without touching unknown rows.
--   - All unverified metrics ($200K pipeline, 20+ leads, etc.) are kept in
--     `public_bullets` with the caveat inline (chat does not read
--     `private_context_*` fields) and also recorded in
--     `private_context_what_id_do_differently`.
--   - This script is designed to be idempotent: INSERT ... ON CONFLICT (id)
--     updates existing rows.
-- Usage: Run this in the Supabase SQL Editor for project
--        cvkcwvmlnghwwvdqudod.
-- ============================================================

BEGIN;

-- ============================================================
-- 0. REORDER EXISTING EXPERIENCES TO MAKE ROOM FOR NEW ROLES
-- ============================================================
UPDATE experiences
SET display_order = CASE id
  WHEN 'exp-001' THEN 3   -- Mixmax (Sep–Dec 2025)
  WHEN 'exp-002' THEN 4   -- Mobb (May–Jul 2025)
  WHEN 'exp-003' THEN 7   -- TraceAir (Jul 2024–Jan 2025)
  WHEN 'exp-004' THEN 8   -- BCOFA 2024 (Jan–Jun 2024)
  WHEN 'exp-005' THEN 9   -- Biofourmis (Aug 2021–Jan 2023)
  WHEN 'exp-006' THEN 10  -- Barbour Orthopaedics (Jun 2020–Jul 2021)
  WHEN 'exp-007' THEN 11  -- ASGM Research (2016–2018)
  WHEN 'exp-09'  THEN 99  -- Camp Horizon (volunteer, bottom)
  ELSE display_order
END
WHERE candidate_id = 'keegan-moody-001';

-- ============================================================
-- 1. INSERT / UPDATE FOUR NEW EXPERIENCES
-- ============================================================

-- 1a. Kivira.health (Apr–Jun 2026) — GTM Engineering / Outbound & Knowledge Systems
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  public_bullets, metrics, private_context_what_id_do_differently,
  private_context_manager_would_say, exit_reason, verification_status,
  verification_sources, is_featured, display_order
) VALUES (
  'exp-kivira',
  'keegan-moody-001',
  'Kivira.health',
  'https://kivira.health',
  'GTM Engineering Contractor — Outbound & Knowledge Systems',
  '2026-04-01',
  '2026-06-30',
  3,
  'Remote',
  'Contract',
  'Early-stage',
  'Undisclosed',
  'Healthcare Tech / Mental Health Clinical Decision Support',
  'Led cold outbound GTM operations for a mental-health clinical decision support startup targeting primary care clinics, health systems, and value-based care organizations.',
  ARRAY[
    'Owned end-to-end cold outbound execution: prospecting, list building, campaign deployment, and cold calls',
    'Provisioned and managed 15 sending inboxes to support multi-channel outbound at scale',
    'Built and sent targeted campaigns across multiple buyer personas, including an innovation-champion campaign reaching 285 list-built/enriched CIO/CMIO/CTO contacts at health systems (outcomes not independently verified)',
    'Onboarded and ramped NYU interns interested in startup go-to-market, delegating research, outreach, and operational tasks',
    'Designed and built a Context Operating System (Context OS) — a structured knowledge graph linking market research, ICP tiers, buyer personas, messaging, and campaign artifacts',
    'Supported ICP definition around a primary-care mental-health wedge, including CoCM billing signal analysis and 9-subtier account architecture'
  ],
  NULL,
  'Three-month contract focused on outbound execution, infrastructure, and knowledge-system build. I do not have verified closed-revenue numbers from the campaigns. The 285 validated contact count comes from list-building and enrichment; I do not have independent verification of accuracy or campaign outcomes. The main outcomes are the outbound system, the launched campaigns, the intern ramp, and the Context OS as a reusable GTM asset.',
  NULL,
  'Contract completion',
  'VERIFIED',
  ARRAY['experience markdown / owner attestation'],
  FALSE,
  1
)
ON CONFLICT (id) DO UPDATE SET
  candidate_id = EXCLUDED.candidate_id,
  company_name = EXCLUDED.company_name,
  company_url = EXCLUDED.company_url,
  role_title = EXCLUDED.role_title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  duration_months = EXCLUDED.duration_months,
  location = EXCLUDED.location,
  employment_type = EXCLUDED.employment_type,
  company_stage = EXCLUDED.company_stage,
  company_funding = EXCLUDED.company_funding,
  company_industry = EXCLUDED.company_industry,
  description = EXCLUDED.description,
  public_bullets = EXCLUDED.public_bullets,
  metrics = EXCLUDED.metrics,
  private_context_what_id_do_differently = EXCLUDED.private_context_what_id_do_differently,
  private_context_manager_would_say = EXCLUDED.private_context_manager_would_say,
  exit_reason = EXCLUDED.exit_reason,
  verification_status = EXCLUDED.verification_status,
  verification_sources = EXCLUDED.verification_sources,
  is_featured = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order;

-- 1b. Morph Data Strategies / Focus HCS (May 2026) — MSO Intelligence Engine
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  public_bullets, metrics, private_context_what_id_do_differently,
  private_context_manager_would_say, exit_reason, verification_status,
  verification_sources, is_featured, display_order
) VALUES (
  'exp-morph',
  'keegan-moody-001',
  'Morph Data Strategies (client: Focus HCS)',
  'https://focushcs.com',
  'Outside Creative Researcher — MSO Intelligence Engine',
  '2026-05-01',
  '2026-05-31',
  1,
  'Remote',
  'Contract',
  'Research / Consulting',
  'Undisclosed',
  'Healthcare MSO Market Intelligence / Research',
  'Contracted by Morph Data Strategies to build an MSO Intelligence Engine for Focus HCS, combining deep market research, signal-based sourcing angles, and an interactive data platform for healthcare management services organizations.',
  ARRAY[
    'Conducted deep research into the US healthcare MSO market, including private-equity consolidation, EHR fragmentation, cybersecurity exposure, and revenue-cycle degradation',
    'Delivered an executive research brief and a full scientific-format publication with abstract, methods, results, and references',
    'Built six angle dossiers identifying predictive signals for MSO target sourcing, including NPI/TIN intersections, Form D/PE hiring patterns, CRE aggregation, and RCM/SOS signals',
    'Produced six interactive HTML figures to visualize signal intersections, pre-formation timelines, tier maps, and formation funnels',
    'Built a working MSO Intelligence Platform (React + Vite + TypeScript + Leaflet) to explore and present MSO market data',
    'Developed the research with a focus on actionable, evidence-based intelligence rather than generic market sizing'
  ],
  NULL,
  'Short, focused research contract. The deliverables were substantial — research brief, publication, angle dossiers, figures, and a working platform — but the final publication received a "needs changes" review and I do not have confirmation that it was fully accepted or deployed by the client. The MSO Intelligence Platform exists as a working build on GitHub. The EDP scoring framework was dropped after retrospective validation failed, which is the right honest framing.',
  NULL,
  'Contract completion',
  'VERIFIED',
  ARRAY['experience markdown / owner attestation'],
  FALSE,
  2
)
ON CONFLICT (id) DO UPDATE SET
  candidate_id = EXCLUDED.candidate_id,
  company_name = EXCLUDED.company_name,
  company_url = EXCLUDED.company_url,
  role_title = EXCLUDED.role_title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  duration_months = EXCLUDED.duration_months,
  location = EXCLUDED.location,
  employment_type = EXCLUDED.employment_type,
  company_stage = EXCLUDED.company_stage,
  company_funding = EXCLUDED.company_funding,
  company_industry = EXCLUDED.company_industry,
  description = EXCLUDED.description,
  public_bullets = EXCLUDED.public_bullets,
  metrics = EXCLUDED.metrics,
  private_context_what_id_do_differently = EXCLUDED.private_context_what_id_do_differently,
  private_context_manager_would_say = EXCLUDED.private_context_manager_would_say,
  exit_reason = EXCLUDED.exit_reason,
  verification_status = EXCLUDED.verification_status,
  verification_sources = EXCLUDED.verification_sources,
  is_featured = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order;

-- 1c. AssetMule via SoundGTM (Jul 2025) — Outbound Operations
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  public_bullets, metrics, private_context_what_id_do_differently,
  private_context_manager_would_say, exit_reason, verification_status,
  verification_sources, is_featured, display_order
) VALUES (
  'exp-assetmule',
  'keegan-moody-001',
  'AssetMule (via SoundGTM)',
  NULL,
  'GTM Contractor — Outbound Operations',
  '2025-07-01',
  '2025-07-31',
  1,
  'Remote',
  'Contract',
  'Early-stage',
  'Undisclosed',
  'Sales Engagement / Interactive Assets',
  'Supported early go-to-market execution for AssetMule, an interactive sales asset platform, by building prospecting infrastructure and launching outbound email campaigns.',
  ARRAY[
    'Built target account and contact lists in Clay for product marketers at startups up to 100 employees',
    'Configured and launched outbound email campaigns using Clay''s recently released email sequencer to drive trial signups',
    'Worked directly with Jorge Macias (now founder of GTM-Engineering.io) on campaign setup, targeting, and messaging',
    'Helped refine outreach positioning for a product-led sales tool replacing static PDFs with interactive, trackable assets'
  ],
  NULL,
  'Short, unpaid freelance engagement. I do not have verified revenue or reply-rate metrics from it. The main value was hands-on reps with Clay sequencing and working alongside Jorge.',
  NULL,
  'Contract completion',
  'VERIFIED',
  ARRAY['experience markdown / owner attestation'],
  FALSE,
  5
)
ON CONFLICT (id) DO UPDATE SET
  candidate_id = EXCLUDED.candidate_id,
  company_name = EXCLUDED.company_name,
  company_url = EXCLUDED.company_url,
  role_title = EXCLUDED.role_title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  duration_months = EXCLUDED.duration_months,
  location = EXCLUDED.location,
  employment_type = EXCLUDED.employment_type,
  company_stage = EXCLUDED.company_stage,
  company_funding = EXCLUDED.company_funding,
  company_industry = EXCLUDED.company_industry,
  description = EXCLUDED.description,
  public_bullets = EXCLUDED.public_bullets,
  metrics = EXCLUDED.metrics,
  private_context_what_id_do_differently = EXCLUDED.private_context_what_id_do_differently,
  private_context_manager_would_say = EXCLUDED.private_context_manager_would_say,
  exit_reason = EXCLUDED.exit_reason,
  verification_status = EXCLUDED.verification_status,
  verification_sources = EXCLUDED.verification_sources,
  is_featured = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order;

-- 1d. Bariatric Centers of America — 2025 GTM Build (Mar–Apr 2025)
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  public_bullets, metrics, private_context_what_id_do_differently,
  private_context_manager_would_say, exit_reason, verification_status,
  verification_sources, is_featured, display_order
) VALUES (
  'exp-bcofa-2025',
  'keegan-moody-001',
  'Bariatric Centers of America (BariTotalCare)',
  'https://bcofa.com',
  'GTM Engineer Consultant',
  '2025-03-01',
  '2025-04-30',
  2,
  'Remote / Atlanta, Georgia',
  'Contract',
  'Early-stage',
  'Undisclosed',
  'Healthcare / Bariatric Surgery & Weight Management',
  'Built outbound GTM engine for BariTotalCare across bariatric surgery, medical weight loss, HRT, and lifestyle medicine clinics.',
  ARRAY[
    'Built outbound GTM engine targeting bariatric surgery programs, medical weight loss clinics, HRT clinics, and lifestyle medicine practices',
    'Provisioned email infrastructure and configured cold email systems so BCOFA could launch outbound campaigns',
    'Conducted market research and ICP segmentation across a finite, enumerable clinic universe (~800 US bariatric programs, 3,000–5,000+ medical weight loss/HRT/lifestyle targets)',
    'Designed LinkedIn boolean search templates, clinic scraping pipelines, and enrichment workflows to feed target account lists',
    'Generated $200K+ in early-stage, founder-assisted pipeline and 20+ net-new leads for BariTotalCare clinical software (not closed revenue; no independent paper proof)',
    'Advised founders and internal teams on a weekly cadence around messaging, targeting, and operational rollout'
  ],
  NULL,
  'Short advising/execution engagement. Heavy on strategy and enablement. The $200K+ early-stage pipeline and 20+ net-new leads are founder-assisted, not closed revenue; I do not have paper proof of those numbers. I built the systems and targeting, but the long-term execution depended on BCOFA''s internal capacity.',
  NULL,
  'Contract completion',
  'VERIFIED',
  ARRAY['experience markdown / owner attestation'],
  FALSE,
  6
)
ON CONFLICT (id) DO UPDATE SET
  candidate_id = EXCLUDED.candidate_id,
  company_name = EXCLUDED.company_name,
  company_url = EXCLUDED.company_url,
  role_title = EXCLUDED.role_title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  duration_months = EXCLUDED.duration_months,
  location = EXCLUDED.location,
  employment_type = EXCLUDED.employment_type,
  company_stage = EXCLUDED.company_stage,
  company_funding = EXCLUDED.company_funding,
  company_industry = EXCLUDED.company_industry,
  description = EXCLUDED.description,
  public_bullets = EXCLUDED.public_bullets,
  metrics = EXCLUDED.metrics,
  private_context_what_id_do_differently = EXCLUDED.private_context_what_id_do_differently,
  private_context_manager_would_say = EXCLUDED.private_context_manager_would_say,
  exit_reason = EXCLUDED.exit_reason,
  verification_status = EXCLUDED.verification_status,
  verification_sources = EXCLUDED.verification_sources,
  is_featured = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order;

-- ============================================================
-- 2. INSERT / UPDATE NEW SKILLS
--    `category` is the chat bucket (strong/moderate/developing/gap)
--    `proficiency_level` preserves the original descriptive label
-- ============================================================
INSERT INTO skills (
  id, candidate_id, category, skill_name, proficiency_level, evidence, years_experience
) VALUES
  ('skill-typescript', 'keegan-moody-001', 'developing', 'TypeScript', 'Beginner → Intermediate', 'Portfolio site, Supabase Edge Functions', 1),
  ('skill-react-nextjs', 'keegan-moody-001', 'developing', 'React/Next.js', 'Beginner', 'Portfolio site', 1),
  ('skill-supabase', 'keegan-moody-001', 'developing', 'Supabase', 'Beginner', 'Database design, Edge Functions', 1),
  ('skill-api-integration', 'keegan-moody-001', 'moderate', 'API Integration', 'Intermediate', 'Claude API, Firecrawl integration', 2),
  ('skill-system-design', 'keegan-moody-001', 'moderate', 'System Design', 'Intermediate', 'Mixmax GTM Intelligence System', 2),
  ('skill-clay-outbound', 'keegan-moody-001', 'moderate', 'Clay / Outbound Infrastructure', 'Intermediate', 'AssetMule, BCOFA, Kivira — list building, sequencing, inbox provisioning', 2),
  ('skill-knowledge-graph', 'keegan-moody-001', 'moderate', 'Knowledge Graph / Context OS', 'Intermediate', 'Kivira Context OS with linked nodes, wiki-links, graph indexing', 1),
  ('skill-react-vite-leaflet', 'keegan-moody-001', 'developing', 'React + Vite + TypeScript + Leaflet', 'Beginner → Intermediate', 'Morph MSO Intelligence Platform', 1),
  ('skill-healthcare-gtm', 'keegan-moody-001', 'moderate', 'Healthcare GTM / Compliance Messaging', 'Intermediate', 'Kivira CDS framing, BCOFA HIPAA/CAN-SPAM aware outreach', 2),
  ('skill-mso-intelligence', 'keegan-moody-001', 'moderate', 'MSO Market Intelligence / PE Signal Research', 'Intermediate', 'Morph Focus HCS research — NPI/TIN, SOS, Form D, CRE signals', 1),
  ('skill-intern-onboarding', 'keegan-moody-001', 'developing', 'Intern Onboarding / Delegation', 'Beginner → Intermediate', 'Kivira — onboarded and ramped NYU interns on GTM work', 1)
ON CONFLICT (id) DO UPDATE SET
  candidate_id = EXCLUDED.candidate_id,
  category = EXCLUDED.category,
  skill_name = EXCLUDED.skill_name,
  proficiency_level = EXCLUDED.proficiency_level,
  evidence = EXCLUDED.evidence,
  years_experience = EXCLUDED.years_experience;

-- ============================================================
-- 3. UPDATE CODING GAP TO "ACTIVELY DEVELOPING"
--    Handle both known column layouts robustly.
-- ============================================================
DO $$
DECLARE
  has_gap_name boolean := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gaps_weaknesses' AND column_name = 'gap_name'
  );
  has_area boolean := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gaps_weaknesses' AND column_name = 'area'
  );
BEGIN
  IF has_gap_name THEN
    -- Modern schema (gap_name, gap_type, description, growth_path, is_active)
    DELETE FROM gaps_weaknesses
    WHERE candidate_id = 'keegan-moody-001'
      AND (gap_name ILIKE '%coding%' OR gap_name ILIKE '%technical%');

    INSERT INTO gaps_weaknesses (
      candidate_id, gap_name, gap_type, description, growth_path, is_active
    ) VALUES (
      'keegan-moody-001',
      'Coding / Technical Implementation',
      'learnable_weakness',
      'Actively developing. Built this portfolio with Next.js, TypeScript, and Supabase Edge Functions. Learning by doing.',
      'Ship working features, then refactor; pair with experienced engineers on architecture reviews.',
      TRUE
    );

  ELSIF has_area THEN
    -- Legacy schema (area, context)
    UPDATE gaps_weaknesses
    SET context = 'Actively developing. Built this portfolio with Next.js, TypeScript, and Supabase Edge Functions. Learning by doing.'
    WHERE candidate_id = 'keegan-moody-001'
      AND (area ILIKE '%coding%' OR area ILIKE '%technical%');

    IF NOT FOUND THEN
      INSERT INTO gaps_weaknesses (candidate_id, area, context)
      VALUES (
        'keegan-moody-001',
        'Coding / Technical Implementation',
        'Actively developing. Built this portfolio with Next.js, TypeScript, and Supabase Edge Functions. Learning by doing.'
      );
    END IF;
  END IF;
END $$;

-- ============================================================
-- 4. VERIFICATION QUERIES (run manually after commit to confirm)
-- ============================================================
-- Uncomment and run these in the SQL Editor if you want to verify counts.
-- SELECT 'experiences' AS table_name, COUNT(*) AS row_count
-- FROM experiences WHERE candidate_id = 'keegan-moody-001';
--
-- SELECT 'skills' AS table_name, COUNT(*) AS row_count
-- FROM skills WHERE candidate_id = 'keegan-moody-001';
--
-- SELECT 'gaps_weaknesses' AS table_name, COUNT(*) AS row_count
-- FROM gaps_weaknesses WHERE candidate_id = 'keegan-moody-001';

COMMIT;
