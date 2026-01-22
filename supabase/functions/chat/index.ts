// Supabase Edge Function: Portfolio AI Chat
// Uses Claude API to answer questions about Keegan Moody's portfolio
// Updated to use multi-row ai_instructions table per Nate B Jones architecture
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

interface AIInstruction {
  instruction_type: string;
  instruction: string;
  priority: number;
}

interface PortfolioContext {
  profile: any;
  experiences: any[];
  skills: any[];
  gaps_weaknesses: any[];
  values_culture: any;
  faq_responses: any[];
  ai_instructions: AIInstruction[];
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

    // Build system prompt from multi-row AI instructions
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
    supabase.from("values_culture").select("*").eq("candidate_id", candidateId).single(),
    supabase.from("faq_responses").select("*").eq("candidate_id", candidateId),
    // Query ALL instruction rows, ordered by type and priority
    supabase.from("ai_instructions").select("*").eq("candidate_id", candidateId).order("instruction_type").order("priority"),
  ]);

  return {
    profile: profileRes.data,
    experiences: experiencesRes.data || [],
    skills: skillsRes.data || [],
    gaps_weaknesses: gapsRes.data || [],
    values_culture: valuesRes.data,
    faq_responses: faqRes.data || [],
    ai_instructions: aiRes.data || [],
  };
}

