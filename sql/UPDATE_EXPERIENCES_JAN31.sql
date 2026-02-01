-- ============================================================
-- EXPERIENCE UPDATES - Jan 31, 2026
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. RENAME "Mercury Research" → "ASGM Research for EPA"
-- And add publications highlight
UPDATE experiences
SET
  company_name = 'ASGM Research (EPA)',
  role_title = 'Published Research Author',
  public_bullets = ARRAY[
    'Author of peer-reviewed publications on mercury exposure in artisanal gold mining communities',
    'Conducted 270+ days fieldwork across South American mining communities measuring elemental mercury vapor',
    'Developed novel methodology pairing portable spectrophotometry with GPS for geographic concentration mapping',
    'Created heat maps identifying high-risk exposure areas to inform EPA and community health interventions'
  ]
WHERE company_name ILIKE '%mercury%'
AND candidate_id = 'keegan-moody-001';

-- 2. RENAME "GTM Consulting" → "Bariatric Centers of America / BARINAV"
UPDATE experiences
SET
  company_name = 'Bariatric Centers of America (BARINAV)',
  role_title = 'GTM Consultant',
  public_bullets = ARRAY[
    'Developed go-to-market funnel and outbound prospecting process for bariatric surgery software platform',
    'Created hospital outreach strategy and pilot program framework for surgical software adoption',
    'Built sales infrastructure from scratch for early-stage healthcare technology company'
  ]
WHERE company_name ILIKE '%GTM Consult%' OR company_name ILIKE '%BariNav%'
AND candidate_id = 'keegan-moody-001';

-- 3. FIX DISPLAY ORDER (Most recent first, Biofourmis before Barbour)
-- Order: Mixmax → Mobb → Trace Air → BARINAV → Biofourmis → Barbour → ASGM → Chapel Hill/Coaching → Camp Horizon (volunteer, bottom)
UPDATE experiences SET display_order = 1 WHERE company_name ILIKE '%mixmax%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 2 WHERE company_name ILIKE '%mobb%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 3 WHERE company_name ILIKE '%trace%air%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 4 WHERE (company_name ILIKE '%bariatric%' OR company_name ILIKE '%barinav%' OR company_name ILIKE '%bcofa%') AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 5 WHERE company_name ILIKE '%biofourmis%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 6 WHERE company_name ILIKE '%barbour%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 7 WHERE (company_name ILIKE '%asgm%' OR company_name ILIKE '%mercury%' OR company_name ILIKE '%epa%') AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 8 WHERE (company_name ILIKE '%chapel hill%' OR company_name ILIKE '%football%' OR company_name ILIKE '%coaching%' OR company_name ILIKE '%special ed%') AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 99 WHERE company_name ILIKE '%camp horizon%' AND candidate_id = 'keegan-moody-001';

-- 4. UPDATE Camp Horizon to clearly show it's volunteer work
UPDATE experiences
SET role_title = 'Volunteer Counselor (10+ Years)'
WHERE company_name ILIKE '%camp horizon%'
AND candidate_id = 'keegan-moody-001';

-- 5. UPDATE Chapel Hill / Coaching role title
UPDATE experiences
SET
  company_name = 'Chapel Hill Middle School',
  role_title = 'Special Ed Para-Pro & HS Football Coach'
WHERE (company_name ILIKE '%chapel hill%' OR company_name ILIKE '%education%' OR company_name ILIKE '%football%')
AND candidate_id = 'keegan-moody-001';

-- 6. Verify the updates
SELECT display_order, company_name, role_title, start_date
FROM experiences
WHERE candidate_id = 'keegan-moody-001'
ORDER BY display_order;
