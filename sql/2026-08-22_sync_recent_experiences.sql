-- ============================================================
-- SYNC RECENT EXPERIENCES, SKILLS, AND CODING GAP
-- Generated: 2026-08-22
-- Author: Devin
-- Purpose: Add four new experiences (Kivira, Morph, AssetMule,
--          BCOFA 2025) plus new skills and refresh the coding gap
--          in the live Supabase portfolio DB.
--
-- Schema source of truth: introspected from the live PostgREST
-- OpenAPI document for project cvkcwvmlnghwwvdqudod on 2026-08-22.
--
--   experiences (id TEXT PK):
--     candidate_id, company_name, company_url, role_title,
--     start_date, end_date, duration_months, location,
--     employment_type, public_bullets TEXT[], display_order,
--     private_context_why_joined, private_context_why_left,
--     private_context_what_i_did,
--     private_context_proudest_achievement,
--     private_context_what_id_do_differently,
--     private_context_manager_would_say
--
--   skills (id INT PK, auto):
--     candidate_id, category, skill_name, proficiency_level, evidence
--
--   gaps_weaknesses (id INT PK, auto):
--     candidate_id, type, item, context
--
-- Notes:
--   - There are no `metrics`, `description`, `company_stage`,
--     `company_funding`, `company_industry`, `exit_reason`,
--     `verification_status`, `verification_sources`, `is_featured`,
--     `years_experience`, or `notes` columns. Do not reintroduce them.
--   - `category` on skills is the chat bucket
--     (strong / moderate / developing / gap); `proficiency_level`
--     holds the descriptive label.
--   - Unverified metrics ($200K+ pipeline, 20+ leads, 285 contacts)
--     carry their caveat inline in `public_bullets`, because the chat
--     Edge Function does not read `private_context_*` fields. The
--     longer caveat is also stored in
--     `private_context_what_id_do_differently`.
--   - Idempotent: INSERT ... ON CONFLICT (id) updates existing rows.
-- Usage: Supabase SQL Editor for project cvkcwvmlnghwwvdqudod.
-- ============================================================

BEGIN;

-- ============================================================
-- 0. REORDER EXISTING EXPERIENCES TO MAKE ROOM FOR NEW ROLES
--    Ordered most-recent-first by end_date. Volunteer / teaching
--    rows (exp-09, exp-10, exp-11) keep their 99+ ordering so they
--    stay at the bottom of the timeline.
-- ============================================================
UPDATE experiences
SET display_order = CASE id
  WHEN 'exp-01' THEN 3   -- Mixmax (Sep–Dec 2025)
  WHEN 'exp-02' THEN 5   -- Mobb AI (May–Jun 2025)
  WHEN 'exp-03' THEN 7   -- Traceair (Jun 2024–Jan 2025)
  WHEN 'exp-05' THEN 8   -- BCOFA / BARINAV 2024 (Jan–Jun 2024)
  WHEN 'exp-04' THEN 9   -- Biofourmis (Aug 2021–Jan 2023)
  WHEN 'exp-06' THEN 10  -- Barbour Orthopedics (Jun 2020–Jul 2021)
  WHEN 'exp-08' THEN 11  -- Chapel Hill Middle School (Aug 2019–Jun 2020)
  WHEN 'exp-07' THEN 12  -- ASGM Research (EPA) (2016–2020)
  ELSE display_order
END
WHERE candidate_id = 'keegan-moody-001';

-- ============================================================
-- 1. INSERT / UPDATE FOUR NEW EXPERIENCES
-- ============================================================

-- 1a. Kivira.health (Apr–Jun 2026) — GTM Engineering, outbound & knowledge systems
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  public_bullets, private_context_what_i_did,
  private_context_what_id_do_differently, display_order
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
  ARRAY[
    'Owned end-to-end cold outbound execution: prospecting, list building, campaign deployment, and cold calls',
    'Provisioned and managed 15 sending inboxes to support multi-channel outbound at scale',
    'Built and sent targeted campaigns across multiple buyer personas, including an innovation-champion campaign reaching 285 list-built/enriched CIO/CMIO/CTO contacts at health systems (outcomes not independently verified)',
    'Onboarded and ramped NYU interns interested in startup go-to-market, delegating research, outreach, and operational tasks',
    'Designed and built a Context Operating System (Context OS) — a structured knowledge graph linking market research, ICP tiers, buyer personas, messaging, and campaign artifacts',
    'Supported ICP definition around a primary-care mental-health wedge, including CoCM billing signal analysis and 9-subtier account architecture'
  ],
  'Owned cold outbound end-to-end: research, list building, sequencing, sending, and cold calls. Provisioned 15 sending inboxes. Launched an innovation-champion campaign to CIO/CMIO/CTO and digital-health leaders at health systems. Onboarded and ramped NYU interns. Built the Kivira Context OS knowledge graph of market research, ICP tiers, buyer personas, messaging, and campaign artifacts.',
  'Three-month contract focused on outbound execution, infrastructure, and knowledge-system build. I do not have verified closed-revenue numbers from the campaigns. The 285 contact count comes from list-building and enrichment; I do not have independent verification of accuracy or campaign outcomes. The real outcomes are the outbound system, the launched campaigns, the intern ramp, and the Context OS as a reusable GTM asset.',
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
  public_bullets = EXCLUDED.public_bullets,
  private_context_what_i_did = EXCLUDED.private_context_what_i_did,
  private_context_what_id_do_differently = EXCLUDED.private_context_what_id_do_differently,
  display_order = EXCLUDED.display_order;

