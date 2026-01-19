-- Keegan Moody Portfolio Data
-- Generated from outputs/supabase_export.json
-- Run this AFTER create_tables.sql

-- ============================================
-- INSERT: candidate_profiles
-- ============================================
INSERT INTO candidate_profiles (
  id, first_name, last_name, email, location, headline, summary,
  primary_role_type, ideal_company_stage, ideal_environment, work_style,
  linkedin_url, github_url, portfolio_url
) VALUES (
  'keegan-moody-001',
  'Keegan',
  'Moody',
  'keeganmoody@gmail.com',
  'Atlanta, Georgia',
  'GTM Engineer | I build go-to-market infrastructure from scratch at early-stage startups',
  'I build GTM infrastructure from scratch at early-stage startups. Not campaigns—systems. The methodology, the automation, the intelligence layer that makes outbound repeatable. Track record includes work at a digital health unicorn (Biofourmis), a Series B construction tech company (TraceAir), and an AI-native sales platform (Mixmax). The pattern is consistent: give me a greenfield problem and autonomy, and I build something that outlasts my tenure.',
  'GTM Engineer / Sales Development / Business Development',
  ARRAY['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D', 'Unicorn', 'Public', 'Pre-funded', 'Growth', 'Any (depends on context)'],
  ARRAY['High autonomy', 'Outcome-measured', 'Technical B2B SaaS', 'Healthcare tech'],
  'Operator, builder, idea generator, and a craftsman—physical and digital. I love different—sometimes to a fault. Experience architecting outbound systems from zero. True GTM engineer. Quality over quantity. Geek for great products. Systems thinker.',
  NULL,
  NULL,
  NULL
);

-- ============================================
-- INSERT: experiences
-- ============================================

-- Mixmax
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  key_deliverables, metrics, honest_assessment, exit_reason,
  verification_status, verification_sources, is_featured, display_order
) VALUES (
  'exp-001',
  'keegan-moody-001',
  'Mixmax',
  'https://www.mixmax.com',
  'Founding GTM Engineer',
  '2025-09-01',
  '2025-12-12',
  4,
  'Remote',
  'Contract',
  'Series B',
  '$22.1M',
  'Sales Engagement / Sales Tech',
  'Built complete GTM intelligence system from zero. Validated 402 customer accounts ($4.79M ARR) using bidirectional Volley Method. Discovered power law: 15% of accounts = 66% of revenue. Designed 9-agent Gutenberg Framework for autonomous sales execution. Built 50+ warmed inboxes across ScaledMail, Pager AI, SmartLead AI.',
  ARRAY['The Volley Method (ICP validation methodology)', 'Tacit Knowledge Extraction Framework', 'Golden Goose 100-point scoring model', '9-agent Gutenberg Framework', '50+ warmed domain infrastructure', '30+ strategic documents with provenance tracking'],
  NULL,
  'Built infrastructure and validated methodology but fell short on volume targets. 3,770 delivered vs 9,000 expected. Contract ended before full execution.',
  'Contract ended early',
  'VERIFIED',
  ARRAY['Service agreements', 'NOVEMBER 0742 documentation'],
  TRUE,
  1
);

-- Mobb
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  key_deliverables, honest_assessment, exit_reason,
  verification_status, verification_sources, is_featured, display_order
) VALUES (
  'exp-002',
  'keegan-moody-001',
  'Mobb',
  'https://mobb.ai',
  'GTM | Business Development',
  '2025-05-01',
  '2025-07-31',
  3,
  'Remote',
  'Contract',
  'Seed',
  '$5.4M',
  'Application Security / DevSecOps',
  'Early GTM hire at seed-stage security startup. Focused on market research, go-to-market strategy development, and business development during company''s early growth phase.',
  ARRAY['Call scripts', 'Product briefs', 'One-pager collateral', 'Market research'],
  'Short tenure (3 months) limits documentation depth. Contract-based engagement.',
  'Contract completion',
  'VERIFIED',
  ARRAY['LinkedIn', 'Work product files'],
  FALSE,
  2
);

