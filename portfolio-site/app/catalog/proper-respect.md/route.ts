import { markdownHeaders, sleeveMarkdown } from '@/lib/markdown'

export function GET() {
  const body = sleeveMarkdown('proper-respect')
  return new Response(body ?? '', { headers: markdownHeaders() })
}
