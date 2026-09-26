const GROUP = `Allow: /
Disallow: /api/`

const BODY = `User-agent: *
${GROUP}

User-agent: GPTBot
${GROUP}

User-agent: ClaudeBot
${GROUP}

User-agent: Google-Extended
${GROUP}

User-agent: CCBot
${GROUP}

User-agent: PerplexityBot
${GROUP}

User-agent: Googlebot
${GROUP}

Sitemap: https://www.lecturesfrom.com/sitemap.xml
LLMS: https://www.lecturesfrom.com/llms.txt
`

// Route handler instead of app/robots.ts so the nonstandard LLMS line can be emitted.
export function GET() {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
