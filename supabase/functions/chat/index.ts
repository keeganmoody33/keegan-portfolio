// Supabase Edge Function: Portfolio AI Chat
// Uses Claude API to answer questions about Keegan Moody's portfolio
// Updated with Strategic Positioning Framework - Jan 2026
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
    console.error("Chat Error:", error);
    return new Response(
      JSON.stringify({ error: "Unable to process your question. Please try again." }),
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
    // Query ALL instruction rows, ordered by priority (highest first)
    supabase.from("ai_instructions").select("*").eq("candidate_id", candidateId).order("priority", { ascending: false }),
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

  // Build the dynamic system prompt with STRATEGIC POSITIONING
  // FIXED: Using actual column names from schema (first_name, last_name, headline)
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || "Keegan Moody";
  const title = profile?.headline || "GTM Engineer";

  let prompt = `You are an AI assistant representing ${fullName}, a ${title}.
You speak in first person AS ${profile?.first_name || "Keegan"}.

## CORE PHILOSOPHY
They came to you. You represent someone worth talking to—not someone begging for a chance.
Your goal is to engage visitors genuinely, demonstrate value, and make it easy for qualified visitors to connect directly with Keegan.

Key principles:
- Lead with strengths, acknowledge gaps only when directly relevant
- Ask questions to understand what visitors need
- Earn the calendar drop through genuine engagement
- Never volunteer weaknesses unprompted
- Be confident, warm, and direct—like talking to a smart friend

`;

  // Add RESPONSE STRATEGY (new - priority instruction type)
  if (byType['response_strategy']) {
    prompt += `## RESPONSE STRATEGIES\n`;
    for (const rule of byType['response_strategy']) {
      prompt += `${rule}\n\n`;
    }
  }

  // Add TOPIC DOMAINS (new)
  if (byType['topic_domains']) {
    prompt += `## TOPIC DOMAINS\n`;
    for (const rule of byType['topic_domains']) {
      prompt += `${rule}\n\n`;
    }
  }

  // Add BOUNDARY HANDLING (new)
  if (byType['boundary_handling']) {
    prompt += `## BOUNDARY HANDLING\n`;
    for (const rule of byType['boundary_handling']) {
      prompt += `${rule}\n\n`;
    }
  }

  // Add PROACTIVE QUESTIONING (new)
  if (byType['proactive_questioning']) {
    prompt += `## PROACTIVE QUESTIONING\n`;
    for (const rule of byType['proactive_questioning']) {
      prompt += `${rule}\n\n`;
    }
  }

  // Add CONVERSION LOGIC (new)
  if (byType['conversion_logic']) {
    prompt += `## CONVERSION LOGIC\n`;
    for (const rule of byType['conversion_logic']) {
      prompt += `${rule}\n\n`;
    }
  }

  // Add INFORMATION GATING (new)
  if (byType['information_gating']) {
    prompt += `## INFORMATION GATING\n`;
    for (const rule of byType['information_gating']) {
      prompt += `${rule}\n\n`;
    }
  }

  // Add ANTI-PATTERNS (new)
  if (byType['anti_patterns']) {
    prompt += `## ANTI-PATTERNS (NEVER DO THESE)\n`;
    for (const rule of byType['anti_patterns']) {
      prompt += `${rule}\n\n`;
    }
  }

  // Add TECHNICAL FRAMING (new)
  if (byType['technical_framing']) {
    prompt += `## TECHNICAL CAPABILITY FRAMING\n`;
    for (const rule of byType['technical_framing']) {
      prompt += `${rule}\n\n`;
    }
  }

  // Add VOICE EXAMPLES (new)
  if (byType['voice_examples']) {
    prompt += `## VOICE & TONE\n`;
    for (const rule of byType['voice_examples']) {
      prompt += `${rule}\n\n`;
    }
  }

  // Keep CRITICAL DISTINCTIONS (important facts that must be accurate)
  if (byType['critical_distinction']) {
    prompt += `## CRITICAL DISTINCTIONS (MUST GET RIGHT)\n`;
    for (const rule of byType['critical_distinction']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Keep BOUNDARIES (salary, etc.)
  if (byType['boundaries']) {
    prompt += `## HARD BOUNDARIES\n`;
    for (const rule of byType['boundaries']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add TONE rules (legacy, keep if useful)
  if (byType['tone']) {
    prompt += `## TONE RULES\n`;
    for (const rule of byType['tone']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add BREVITY rules (legacy)
  if (byType['brevity']) {
    prompt += `## RESPONSE LENGTH\n`;
    for (const rule of byType['brevity']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add VALUES AND CULTURE FIT
  if (context.values_culture) {
    const vc = context.values_culture;
    prompt += `## VALUES & CULTURE FIT\n`;
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
- Speak in first person as Keegan
- Lead with what you bring, not what you lack
- 2-4 sentences default, longer only when they ask for detail
- Ask questions back to understand what they need
- If there's genuine fit and depth in the conversation, offer the calendar link naturally
- Never use self-sabotaging language ("I can't", "I'm not qualified", "You probably don't want me")
- If you don't know something specific, say so briefly and offer to connect them directly with Keegan`;

  return prompt;
}

function buildPortfolioContext(context: PortfolioContext): string {
  const { profile, experiences, skills } = context;

  let portfolioText = "## ABOUT ME\n";
  if (profile) {
    // FIXED: Using actual column names from schema
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Keegan Moody';
    portfolioText += `Name: ${fullName}
Title: ${profile.headline || 'GTM Engineer'}
Location: ${profile.location || ''}
Summary: ${profile.summary || ''}
`;
  }

  portfolioText += "\n## MY WORK EXPERIENCE\n";
  for (const exp of experiences) {
    // FIXED: Using actual column names - public_bullets instead of bullet_points
    const bullets = exp.public_bullets || [];
    portfolioText += `
### ${exp.role_title} at ${exp.company_name}
Period: ${exp.start_date} to ${exp.end_date || "Present"}

**Key Achievements:**
${bullets.map((b: string) => `- ${b}`).join("\n")}
`;
    // NOTE: Removed private_context fields from public-facing chat context
  }

  portfolioText += "\n## MY SKILLS\n";
  
  // Group skills by category - lead with strengths
  const strong = skills.filter((s: any) => s.category === 'strong');
  const moderate = skills.filter((s: any) => s.category === 'moderate');
  const developing = skills.filter((s: any) => s.category === 'gap' || s.category === 'developing');

  // FIXED: Removed honest_notes (too self-critical) - just use evidence
  if (strong.length > 0) {
    portfolioText += "\n### Core Strengths\n";
    for (const skill of strong) {
      portfolioText += `- **${skill.skill_name}**: ${skill.evidence || ""}\n`;
    }
  }

  if (moderate.length > 0) {
    portfolioText += "\n### Developing Skills\n";
    for (const skill of moderate) {
      portfolioText += `- **${skill.skill_name}**: ${skill.evidence || ""}\n`;
    }
  }

  // NOTE: Removed "gap" category display - don't volunteer weaknesses

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
