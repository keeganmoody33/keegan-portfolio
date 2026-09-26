import { markdownHeaders, sleeveMarkdown } from '@/lib/markdown'

export function GET() {
  const body = sleeveMarkdown('yadiggg')
  return new Response(body ?? '', { headers: markdownHeaders() })
}
