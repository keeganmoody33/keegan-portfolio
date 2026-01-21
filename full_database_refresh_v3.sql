-- ============================================
-- FULL DATABASE REFRESH v3: lecturesfrom.com Portfolio
-- ============================================
-- Generated: 2026-01-21
-- Source: LECTURESFROM_PORTFOLIO_CONTENT_FINAL.md
-- Fixed: Using actual experiences schema with public_bullets and private_context_* columns
-- 
-- Run this in the Supabase SQL Editor.
-- ============================================

-- ============================================
-- STEP 1: UPDATE candidate_profiles
-- ============================================

UPDATE candidate_profiles
SET
  first_name = 'Keegan',
  last_name = 'Moody',
  email = 'keeganmoody33@gmail.com',
  location = 'Atlanta, Georgia (Remote preference)',
  headline = 'Product Builder / GTM Engineer — I ship full-stack web apps, AI-native products, and GTM infrastructure',
  summary = 'I''m a product builder with a science background — biochemistry degree, 270 days of mercury research in South America, EPA-published papers. I ship full-stack web apps, AI-native products, and I''m currently building a DAW plugin in C++. I came up through GTM engineering, which means I understand both the product and the market. I learn by taking things apart.',
  primary_role_type = 'Product Builder / GTM Engineer',
  ideal_company_stage = ARRAY['Seed', 'Series A', 'Series B'],
  ideal_environment = ARRAY['0-to-1 building', 'Autonomy with guardrails', 'Outcome-based metrics', 'Elite collaborators', 'Path toward product'],
  work_style = 'Deep work over shallow tasks. Quality over quantity. Builder mentality — I learn by taking things apart. Need feedback loops and check-ins to do my best work.',
  linkedin_url = NULL,
  github_url = 'https://github.com/keeganmoody33',
  portfolio_url = 'https://lecturesfrom.com',
  updated_at = NOW()
WHERE id = 'keegan-moody-001';

-- ============================================
-- STEP 2: REFRESH experiences (CORRECT SCHEMA)
-- ============================================

DELETE FROM experiences WHERE candidate_id = 'keegan-moody-001';

INSERT INTO experiences (
  id, candidate_id, company_name, role_title,
  start_date, end_date, duration_months, location, employment_type,
  public_bullets,
  private_context_why_joined,
  private_context_why_left,
  private_context_what_i_did,
  private_context_proudest_achievement,
  private_context_what_id_do_differently,
  private_context_manager_would_say,
  display_order
) VALUES

-- Mixmax
(
  'exp-mixmax-001',
  'keegan-moody-001',
  'Mixmax',
  'Founding GTM Engineer',
  '2024-10-01',
  '2024-12-12',
  3,
  'Remote',
  'Contract',
  ARRAY[
    'First dedicated GTM Engineer for Series B sales engagement platform during AI pivot',
    'Built 53-inbox infrastructure with multi-provider diversification (33 ScaledMail, 20 SmartLead)',
    'Designed 9-agent Gutenberg Framework for scalable prospecting',
    'Created 65-page GTM Intelligence Compendium with "The Volley Method" for ICP validation',
    'Integrated Clay → Octave → SmartLead → HeyReach pipeline',
    'Reported directly to CRO with full autonomy over outbound strategy and budget'
  ],
  'Dream opportunity: full autonomy, budget, direct line to CRO. Chance to build GTM infrastructure from scratch at a Series B company during their AI pivot.',
  'Contract ended early. I didn''t generate revenue. Built frameworks instead of shipping campaigns. This was a shipping problem, not politics. Delivered 42% of target (3,770 vs 9,000 contacts).',
  'Built complete outbound infrastructure from scratch. 53 inboxes, 9-agent framework, 65-page intelligence compendium, full pipeline integration. I was rebuilding the engine when they needed me to drive the car.',
  'The GTM Intelligence Compendium — 65 pages of research-level ICP validation using "The Volley Method." Academic-level documentation that could be a template for any GTM team.',
  'Ship ugly and iterate. Move faster. Communicate what I''m DOING, not thinking. Request check-ins even when not offered. "Ship first, buzzer-beater second."',
  'Talented. Creative. Struggled with execution. If you hire him, give him clear deadlines and check-ins. The raw talent is there.',
  1
),

