import { getCatalogPageSleeves } from '@/lib/catalog'
import { SITE_URL } from '@/lib/site'

export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function catalogSleeveSlugs(): string[] {
  return getCatalogPageSleeves().map((sleeve) => sleeve.slug)
}

export function markdownTwinPath(pathname: string): string | null {
  const path = normalizePath(pathname)
  if (path === '/') return '/index.md'
  if (path === '/catalog') return '/catalog.md'
  if (path === '/collection') return '/collection.md'
  if (path === '/legal') return '/legal.md'
  if (path === '/llms') return '/llms.md'

  const sleeveMatch = path.match(/^\/catalog\/([^/]+)$/)
  if (sleeveMatch) {
    const slug = sleeveMatch[1]
    if (slug && catalogSleeveSlugs().includes(slug)) {
      return `/catalog/${slug}.md`
    }
    return null
  }

  return null
}

export function isHouseHtmlPath(pathname: string): boolean {
  return markdownTwinPath(pathname) !== null && normalizePath(pathname) !== '/llms'
}

export function htmlPathForMarkdownUrl(pathname: string): string | null {
  const path = normalizePath(pathname)
  if (!path.endsWith('.md')) return null
  const inner = path.slice(0, -3)
  if (inner === '/index' || inner === '') return '/'
  if (inner === '/llms') return '/'
  if (inner === '/catalog') return '/catalog'
  if (inner === '/collection') return '/collection'
  if (inner === '/legal') return '/legal'
  const sleeveMatch = inner.match(/^\/catalog\/([^/]+)$/)
  if (sleeveMatch && sleeveMatch[1] && catalogSleeveSlugs().includes(sleeveMatch[1])) {
    return `/catalog/${sleeveMatch[1]}`
  }
  return null
}

export function internalMarkdownPath(pathname: string): string | null {
  const twin = pathname.endsWith('.md')
    ? htmlPathForMarkdownUrl(pathname)
      ? normalizePath(pathname).slice(0, -3)
      : null
    : markdownTwinPath(pathname)?.replace(/\.md$/, '') ?? null

  if (!twin) return null
  const inner = twin === '/index' || twin === '' ? '/index' : twin
  return `/md${inner}`
}

function parseAcceptQuality(accept: string, type: string): number | null {
  const parts = accept.split(',').map((part) => part.trim())
  let best: number | null = null
  for (const part of parts) {
    const [media, ...params] = part.split(';').map((item) => item.trim())
    if (!media) continue
    const matches =
      media.toLowerCase() === type.toLowerCase() ||
      (type === 'text/markdown' && media.toLowerCase() === 'text/x-markdown')
    if (!matches) continue
    const qParam = params.find((param) => param.startsWith('q='))
    const quality = qParam ? Number.parseFloat(qParam.slice(2)) : 1
    if (!Number.isNaN(quality) && (best === null || quality > best)) {
      best = quality
    }
  }
  return best
}

export function requestWantsMarkdown(request: Request): boolean {
  const headers = request.headers
  if (headers.get('rsc') === '1') return false
  if (headers.has('next-router-prefetch')) return false
  if (headers.has('next-router-segment-prefetch')) return false

  const accept = headers.get('accept') ?? ''
  if (accept.includes('text/x-component')) return false

  const markdown = parseAcceptQuality(accept, 'text/markdown')
  if (markdown === null) return false
  const html = parseAcceptQuality(accept, 'text/html')
  if (html === null) return true
  return markdown > html
}

export function shouldBypassAgentMiddleware(pathname: string): boolean {
  const path = normalizePath(pathname)
  if (path.startsWith('/api/')) return true
  if (path.startsWith('/_next/')) return true
  if (path.startsWith('/md/')) return true
  if (path.startsWith('/.well-known/')) return true
  return false
}

export function linkHeaderValue(pathname: string): string | null {
  const path = normalizePath(pathname)
  const twin = markdownTwinPath(path)
  if (!twin && path !== '/keeganmoody33') return null

  const parts = [
    `</llms.txt>; rel="describedby"; type="text/plain"`,
    `</sitemap.xml>; rel="sitemap"`,
    `</.well-known/ard.json>; rel="ard"`,
    `</.well-known/ai-catalog.json>; rel="ai-catalog"`,
  ]
  if (twin) {
    parts.push(`<${twin}>; rel="alternate"; type="text/markdown"`)
  }
  return parts.join(', ')
}

export function markdownNotFoundBody(): string {
  return `# not found

no page at this url.

see:

- [llms.txt](${SITE_URL}/llms.txt): agent index for lecturesfrom
- [sitemap](${SITE_URL}/sitemap.xml): indexable house and principal urls
- [catalog](${SITE_URL}/catalog): current sleeves
`
}

export function appendVaryAccept(headers: Headers): void {
  const existing = headers.get('Vary')
  if (!existing) {
    headers.set('Vary', 'Accept')
    return
  }
  const tokens = existing.split(',').map((token) => token.trim().toLowerCase())
  if (!tokens.includes('accept')) {
    headers.set('Vary', `${existing}, Accept`)
  }
}

export const HOUSE_HTML_PATHS = [
  '/',
  '/catalog',
  ...catalogSleeveSlugs().map((slug) => `/catalog/${slug}`),
  '/collection',
  '/legal',
] as const