-- TraceAir
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  key_deliverables, metrics, honest_assessment, exit_reason,
  verification_status, verification_sources, is_featured, display_order
) VALUES (
  'exp-003',
  'keegan-moody-001',
  'TraceAir Technologies',
  'https://www.traceair.net',
  'Senior Sales Development Representative',
  '2024-07-01',
  '2025-01-31',
  7,
  'Seattle, Washington (Remote)',
  'Full-time',
  'Series B',
  '$64M',
  'Construction Tech / Drone Software',
  'SDR role during post-Series B growth phase. Prospected outbound, inbound, and nurtured accounts across 13 states. Achieved 147% quota attainment with 21% connection rate vs 4-6% team average.',
  ARRAY['22 demos in September 2024 (147% of 15/month quota)', '$216,437.50 closed-won revenue', '21% connection rate (vs 4-6% team average)', 'Prospected across 13 states'],
  '{"demos_booked": 22, "quota": 15, "quota_attainment_percent": 147, "connection_rate_percent": 21, "team_average_connection_rate_percent": 5, "closed_won_revenue": 216437.50}'::JSONB,
  'Strong performance metrics but terminated despite results. Fit mismatch with activity-metric culture.',
  'Terminated',
  'VERIFIED',
  ARRAY['Offer letter', 'Gmail records', 'Apple Notes stats'],
  TRUE,
  3
);

-- Bariatric Centers of America
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  key_deliverables, honest_assessment, exit_reason,
  verification_status, verification_sources, is_featured, display_order
) VALUES (
  'exp-004',
  'keegan-moody-001',
  'Bariatric Centers of America',
  'https://bcofa.com',
  'Senior Sales Consultant',
  '2024-01-01',
  '2024-06-30',
  6,
  'Atlanta, Georgia',
  'Contract',
  'Early-stage',
  'Undisclosed',
  'Healthcare Tech / Bariatric Surgery',
  'Collaborated on enterprise sales and BariNAV product development. Helped bring technology solutions to bariatric surgery programs.',
  ARRAY['Enterprise sales development', 'BariNAV product-market validation'],
  'Consulting engagement bridging gap period. Limited documentation.',
  'Contract completion',
  'MODERATE',
  ARRAY['LinkedIn'],
  FALSE,
  4
);

-- Biofourmis
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  key_deliverables, metrics, honest_assessment, exit_reason,
  verification_status, verification_sources, is_featured, display_order
) VALUES (
  'exp-005',
  'keegan-moody-001',
  'Biofourmis',
  'https://biofourmis.com',
  'Sales Development Representative',
  '2021-08-01',
  '2023-01-31',
  17,
  'Atlanta, Georgia (Remote)',
  'Full-time',
  'Series C → Unicorn',
  '$465M',
  'Digital Health / Remote Patient Monitoring',
  '2nd SDR hired for Commercial Care vertical at company that achieved unicorn status during tenure. Prospecting sourced the Orlando Health deal—90-day close, fastest in company history. Employed during Series D ($1.3B valuation, April 2022).',
  ARRAY['Sourced Orlando Health deal (90-day close, fastest in company history)', 'Built compliance-driven prospecting methodology (CMS readmission penalties)', 'Contributed to Commercial Care vertical launch'],
  '{"deal_close_time_days": 90, "company_milestone": "Unicorn status ($1.3B valuation)"}'::JSONB,
  'Strong individual performance but terminated. Autonomy paradox—high output but friction with organizational structure. Critical: SDRs SOURCE deals, AEs CLOSE them. Tyler Cole (AE) closed the Orlando Health deal.',
  'Terminated',
  'VERIFIED',
  ARRAY['LinkedIn', 'Experience documentation', 'Company funding records'],
  TRUE,
  5
);

-- Barbour Orthopaedics
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  key_deliverables, honest_assessment, exit_reason,
  verification_status, verification_sources, is_featured, display_order
) VALUES (
  'exp-006',
  'keegan-moody-001',
  'Barbour Orthopaedics & Spine',
  NULL,
  'Corporate Development Associate',
  '2020-06-01',
  '2021-07-31',
  13,
  'Atlanta, Georgia',
  'Full-time',
  'Established',
  NULL,
  'Healthcare / Orthopedics',
  'Corporate development role at orthopedic practice. Front desk operations and administrative support.',
  ARRAY[]::TEXT[],
  'Transitional role during career pivot from academic to professional track.',
  'Moved to new opportunity',
  'VERIFIED',
  ARRAY['LinkedIn'],
  FALSE,
  6
);