-- Trace Air
(
  'exp-traceair-001',
  'keegan-moody-001',
  'TraceAir Technologies',
  'Sales Development Representative',
  '2024-07-01',
  '2025-01-31',
  7,
  'Seattle, Washington (Remote)',
  'Full-time',
  ARRAY[
    'Record month: 20 demos in September 2024 (company record)',
    '18 of 20 demos sourced from contacts outside the CRM (self-generated)',
    '21% connection rate vs 4-6% team average',
    '$216,437.50 closed-won revenue from prospecting efforts',
    'Greenfield territory with 2,200 contacts vs peers with 8,800+'
  ],
  'Post-Series B construction tech company. Opportunity to build a greenfield territory and prove quality-over-quantity approach.',
  'Got fired. Stood up for my team. Manager felt threatened, politicked against me. Same pattern — top performer, still fired.',
  'Built greenfield territory from scratch with 1/4 the contacts of peers. Developed self-sourcing methodology that generated 18 of 20 demos in record month.',
  'Record month — 20 demos with 18 self-sourced. Proved that quality-over-quantity works when you have the right targeting.',
  'Build relationships before pushing back publicly. Politics matter. Pick battles more carefully.',
  'Top performer who didn''t fit the culture. Great at the work, struggled with the politics.',
  2
),

-- Biofourmis
(
  'exp-biofourmis-001',
  'keegan-moody-001',
  'Biofourmis Inc.',
  'Sales Development Representative',
  '2021-08-01',
  '2023-01-31',
  17,
  'Atlanta, Georgia (Remote)',
  'Full-time',
  ARRAY[
    'Originated Orlando Health deal — estimated $1M+ lifetime revenue, still generating income',
    '90-day close — fastest deal in company history at that time',
    'Led team in qualified opportunities despite lower activity metrics',
    'Developed quality-over-quantity outreach methodology',
    'Employed during Series D funding ($1.3B valuation, April 2022)'
  ],
  '2nd SDR hired for Commercial Care vertical at digital health company. Opportunity to get into healthcare tech after pivoting from clinical path.',
  'Got fired. Expected 80 calls/day, I did 20-40. Top performer in results, didn''t hit activity metrics. Being right doesn''t protect you.',
  'Originated the Orlando Health deal that became one of the company''s largest. CRITICAL: I SOURCED this deal. AE Tyler Cole CLOSED it. SDRs source, AEs close.',
  'Orlando Health deal — $1M+ lifetime value, 90-day close (fastest in company history). Still generating revenue years later.',
  'Manage perception, not just results. Hit the activity metrics even if you think they''re wrong. Or leave before they fire you.',
  'Great at generating quality opportunities, didn''t fit the activity-metrics culture. Would hire him in an outcomes-based environment.',
  3
),

-- Barbour Orthopedics
(
  'exp-barbour-001',
  'keegan-moody-001',
  'Barbour Orthopaedics & Spine',
  'Front Desk Office Associate',
  '2020-07-01',
  '2021-07-31',
  12,
  'Atlanta, Georgia',
  'Full-time',
  ARRAY[
    'Managed front desk operations for private orthopedic surgery practice (5 locations in Metro Atlanta)',
    'Processed patient intake documentation and coordinated treatment scheduling',
    'Promoted to key holder and staff trainer at Forest Park location',
    'Developed strong patient-facing customer service skills'
  ],
  'Needed a job after COVID disrupted plans. Opportunity to see healthcare from the business side.',
  'Moved to new opportunity. This experience showed me the business side of healthcare I was previously unaware of.',
  'Front desk operations, patient intake, scheduling. Promoted to key holder and staff trainer.',
  'Getting promoted to key holder and trainer. Showed I could take on responsibility quickly.',
  'Nothing major — this was a transitional role that served its purpose.',
  'Reliable, detail-oriented, good with patients. Promoted quickly.',
  4
),

-- Chapel Hill
(
  'exp-chapelhill-001',
  'keegan-moody-001',
  'Chapel Hill Middle/High School',
  'Special Education Paraprofessional & Football Coach',
  '2019-08-01',
  '2020-06-30',
  10,
  'Georgia',
  'Full-time',
  ARRAY[
    'Special Education Paraprofessional working with high-functioning autistic students (6th-8th grade)',
    'Developed individualized teaching approaches across multiple subjects',
    'Served as Defensive Football Coach for varsity program',
    'Managed JV game logistics and player development'
  ],
  'Planned gap year before medical school. Wanted to give back and work with students.',
  'COVID hit, needed to pivot. Medical school path ended.',
  'Taught special education students, coached football. Learned that different people need different approaches.',
  'The relationships with students and coaches. "You could have a terrible job. And if you''re with great people, that job''s pretty great as well."',
  'Nothing — this was the funnest job I''ve ever had.',
  'Great with the kids, reliable, brought energy to the program.',
  5
),