-- 1b. Morph Data Strategies / Focus HCS (May 2026) — MSO Intelligence Engine
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  public_bullets, private_context_what_i_did,
  private_context_what_id_do_differently, display_order
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
  ARRAY[
    'Conducted deep research into the US healthcare MSO market, including private-equity consolidation, EHR fragmentation, cybersecurity exposure, and revenue-cycle degradation',
    'Delivered an executive research brief and a full scientific-format publication with abstract, methods, results, and references',
    'Built six angle dossiers identifying predictive signals for MSO target sourcing, including NPI/TIN intersections, Form D/PE hiring patterns, CRE aggregation, and RCM/SOS signals',
    'Produced six interactive HTML figures to visualize signal intersections, pre-formation timelines, tier maps, and formation funnels',
    'Built a working MSO Intelligence Platform (React + Vite + TypeScript + Leaflet) to explore and present MSO market data',
    'Dropped the EDP predictive scoring framework after it failed retrospective validation against the case cohort'
  ],
  'Built the full MSO Intelligence Engine research package for Focus HCS: executive brief, scientific-format publication, six angle dossiers covering NPPES/TIN intersections and PE/RCM/SOS/CRE signals, six interactive HTML figures, and a working React + Vite + TypeScript + Leaflet platform pushed to GitHub with a dist build.',
  'Short, focused research contract. The deliverables were substantial, but the final publication received a "needs changes" review and I do not have confirmation that it was fully accepted or deployed by the client. The MSO Intelligence Platform exists as a working build on GitHub. The EDP scoring framework was dropped after retrospective validation failed, which is the honest framing.',
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
  public_bullets = EXCLUDED.public_bullets,
  private_context_what_i_did = EXCLUDED.private_context_what_i_did,
  private_context_what_id_do_differently = EXCLUDED.private_context_what_id_do_differently,
  display_order = EXCLUDED.display_order;

-- 1c. AssetMule via SoundGTM (Jul 2025) — Outbound Operations
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  public_bullets, private_context_what_i_did,
  private_context_what_id_do_differently, display_order
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
  ARRAY[
    'Built target account and contact lists in Clay for product marketers at startups up to 100 employees',
    'Configured and launched outbound email campaigns using Clay''s recently released email sequencer to drive trial signups',
    'Worked directly with Jorge Macias (now founder of GTM-Engineering.io) on campaign setup, targeting, and messaging',
    'Helped refine outreach positioning for a product-led sales tool replacing static PDFs with interactive, trackable assets'
  ],
  'Built Clay tables with target accounts and contacts, used Clay''s then newly released email sequencer to send campaigns, and collaborated with Jorge Macias on setup, targeting, and messaging.',
  'Short, unpaid freelance engagement. I do not have verified revenue or reply-rate metrics from it. The value was hands-on reps with Clay sequencing and working alongside Jorge.',
  4
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
  public_bullets = EXCLUDED.public_bullets,
  private_context_what_i_did = EXCLUDED.private_context_what_i_did,
  private_context_what_id_do_differently = EXCLUDED.private_context_what_id_do_differently,
  display_order = EXCLUDED.display_order;

