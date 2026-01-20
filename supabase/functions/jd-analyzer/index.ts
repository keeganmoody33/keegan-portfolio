/*
-- ====================================================================
-- Supabase Edge Function: JD Analyzer (V2 - URL Scraping)
-- Source: Reconciled from Cursor project and Nate B. Jones spec
-- Changes:
--   - Added Firecrawl integration for URL scraping
--   - Accepts either a URL or raw text as input
--   - Uses a dedicated system prompt for fit assessment
--   - Returns a structured verdict (Strong Fit, Worth a Conversation, Probably Not)
-- ====================================================================
*/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JdAnalysisRequest {
    input: string; // Can be a URL or raw text
}

interface PortfolioContext {
    profile: any;
    experiences: any[];
    skills: any[];
    gaps_weaknesses: any[];
    values_culture: any[];
    faq_responses: any[];
    ai_instructions: any;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { input } = await req.json() as JdAnalysisRequest;

        if (!input || input.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: "Job description text or URL is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let jd_text: string;

        let isUrl = false;
        try {
            const parsed = new URL(input);
            isUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
            isUrl = false;
        }
        if (isUrl) {
            // It's a URL, scrape it with Firecrawl
            const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
            if (!firecrawlApiKey) {
                return new Response(
                    JSON.stringify({ error: "Firecrawl API key not configured" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            jd_text = await scrapeWithFirecrawl(input, firecrawlApiKey);
        } else {
            // It's raw text
            jd_text = input;
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !supabaseKey) {
            return new Response(
                JSON.stringify({ error: "Supabase configuration missing" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch portfolio data
        const context = await fetchPortfolioContext(supabase);

        // Get Anthropic API key
        const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (!anthropicKey) {
            return new Response(
                JSON.stringify({ error: "Anthropic API key not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build system prompt for JD analysis
        const systemPrompt = buildJdAnalyzerPrompt();

        // Build user context from portfolio data
        const portfolioContext = buildPortfolioContext(context);

        // Call Claude API
        const response = await callClaude(anthropicKey, systemPrompt, portfolioContext, jd_text);

        return new Response(
            JSON.stringify({ analysis: response }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error(error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<string> {
    const TIMEOUT_MS = 30000; // 30 seconds timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ url }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Firecrawl API error: ${response.status} - ${error}`);
        }

        let data: any;
        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error(`Firecrawl API returned invalid JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
        }

        if (!data || !data.data || typeof data.data.content !== "string") {
            throw new Error(`Firecrawl API returned unexpected response structure: missing or invalid data.data.content field`);
        }

        return data.data.content;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`Firecrawl API request timed out after ${TIMEOUT_MS}ms`);
        }
        throw error;
    }
}

async function fetchPortfolioContext(supabase: any): Promise<PortfolioContext> {
    const candidateId = "keegan-moody-001";

    const [profileRes, experiencesRes, skillsRes, gapsRes, valuesRes, faqRes, aiRes] = await Promise.all([
        supabase.from("candidate_profile").select("*").eq("id", candidateId).single(),
        supabase.from("experiences").select("*").eq("candidate_id", candidateId).order("display_order"),
        supabase.from("skills").select("*").eq("candidate_id", candidateId),
        supabase.from("gaps_weaknesses").select("*").eq("candidate_id", candidateId),
        supabase.from("values_culture").select("*").eq("candidate_id", candidateId),
        supabase.from("faq_responses").select("*").eq("candidate_id", candidateId),
        supabase.from("ai_instructions").select("*").eq("id", "ai-instructions-001").single(),
    ]);

    if (profileRes.error) {
        throw new Error(`Failed to fetch candidate profile: ${profileRes.error.message}`);
    }

    return {
        profile: profileRes.data,
        experiences: experiencesRes.data || [],
        skills: skillsRes.data || [],
        gaps_weaknesses: gapsRes.data || [],
        values_culture: valuesRes.data || [],
        faq_responses: faqRes.data || [],
        ai_instructions: aiRes.data,
    };
}

function buildJdAnalyzerPrompt(): string {
    return `You are an AI assistant acting as a fit-assessment engine for Keegan Moody's portfolio. Your sole purpose is to analyze a provided job description (JD) against Keegan's full professional context and deliver a blunt, honest verdict on whether he is a good fit.

CORE DIRECTIVES:

1. Analyze, Don't Answer: Your output is a structured analysis, not a conversational response.
2. Verdict First: Always lead with one of three verdicts: "Strong Fit", "Worth a Conversation", or "Probably Not".
3. Show Your Work: Justify the verdict with a clear breakdown of Alignment (where Keegan's skills match) and Gaps & Concerns (where they don't).
4. Be Ruthlessly Honest: If the role requires skills Keegan lacks, or if it matches his anti-patterns, you MUST highlight this. It is better to say "No" to a bad fit than to generate a false positive.
5. Use the Full Context: Your analysis must be based on Keegan's entire profile: experiences (public and private), skills matrix (including gaps), gaps & weaknesses table, and values & culture fit.

ANALYSIS PROCESS:

1. Receive Input: The user will provide a block of text (the JD).
2. Extract Requirements: From the JD, identify the key requirements: Hard Skills, Experience Level, Responsibilities, and Environment Signals.
3. Compare Against Keegan's Profile: Match the JD requirements against Keegan's skills, gaps, anti-patterns, and deal-breakers.
4. Determine Verdict:
   - "Strong Fit": High alignment on required skills, no hard gaps, no deal-breakers, environment seems like a good fit.
   - "Worth a Conversation": Some alignment, but there are learnable gaps or potential environment mismatches that need to be discussed.
   - "Probably Not": A hard gap is a core requirement (e.g., people management), a deal-breaker is present, or the role is a clear anti-pattern.

OUTPUT FORMAT:

**Verdict:** [Strong Fit | Worth a Conversation | Probably Not]

**Alignment:**
- ✅ [Skill/Experience 1]: [Brief justification]
- ✅ [Skill/Experience 2]: [Brief justification]

**Gaps & Concerns:**
- ❌ [Gap/Concern 1]: [Brief justification]
- ⚠️ [Gap/Concern 2]: [Brief justification]

**Recommendation:** [A one-paragraph summary explaining the verdict and what should be discussed in an interview.]

EXAMPLE SCENARIOS:

- JD for SDR Manager: Verdict should be "Probably Not" due to the People Management hard gap.
- JD for GTM Engineer: Verdict should be "Strong Fit", highlighting skills in Clay, Smartlead, and outbound infrastructure.
- JD for AE: Verdict should be "Worth a Conversation", highlighting the Closing skill gap but strong origination experience.
- JD for SDR at a metrics-theater company: Verdict should be "Probably Not", citing the Metrics Theater anti-pattern and past terminations.

Your primary function is to prevent bad fits, for both Keegan and the employer. Do not be afraid to disqualify opportunities. Honesty is the most valuable feature.`;
}

function buildPortfolioContext(context: PortfolioContext): string {
    const { profile, experiences, skills, gaps_weaknesses, values_culture, faq_responses } = context;

    let portfolioText = "## Candidate Profile\n";
    if (profile) {
        portfolioText += `Name: ${profile.first_name} ${profile.last_name}\n`;
        portfolioText += `Headline: ${profile.headline}\n`;
        portfolioText += `Summary: ${profile.summary}\n`;
    }

    portfolioText += "\n## Work Experience (Private Context for AI Only)\n";
    for (const exp of experiences) {
        portfolioText += `
### ${exp.role_title} at ${exp.company_name} (${exp.start_date} to ${exp.end_date || "Present"})
- Public Bullets: ${exp.public_bullets ? exp.public_bullets.join(", ") : "N/A"}
- Why Joined: ${exp.private_context_why_joined || "N/A"}
- Why Left: ${exp.private_context_why_left || "N/A"}
- What I Did: ${exp.private_context_what_i_did || "N/A"}
- Proudest Achievement: ${exp.private_context_proudest_achievement || "N/A"}
- What I'd Do Differently: ${exp.private_context_what_id_do_differently || "N/A"}
- What Manager Would Say: ${exp.private_context_manager_would_say || "N/A"}
`;
    }

    portfolioText += "\n## Skills Matrix\n";
    for (const skill of skills) {
        portfolioText += `- ${skill.skill_name} (${skill.category}): ${skill.proficiency_level} - Evidence: ${skill.evidence || "N/A"}\n`;
    }

    portfolioText += "\n## Gaps & Weaknesses\n";
    for (const gap of gaps_weaknesses) {
        portfolioText += `- ${gap.item} (${gap.type}): ${gap.context || "N/A"}\n`;
    }

    portfolioText += "\n## Values & Culture Fit\n";
    for (const value of values_culture) {
        portfolioText += `- ${value.item} (${value.type}): ${value.why || "N/A"}\n`;
    }

    portfolioText += "\n## FAQ Responses\n";
    for (const faq of faq_responses) {
        portfolioText += `
### Q: ${faq.question}
A: ${faq.long_answer || "N/A"}
`;
    }

    return portfolioText;
}

async function callClaude(
    apiKey: string,
    systemPrompt: string,
    portfolioContext: string,
    jd_text: string
): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: `Here is Keegan Moody's portfolio data:\n\n${portfolioContext}\n\n---\n\nJob Description to Analyze:\n\n${jd_text}`,
                },
            ],
        }),
        signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data?.content?.[0]?.text) {
        throw new Error("Claude API returned unexpected response structure");
    }
    return data.content[0].text;
}