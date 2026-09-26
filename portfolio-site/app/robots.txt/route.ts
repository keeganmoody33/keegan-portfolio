const BODY = `User-agent: *
Allow: /
Disallow: /api/

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /

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
