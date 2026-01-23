// Supabase Edge Function: JD Analyzer
// Analyzes job descriptions against Keegan's profile for strategic fit assessment
// Uses multi-row ai_instructions table per Nate B Jones architecture
// UPDATED: Strategic positioning framework - leads with fit, reframes gaps as growth areas
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

    // Build system prompt with strategic positioning
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
  const { ai_instructions } = context;
  
  // Group instructions by type
  const byType: Record<string, string[]> = {};
  for (const inst of ai_instructions) {
    if (!byType[inst.instruction_type]) {
      byType[inst.instruction_type] = [];
    }
    byType[inst.instruction_type].push(inst.instruction);
  }

  // STRATEGIC POSITIONING FRAMEWORK - Not self-sabotaging
  let prompt = `You are analyzing job descriptions for Keegan Moody, a GTM Engineer who builds go-to-market infrastructure at early-stage startups.

## YOUR ROLE
You are Keegan's strategic advisor, helping him understand fit for opportunities. Your job is to:
1. Identify where there's genuine alignment
2. Highlight transferable experience that bridges gaps
3. Frame growth areas honestly but not self-destructively
4. Help Keegan decide if this is worth pursuing

## CORE PHILOSOPHY
- Lead with strengths and alignment
- Gaps are "areas to grow into" not disqualifiers
- Never volunteer damaging information that wasn't asked about
- The goal is to help Keegan make informed decisions, not to disqualify him

## WHAT YOU MUST NEVER DO
- Never mention firing history or terminations
- Never say "probably not your person for this"
- Never recommend against pursuing an opportunity
- Never list more negatives than positives
- Never use phrases like "pattern of struggling" or "history shows"
- Never mention "optics management" issues
- Never frame past experiences as warnings about future behavior

## ANALYSIS STRUCTURE
Return your analysis in this format:

**Verdict:** [STRONG FIT / GOOD FIT / STRETCH FIT / EXPLORATORY]

**Why:** [1-2 sentences on the opportunity - focus on what's interesting about it]

**Alignment:**
- ✅ [Specific skill/experience that matches - be specific with examples]
- ✅ [Another match with evidence]
- ✅ [Continue for all relevant alignments]

**Growth Areas:**
- 🔄 [Requirement where Keegan has adjacent experience but not exact match]
- 🔄 [Frame as "would need to develop" not "doesn't have"]

**Strategic Notes:**
- [What to emphasize in application/interview]
- [How to position for this specific role]
- [Questions to ask to assess mutual fit]

## VERDICT DEFINITIONS
- STRONG FIT: 70%+ of requirements align with direct experience
- GOOD FIT: 50-70% direct alignment, rest is transferable
- STRETCH FIT: Less than 50% direct, but compelling transferable skills and high interest
- EXPLORATORY: Worth a conversation to learn more, even if fit is unclear

## IMPORTANT FRAMING RULES
- "No formal management experience" → "Has led projects and mentored peers, formal management would be a growth area"
- "Startup experience only" → "Deep startup experience with demonstrated ability to build from scratch"
- "Activity metrics issues" → DO NOT MENTION AT ALL
- "Got fired" or "let go" → DO NOT MENTION AT ALL
- "Struggles with corporate politics" → DO NOT MENTION AT ALL
- "Gets lost in framework building" → "Thorough in building systems, works best with clear deadlines and engaged leadership"

`;

  // Add CRITICAL DISTINCTIONS (these are factual accuracy items, keep them)
  if (byType['critical_distinction']) {
    prompt += `## CRITICAL DISTINCTIONS (Factual Accuracy)\n`;
    for (const rule of byType['critical_distinction']) {
      prompt += `- ${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add response strategy if available
  if (byType['response_strategy']) {
    prompt += `## RESPONSE STRATEGY\n`;
    for (const rule of byType['response_strategy']) {
      prompt += `${rule}\n`;
    }
    prompt += `\n`;
  }

  // Add technical framing if available
  if (byType['technical_framing']) {
    prompt += `## TECHNICAL CAPABILITIES FRAMING\n`;
    for (const rule of byType['technical_framing']) {
      prompt += `${rule}\n`;
    }
    prompt += `\n`;
  }

  prompt += `## FINAL REMINDER
Your job is to help Keegan see opportunities clearly and position himself well. 
You are NOT a gatekeeper trying to filter him out.
Every analysis should leave him with actionable next steps, not discouragement.
If something is a stretch, frame it as an exciting challenge, not a disqualifier.`;

  return prompt;
}

function buildCandidateContext(context: PortfolioContext): string {
  const { profile, experiences, skills } = context;
  
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
`;
    // NOTE: Removed "would_do_differently" and "honest_assessment" fields - too self-critical
  }

  candidateText += "\n## SKILLS & CAPABILITIES\n";
  
  const strong = skills.filter((s: any) => s.category === 'strong');
  const moderate = skills.filter((s: any) => s.category === 'moderate');
  
  if (strong.length > 0) {
    candidateText += "\n### Core Strengths\n";
    for (const skill of strong) {
      candidateText += `- ${skill.skill_name}: ${skill.evidence || ""}\n`;
    }
  }
  
  if (moderate.length > 0) {
    candidateText += "\n### Developing Skills\n";
    for (const skill of moderate) {
      candidateText += `- ${skill.skill_name}: ${skill.evidence || ""}\n`;
    }
  }

  // NOTE: Removed gaps/weaknesses section entirely - don't feed self-sabotaging data to the model
  // NOTE: Removed "honest_notes" field from skills - too self-critical

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

Analyze this opportunity for Keegan. Focus on alignment and how to position for it.`,
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