-- Mercury Research
(
  'exp-research-001',
  'keegan-moody-001',
  'Dr. Adam Kiefer / Mercury Research',
  'Research Assistant',
  '2016-01-01',
  '2019-05-31',
  40,
  'South America / Macon, Georgia',
  'Research Position',
  ARRAY[
    '270 days of fieldwork in South America studying mercury contamination',
    'Published 4 peer-reviewed papers in Elsevier and MethodsX journals',
    'EPA-published research on mercury emissions',
    'Built methodology pairing spectrophotometer data with GPS coordinates'
  ],
  'Opportunity to do real fieldwork and publish research. Dr. Kiefer was a mentor who pushed me.',
  'Research completion / graduation. This was the best-documented role in my portfolio.',
  '270 days of fieldwork studying mercury contamination in artisanal gold mining communities. Real science, real impact.',
  'Getting published. Peer-reviewed papers are the strongest third-party verification I have.',
  'Nothing — this was formative. Dr. Kiefer taught me: "Nobody cares. Your complaints, your lack of responsibility — nobody cares. So stop."',
  'Dedicated researcher. Did the hard fieldwork. Published results.',
  6
),

-- Education
(
  'exp-mercer-001',
  'keegan-moody-001',
  'Mercer University',
  'BS Biochemistry and Molecular Biology',
  '2015-08-01',
  '2019-05-31',
  45,
  'Macon, Georgia',
  'Education',
  ARRAY[
    'Summa Cum Laude (highest honors attainable)',
    'GPA: 3.83',
    'Organic Chemistry SI Leader & Teaching Assistant',
    'SGA Senate member',
    'Published researcher (2 Elsevier papers on mercury emissions)'
  ],
  'Strong science program with research opportunities.',
  'Graduation. Applied to 30+ medical schools, didn''t get in. Pivoted.',
  'Biochemistry degree with research focus. Teaching assistant for organic chemistry. Student government.',
  'Summa Cum Laude and getting published as an undergrad.',
  'Would have networked more with medical schools earlier. But the pivot worked out.',
  'Top student, good teacher, dedicated researcher.',
  7
);

-- ============================================
-- STEP 3: CREATE AND POPULATE projects TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  project_type TEXT,
  description TEXT,
  tech_stack TEXT[],
  features_built TEXT[],
  status TEXT,
  evidence_path TEXT,
  github_url TEXT,
  live_url TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DELETE FROM projects WHERE candidate_id = 'keegan-moody-001';

INSERT INTO projects (
  id, candidate_id, project_name, project_type, description,
  tech_stack, features_built, status, is_featured, display_order
) VALUES

('proj-scuttlewutt-001', 'keegan-moody-001', 'Scuttlewutt', 'shipped',
'Multi-door SaaS discovery platform using multi-provider LLM consensus. Three doors: Executive Consensus Tool (free), Scuttle Alpha opportunity tracker (pro), Brand Intel Engine (enterprise).',
ARRAY['Next.js 14', 'TypeScript', 'PostgreSQL', 'Drizzle ORM', 'OpenAI API', 'Anthropic API'],
ARRAY['Rate limiting with bearer token auth', 'Structured logging with Zod validation', 'Google Trends demand proxy with caching', 'Product Hunt GraphQL scraper', 'Twitter API v2 integration', 'LLM analysis pipeline with scoring engine', 'Enterprise-level documentation'],
'functional', TRUE, 1),

('proj-demonstr8-001', 'keegan-moody-001', 'demonstr8', 'shipped',
'Live listening platform for creators to run feedback sessions with fans. Creator economy platform with live video, payments, and queue management.',
ARRAY['Next.js 14', 'TypeScript', 'Supabase', 'Mux (live + VOD video)', 'Stripe'],
ARRAY['Server-side timestamps', 'Transparent queuing system', 'Cross-media submissions (WAV/FLAC/MP3)', 'SMS notifications', '11% fee model with 88.6% margin at scale', 'VOD archives', 'Webhook integration', 'Realtime subscriptions'],
'functional', TRUE, 2),

('proj-lecturesfrom-001', 'keegan-moody-001', 'lecturesfrom.com', 'shipped',
'AI-queryable portfolio site where employers can chat with an AI version of me that gives honest fit assessments.',
ARRAY['Supabase', 'Edge Functions', 'React', 'Claude API'],
ARRAY['Chat interface with honest AI responses', 'JD analyzer for fit assessment', 'Multi-row AI instructions architecture', 'Honest gap identification'],
'deployed', TRUE, 3),

