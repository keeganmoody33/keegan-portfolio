-- ============================================================
-- EXPERIENCE CORRECTIONS - Jan 31, 2026
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. CAMP HORIZON - Fix dates (JULY 2016 - Present) and description
UPDATE experiences
SET
  start_date = '2016-07-01',
  end_date = NULL,
  duration_months = 115,
  role_title = 'Volunteer Counselor & Year-Round Mentor (10+ Years)',
  public_bullets = ARRAY[
    'Decade-long commitment to Camp Horizon, serving foster children in Fulton and DeKalb County, Georgia',
    'Annual week-long immersion as counselor in technology-free Leadership Development Program for ages 8-18',
    'Year-round mentor maintaining relationships and encouraging youth development beyond summer camp',
    'Only 1:1 camper-to-counselor ratio program in the Southeast — consistent positive male presence for campers who rarely experience stability'
  ]
WHERE company_name ILIKE '%camp horizon%'
AND candidate_id = 'keegan-moody-001';

-- 2. CHAPEL HILL MIDDLE SCHOOL - Fix dates (JUN 2019 - MAY 2020) and description
UPDATE experiences
SET
  start_date = '2019-06-01',
  end_date = '2020-05-01',
  duration_months = 11,
  company_name = 'Chapel Hill Middle School',
  role_title = 'Special Education Paraprofessional & Varsity Football Coach',
  public_bullets = ARRAY[
    'First role after college graduation — taught literature, math, and social studies to special education students',
    'Supervised and encouraged learning in positive atmosphere despite daily challenges',
    'Simultaneously coached defensive skill players for Varsity High School Football program'
  ]
WHERE company_name ILIKE '%chapel hill%'
AND candidate_id = 'keegan-moody-001';

-- 3. ASGM RESEARCH - Fix dates (MAY 2017 - JAN 2020)
UPDATE experiences
SET
  start_date = '2017-05-01',
  end_date = '2020-01-01',
  duration_months = 32,
  company_name = 'ASGM Research (EPA)',
  role_title = 'Published Research Author'
WHERE company_name ILIKE '%asgm%' OR company_name ILIKE '%epa%'
AND candidate_id = 'keegan-moody-001';

-- 4. BIOFOURMIS - Change to Biofourmis Inc.
UPDATE experiences
SET
  company_name = 'Biofourmis Inc.',
  role_title = 'Co-Founding SDR, Commercial Care Vertical'
WHERE company_name ILIKE '%biofourmis%'
AND candidate_id = 'keegan-moody-001';

-- 5. TRACEAIR - Change to TraceAir Technologies
UPDATE experiences
SET
  company_name = 'TraceAir Technologies',
  role_title = 'Sales Development Representative',
  public_bullets = ARRAY[
    'Achieved record month of 20 demos booked — 18 (90%) self-sourced contacts outside existing CRM',
    'Pioneered video outreach strategy via LinkedIn, leaning into authenticity to break through the noise',
    'Developed custom prospecting methodology using ChatGPT to identify upcoming major land developments',
    'Built greenfield territory from scratch with limited resources — 2,200 contacts vs 8,800 in comparable territories'
  ]
WHERE company_name ILIKE '%trace%air%'
AND candidate_id = 'keegan-moody-001';

-- 6. MIXMAX - Improve description
UPDATE experiences
SET
  public_bullets = ARRAY[
    'First dedicated GTM engineering hire — rebuilt outbound infrastructure from zero after company pivoted to AI-first positioning',
    'Architected 53-inbox sending system with 50+ warmed domains, Clay workflows, and Smartlead campaign automation',
    'Designed multi-segment targeting strategy across 12,000+ prospect accounts with persona-based messaging frameworks',
    'Built scalable Clay tables with automated enrichment pipelines integrating Trigify, Apollo, and custom data sources',
    'Created comprehensive campaign playbooks and internal documentation enabling RevOps team to maintain systems post-engagement'
  ]
WHERE company_name ILIKE '%mixmax%'
AND candidate_id = 'keegan-moody-001';

-- 7. Verify all updates
SELECT display_order, company_name, role_title, start_date, end_date
FROM experiences
WHERE candidate_id = 'keegan-moody-001'
ORDER BY display_order;
