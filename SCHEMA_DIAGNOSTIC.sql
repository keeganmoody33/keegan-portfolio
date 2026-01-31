-- ============================================================
-- SCHEMA DIAGNOSTIC - Run this first to see actual columns
-- Copy each section and run separately
-- ============================================================

-- 1. Check ai_instructions columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_instructions'
ORDER BY ordinal_position;

-- 2. Check candidate_profile columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'candidate_profile'
ORDER BY ordinal_position;

-- 3. Check experiences columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'experiences'
ORDER BY ordinal_position;

-- 4. Check skills columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'skills'
ORDER BY ordinal_position;

-- 5. Check gaps_weaknesses columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'gaps_weaknesses'
ORDER BY ordinal_position;

-- 6. Check values_culture columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'values_culture'
ORDER BY ordinal_position;

-- ============================================================
-- 7. See current ai_instructions content
-- ============================================================
SELECT id, instruction_type, LEFT(instruction, 50) as instruction_preview, LEFT(content, 50) as content_preview
FROM ai_instructions
WHERE candidate_id = 'keegan-moody-001'
LIMIT 10;

-- ============================================================
-- 8. See current candidate_profile
-- ============================================================
SELECT * FROM candidate_profile WHERE id = 'keegan-moody-001';

-- ============================================================
-- 9. See current experiences
-- ============================================================
SELECT id, company_name, role_title, start_date, end_date
FROM experiences
WHERE candidate_id = 'keegan-moody-001'
ORDER BY display_order;