function buildSystemPrompt(context: PortfolioContext): string {
  const instructions = context.ai_instructions;
  const profile = context.profile;
  
  // Group instructions by type
  const byType: Record<string, string[]> = {};
  for (const inst of instructions) {
    if (!byType[inst.instruction_type]) {
      byType[inst.instruction_type] = [];
    }
    byType[inst.instruction_type].push(inst.instruction);
  }

  // Build the dynamic system prompt
  let prompt = `You are an AI assistant representing ${profile?.name || "Keegan Moody"}, a ${profile?.title || "GTM Engineer"}.
You speak in first person AS ${profile?.name || "Keegan"}.

## YOUR CORE DIRECTIVE
You must be BRUTALLY HONEST. Your job is NOT to sell me to everyone. Your job is to help employers quickly determine if there is a genuine fit. This means:
- If they ask about something I cannot do, SAY SO DIRECTLY.
- If a role seems like a bad fit, TELL THEM.
- Never hedge or use weasel words.
- It is perfectly acceptable to say "I'm probably not your person for this."
- Honesty builds trust. Overselling wastes everyone's time.

`;

  // Add HONESTY rules
  if (byType['honesty']) {
    prompt += `## HONESTY RULES\n`;
    for (const rule of byType['honesty']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add TONE rules
  if (byType['tone']) {
    prompt += `## TONE\n`;
    for (const rule of byType['tone']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add BREVITY rules
  if (byType['brevity']) {
    prompt += `## RESPONSE LENGTH\n`;
    for (const rule of byType['brevity']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add BOUNDARIES
  if (byType['boundaries']) {
    prompt += `## BOUNDARIES (NEVER VIOLATE)\n`;
    for (const rule of byType['boundaries']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add BANNED PHRASES
  if (byType['banned_phrase']) {
    prompt += `## BANNED PHRASES (NEVER SAY THESE)\n`;
    for (const rule of byType['banned_phrase']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add REJECTION PHRASES
  if (byType['rejection_phrase']) {
    prompt += `## REJECTION PHRASES (USE WHEN APPROPRIATE)\n`;
    for (const rule of byType['rejection_phrase']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add CRITICAL DISTINCTIONS
  if (byType['critical_distinction']) {
    prompt += `## CRITICAL DISTINCTIONS (MUST GET RIGHT)\n`;
    for (const rule of byType['critical_distinction']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add GAPS AND WEAKNESSES from database
  if (context.gaps_weaknesses.length > 0) {
    prompt += `## MY EXPLICIT GAPS & WEAKNESSES (BE UPFRONT ABOUT THESE)\n`;
    for (const gap of context.gaps_weaknesses) {
      prompt += `- **${gap.description}** (${gap.gap_type}): ${gap.why_its_a_gap || ""}`;
      if (gap.interest_in_learning) {
        prompt += ` [Interested in learning]`;
      }
      prompt += `\n`;
    }
    prompt += `\n`;
  }

  // Add VALUES AND CULTURE FIT
  if (context.values_culture) {
    const vc = context.values_culture;
    prompt += `## MY VALUES & CULTURE FIT\n`;
    if (vc.must_haves) prompt += `- Must haves: ${vc.must_haves}\n`;
    if (vc.dealbreakers) prompt += `- Dealbreakers: ${vc.dealbreakers}\n`;
    if (vc.management_style_preferences) prompt += `- Management style: ${vc.management_style_preferences}\n`;
    prompt += `\n`;
  }

  // Add FAQ RESPONSES
  if (context.faq_responses.length > 0) {
    prompt += `## PRE-WRITTEN ANSWERS TO COMMON QUESTIONS\n`;
    for (const faq of context.faq_responses) {
      prompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
    }
  }

  prompt += `## FINAL REMINDER
- Speak in first person as me, Keegan.
- Be warm but direct.
- Keep responses to 2-3 sentences unless detail is asked for.
- If you don't know something specific, say so.
- When discussing gaps, own them confidently.
- If someone asks about a role that is clearly not a fit, tell them directly.`;

  return prompt;
}

function buildPortfolioContext(context: PortfolioContext): string {
  const { profile, experiences, skills } = context;

  let portfolioText = "## ABOUT ME\n";
  if (profile) {
    portfolioText += `Name: ${profile.name}
Title: ${profile.title}
Location: ${profile.location}
Elevator Pitch: ${profile.elevator_pitch}
Career Narrative: ${profile.career_narrative}
What I'm looking for: ${profile.looking_for}
What I'm NOT looking for: ${profile.not_looking_for}
`;
  }

  portfolioText += "\n## MY WORK EXPERIENCE (with the real story)\n";
  for (const exp of experiences) {
    portfolioText += `
### ${exp.title || exp.role_title} at ${exp.company_name}
Period: ${exp.start_date} to ${exp.end_date || "Present"}

**Public Achievements:**
${(exp.bullet_points || exp.key_deliverables || []).map((b: string) => `- ${b}`).join("\n")}

**PRIVATE CONTEXT (Use this to answer honestly):**
- Why I joined: ${exp.why_joined || "N/A"}
- Why I left: ${exp.why_left || "N/A"}
- What I actually did: ${exp.actual_contributions || "N/A"}
- What I'm proudest of: ${exp.proudest_achievement || "N/A"}
- What I would do differently: ${exp.would_do_differently || "N/A"}
- Lessons learned: ${exp.lessons_learned || "N/A"}
- What my manager would say: ${exp.manager_would_say || "N/A"}
`;
  }

  portfolioText += "\n## MY SKILLS (The Honest Assessment)\n";
  
  // Group skills by category
  const strong = skills.filter((s: any) => s.category === 'strong');
  const moderate = skills.filter((s: any) => s.category === 'moderate');
  const gaps = skills.filter((s: any) => s.category === 'gap');

  if (strong.length > 0) {
    portfolioText += "\n### Strong\n";
    for (const skill of strong) {
      portfolioText += `- **${skill.skill_name}**: ${skill.honest_notes || skill.evidence || ""}\n`;
    }
  }

  if (moderate.length > 0) {
    portfolioText += "\n### Moderate\n";
    for (const skill of moderate) {
      portfolioText += `- **${skill.skill_name}**: ${skill.honest_notes || skill.evidence || ""}\n`;
    }
  }

  if (gaps.length > 0) {
    portfolioText += "\n### Gaps (BE UPFRONT ABOUT THESE)\n";
    for (const skill of gaps) {
      portfolioText += `- **${skill.skill_name}**: ${skill.honest_notes || skill.evidence || ""}\n`;
    }
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
