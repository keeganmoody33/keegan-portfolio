import { llmsMarkdown, markdownHeaders } from '@/lib/markdown'

export function GET() {
  return new Response(llmsMarkdown(), { headers: markdownHeaders() })
}
