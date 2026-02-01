-- ============================================================
-- COMPREHENSIVE AUDIT FIX - Feb 1, 2026
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. CAMP HORIZON - MAY 2016 start (not 2015)
UPDATE experiences
SET
  start_date = '2016-05-01',
  end_date = NULL,
  duration_months = 117,
  role_title = 'Volunteer Counselor & Year-Round Mentor',
  public_bullets = ARRAY[
    'Decade-long commitment to Camp Horizon, serving foster children in Fulton and DeKalb County, Georgia.',
    'Annual week-long immersion as counselor in technology-free Leadership Development Program for ages 8-18.',
    'Year-round mentor maintaining relationships and encouraging youth development beyond summer camp.',
    'Only 1:1 camper-to-counselor ratio program in the Southeast — consistent positive male presence for campers who rarely experience stability.'
  ]
WHERE company_name ILIKE '%camp horizon%'
AND candidate_id = 'keegan-moody-001';

-- 2. CHAPEL HILL MIDDLE SCHOOL - MAY 2019 start (not Dec 2016)
UPDATE experiences
SET
  start_date = '2019-05-01',
  end_date = '2020-05-01',
  duration_months = 12,
  company_name = 'Chapel Hill Middle School',
  role_title = 'Special Education Paraprofessional & HS Football Defensive Coach',
  public_bullets = ARRAY[
    'First role after college graduation — taught literature, math, social studies, and all subjects for special education students.',
    'Supervised and encouraged learning in a positive atmosphere despite daily challenges.',
    'Simultaneously coached defensive skill players for Varsity High School Football program.'
  ]
WHERE company_name ILIKE '%chapel hill%'
AND candidate_id = 'keegan-moody-001';

-- 3. ASGM RESEARCH - DEC 2016 to DEC 2020 (not 2015-2018)
UPDATE experiences
SET
  start_date = '2016-12-01',
  end_date = '2020-12-01',
  duration_months = 48,
  company_name = 'ASGM Research (EPA)',
  role_title = 'Published Research Author',
  public_bullets = ARRAY[
    'First-author peer-reviewed publication in Environmental Research (IF 8.3) on mercury emissions in artisanal gold mining communities.',
    'Co-authored methodology paper in MethodsX detailing portable spectrometry mapping techniques.',
    'Conducted 120+ days of fieldwork across South America (Peru, Ecuador) measuring life-threatening Hg vapor concentrations.',
    'Research contributed to Peruvian air quality protocol development under Minamata Convention compliance.'
  ]
WHERE company_name ILIKE '%asgm%' OR company_name ILIKE '%mercury%' OR company_name ILIKE '%epa%' OR company_name ILIKE '%research%'
AND candidate_id = 'keegan-moody-001';

-- 4. BIOFOURMIS INC. - Add AI/ML descriptor
UPDATE experiences
SET
  company_name = 'Biofourmis Inc.',
  role_title = 'Co-Founding SDR, Commercial Care Vertical | AI & ML Health Tech',
  public_bullets = ARRAY[
    'Co-founding SDR for AI/ML-powered remote patient monitoring platform in high-growth health tech startup.',
    'Built Commercial Care vertical from scratch — pioneered outbound strategy targeting health systems and payers.',
    'Developed scalable prospecting workflows leveraging Salesforce, ZoomInfo, and Outreach automation.',
    'Contributed to early-stage GTM playbook that supported company growth through Series C funding.'
  ]
WHERE company_name ILIKE '%biofourmis%'
AND candidate_id = 'keegan-moody-001';

-- 5. TRACEAIR TECHNOLOGIES - Fix name (one word) + SENIOR SDR
UPDATE experiences
SET
  company_name = 'Traceair Technologies',
  role_title = 'Senior Sales Development Representative',
  public_bullets = ARRAY[
    'Achieved record month of 20 demos booked — 18 (90%) self-sourced contacts outside existing CRM.',
    'Pioneered video outreach strategy via LinkedIn, leaning into authenticity to break through the noise.',
    'Developed custom prospecting methodology using ChatGPT to identify upcoming major land developments.',
    'Built greenfield territory from scratch with limited resources — 2,200 contacts vs 8,800 in comparable territories.'
  ]
WHERE company_name ILIKE '%trace%air%'
AND candidate_id = 'keegan-moody-001';

-- 6. MOBB AI - Ensure proper punctuation
UPDATE experiences
SET
  public_bullets = ARRAY[
    'First SDR hire at AI-first security remediation startup — established outbound function from zero.',
    'Drove first-week adoption velocity by creating PVP framework adopted across sales organization.',
    'Built MCP server integration enabling AI-assisted prospecting and pipeline management.',
    'Developed persona-based messaging frameworks targeting DevSecOps and AppSec leaders.'
  ]
WHERE company_name ILIKE '%mobb%'
AND candidate_id = 'keegan-moody-001';

-- 7. MIXMAX - Ensure proper punctuation
UPDATE experiences
SET
  public_bullets = ARRAY[
    'First dedicated GTM engineering hire — rebuilt outbound infrastructure from zero after company pivoted to AI-first positioning.',
    'Architected 53-inbox sending system with 50+ warmed domains, Clay workflows, and Smartlead campaign automation.',
    'Designed multi-segment targeting strategy across 12,000+ prospect accounts with persona-based messaging frameworks.',
    'Built scalable Clay tables with automated enrichment pipelines integrating Trigify, Apollo, and custom data sources.',
    'Created comprehensive campaign playbooks and internal documentation enabling RevOps team to maintain systems.'
  ]
WHERE company_name ILIKE '%mixmax%'
AND candidate_id = 'keegan-moody-001';

-- 8. BARIATRIC CENTERS OF AMERICA - Ensure proper punctuation
UPDATE experiences
SET
  public_bullets = ARRAY[
    'GTM consulting engagement building BARINAV patient navigation platform go-to-market strategy.',
    'Developed outbound prospecting infrastructure targeting bariatric surgery practices and health systems.',
    'Created HubSpot automation workflows for patient journey tracking and provider engagement.'
  ]
WHERE company_name ILIKE '%bariatric%' OR company_name ILIKE '%barinav%'
AND candidate_id = 'keegan-moody-001';

-- 9. BARBOUR ORTHOPAEDICS - Ensure proper punctuation
UPDATE experiences
SET
  public_bullets = ARRAY[
    'Marketing and operations role at orthopedic surgery practice during gap year.',
    'Managed patient communications and appointment scheduling systems.',
    'Supported practice growth initiatives and community outreach programs.'
  ]
WHERE company_name ILIKE '%barbour%'
AND candidate_id = 'keegan-moody-001';

-- VERIFY ALL UPDATES
SELECT
  display_order,
  company_name,
  role_title,
  TO_CHAR(start_date, 'MON YYYY') as start_formatted,
  TO_CHAR(end_date, 'MON YYYY') as end_formatted,
  duration_months
FROM experiences
WHERE candidate_id = 'keegan-moody-001'
ORDER BY display_order;
