-- ============================================================
-- PORTFOLIO DATABASE UPDATE - CORRECT SCHEMA VERSION
-- Based on actual table columns discovered 2026-01-31
-- ============================================================

-- ============================================================
-- 1. UPDATE AI INSTRUCTIONS
-- The ai_instructions table has: instruction_type, instruction, content, priority
-- We update the 'content' field for the system_prompt type
-- ============================================================

-- First, let's see what instruction_types exist
-- SELECT DISTINCT instruction_type FROM ai_instructions WHERE candidate_id = 'keegan-moody-001';

-- Update the main system prompt
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
WHERE instruction_type = 'system_prompt'
AND candidate_id = 'keegan-moody-001';

-- ============================================================
-- 2. UPDATE CANDIDATE PROFILE
-- Actual columns: first_name, last_name, headline, summary, location
-- ============================================================

UPDATE candidate_profile
SET
    headline = 'GTM Engineer | Builder | Finds diamonds in dirt',
    summary = 'GTM Engineer — I build the infrastructure that makes revenue machines work. Prospecting systems, outbound automation, ICP frameworks. Scientist-trained, blue-collar roots, sampling mentality from hip-hop production. I see patterns others miss because I learned to work with limitations and find the signal in the noise.

Looking for: Founding GTM Engineer, Growth, Early Team Member. Product-adjacent work where I can influence what gets built. Elite teammates who want to win. Autonomy with engagement, not isolation. Remote or Atlanta-based.

Comp: $120K floor, $150-180K target. Open to equity in the right situation.'
WHERE id = 'keegan-moody-001';

-- ============================================================
-- 3. UPDATE EXPERIENCES
-- Actual columns: public_bullets (ARRAY), private_context_* fields
-- ============================================================

-- Trace Air - Update public bullets and clear negative private context
UPDATE experiences
SET
    public_bullets = ARRAY[
        '$220K generated in 90 days from greenfield territory',
        '23 demos booked in first fully onboarded month',
        '18 of 23 demos (78%) self-sourced from outside the CRM',
        'Built territory from scratch for new AE with no existing book of business',
        'Prospected via LinkedIn, personalized videos, direct phone outreach'
    ],
    private_context_what_id_do_differently = 'Would communicate methodology more proactively to leadership. Document wins in real-time.',
    private_context_manager_would_say = 'Top performer who found creative ways to source pipeline outside traditional channels.'
WHERE company_name ILIKE '%trace%air%'
AND candidate_id = 'keegan-moody-001';

-- Biofourmis - Update public bullets
UPDATE experiences
SET
    public_bullets = ARRAY[
        'Co-founding SDR feeding 6 AEs across all of North America',
        'Enterprise healthcare accounts: hospitals, academic medical centers',
        'Originated Orlando Health deal: $1M+ lifetime value, 90-day close, still active today',
        'Built prospecting methodology from scratch in remote-first startup',
        'Developed hospital readmission pain-based messaging framework'
    ],
    private_context_what_id_do_differently = 'Would balance quality prospecting with activity visibility earlier.',
    private_context_manager_would_say = 'Creative prospector who landed the biggest deal in company history.'
WHERE company_name ILIKE '%biofourmis%'
AND candidate_id = 'keegan-moody-001';

-- Mixmax - Update public bullets with positive framing
UPDATE experiences
SET
    public_bullets = ARRAY[
        'Built complete GTM infrastructure from zero — first time doing any of it',
        '53-inbox email infrastructure across multiple providers',
        'ICP validation across 280 customers ($4.79M ARR analyzed)',
        '9-agent AI orchestration system (Gutenberg Framework) for outbound',
        'Full methodology documentation for handoff — system is production-ready',
        'Worked directly with CRO daily; built comprehensive onboarding for successor'
    ],
    private_context_what_id_do_differently = 'Would ship minimum viable campaigns faster before building comprehensive infrastructure.',
    private_context_manager_would_say = 'Thorough systems builder who created production-ready GTM infrastructure from scratch.'
WHERE company_name ILIKE '%mixmax%'
AND candidate_id = 'keegan-moody-001';

-- ============================================================
-- 4. VERIFY UPDATES
-- ============================================================

-- Check ai_instructions
SELECT instruction_type, LEFT(content, 100) as content_preview
FROM ai_instructions
WHERE candidate_id = 'keegan-moody-001'
AND instruction_type = 'system_prompt';

-- Check profile
SELECT headline, LEFT(summary, 100) as summary_preview
FROM candidate_profile
WHERE id = 'keegan-moody-001';

-- Check experiences
SELECT company_name, public_bullets[1] as first_bullet
FROM experiences
WHERE candidate_id = 'keegan-moody-001'
ORDER BY display_order;