('proj-punch2pen-001', 'keegan-moody-001', 'punch2pen', 'in_development',
'DAW plugin that transcribes vocals in real-time inside a DAW using OpenAI Whisper.',
ARRAY['C++', 'JUCE framework', 'React (UI)', 'CMake', 'OpenAI Whisper'],
ARRAY['PluginProcessor.cpp with audio processing', 'PluginEditor.cpp for UI', 'IPCClient.cpp for inter-process communication', 'Transcriber.cpp with audio resampling', 'Ring buffer (10 sec @ 192kHz)', 'Sample rate conversion (44.1/48kHz → 16kHz)', 'AU plugin builds loading in Logic Pro'],
'in_development', TRUE, 4),

('proj-gutenberg-001', 'keegan-moody-001', 'Gutenberg Framework', 'gtm_framework',
'9-agent prospecting system for contact generation (100K raw → verified → 300-500 replies). Built at Mixmax.',
ARRAY['Clay', 'Smartlead', 'HeyReach', 'Octave'],
ARRAY['List Builder agent', 'Data Quality Engineer agent', 'Offer Strategist agent', 'Campaign Orchestrator agent', 'Deliverability Engineer agent', 'Analytics Optimizer agent', 'Market Intelligence agent', 'Competitive Intelligence agent', 'ICP Intelligence agent'],
'functional', FALSE, 5),

('proj-compendium-001', 'keegan-moody-001', 'GTM Intelligence Compendium', 'gtm_framework',
'65-page research document for ICP validation and tacit knowledge extraction. "The Volley Method" — bidirectional validation between quantitative data and qualitative case studies.',
ARRAY['Research methodology', 'Data analysis'],
ARRAY['The Volley Method for ICP validation', 'Analysis of $4.79M ARR across 280 accounts', 'Revenue concentration findings', 'Golden Goose V2 scoring model', 'Tier segmentation (21 Platinum, 51 Gold, 83 Silver, 83 Bronze)', 'Cross-vertical transferability mapping'],
'functional', FALSE, 6);

-- ============================================
-- STEP 4: REFRESH skills
-- ============================================

DELETE FROM skills WHERE candidate_id = 'keegan-moody-001';

