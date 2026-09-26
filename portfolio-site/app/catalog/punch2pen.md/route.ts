import { markdownHeaders, sleeveMarkdown } from '@/lib/markdown'

export function GET() {
  const body = sleeveMarkdown('punch2pen')
  return new Response(body ?? '', { headers: markdownHeaders() })
}
