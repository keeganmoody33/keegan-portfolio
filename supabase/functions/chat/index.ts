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

interface PortfolioContextError {
  error: true;
  message: string;
  details: string;
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

    // Check for structured error from Supabase queries
    if ("error" in context && context.error) {
      return new Response(
        JSON.stringify({ error: context.message, details: context.details }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Type narrowing: context is now PortfolioContext
    const portfolioData = context as PortfolioContext;

    // Get Anthropic API key
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build system prompt from AI instructions
    const systemPrompt = buildSystemPrompt(portfolioData);

    // Build user context from portfolio data
    const portfolioContext = buildPortfolioContext(portfolioData);

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

async function fetchPortfolioContext(supabase: any): Promise<PortfolioContext | PortfolioContextError> {
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

  // Check for errors in all responses
  const errors: string[] = [];

  // Profile is critical - must exist
  if (profileRes.error) {
    return {
      error: true,
      message: "Failed to fetch candidate profile",
      details: `profileRes.error: ${profileRes.error.message || JSON.stringify(profileRes.error)}`,
    };
  }

  // Check other responses and collect errors
  if (experiencesRes.error) {
    errors.push(`experiencesRes.error: ${experiencesRes.error.message || JSON.stringify(experiencesRes.error)}`);
  }
  if (skillsRes.error) {
    errors.push(`skillsRes.error: ${skillsRes.error.message || JSON.stringify(skillsRes.error)}`);
  }
  if (gapsRes.error) {
    errors.push(`gapsRes.error: ${gapsRes.error.message || JSON.stringify(gapsRes.error)}`);
  }
  if (valuesRes.error) {
    errors.push(`valuesRes.error: ${valuesRes.error.message || JSON.stringify(valuesRes.error)}`);
  }
  if (faqRes.error) {
    errors.push(`faqRes.error: ${faqRes.error.message || JSON.stringify(faqRes.error)}`);
  }
  if (aiRes.error) {
    errors.push(`aiRes.error: ${aiRes.error.message || JSON.stringify(aiRes.error)}`);
  }

  // Log non-critical errors but proceed with available data
  if (errors.length > 0) {
    console.warn("Some portfolio data failed to load:", errors);
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
- Public Bullets: ${(exp.public_bullets || []).join(", ")}
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
  const text = data?.content?.[0]?.text;
  if (!text) {
    throw new Error("Unexpected response format from Claude API");
  }
  return text;
}