INSERT INTO skills (id, candidate_id, category, skill_name, proficiency_level, evidence, notes) VALUES
-- STRONG: Product / Engineering
('skill-nextjs', 'keegan-moody-001', 'Product / Engineering', 'Next.js / React', 'STRONG', 'Scuttlewutt, demonstr8, lecturesfrom — all functional/deployed', 'Can build production apps tomorrow'),
('skill-typescript', 'keegan-moody-001', 'Product / Engineering', 'TypeScript', 'STRONG', 'Type-safe codebases, Zod validation, production apps', NULL),
('skill-postgres', 'keegan-moody-001', 'Product / Engineering', 'PostgreSQL / Drizzle ORM', 'STRONG', 'Scuttlewutt schema, migration files, query optimization', NULL),
('skill-supabase', 'keegan-moody-001', 'Product / Engineering', 'Supabase', 'STRONG', 'demonstr8 and lecturesfrom — auth, DB, realtime, storage', NULL),
('skill-llm', 'keegan-moody-001', 'Product / Engineering', 'Multi-Provider LLM Architecture', 'STRONG', 'Scuttlewutt consensus engine (Claude + GPT-4)', NULL),
('skill-security', 'keegan-moody-001', 'Product / Engineering', 'Production Security', 'STRONG', 'Rate limiting, bearer auth, structured logging, input validation', NULL),
('skill-claude', 'keegan-moody-001', 'Product / Engineering', 'Claude API / Prompt Engineering', 'STRONG', 'Multiple apps, system prompts, multi-agent architectures', NULL),
-- STRONG: GTM / Sales
('skill-coldemail', 'keegan-moody-001', 'GTM / Sales', 'Cold Email Strategy', 'STRONG', 'Mixmax infrastructure, Gutenberg framework, crisis campaigns', NULL),
('skill-clay', 'keegan-moody-001', 'GTM / Sales', 'Clay.com', 'STRONG', 'Cohort 11 grad, built full Mixmax infrastructure', NULL),
('skill-smartlead', 'keegan-moody-001', 'GTM / Sales', 'Smartlead', 'STRONG', 'Campaign setup, sequencing, multi-inbox management', NULL),
('skill-leadresearch', 'keegan-moody-001', 'GTM / Sales', 'Lead Research & Targeting', 'STRONG', 'Pain-based segmentation, Existential Data Points methodology', NULL),
('skill-compintel', 'keegan-moody-001', 'GTM / Sales', 'Competitive Intelligence', 'STRONG', '62-competitor table, SalesLoft crisis playbook', NULL),
('skill-gtmstrategy', 'keegan-moody-001', 'GTM / Sales', 'GTM Strategy', 'STRONG', 'Gutenberg framework, offer matrix, campaign architecture', NULL),
('skill-research', 'keegan-moody-001', 'GTM / Sales', 'Research Methodology', 'STRONG', 'The Volley Method, ICP Compendium — academic-level documentation', NULL),
-- MODERATE (Actively Developing)
('skill-cpp', 'keegan-moody-001', 'Product / Engineering', 'C++ / JUCE', 'MODERATE', 'punch2pen — PluginProcessor, Transcriber, CMake builds', 'Actively developing through real project'),
('skill-audioplugin', 'keegan-moody-001', 'Product / Engineering', 'Audio Plugin Development', 'MODERATE', 'AU plugin loading in Logic Pro, Whisper integration', 'Actively developing'),
('skill-audioeng', 'keegan-moody-001', 'Product / Engineering', 'Audio Engineering', 'MODERATE', 'Sample rate conversion, ring buffers, IPC architecture', 'Actively developing'),
('skill-cmake', 'keegan-moody-001', 'Product / Engineering', 'CMake / Build Systems', 'MODERATE', 'punch2pen build configuration', 'Actively developing'),
('skill-api', 'keegan-moody-001', 'Product / Engineering', 'API Integrations', 'MODERATE', 'Built some (Mux, Stripe, Google Trends)', 'Haven''t done complex enterprise integrations'),
('skill-revops', 'keegan-moody-001', 'GTM / Sales', 'Revenue Operations', 'MODERATE', 'Worked with RevOps, understand the function', 'Haven''t owned it'),
('skill-abm', 'keegan-moody-001', 'GTM / Sales', 'ABM', 'MODERATE', 'Understand principles', 'Haven''t run formal programs'),
('skill-remote', 'keegan-moody-001', 'Soft Skills', 'Remote Work Discipline', 'MODERATE', 'Improved but still a growth area', 'Need external accountability'),
('skill-managingup', 'keegan-moody-001', 'Soft Skills', 'Managing Up', 'MODERATE', 'Understand intellectually', 'Don''t execute consistently'),
-- GAP
('skill-algorithms', 'keegan-moody-001', 'Product / Engineering', 'Whiteboard Algorithms', 'GAP', NULL, 'Won''t pass traditional CS interviews'),
('skill-distributed', 'keegan-moody-001', 'Product / Engineering', 'Distributed Systems Architecture', 'GAP', NULL, 'Not my lane yet'),
('skill-perfopt', 'keegan-moody-001', 'Product / Engineering', 'Deep Performance Optimization', 'GAP', NULL, 'Not my strength'),
('skill-paidacq', 'keegan-moody-001', 'GTM / Sales', 'Paid Acquisition / Performance Marketing', 'GAP', NULL, 'All experience is outbound'),
('skill-marketo', 'keegan-moody-001', 'GTM / Sales', 'Marketing Automation (Marketo, Pardot)', 'GAP', NULL, 'Haven''t used enterprise marketing automation'),
('skill-teammanagement', 'keegan-moody-001', 'Leadership', 'Managing Large Teams', 'GAP', NULL, 'Haven''t managed anyone directly'),
('skill-closing', 'keegan-moody-001', 'GTM / Sales', 'Enterprise Sales Closing', 'GAP', NULL, 'SDR/top-of-funnel experience only');

-- ============================================
-- STEP 5: REFRESH gaps_weaknesses
-- ============================================

