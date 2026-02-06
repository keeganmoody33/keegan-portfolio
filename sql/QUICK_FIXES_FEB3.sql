-- ============================================================
-- QUICK FIXES - Feb 3, 2026
-- LEC-12, LEC-9, LEC-6
-- Run in Supabase SQL Editor: https://supabase.com/dashboard
-- ============================================================

-- ============================================================
-- LEC-12: Add MixMax end date (departed Dec 12, 2025)
-- ============================================================
UPDATE experiences
SET
  end_date = '2025-12-12',
  duration_months = 3  -- Sep 2025 to Dec 2025 = ~3 months
WHERE company_name ILIKE '%mixmax%'
AND candidate_id = 'keegan-moody-001';

-- ============================================================
-- LEC-9: Fix timeline display_order (chronological)
-- Timeline should be newest first (descending by start_date)
-- ============================================================

-- First, let's see current order
-- SELECT id, company_name, start_date, display_order
-- FROM experiences WHERE candidate_id = 'keegan-moody-001' ORDER BY start_date DESC;

-- Set display_order based on chronological order (newest = 1)
UPDATE experiences SET display_order = 1 WHERE company_name ILIKE '%mixmax%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 2 WHERE company_name ILIKE '%mobb%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 3 WHERE company_name ILIKE '%trace%air%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 4 WHERE company_name ILIKE '%biofourmis%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 5 WHERE company_name ILIKE '%bariatric%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 6 WHERE company_name ILIKE '%barbour%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 7 WHERE company_name ILIKE '%chapel hill%' AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 8 WHERE (company_name ILIKE '%asgm%' OR company_name ILIKE '%mercury%' OR company_name ILIKE '%epa%') AND candidate_id = 'keegan-moody-001';
UPDATE experiences SET display_order = 9 WHERE company_name ILIKE '%camp horizon%' AND candidate_id = 'keegan-moody-001';

-- ============================================================
-- LEC-6: Rewrite Mobb AI job description
-- Current: "proprietary formula" language
-- New: Authentic PVP narrative - first real GTM win
-- ============================================================
UPDATE experiences
SET
  public_bullets = ARRAY[
    'First SDR hire at AI-powered security remediation startup. Built outbound function from zero.',
    'Created PVP scoring framework that became the sales org standard within first week.',
    'First time I felt close to success running cannonball GTM - rapid adoption, immediate application, real pipeline velocity.',
    'Built MCP server integration connecting Claude to our prospecting workflow before most people knew what MCP was.'
  ]
WHERE company_name ILIKE '%mobb%'
AND candidate_id = 'keegan-moody-001';

-- ============================================================
-- VERIFY ALL UPDATES
-- ============================================================
SELECT
  display_order,
  company_name,
  role_title,
  TO_CHAR(start_date, 'MON YYYY') as start_date,
  COALESCE(TO_CHAR(end_date, 'MON YYYY'), 'Present') as end_date,
  duration_months
FROM experiences
WHERE candidate_id = 'keegan-moody-001'
ORDER BY display_order;
