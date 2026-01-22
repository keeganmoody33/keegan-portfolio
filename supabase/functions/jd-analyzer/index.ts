// Supabase Edge Function: JD Analyzer
// Analyzes job descriptions against Keegan's profile for honest fit assessment
// Uses multi-row ai_instructions table per Nate B Jones architecture
// Deployed to: https://cvkcwvmlnghwwvdqudod.supabase.co/functions/v1/jd-analyzer

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JDRequest {
  input: string; // Can be job description text or URL
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
  ai_instructions: AIInstruction[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { input } = await req.json() as JDRequest;

    if (!input || input.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Job description or URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if input is a URL
    let jobDescription = input;
    if (isUrl(input)) {
      jobDescription = await scrapeJobPosting(input);
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
    const systemPrompt = buildJDAnalyzerPrompt(context);

    // Build candidate context
    const candidateContext = buildCandidateContext(context);

    // Call Claude API for analysis
    const analysis = await analyzeWithClaude(anthropicKey, systemPrompt, candidateContext, jobDescription);

    return new Response(
      JSON.stringify({ analysis }),
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

function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function scrapeJobPosting(url: string): Promise<string> {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  
  if (!firecrawlKey) {
    throw new Error("Firecrawl API key not configured. Please paste the job description text directly.");
  }

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${firecrawlKey}`,
    },
    body: JSON.stringify({
      url: url,
      formats: ["markdown"],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to scrape job posting: ${error}`);
  }

  const data = await response.json();
  return data.data?.markdown || data.data?.content || "Could not extract job description from URL.";
}

async function fetchPortfolioContext(supabase: any): Promise<PortfolioContext> {
  const candidateId = "keegan-moody-001";

  const [profileRes, experiencesRes, skillsRes, gapsRes, valuesRes, aiRes] = await Promise.all([
    supabase.from("candidate_profile").select("*").eq("id", candidateId).single(),
    supabase.from("experiences").select("*").eq("candidate_id", candidateId).order("display_order"),
    supabase.from("skills").select("*").eq("candidate_id", candidateId),
    supabase.from("gaps_weaknesses").select("*").eq("candidate_id", candidateId),
    supabase.from("values_culture").select("*").eq("candidate_id", candidateId).single(),
    supabase.from("ai_instructions").select("*").eq("candidate_id", candidateId).order("instruction_type").order("priority"),
  ]);

  return {
    profile: profileRes.data,
    experiences: experiencesRes.data || [],
    skills: skillsRes.data || [],
    gaps_weaknesses: gapsRes.data || [],
    values_culture: valuesRes.data,
    ai_instructions: aiRes.data || [],
  };
}

function buildJDAnalyzerPrompt(context: PortfolioContext): string {
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

  let prompt = `You are a JD Fit Analyzer for ${profile?.name || "Keegan Moody"}.

## YOUR CORE DIRECTIVE
Analyze job descriptions HONESTLY. Your job is NOT to make every role seem like a fit. Your job is to give a REAL assessment that helps both the candidate and the employer.

## VERDICT OPTIONS
You MUST return one of these verdicts:
- **STRONG FIT**: 80%+ alignment, no critical gaps
- **MODERATE FIT**: 50-79% alignment, gaps are learnable
- **WEAK FIT**: 30-49% alignment, significant gaps exist
- **NOT A FIT**: <30% alignment or critical dealbreakers present

## ANALYSIS STRUCTURE
Return your analysis in this format:

**VERDICT: [STRONG FIT / MODERATE FIT / WEAK FIT / NOT A FIT]**

**Why:** [1-2 sentences explaining the verdict]

**Alignments:**
- [Specific skill/experience that matches]
- [Another match]

**Gaps:**
- [Specific requirement I don't meet]
- [Another gap]

**Honest Recommendation:** [Direct advice - may include "I'm probably not your person for this"]

`;

  // Add HONESTY rules
  if (byType['honesty']) {
    prompt += `## HONESTY RULES\n`;
    for (const rule of byType['honesty']) {
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

  // Add EXPLICIT GAPS from database
  if (context.gaps_weaknesses.length > 0) {
    prompt += `## CANDIDATE'S EXPLICIT GAPS (Check JD against these)\n`;
    for (const gap of context.gaps_weaknesses) {
      prompt += `- **${gap.description}** (${gap.gap_type}): ${gap.why_its_a_gap || ""}\n`;
    }
    prompt += `\n`;
  }

  // Add VALUES AND CULTURE FIT
  if (context.values_culture) {
    const vc = context.values_culture;
    prompt += `## CULTURE FIT CRITERIA\n`;
    if (vc.must_haves) prompt += `- Must haves: ${vc.must_haves}\n`;
    if (vc.dealbreakers) prompt += `- Dealbreakers: ${vc.dealbreakers}\n`;
    prompt += `\n`;
  }

  prompt += `## IMPORTANT
- Be direct. If it's not a fit, say so.
- Don't soften bad news with excessive caveats.
- If 3+ major gaps exist, verdict should be WEAK FIT or NOT A FIT.
- Never say "I could learn that quickly" to cover gaps.`;

  return prompt;
}

function buildCandidateContext(context: PortfolioContext): string {
  const { profile, experiences, skills, gaps_weaknesses } = context;

  let candidateText = "## CANDIDATE PROFILE\n";
  if (profile) {
    candidateText += `Name: ${profile.name}
Title: ${profile.title}
Looking for: ${profile.looking_for}
NOT looking for: ${profile.not_looking_for}
`;
  }

  candidateText += "\n## WORK EXPERIENCE\n";
  for (const exp of experiences) {
    candidateText += `
### ${exp.title || exp.role_title} at ${exp.company_name} (${exp.start_date} - ${exp.end_date || "Present"})
${(exp.bullet_points || []).map((b: string) => `- ${b}`).join("\n")}
Honest assessment: ${exp.would_do_differently || "N/A"}
`;
  }

  candidateText += "\n## SKILLS\n";
  
  const strong = skills.filter((s: any) => s.category === 'strong');
  const moderate = skills.filter((s: any) => s.category === 'moderate');
  const gaps = skills.filter((s: any) => s.category === 'gap');

  if (strong.length > 0) {
    candidateText += "\n### Strong Skills\n";
    for (const skill of strong) {
      candidateText += `- ${skill.skill_name}: ${skill.evidence || ""}\n`;
    }
  }

  if (moderate.length > 0) {
    candidateText += "\n### Moderate Skills\n";
    for (const skill of moderate) {
      candidateText += `- ${skill.skill_name}: ${skill.evidence || ""}\n`;
    }
  }

  if (gaps.length > 0) {
    candidateText += "\n### Skill Gaps\n";
    for (const skill of gaps) {
      candidateText += `- ${skill.skill_name}: ${skill.honest_notes || ""}\n`;
    }
  }

  if (gaps_weaknesses.length > 0) {
    candidateText += "\n## EXPLICIT WEAKNESSES\n";
    for (const gap of gaps_weaknesses) {
      candidateText += `- ${gap.description}: ${gap.why_its_a_gap || ""}\n`;
    }
  }

  return candidateText;
}

async function analyzeWithClaude(
  apiKey: string,
  systemPrompt: string,
  candidateContext: string,
  jobDescription: string
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
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `## CANDIDATE DATA
${candidateContext}

---

## JOB DESCRIPTION TO ANALYZE
${jobDescription}

---

Analyze this job description against the candidate's profile. Be honest about fit.`,
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