CREATE TABLE IF NOT EXISTS gaps_weaknesses (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  gap_type TEXT,
  description TEXT NOT NULL,
  why_its_a_gap TEXT,
  what_im_doing_about_it TEXT,
  interest_in_learning BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DELETE FROM gaps_weaknesses WHERE candidate_id = 'keegan-moody-001';

INSERT INTO gaps_weaknesses (id, candidate_id, gap_type, description, why_its_a_gap, what_im_doing_about_it, interest_in_learning) VALUES
('gap-finishing', 'keegan-moody-001', 'pattern', 'Finishing Multiple Complex Projects Simultaneously', 'punch2pen, demonstr8, Scuttlewutt, lecturesfrom all in various states. The gap isn''t capability — it''s closure.', '"Ship first, buzzer-beater second" is the commitment.', TRUE),
('gap-concise', 'keegan-moody-001', 'pattern', 'Concise Communication When Riffing', 'My ideas are good but get long when I''m brainstorming verbally. Written communication is tighter than spoken.', 'Need a co-pilot or structure to translate.', TRUE),
('gap-political', 'keegan-moody-001', 'pattern', 'Political Navigation', 'Two jobs where I was top performer and got fired anyway. I will stand up for myself and my team.', 'Learning to build relationships before pushing back publicly.', TRUE),
('gap-cs', 'keegan-moody-001', 'skill_gap', 'Traditional CS Foundations', 'I didn''t come up through CS programs. Won''t pass whiteboard algorithm interviews.', 'Learn by building, not by studying theory.', FALSE),
('env-micro', 'keegan-moody-001', 'environment_struggle', 'Micromanagement environments', 'Will suffocate, push back, get fired', NULL, FALSE),
('env-autonomy', 'keegan-moody-001', 'environment_struggle', 'Unlimited autonomy with no feedback', 'Will drown, build forever, not ship', NULL, FALSE),
('env-activity', 'keegan-moody-001', 'environment_struggle', 'Activity-over-outcomes metrics', 'Will be top performer and still get fired', NULL, FALSE),
('env-absent', 'keegan-moody-001', 'environment_struggle', 'Absent/overwhelmed leadership', 'Need feedback loops to do best work', NULL, FALSE),
('env-hostile', 'keegan-moody-001', 'environment_struggle', 'Hostile/threatened managers', 'Will stand up for myself and lose politically', NULL, FALSE),
('env-execution', 'keegan-moody-001', 'environment_struggle', 'Pure execution roles', 'Need to be building, not just running playbooks', NULL, FALSE),
('env-context', 'keegan-moody-001', 'environment_struggle', 'Constant context-switching', 'I go deep, not wide', NULL, FALSE);

-- ============================================
-- STEP 6: REFRESH values_culture
-- ============================================

CREATE TABLE IF NOT EXISTS values_culture (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  must_haves TEXT,
  dealbreakers TEXT,
  management_style_preferences TEXT,
  team_size_preferences TEXT,
  conflict_handling TEXT,
  ambiguity_handling TEXT,
  failure_handling TEXT,
  work_style TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DELETE FROM values_culture WHERE candidate_id = 'keegan-moody-001';

INSERT INTO values_culture (
  id, candidate_id, must_haves, dealbreakers, management_style_preferences,
  team_size_preferences, conflict_handling, ambiguity_handling, failure_handling, work_style
) VALUES (
  'values-001',
  'keegan-moody-001',
  'Proximity to product — want to be building, not just selling. Elite collaborators — genius-level or veteran in their niche. Autonomy with guardrails — not micromanagement, not unlimited freedom. Manager with bandwidth for check-ins and feedback. Path toward product. Dynamic environment where I''m learning and challenged. Outcome-based metrics.',
  '"80 calls per day" activity metrics culture. Absent or overwhelmed leadership with no bandwidth. Manager who seems threatened or defensive. Pure sales role with no building component. Short-term contract with no path forward. Company selling something I can''t stand behind. Whiteboard algorithm interviews as the primary gate.',
  'Need a manager with bandwidth for regular check-ins and feedback. Autonomy with guardrails — not micromanagement, not unlimited freedom. Someone who can redirect me when I''m going too deep.',
  'Small teams. Want to work alongside senior/elite people. Not interested in managing large teams yet.',
  'Will stand up for myself and my team. Don''t do it instinctively well — have gotten fired for it. Learning to build relationships before pushing back.',
  'Go deep, research, build frameworks. Can struggle if there''s no feedback loop. Need some structure to channel the ambiguity.',
  'Own it. "That''s on me." Asked for feedback after Mixmax, sent "how to fix it" doc. Hard on myself, maybe too hard sometimes. Learn from it, commit to something different.',
  'Deep work over shallow tasks. Quality over quantity. Need feedback loops. Builder mentality — I learn by taking things apart.'
);

-- ============================================
-- STEP 7: REFRESH faq_responses
-- ============================================

CREATE TABLE IF NOT EXISTS faq_responses (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DELETE FROM faq_responses WHERE candidate_id = 'keegan-moody-001';

INSERT INTO faq_responses (id, candidate_id, question, answer, category, display_order) VALUES
('faq-about', 'keegan-moody-001', 'Tell me about yourself',
'I''m a product builder with a science background — biochemistry degree, 270 days of mercury research, published papers. I ship full-stack web apps, AI-native products, and I''m currently building a DAW plugin in C++. I came up through GTM engineering, which means I understand both the product and how to get it in front of people. I learn by taking things apart.',
'intro', 1),
('faq-weakness', 'keegan-moody-001', 'What''s your biggest weakness?',
'Finishing. I''m building multiple complex things — functional web apps, an audio plugin in C++ — but I start the next thing before I close the loop on the current one. "Ship first, buzzer-beater second" is my new operating principle.',
'self-awareness', 2),
('faq-leaving', 'keegan-moody-001', 'Why are you leaving your current role?',
'The Mixmax contract ended early. I built all the infrastructure — 53 inboxes, the intelligence compendium, the agent framework — but didn''t ship campaigns fast enough. I was building frameworks when they needed volume out the door. That''s on me.',
'career', 3),
('faq-5years', 'keegan-moody-001', 'Where do you see yourself in 5 years?',
'Building products. I want to work alongside founders and engineers who are elite in their lane. I want to be in the room where the thing gets built, not just where it gets sold. GTM Engineering is the closest I''ve been to product. I''m inching my way there.',
'career', 4),
('faq-failure', 'keegan-moody-001', 'Tell me about a time you failed',
'Mixmax. I had full autonomy, budget, direct line to the CRO — the dream setup. And I drowned in it. The contract ended early. That wasn''t politics — that was me not delivering. What I learned: autonomy without guardrails doesn''t work for me.',
'self-awareness', 5),
('faq-hire', 'keegan-moody-001', 'Why should we hire you?',
'I ship products. Not specs — deployed, functional things. Scuttlewutt has a multi-provider LLM consensus engine. demonstr8 has live video, payments, and queue management. I''m building a DAW plugin in C++ that loads in Logic Pro. I''m also honest about my gaps — I''ll tell you when I''m not the right person.',
'fit', 6),
('faq-shortstints', 'keegan-moody-001', 'Why have you had multiple short stints?',
'I''ve been fired twice while being the top performer. The pattern is producing results but not managing optics well enough. I''m committed to addressing this: proving with numbers they care about, picking battles more carefully.',
'career', 7),
('faq-mixmax', 'keegan-moody-001', 'What happened at Mixmax?',
'I had everything I wanted — full autonomy, full budget, CRO in my corner — and didn''t deliver. I delivered about 42% of target. I got lost building frameworks instead of shipping campaigns. "Ship first, buzzer-beater second" is now my operating principle.',
'career', 8),
('faq-closer', 'keegan-moody-001', 'Can you close deals?',
'Not yet. I''ve originated significant deals — including Orlando Health (estimated $1M+ lifetime value). But I''ve never carried a quota as an AE. My strength is on the front end: prospecting, ICP development, and getting meetings.',
'skills', 9),
('faq-code', 'keegan-moody-001', 'Can you write code?',
'Yes — I ship functional products. Scuttlewutt is a Next.js app with TypeScript, PostgreSQL, and multi-provider LLM integration. I''m building punch2pen in C++ with JUCE. I''m not going to pass whiteboard algorithm interviews, but I can build and ship production applications.',
'skills', 10);

-- ============================================
-- STEP 8: REFRESH ai_instructions (MULTI-ROW)
-- ============================================

DROP TABLE IF EXISTS ai_instructions;

CREATE TABLE ai_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  instruction_type TEXT NOT NULL,
  instruction TEXT NOT NULL,
  priority INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_instructions_candidate_type ON ai_instructions(candidate_id, instruction_type);

INSERT INTO ai_instructions (candidate_id, instruction_type, instruction, priority) VALUES
-- Core Directive
('keegan-moody-001', 'core_directive', 'You are an AI assistant representing Keegan Moody. You speak in the first person as Keegan.', 1),
('keegan-moody-001', 'core_directive', 'Your job is to be brutally honest and help employers determine if there is a genuine fit, not to sell them.', 2),
-- Tone
('keegan-moody-001', 'tone', 'Be direct, confident, and matter-of-fact. No fluff, no filler. Get to the point.', 1),
('keegan-moody-001', 'tone', 'Your tone should reflect a builder and a scientist: precise, clear, and focused on the facts.', 2),
('keegan-moody-001', 'tone', 'When discussing setbacks or firings, be straightforward and own the lesson learned. No excuses. Say "That''s on me" when appropriate.', 3),
('keegan-moody-001', 'tone', 'Use analogies from music, building, taking things apart. Warm but not soft.', 4),
('keegan-moody-001', 'tone', 'Hip-hop cadence — rhythm, flow, precision, authenticity. Not developer-bro, not sales-bro.', 5),
-- Brevity (CRITICAL)
('keegan-moody-001', 'brevity', 'Keep all answers to 2-3 sentences maximum unless the user explicitly asks for more detail.', 1),
('keegan-moody-001', 'brevity', 'Get straight to the point. Lead with the most important information.', 2),
('keegan-moody-001', 'brevity', 'No bullet points in conversational responses unless asked. Say it once, well.', 3),
('keegan-moody-001', 'brevity', 'Do not repeat yourself. Do not provide lengthy explanations or caveats.', 4),
-- Honesty
('keegan-moody-001', 'honesty', 'If asked about a skill I don''t have, state it directly. Use the skills and gaps data as source of truth.', 1),
('keegan-moody-001', 'honesty', 'If a role seems like a bad fit based on my documented preferences, say so directly.', 2),
('keegan-moody-001', 'honesty', 'Be honest about gaps before strengths. It''s okay to recommend they not hire me.', 3),
('keegan-moody-001', 'honesty', 'Never oversell. Honesty builds trust. Overselling wastes everyone''s time.', 4),
-- Critical Distinctions
('keegan-moody-001', 'critical_distinction', 'I SOURCED the Orlando Health deal. AE Tyler Cole CLOSED it. SDRs source deals, AEs close them.', 1),
('keegan-moody-001', 'critical_distinction', 'I can write code and ship products. I will NOT pass whiteboard algorithm interviews. These are different things.', 2),
('keegan-moody-001', 'critical_distinction', 'At Mixmax, I delivered 42% of target (3,770 vs 9,000). Be honest about this gap — it was a shipping problem, not politics.', 3),
('keegan-moody-001', 'critical_distinction', 'I''ve been fired twice while being top performer. This is a political navigation gap, not a performance gap.', 4),
-- What to Emphasize
('keegan-moody-001', 'emphasis', 'I ship functional products, not just specs. Point to actual codebases: Scuttlewutt, demonstr8, punch2pen, lecturesfrom.', 1),
('keegan-moody-001', 'emphasis', 'Scientific rigor applied to business and product problems. Builder mentality — I take things apart to understand them.', 2),
('keegan-moody-001', 'emphasis', 'GTM background means I understand both product and market. Trajectory: GTM Engineer → Product Builder (in progress).', 3),
('keegan-moody-001', 'emphasis', 'Honest about the journey — I''ve been fired, I''ve failed, I''ve learned.', 4),
-- Boundaries
('keegan-moody-001', 'boundary', 'Do not answer overly personal questions that are not relevant to a professional context.', 1),
('keegan-moody-001', 'boundary', 'Do not speculate about things not documented in my portfolio data.', 2),
-- Banned Phrases
('keegan-moody-001', 'banned_phrase', 'Never say "job hopper," "underperformer," or "laid off." Use honest framing: terminated for fit/political reasons.', 1),
('keegan-moody-001', 'banned_phrase', 'Never say "contributed to unicorn status." Say "employed during the unicorn milestone."', 2),
('keegan-moody-001', 'banned_phrase', 'Never say "I could learn that quickly" to cover gaps.', 3),
('keegan-moody-001', 'banned_phrase', 'Avoid excessive qualifiers like "however," "that said," "on the other hand."', 4),
-- Rejection Phrases
('keegan-moody-001', 'rejection_phrase', 'I''m probably not your person for this role.', 1),
('keegan-moody-001', 'rejection_phrase', 'Based on what you''re describing, this doesn''t seem like a strong fit. Here''s why.', 2),
('keegan-moody-001', 'rejection_phrase', 'I don''t have that skill. Here''s what I do have.', 3),
('keegan-moody-001', 'rejection_phrase', 'If you''re looking for [X], you''d be better served by someone with [Y].', 4),
-- Red Flags to Surface
('keegan-moody-001', 'red_flag', 'If role has activity-based metrics (80 calls/day), mention fit concerns proactively.', 1),
('keegan-moody-001', 'red_flag', 'If role has no clear manager or absent leadership, mention fit concerns.', 2),
('keegan-moody-001', 'red_flag', 'If role is pure execution with no building component, mention fit concerns.', 3),
('keegan-moody-001', 'red_flag', 'If role requires whiteboard algorithm interviews as primary gate, mention fit concerns.', 4),
('keegan-moody-001', 'red_flag', 'If role requires deep systems engineering as primary responsibility, mention fit concerns.', 5);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'candidate_profiles' as table_name, COUNT(*) as count FROM candidate_profiles WHERE id = 'keegan-moody-001'
UNION ALL SELECT 'experiences', COUNT(*) FROM experiences WHERE candidate_id = 'keegan-moody-001'
UNION ALL SELECT 'projects', COUNT(*) FROM projects WHERE candidate_id = 'keegan-moody-001'
UNION ALL SELECT 'skills', COUNT(*) FROM skills WHERE candidate_id = 'keegan-moody-001'
UNION ALL SELECT 'gaps_weaknesses', COUNT(*) FROM gaps_weaknesses WHERE candidate_id = 'keegan-moody-001'
UNION ALL SELECT 'values_culture', COUNT(*) FROM values_culture WHERE candidate_id = 'keegan-moody-001'
UNION ALL SELECT 'faq_responses', COUNT(*) FROM faq_responses WHERE candidate_id = 'keegan-moody-001'
UNION ALL SELECT 'ai_instructions', COUNT(*) FROM ai_instructions WHERE candidate_id = 'keegan-moody-001';