-- Research
INSERT INTO experiences (
  id, candidate_id, company_name, company_url, role_title,
  start_date, end_date, duration_months, location, employment_type,
  company_stage, company_funding, company_industry, description,
  key_deliverables, metrics, honest_assessment, exit_reason,
  verification_status, verification_sources, is_featured, display_order
) VALUES (
  'exp-007',
  'keegan-moody-001',
  'Dr. William Kiefer / Mercury Research',
  NULL,
  'Research Assistant',
  '2016-01-01',
  '2018-12-31',
  36,
  'South America / Macon, Georgia',
  'Research Position',
  'Academic',
  NULL,
  'Environmental Science / Mercury Research',
  '270 days of fieldwork studying mercury contamination in artisanal gold mining communities in South America. Published 4 peer-reviewed papers in Elsevier and MethodsX journals.',
  ARRAY['KMOODY_2020_ELSEVIER.pdf', 'KMOODY_2020_HGEMISSIONS.pdf', 'KMOODY.ASGM-HG 2020.pdf', 'KMOODY_METHODSX COVERPG 2020.pdf'],
  '{"fieldwork_days": 270, "publications": 4}'::JSONB,
  'Best-documented role in portfolio. Peer-reviewed publications are strong third-party verification.',
  'Research completion / graduation',
  'VERIFIED',
  ARRAY['Peer-reviewed publications'],
  TRUE,
  7
);

-- ============================================
-- INSERT: skills
-- ============================================

INSERT INTO skills (id, candidate_id, category, skill_name, proficiency_level, evidence, years_experience) VALUES
('skill-001', 'keegan-moody-001', 'GTM / Sales', 'Cold Outreach Strategy', 'STRONG', 'Orlando Health deal (90-day close), 22 demos at TraceAir with 147% quota', 4),
('skill-002', 'keegan-moody-001', 'GTM / Sales', 'Prospecting / Lead Sourcing', 'STRONG', 'Built methodology at every role—hospital readmission research, land development project hunting, ICP validation', 4),
('skill-003', 'keegan-moody-001', 'GTM / Sales', 'ICP Development', 'STRONG', 'Defined personas at Biofourmis (QA Directors), TraceAir (land developers), Mixmax (sales leaders via Volley Method)', 4),
('skill-004', 'keegan-moody-001', 'GTM / Sales', 'Territory Development', 'STRONG', 'Built greenfield territory at TraceAir with 1/4 contacts of peers, still led in demos', 3),
('skill-005', 'keegan-moody-001', 'Technical / Tools', 'Clay', 'STRONG', 'Built full workflows at Mixmax, 12k+ row tables, automated enrichment pipelines', 1),
('skill-006', 'keegan-moody-001', 'Technical / Tools', 'Smartlead', 'STRONG', 'Set up campaigns, domain management, sequencing at Mixmax', 1),
('skill-007', 'keegan-moody-001', 'Technical / Tools', 'HubSpot', 'STRONG', 'Used extensively at Biofourmis for sequencing', 2),
('skill-008', 'keegan-moody-001', 'Technical / Tools', 'Salesforce', 'STRONG', 'Used at TraceAir and Biofourmis for pipeline management', 3),
('skill-009', 'keegan-moody-001', 'Technical / Tools', 'LinkedIn Sales Navigator', 'STRONG', 'Primary prospecting tool at TraceAir, power user', 3),
('skill-010', 'keegan-moody-001', 'Technical / Tools', 'ZoomInfo / Apollo', 'STRONG', 'Used at Biofourmis and Mixmax for data enrichment', 2),
('skill-011', 'keegan-moody-001', 'Technical / Tools', 'ChatGPT / AI Tools', 'STRONG', 'Built AI-powered workflows, prompt engineering for GTM, 9-agent Gutenberg Framework design', 2),
('skill-012', 'keegan-moody-001', 'Research / Analysis', 'Primary Research', 'STRONG', '270 days fieldwork in South America, 4 published papers', 3),
('skill-013', 'keegan-moody-001', 'Research / Analysis', 'Pattern Recognition', 'STRONG', 'Finding angles in markets (hospital readmissions, land developments, power law revenue)', 4),
('skill-014', 'keegan-moody-001', 'Research / Analysis', 'Framework Development', 'STRONG', 'Volley Method, Tacit Knowledge Extraction, Golden Goose Model, Gutenberg Framework', 2),
('skill-015', 'keegan-moody-001', 'GTM / Sales', 'Account Executive / Closing', 'MODERATE', 'Have never closed deals—always originated for AEs', 0),
('skill-016', 'keegan-moody-001', 'Soft Skills', 'Managing Up', 'GAP', 'Two terminations partly due to political misalignment', NULL),
('skill-017', 'keegan-moody-001', 'Leadership', 'People Management', 'GAP', 'Have never managed direct reports. Led by influence, not authority.', 0);

