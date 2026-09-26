import { collectionMarkdown, markdownHeaders } from '@/lib/markdown'
import { fetchFullCollection } from '@/lib/discogs'

export const revalidate = 300

export async function GET() {
  let items: number | undefined
  try {
    const data = await fetchFullCollection()
    items = data.pagination.items
  } catch {
    items = undefined
  }
  return new Response(collectionMarkdown(items), { headers: markdownHeaders() })
}
