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
    console.error("JD Analyzer Error:", error);
    return new Response(
      JSON.stringify({ error: "Unable to analyze job description. Please try again." }),
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

  // STRATEGIC POSITIONING FRAMEWORK - Public-facing for recruiters/employers
  let prompt = `You are analyzing job descriptions against Keegan Moody's profile. Keegan is a GTM Engineer who builds go-to-market infrastructure at early-stage startups.

## AUDIENCE
This analysis is for RECRUITERS and EMPLOYERS visiting Keegan's portfolio site. They are evaluating whether Keegan is a fit for their role. Speak about Keegan in THIRD PERSON ("he", "Keegan", "his experience") - NOT second person ("you", "your").

## YOUR ROLE
You are providing an objective fit assessment to help recruiters/employers understand:
1. Where Keegan's experience aligns with their requirements
2. What transferable skills bridge any gaps
3. What growth areas exist (framed constructively)
4. Whether this could be a productive conversation

## CORE PHILOSOPHY
- Lead with strengths and alignment
- Gaps are "areas to grow into" not disqualifiers
- The goal is to help visitors see Keegan's potential fit
- Focus on what he CAN do, not what he hasn't done yet

## FRAMING GUIDELINES
- Always use third person about Keegan (he/his/Keegan, never "you/your")
- Focus on alignment and transferable skills
- Frame growth areas constructively, not as deficits
- Every analysis should make a conversation feel worthwhile

## ANALYSIS STRUCTURE
Return your analysis in this format:

**Verdict:** [STRONG FIT / GOOD FIT / STRETCH FIT / EXPLORATORY]

**Summary:** [1-2 sentences on why this role aligns with Keegan's background]

**Alignment:**
- ✅ [Specific skill/experience Keegan has that matches - be specific with examples]
- ✅ [Another match with evidence from his background]
- ✅ [Continue for all relevant alignments]

**Growth Areas:**
- 🔄 [Requirement where Keegan has adjacent but not exact experience]
- 🔄 [Frame as "would develop" not "lacks"]

**Why Connect:**
- [What makes Keegan interesting for this role]
- [What he would bring to the team]
- [Suggested topics for an initial conversation]

## VERDICT DEFINITIONS
- STRONG FIT: 70%+ of requirements align with Keegan's direct experience
- GOOD FIT: 50-70% direct alignment, rest is transferable
- STRETCH FIT: Less than 50% direct, but compelling transferable skills
- EXPLORATORY: Worth a conversation to explore mutual fit

## GROWTH AREA FRAMING
When a requirement doesn't match Keegan's direct experience, frame it as potential:
- "No formal management experience" → "Has led projects and mentored peers; formal management would be a growth area"
- "Enterprise-only experience required" → "Deep startup experience with ability to build from scratch; would adapt enterprise processes"
- "Coding required" → "Works closely with technical teams and builds with AI-assisted tools; not a traditional engineer"

Focus on what's TRUE about Keegan's capabilities. Don't invent experience, but do highlight transferable skills.

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
You are helping recruiters/employers understand Keegan's fit for their role.
Always speak about Keegan in third person ("he", "his", "Keegan").
Never use "you" or "your" - the visitor is NOT Keegan.
Every analysis should help the visitor see why a conversation with Keegan could be valuable.
If something is a stretch, frame it as an opportunity for growth, not a disqualifier.`;

  return prompt;
}

function buildCandidateContext(context: PortfolioContext): string {
  const { profile, experiences, skills } = context;

  let candidateText = "## CANDIDATE PROFILE\n";

  if (profile) {
    // FIXED: Using actual column names from schema
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Keegan Moody';
    candidateText += `Name: ${fullName}
Title: ${profile.headline || 'GTM Engineer'}
Summary: ${profile.summary || ''}
`;
  }

  candidateText += "\n## WORK EXPERIENCE\n";
  for (const exp of experiences) {
    // FIXED: Using actual column names - public_bullets instead of bullet_points
    const bullets = exp.public_bullets || [];
    candidateText += `
### ${exp.role_title} at ${exp.company_name} (${exp.start_date} - ${exp.end_date || "Present"})
${bullets.map((b: string) => `- ${b}`).join("\n")}
`;
    // NOTE: Removed private_context fields - those are for internal use only
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
      model: "claude-opus-4-5-20251101",
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

Analyze how Keegan's background aligns with this role. Remember: speak about Keegan in third person (he/his/Keegan) for the recruiter/employer audience.`,
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
