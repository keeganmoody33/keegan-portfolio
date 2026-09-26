import { catalogIndexMarkdown, markdownHeaders } from '@/lib/markdown'

export function GET() {
  return new Response(catalogIndexMarkdown(), { headers: markdownHeaders() })
}
