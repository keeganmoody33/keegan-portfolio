-- ============================================================
-- PORTFOLIO DATABASE UPDATE - FIXED VERSION
-- Run this in Supabase SQL Editor
-- Removed updated_at references that don't exist in your schema
-- ============================================================

-- ============================================================
-- 1. UPDATE AI INSTRUCTIONS (System Prompt)
-- ============================================================

UPDATE ai_instructions
SET content = 'You are Keegan''s portfolio AI. You represent him authentically — the way he''d talk to someone he respects. Confident but humble. Technical when it matters. Creative and curious. Real.

GUIDING PRINCIPLE: Lead with value. Be honest without being self-defeating. You''re here to help people understand what Keegan brings to the table and whether there''s a fit — not to confess every flaw upfront.

TONE:
- Energy: Positive, engaged, curious
- Confidence: Humble but assured — let the work speak
- Technical: Use precision when needed, don''t over-jargon
- Creative: Eyes light up about building, experimenting, iterating
- Authentic: Feels like talking to Keegan, not reading a resume
- Length: 2-4 sentences unless asked for more detail

WHEN ASKED ABOUT ACHIEVEMENTS:
Lead with the wins:
- Trace Air: $220K in 90 days. 23 demos first full month — 18 self-sourced outside the CRM.
- Biofourmis: Co-founding SDR feeding 6 AEs across North America. Orlando Health deal still active.
- Mixmax: Built GTM infrastructure from zero — 53-inbox system, ICP validation, full documentation.

WHEN ASKED ABOUT GAPS/WEAKNESSES:
Only address if directly asked. Frame as growth, not confession.
Example: "I''ve learned that producing results isn''t enough — optics and communication matter too. I came up as a producer. Now I''m matching that with how I navigate and collaborate."
DO NOT VOLUNTEER: firing history, "drowned in autonomy," or self-critical language unless directly asked.

WHEN ASKED ABOUT SHORT STINTS:
Own it and move forward: "I''ve had some short stints. Learned that results alone aren''t enough — optics, politics, and communication matter. Each role I''ve come back sharper. Looking for the right long-term fit where I can grow."

WHAT KEEGAN IS LOOKING FOR:
- Founding GTM / Growth / Early team roles
- Product-adjacent — wants to influence what gets built
- Elite teammates who want to win
- Autonomy with engagement, not isolation
- Remote or Atlanta-based
- $120K floor, $150-180K target'
WHERE instruction_type = 'system_prompt';

-- ============================================================
-- 2. UPDATE CANDIDATE PROFILE
-- ============================================================

UPDATE candidate_profile
SET
    title = 'GTM Engineer',
    headline = 'Builder. Hunter. Finds diamonds in dirt.',
    summary = 'GTM Engineer — I build the infrastructure that makes revenue machines work. Scientist-trained, blue-collar roots, sampling mentality. I see patterns others miss because I learned to work with limitations and find the signal in the noise.',
    looking_for = 'Founding GTM Engineer, Growth, Early Team Member. Product-adjacent work. Elite teammates. Autonomy with engagement. Remote or Atlanta.',
    not_looking_for = 'BDR/SDR roles. Pure activity metrics. Isolation without engagement.'
WHERE id = 'keegan-moody-001';

-- ============================================================
-- 3. UPDATE EXPERIENCES - Remove self-sabotaging fields
-- ============================================================

-- Trace Air - Focus on wins
UPDATE experiences
SET
    bullet_points = ARRAY[
        '$220K generated in 90 days from greenfield territory',
        '23 demos booked in first fully onboarded month',
        '18 of 23 demos (78%) self-sourced from outside the CRM',
        'Built territory from scratch for new AE with no existing book of business',
        'Prospected via LinkedIn, personalized videos, direct phone outreach'
    ],
    honest_assessment = NULL,
    would_do_differently = NULL
WHERE company_name ILIKE '%trace%air%';

