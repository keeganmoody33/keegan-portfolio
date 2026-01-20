/*
-- ====================================================================
-- Supabase Edge Function: Portfolio AI Chat (V2)
-- Source: Reconciled from Cursor project and Nate B. Jones spec
-- Changes:
--   - Queries all 7 tables (including gaps, values, faq)
--   - Builds a comprehensive system prompt with full context
--   - Aligned with the definitive SQL package
-- ====================================================================
*/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  question: string;
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
    const { question } = await req.json() as ChatRequest;

    if (!question || question.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    // Build system prompt from AI instructions
    const systemPrompt = buildSystemPrompt(context);

    // Build user context from portfolio data
    const portfolioContext = buildPortfolioContext(context);

    // Call Claude API
    const response = await callClaude(anthropicKey, systemPrompt, portfolioContext, question);

    return new Response(
      JSON.stringify({ answer: response }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

function buildSystemPrompt(context: PortfolioContext): string {
  const ai = context.ai_instructions;
  if (!ai) {
    return "You are an AI assistant representing Keegan Moody. Be honest and specific.";
  }
  return ai.system_prompt;
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
- Public Bullets: ${exp.public_bullets.join(", ")}
- Why Joined: ${exp.private_context_why_joined}
- Why Left: ${exp.private_context_why_left}
- What I Did: ${exp.private_context_what_i_did}
- Proudest Achievement: ${exp.private_context_proudest_achievement}
- What I'd Do Differently: ${exp.private_context_what_id_do_differently}
- What Manager Would Say: ${exp.private_context_manager_would_say}
`;
  }

  portfolioText += "\n## Skills Matrix\n";
  for (const skill of skills) {
    portfolioText += `- ${skill.skill_name} (${skill.category}): ${skill.proficiency_level} - Evidence: ${skill.evidence}\n`;
  }

  portfolioText += "\n## Gaps & Weaknesses\n";
  for (const gap of gaps_weaknesses) {
    portfolioText += `- ${gap.item} (${gap.type}): ${gap.context}\n`;
  }

  portfolioText += "\n## Values & Culture Fit\n";
  for (const value of values_culture) {
    portfolioText += `- ${value.item} (${value.type}): ${value.why}\n`;
  }

  portfolioText += "\n## FAQ Responses\n";
  for (const faq of faq_responses) {
    portfolioText += `
### Q: ${faq.question}
- A: ${faq.long_answer}
`;
  }

  return portfolioText;
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  portfolioContext: string,
  question: string
): Promise<string> {
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
          content: `Here is Keegan Moody's portfolio data:\n\n${portfolioContext}\n\n---\n\nQuestion: ${question}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}