-- ============================================
-- INSERT: achievements
-- ============================================

INSERT INTO achievements (id, candidate_id, experience_id, achievement_type, title, description, metric_value, metric_unit, verification_status, verification_source, honest_framing, is_featured) VALUES
('ach-001', 'keegan-moody-001', 'exp-001', 'METHODOLOGY', 'Built Complete GTM Intelligence System', 'Created enterprise-grade GTM intelligence system including Volley Method for ICP validation, Tacit Knowledge Extraction framework, Golden Goose 100-point scoring model, and 9-agent Gutenberg Framework.', NULL, NULL, 'VERIFIED', 'NOVEMBER 0742 documentation', NULL, TRUE),
('ach-002', 'keegan-moody-001', 'exp-001', 'DISCOVERY', 'Discovered Power Law Revenue Distribution', 'Through Volley Method analysis of 402 customer accounts ($4.79M ARR), discovered that 15% of accounts generate 66% of revenue. 51-200 employee segment produces 2x ARR with only 23% of customer base.', 66, 'percent_revenue_concentration', 'VERIFIED', 'ICP_VALIDATION_AUDIT_REPORT.md', NULL, TRUE),
('ach-003', 'keegan-moody-001', 'exp-001', 'INFRASTRUCTURE', 'Built 50+ Warmed Domain Infrastructure', 'Created email infrastructure with 50+ warmed inboxes across ScaledMail (33), Pager AI, and SmartLead AI for outbound campaign deployment.', 50, 'warmed_domains', 'VERIFIED', 'LINKEDIN_SUMMARY.md, service documentation', NULL, TRUE),
('ach-004', 'keegan-moody-001', 'exp-003', 'QUOTA', '147% Quota Attainment', 'Booked 22 demos in September 2024 against a quota of 15, achieving 147% attainment with 21% connection rate vs 4-6% team average.', 147, 'percent_quota', 'VERIFIED', 'Apple_Notes/TRACEAIR_STATS.md, user verification', NULL, TRUE),
('ach-005', 'keegan-moody-001', 'exp-003', 'REVENUE', '$216K Closed-Won Revenue', 'Generated $216,437.50 in closed-won revenue from prospecting efforts.', 216437.50, 'USD', 'VERIFIED', 'Gmail records', NULL, TRUE),
('ach-006', 'keegan-moody-001', 'exp-005', 'DEAL_VELOCITY', 'Sourced Fastest Deal in Company History', 'Prospecting sourced the Orlando Health deal which closed in 90 days—fastest in Biofourmis company history. AE Tyler Cole closed the deal.', 90, 'days_to_close', 'UNVERIFIED_WITH_HONEST_FRAMING', 'Experience documentation, user confirmation (no paper proof)', 'My prospecting sourced the deal. AE Tyler Cole closed it. 90-day close—fastest in company history.', TRUE),
('ach-007', 'keegan-moody-001', 'exp-005', 'MILESTONE', 'Present During Unicorn Milestone', 'Employed at Biofourmis during company''s Series D funding ($300M, $1.3B valuation) in April 2022, achieving unicorn status.', 1.3, 'billion_valuation', 'VERIFIED', 'MobiHealthNews, Crunchbase', NULL, FALSE),
('ach-008', 'keegan-moody-001', 'exp-007', 'PUBLICATION', '4 Peer-Reviewed Publications', 'Published 4 peer-reviewed papers on mercury contamination research in Elsevier and MethodsX journals following 270 days of fieldwork in South America.', 4, 'publications', 'VERIFIED', 'PDF publication files', NULL, TRUE);

-- ============================================
-- INSERT: ai_instructions
-- ============================================