-- 1d. Bariatric Centers of America — 2025 GTM build (Mar–Apr 2025)
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  public_bullets, private_context_what_i_did,
  private_context_what_id_do_differently, display_order
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
  ARRAY[
    'Built outbound GTM engine targeting bariatric surgery programs, medical weight loss clinics, HRT clinics, and lifestyle medicine practices',
    'Provisioned email infrastructure and configured cold email systems so BCOFA could launch outbound campaigns',
    'Conducted market research and ICP segmentation across a finite, enumerable clinic universe (~800 US bariatric programs, 3,000–5,000+ medical weight loss/HRT/lifestyle targets)',
    'Designed LinkedIn boolean search templates, clinic scraping pipelines, and enrichment workflows to feed target account lists',
    'Generated $200K+ in early-stage, founder-assisted pipeline and 20+ net-new leads for BariTotalCare clinical software (not closed revenue; no independent paper proof)',
    'Advised founders and internal teams on a weekly cadence around messaging, targeting, and operational rollout'
  ],
  'Built the outbound GTM engine for the BariTotalCare clinical software: provisioned inboxes, configured cold email, built target lists across bariatric surgery, medical weight loss, HRT, and lifestyle medicine, wrote Python scraping and enrichment pipelines, designed LinkedIn search strings, and met weekly with founders and internal teams.',
  'Short advising and enablement engagement. The $200K+ early-stage pipeline and 20+ net-new leads are founder-assisted, not closed revenue, and I do not have paper proof of those numbers. I built the systems and targeting; long-term execution depended on BCOFA''s internal capacity.',
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
  public_bullets = EXCLUDED.public_bullets,
  private_context_what_i_did = EXCLUDED.private_context_what_i_did,
  private_context_what_id_do_differently = EXCLUDED.private_context_what_id_do_differently,
  display_order = EXCLUDED.display_order;

-- ============================================================
-- 2. INSERT NEW SKILLS
--    `id` is an auto-generated integer, so rows are keyed on
--    (candidate_id, skill_name) via the guard below rather than
--    ON CONFLICT.
-- ============================================================
INSERT INTO skills (candidate_id, category, skill_name, proficiency_level, evidence)
SELECT * FROM (VALUES
  ('keegan-moody-001', 'developing', 'TypeScript', 'Beginner → Intermediate', 'Portfolio site, Supabase Edge Functions'),
  ('keegan-moody-001', 'developing', 'React/Next.js', 'Beginner', 'Portfolio site'),
  ('keegan-moody-001', 'developing', 'Supabase / PostgreSQL', 'Beginner', 'Database design, Edge Functions'),
  ('keegan-moody-001', 'moderate', 'API Integration', 'Intermediate', 'Claude API, Firecrawl integration'),
  ('keegan-moody-001', 'moderate', 'System Design', 'Intermediate', 'Mixmax GTM Intelligence System'),
  ('keegan-moody-001', 'moderate', 'Clay / Outbound Infrastructure', 'Intermediate', 'AssetMule, BCOFA, Kivira — list building, sequencing, inbox provisioning'),
  ('keegan-moody-001', 'moderate', 'Knowledge Graph / Context OS', 'Intermediate', 'Kivira Context OS with linked nodes, wiki-links, graph indexing'),
  ('keegan-moody-001', 'developing', 'React + Vite + TypeScript + Leaflet', 'Beginner → Intermediate', 'Morph MSO Intelligence Platform'),
  ('keegan-moody-001', 'moderate', 'Healthcare GTM / Compliance Messaging', 'Intermediate', 'Kivira CDS framing, BCOFA HIPAA/CAN-SPAM aware outreach'),
  ('keegan-moody-001', 'moderate', 'MSO Market Intelligence / PE Signal Research', 'Intermediate', 'Morph Focus HCS research — NPI/TIN, SOS, Form D, CRE signals'),
  ('keegan-moody-001', 'developing', 'Intern Onboarding / Delegation', 'Beginner → Intermediate', 'Kivira — onboarded and ramped NYU interns on GTM work')
) AS incoming (candidate_id, category, skill_name, proficiency_level, evidence)
WHERE NOT EXISTS (
  SELECT 1 FROM skills existing
  WHERE existing.candidate_id = incoming.candidate_id
    AND existing.skill_name = incoming.skill_name
);

-- ============================================================
-- 3. REFRESH THE CODING GAP TO "ACTIVELY DEVELOPING"
--    Live layout is (candidate_id, type, item, context).
-- ============================================================
UPDATE gaps_weaknesses
SET type = 'Learnable Weakness',
    context = 'Actively developing, not a hard limitation. Built this portfolio end to end with Next.js, TypeScript, and Supabase Edge Functions, plus the Morph MSO Intelligence Platform in React/Vite/Leaflet. Not applying for engineering roles, but can ship what I need.'
WHERE candidate_id = 'keegan-moody-001'
  AND item ILIKE '%production code%';

-- ============================================================
-- 4. VERIFICATION QUERIES
-- ============================================================
-- SELECT id, company_name, role_title, display_order
-- FROM experiences WHERE candidate_id = 'keegan-moody-001'
-- ORDER BY display_order;
--
-- SELECT category, skill_name, proficiency_level
-- FROM skills WHERE candidate_id = 'keegan-moody-001'
-- ORDER BY category, skill_name;
--
-- SELECT type, item, context
-- FROM gaps_weaknesses WHERE candidate_id = 'keegan-moody-001';

COMMIT;
