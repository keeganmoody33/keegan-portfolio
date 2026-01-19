// Supabase Edge Function: Portfolio AI Chat
// Uses Claude API to answer questions about Keegan Moody's portfolio
// Deployed to: https://cvkcwvmlnghwwvdqudod.supabase.co/functions/v1/chat

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
  achievements: any[];
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

  const [profileRes, experiencesRes, skillsRes, achievementsRes, aiRes] = await Promise.all([
    supabase.from("candidate_profiles").select("*").eq("id", candidateId).single(),
    supabase.from("experiences").select("*").eq("candidate_id", candidateId).order("display_order"),
    supabase.from("skills").select("*").eq("candidate_id", candidateId),
    supabase.from("achievements").select("*").eq("candidate_id", candidateId).eq("is_featured", true),
    supabase.from("ai_instructions").select("*").eq("candidate_id", candidateId).single(),
  ]);

  return {
    profile: profileRes.data,
    experiences: experiencesRes.data || [],
    skills: skillsRes.data || [],
    achievements: achievementsRes.data || [],
    ai_instructions: aiRes.data,
  };
}

function buildSystemPrompt(context: PortfolioContext): string {
  const ai = context.ai_instructions;
  if (!ai) {
    return "You are an AI assistant representing Keegan Moody's professional portfolio. Be honest, specific, and concrete.";
  }

  const voice = ai.voice_guidelines || {};
  const honest = ai.honest_framing || {};
  const distinctions = ai.critical_distinctions || [];

  return `You are an AI assistant representing Keegan Moody's professional portfolio.

## Voice Guidelines
Tone: ${voice.tone || "Confident but not arrogant. Honest about setbacks."}
Perspective: ${voice.perspective_portfolio || "First person"} for portfolio content.

## Things to SAY:
${(voice.do_say || []).map((s: string) => `- ${s}`).join("\n")}

## Things to AVOID saying:
${(voice.dont_say || []).map((s: string) => `- ${s}`).join("\n")}

## Critical Distinctions (Must Get Right):
${distinctions.map((d: any) => `- Context: ${d.context}
  WRONG: "${d.incorrect}"
  RIGHT: "${d.correct}"
  Why: ${d.reason}`).join("\n\n")}

## Honest Framing of Setbacks:

### Terminations
Fact: ${honest.terminations?.fact || "Fired twice while exceeding quota"}
Frame as: ${honest.terminations?.framing || "Fit mismatch with activity-metric cultures"}

### Mixmax Delivery Gap
Fact: ${honest.mixmax_gap?.fact || "3,770 delivered vs 9,000 target"}
Frame as: ${honest.mixmax_gap?.framing || "Built infrastructure but fell short on volume"}

### Gap Period
Fact: ${honest.gap_period?.fact || "Survival jobs during job search"}
Frame as: ${honest.gap_period?.framing || "What you build next matters more"}

## Success Patterns:
${(ai.success_patterns || []).map((p: string) => `- ${p}`).join("\n")}

## Failure Patterns (Be Honest):
${(ai.failure_patterns || []).map((p: string) => `- ${p}`).join("\n")}

## Environment Fit:
Thrives in: ${(ai.environment_fit?.thrives_in || []).join(", ")}
Struggles in: ${(ai.environment_fit?.struggles_in || []).join(", ")}

## One-Liners (Use When Appropriate):
${Object.entries(ai.one_liners || {}).map(([k, v]) => `- ${k}: "${v}"`).join("\n")}

IMPORTANT: Be truthful. If you don't have information, say so. Never exaggerate or fabricate. When discussing setbacks, frame them honestly—Keegan owns his failures.`;
}

function buildPortfolioContext(context: PortfolioContext): string {
  const { profile, experiences, skills, achievements } = context;

  let portfolioText = "## Profile\n";
  if (profile) {
    portfolioText += `Name: ${profile.first_name} ${profile.last_name}
Location: ${profile.location}
Headline: ${profile.headline}
Summary: ${profile.summary}
Work Style: ${profile.work_style}
Ideal Company Stage: ${(profile.ideal_company_stage || []).join(", ")}
Ideal Environment: ${(profile.ideal_environment || []).join(", ")}
`;
  }

  portfolioText += "\n## Work Experience\n";
  for (const exp of experiences) {
    portfolioText += `
### ${exp.role_title} at ${exp.company_name}
Period: ${exp.start_date} to ${exp.end_date || "Present"} (${exp.duration_months} months)
Type: ${exp.employment_type} | Stage: ${exp.company_stage} | Industry: ${exp.company_industry}
Description: ${exp.description}
Key Deliverables: ${(exp.key_deliverables || []).join(", ")}
${exp.metrics ? `Metrics: ${JSON.stringify(exp.metrics)}` : ""}
Honest Assessment: ${exp.honest_assessment || "N/A"}
Exit: ${exp.exit_reason}
Verification: ${exp.verification_status}
`;
  }

  portfolioText += "\n## Skills\n";
  const skillsByCategory: Record<string, any[]> = {};
  for (const skill of skills) {
    if (!skillsByCategory[skill.category]) {
      skillsByCategory[skill.category] = [];
    }
    skillsByCategory[skill.category].push(skill);
  }
  for (const [category, categorySkills] of Object.entries(skillsByCategory)) {
    portfolioText += `\n### ${category}\n`;
    for (const skill of categorySkills) {
      portfolioText += `- ${skill.skill_name} (${skill.proficiency_level}): ${skill.evidence}\n`;
    }
  }

  portfolioText += "\n## Featured Achievements\n";
  for (const ach of achievements) {
    portfolioText += `- ${ach.title}: ${ach.description}`;
    if (ach.metric_value) {
      portfolioText += ` [${ach.metric_value} ${ach.metric_unit}]`;
    }
    if (ach.honest_framing) {
      portfolioText += ` (Honest framing: ${ach.honest_framing})`;
    }
    portfolioText += ` [${ach.verification_status}]\n`;
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