INSERT INTO ai_instructions (
  id, candidate_id, version,
  voice_guidelines, critical_distinctions, honest_framing,
  success_patterns, failure_patterns, environment_fit,
  one_liners, methodologies
) VALUES (
  'ai-001',
  'keegan-moody-001',
  '2.0',
  '{
    "tone": "Confident but not arrogant. Honest about setbacks. Specific and concrete.",
    "perspective_portfolio": "First person",
    "perspective_bios": "Third person",
    "do_say": [
      "Builder, not optimizer",
      "Builds GTM infrastructure, not just campaigns",
      "Quality over quantity approach",
      "Systems thinker—creates repeatable methodology",
      "Healthcare tech expertise",
      "Honest about setbacks",
      "0→1 specialist"
    ],
    "dont_say": [
      "Job hopper (reframe as startup volatility + fit mismatch)",
      "Underperformer (metrics show opposite)",
      "Laid off (he was fired—be honest)",
      "Closed deals at Biofourmis (he sourced them—SDR role)",
      "Contributed to unicorn (too vague)"
    ]
  }'::JSONB,
  '[
    {
      "context": "Biofourmis Orlando Health deal",
      "incorrect": "Keegan closed the fastest deal in company history",
      "correct": "Keegan''s prospecting sourced what became the fastest close in company history",
      "reason": "SDRs source deals, AEs close them. Tyler Cole (AE) closed this deal."
    },
    {
      "context": "Biofourmis unicorn",
      "incorrect": "Contributed to unicorn status",
      "correct": "Employed during unicorn milestone (April 2022)",
      "reason": "''Contributed to'' is vague. Timeline fact is verifiable."
    }
  ]'::JSONB,
  '{
    "terminations": {
      "fact": "Fired twice while exceeding quota (Biofourmis, TraceAir)",
      "framing": "Fit mismatch between autonomous work style and activity-metric culture. His method (fewer calls, better research) conflicts with call-volume cultures."
    },
    "mixmax_gap": {
      "fact": "3,770 delivered vs 9,000 target (42%)",
      "framing": "Built infrastructure and validated methodology but fell short on volume targets. Contract ended before full execution. Honest about that gap."
    },
    "gap_period": {
      "fact": "Home Depot cart pusher, Kevin Rathbun''s Steakhouse (2023)",
      "framing": "Survival jobs during job search. What you build next matters more than how you survived."
    }
  }'::JSONB,
  ARRAY[
    'Greenfield Builder: Excels at 0→1, building systems from scratch',
    'Methodical Prospector: Quality over quantity (21% vs 4-6% connection rate)',
    'Systems Thinker: Builds repeatable infrastructure, not one-off campaigns',
    'Healthcare Expertise: Deep domain knowledge in digital health, hospital systems',
    'Documentation Discipline: Everything traced to sources, methodology preserved'
  ],
  ARRAY[
    'Autonomy Paradox: High performance creates friction, not trust',
    'Short Tenure Cycle: Roles end before 12 months',
    'Delivery Under Constraints: Struggles when forced into different methodology',
    'Political Misalignment: Results without relationship-building is a losing hand'
  ],
  '{
    "thrives_in": [
      "Seed to Series B startups",
      "Building new verticals/territories from zero",
      "Outcome-measured cultures (revenue, not activity)",
      "Autonomous work environments",
      "Healthcare/technical B2B SaaS",
      "Roles where methodology matters"
    ],
    "struggles_in": [
      "Activity-metric cultures (calls/day)",
      "Highly structured sales processes",
      "Micromanagement environments",
      "Cultures where political alignment trumps results"
    ]
  }'::JSONB,
  '{
    "general": "I build GTM infrastructure from scratch at early-stage startups.",
    "metrics": "147% quota. $216k closed. 90-day sourced deal. I care about the scoreboard.",
    "methodology": "I built a 9-agent autonomous sales system and validated ICP across 402 accounts.",
    "honesty": "I''ve been fired twice while hitting quota. Here''s what that teaches you.",
    "healthcare": "From mercury research to unicorn deals—I speak both science and sales."
  }'::JSONB,
  '[
    {
      "name": "The Volley Method",
      "use_when": "You need to validate ICP assumptions",
      "process": "Quantitative analysis (revenue, size, industry) ↔ Qualitative analysis (case studies, interviews)",
      "output": "Reconciled ICP with revenue-weighted targeting parameters"
    },
    {
      "name": "Tacit Knowledge Extraction",
      "use_when": "Case studies exist but buying triggers are unclear",
      "process": "Raw extraction → Pattern synthesis → Trigger identification",
      "output": "Unstated buying motivations and failure conditions"
    },
    {
      "name": "Golden Goose Scoring",
      "use_when": "Customer base needs prioritization for targeting",
      "process": "6-factor weighted scoring (100 points)",
      "output": "4-tier segmentation (Platinum, Gold, Silver, Bronze)"
    }
  ]'::JSONB
);

-- ============================================
-- VERIFY INSERT COUNTS
-- ============================================
-- Expected counts after running:
-- candidate_profiles: 1
-- experiences: 7
-- skills: 17
-- achievements: 8
-- ai_instructions: 1