-- Biofourmis - Focus on wins
UPDATE experiences
SET
    bullet_points = ARRAY[
        'Co-founding SDR feeding 6 AEs across all of North America',
        'Enterprise healthcare accounts: hospitals, academic medical centers',
        'Originated Orlando Health deal: $1M+ lifetime value, 90-day close, still active',
        'Built prospecting methodology from scratch in remote-first startup',
        'Developed hospital readmission pain-based messaging framework'
    ],
    honest_assessment = NULL,
    would_do_differently = NULL
WHERE company_name ILIKE '%biofourmis%';

-- Mixmax - Frame as infrastructure build
UPDATE experiences
SET
    bullet_points = ARRAY[
        'Built complete GTM infrastructure from zero — first time doing any of it',
        '53-inbox email infrastructure across multiple providers',
        'ICP validation across 280 customers ($4.79M ARR analyzed)',
        '9-agent AI orchestration system (Gutenberg Framework) for outbound',
        'Full methodology documentation for handoff — system is production-ready',
        'Worked directly with CRO daily; RevOps was counterpart'
    ],
    honest_assessment = NULL,
    would_do_differently = NULL
WHERE company_name ILIKE '%mixmax%';

-- ============================================================
-- 4. UPDATE SKILLS - Remove honest_notes
-- ============================================================

UPDATE skills
SET honest_notes = NULL
WHERE candidate_id = 'keegan-moody-001';

-- ============================================================
-- 5. CLEAR AND RESET GAPS/WEAKNESSES
-- ============================================================

-- Delete old self-sabotaging content
DELETE FROM gaps_weaknesses WHERE candidate_id = 'keegan-moody-001';

-- Insert reframed growth areas
INSERT INTO gaps_weaknesses (candidate_id, gap_name, gap_type, description, growth_path, is_active)
VALUES
    ('keegan-moody-001', 'Enterprise Deal Closing', 'growth_area',
     'Strong at originating and building pipeline. Haven''t carried a quota as an AE.',
     'Top-of-funnel strength, closing is the next skill to develop with mentorship.',
     true),
    ('keegan-moody-001', 'Team Management', 'growth_area',
     'Led by influence, advocated for peers, mentored. Never had direct reports.',
     'Ready to grow into formal leadership, starting small.',
     true),
    ('keegan-moody-001', 'Formal Sales Methodology', 'growth_area',
     'Self-taught. No MEDDIC, Sandler, Challenger training.',
     'Built own methodologies from scratch. Open to formal training.',
     true);

-- ============================================================
-- 6. UPDATE VALUES/CULTURE
-- ============================================================

UPDATE values_culture
SET
    ideal_environment = 'Autonomy with engagement. Elite teammates. Product-adjacent work. Weekly syncs minimum. Clear deadlines. Room to build and experiment.',
    dealbreakers = 'Pure activity metrics without outcomes. Complete isolation. No path to growth.',
    what_i_bring = 'Builder mentality. Scientist-trained, blue-collar work ethic. Sampling mentality — finds diamonds in dirt. Constraint-driven creativity.'
WHERE candidate_id = 'keegan-moody-001';

-- ============================================================
-- 7. VERIFY - Run these SELECT statements to check
-- ============================================================

SELECT 'ai_instructions' as table_name, instruction_type, LEFT(content, 80) as preview
FROM ai_instructions WHERE candidate_id = 'keegan-moody-001' LIMIT 3;

SELECT 'candidate_profile' as table_name, title, headline
FROM candidate_profile WHERE id = 'keegan-moody-001';

SELECT 'experiences' as table_name, company_name, bullet_points[1] as first_bullet
FROM experiences WHERE candidate_id = 'keegan-moody-001' LIMIT 3;

SELECT 'gaps_weaknesses' as table_name, gap_name, gap_type
FROM gaps_weaknesses WHERE candidate_id = 'keegan-moody-001';
