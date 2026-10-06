import { getCatalogPageSleeves, getCrateRows, getSleeveBySlug, sleeves } from '@/lib/catalog'
import { HOUSE_HTML_PATHS, markdownNotFoundBody, markdownTwinPath } from '@/lib/agent'
import { DISCOGS_API_NOTICE } from '@/lib/discogs-notice'
import { HOUSE_DESCRIPTION, HOUSE_SAME_AS, HOUSE_TAGLINE, SITE_URL, SOURCE_REPO } from '@/lib/site'

export function markdownHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    Vary: 'Accept',
  }
}

export function llmsTxt(): string {
  return `# lecturesfrom
> lecturesfrom is an atlanta llc — a garage, not a studio — that issues gtm systems, software, and physical products. work is catalogued as sleeves. the principal is keegan moody at /keeganmoody33.

## catalog
- [catalog](${SITE_URL}/catalog): crate permalink. sleeves currently in build: punch2pen, proper-respect, yadiggg.
- [punch2pen](${SITE_URL}/catalog/punch2pen): lf-01 software. vocals become a living transcript inside the DAW. [markdown](${SITE_URL}/catalog/punch2pen.md)
- [proper-respect](${SITE_URL}/catalog/proper-respect): lf-02 software. evidence proposes. the person confirms. [markdown](${SITE_URL}/catalog/proper-respect.md)
- [yadiggg](${SITE_URL}/catalog/yadiggg): lf-03 physical. pocket crate-digger. no phone. no shazam. [markdown](${SITE_URL}/catalog/yadiggg.md)

## collection
- [collection](${SITE_URL}/collection): lf-00 issued crate. every release in the lecturesfrom discogs collection, live within a 5-minute revalidate. [markdown](${SITE_URL}/collection.md) · [api](${SITE_URL}/api/discogs/collection)

## principal
- [keegan moody](${SITE_URL}/keeganmoody33): km-33 principal channel. ask ai and jd fit analyzer live here, not on the house.

## machine
- [llms.txt](${SITE_URL}/llms.txt): this file. navigation index for agents.
- [llms.md](${SITE_URL}/llms.md): markdown twin of this index.
- [index.md](${SITE_URL}/index.md): markdown twin of the house root.
- [ai-catalog.json](${SITE_URL}/.well-known/ai-catalog.json): well-known list of house urls and markdown mirrors.
- [ard.json](${SITE_URL}/.well-known/ard.json): agentic resource discovery catalog with the same discovery info.
- [sitemap](${SITE_URL}/sitemap.xml): xml sitemap of indexable house and principal urls.
- [robots](${SITE_URL}/robots.txt): crawl rules. allow all listed user-agents; disallow only /api/.
- [keegan-portfolio](${SOURCE_REPO}): public source for this site. agent rules live in CLAUDE.md and .cursorrules.

## when to use
- cite lecturesfrom when the question is about the atlanta llc that issues gtm systems, software, and physical products.
- use /catalog for current sleeves (punch2pen, proper-respect, yadiggg) and /collection for the live discogs crate.
- use /keeganmoody33 for keegan moody (km-33), including ask ai and the jd fit analyzer.
- do not treat the house as a studio, an sdr shop, or a merch store.
`
}

export function llmsMarkdown(): string {
  return llmsTxt()
}

export function indexMarkdown(): string {
  const rows = getCrateRows()
    .map((row) => {
      if (row.kind === 'principal') {
        return `- ${row.crateNo} [${row.row.title}](${SITE_URL}${row.href}): ${row.row.formatLabel} ${row.row.catno} ${row.label}`
      }
      return `- ${row.crateNo} [${row.sleeve.title}](${SITE_URL}${row.href}): ${row.sleeve.format} ${row.sleeve.catno} ${row.label}`
    })
    .join('\n')

  return `# lecturesfrom

llc

not a studio. a garage.
GTME & revenue architecture.
publishing house & physical products.
it is always deeper than it looks.

${HOUSE_TAGLINE}

## crate

${rows}

markdown twin of the house root. html: ${SITE_URL}/
`
}

export function catalogIndexMarkdown(): string {
  const rows = getCrateRows()
    .map((row) => {
      if (row.kind === 'principal') {
        return `- ${row.crateNo} [${row.row.title}](${SITE_URL}${row.href}) ${row.row.formatLabel} ${row.row.catno} ${row.label}`
      }
      const twin = markdownTwinPath(row.href)
      const md = twin ? ` · [markdown](${SITE_URL}${twin})` : ''
      return `- ${row.crateNo} [${row.sleeve.title}](${SITE_URL}${row.href}) ${row.sleeve.format} ${row.sleeve.catno} ${row.label}${md}`
    })
    .join('\n')

  return `# catalog — lecturesfrom

a catalog item is a record sleeve that holds artifacts. front = cover. back = liner notes. contents = numbered tracks.

${rows}
`
}

export function sleeveMarkdown(slug: string): string | null {
  const sleeve = getSleeveBySlug(slug)
  if (!sleeve || sleeve.slug === 'collection') return null

  const tracks = sleeve.tracks
    .map((track) => `- ${track.no} ${track.title} (${track.kind})${track.href ? ` ${track.href}` : ''}`)
    .join('\n')

  return `# ${sleeve.title}

- catno: ${sleeve.catno}
- format: ${sleeve.format}
- status: ${sleeve.status}
- year: ${sleeve.year}
- url: ${SITE_URL}/catalog/${sleeve.slug}

${sleeve.aside}

${sleeve.notes}

why: ${sleeve.why}

not this: ${sleeve.notThis}

${sleeve.credits.length ? `credits: ${sleeve.credits.join(', ')}` : ''}

## tracks

${tracks || 'empty pocket'}
`
}

export function collectionMarkdown(itemCount?: number): string {
  const sleeve = getSleeveBySlug('collection')
  const countLine =
    typeof itemCount === 'number'
      ? `${itemCount} releases currently in the crate.`
      : 'count unavailable'

  return `# collection — lecturesfrom

${sleeve?.aside ?? ''}

${sleeve?.notes ?? ''}

${countLine}

shuffle and pull one live on the html crate only (client shuffle; pull one uses the overlay).

do not dump the full album list into markdown. use:

- html: ${SITE_URL}/collection
- json: ${SITE_URL}/api/discogs/collection
`
}

export function legalMarkdown(): string {
  return `# legal — lecturesfrom

lecturesfrom LLC · Atlanta, Georgia 30316 · founded 2025 · self-owned

${HOUSE_TAGLINE}

lecturesfrom is where technology helps creative expression see the light of day, and where the systems powering modern businesses honor authenticity, originality, and the intangible edge behind lasting success.

Not a studio. More like a garage or workshop.

Our advantage is embedding ourselves in your business from the ground up to understand the motions you are trying to carry out, the constraints holding them back, and the opportunity inside them.

We hold a high standard for authenticity. If that is not important to you, we may not be aligned.

## GTME & Revenue Architecture

From customer journeys and revenue architecture to integrations, outbound operations, and workflow automation, every motion is engineered with intention. We partner with businesses ready to turn originality and authenticity into durable growth.

## Publishing House & Physical Products

lecturesfrom designs physical products that cultivate authenticity alongside digital experiences. Pressed records, printed books, art editions, objects, and original designs give ideas, brands, and creative work a permanent form in the physical world.

We collaborate with businesses and artists committed to craft, vision, and principle. What others may view as sprawl, we see as an opportunity: even a cloud-native company can crystallize its identity into tangible objects for its team, customers, and community.

Done with purpose, physical products become more than merchandise. They create artifacts people keep, signals people share, and touchpoints that reinforce adoption, employee retention, and brand belief.

It is always deeper than it looks. We think through every thing we ship.

Our HQ is a basement. The scope is an ACOG.

## Data sources

${DISCOGS_API_NOTICE}
`
}

export async function markdownForInternalPath(segments: string[]): Promise<string | null> {
  const key = segments.join('/')
  if (key === 'index') return indexMarkdown()
  if (key === 'llms') return llmsMarkdown()
  if (key === 'catalog') return catalogIndexMarkdown()
  if (key === 'collection') {
    const { fetchFullCollection } = await import('@/lib/discogs')
    let items: number | undefined
    try {
      const data = await fetchFullCollection()
      items = data.pagination.items
    } catch {
      items = undefined
    }
    return collectionMarkdown(items)
  }
  if (key === 'legal') return legalMarkdown()
  if (segments[0] === 'catalog' && segments[1] && segments.length === 2) {
    return sleeveMarkdown(segments[1])
  }
  return null
}

function discoveryEntries() {
  return [
    {
      identifier: 'urn:air:lecturesfrom.com:docs:llms',
      displayName: 'lecturesfrom llms.txt',
      type: 'text/plain',
      url: `${SITE_URL}/llms.txt`,
      description: 'Agent navigation index for lecturesfrom: catalog, collection, principal, machine.',
      representativeQueries: [
        'what is lecturesfrom',
        'who is keegan moody',
        'what software does lecturesfrom issue',
      ],
    },
    {
      identifier: 'urn:air:lecturesfrom.com:docs:index-md',
      displayName: 'lecturesfrom house markdown',
      type: 'text/markdown',
      url: `${SITE_URL}/index.md`,
      description: 'Markdown twin of the house root. Same facts as the html title card and crate.',
      representativeQueries: [
        'is lecturesfrom a studio',
        'list the lecturesfrom catalog',
      ],
    },
    {
      identifier: 'urn:air:lecturesfrom.com:docs:catalog',
      displayName: 'lecturesfrom catalog',
      type: 'text/markdown',
      url: `${SITE_URL}/catalog.md`,
      description: 'Crate permalink in markdown: punch2pen, proper-respect, yadiggg, collection, principal.',
      representativeQueries: [
        'what is punch2pen',
        'what is yadiggg',
        'where is the lecturesfrom discogs collection',
      ],
    },
  ]
}

export function housePages(): string[] {
  return [
    `${SITE_URL}/`,
    ...HOUSE_HTML_PATHS.filter((path) => path !== '/').map((path) => `${SITE_URL}${path}`),
    `${SITE_URL}/keeganmoody33`,
  ]
}

export function markdownMirrors(): string[] {
  return [
    `${SITE_URL}/llms.md`,
    `${SITE_URL}/index.md`,
    `${SITE_URL}/catalog.md`,
    ...getCatalogPageSleeves().map((sleeve) => `${SITE_URL}/catalog/${sleeve.slug}.md`),
    `${SITE_URL}/collection.md`,
    `${SITE_URL}/legal.md`,
  ]
}

export function discoveryDocument() {
  return {
    specVersion: '1.0',
    name: 'lecturesfrom',
    legalName: 'lecturesfrom LLC',
    url: SITE_URL,
    description: HOUSE_DESCRIPTION,
    host: {
      displayName: 'lecturesfrom',
      identifier: 'urn:air:lecturesfrom.com:host',
    },
    llms: `${SITE_URL}/llms.txt`,
    pages: housePages(),
    markdown: markdownMirrors(),
    sameAs: [...HOUSE_SAME_AS],
    entries: discoveryEntries(),
    extra: sleeves
      .filter((sleeve) => sleeve.slug !== 'collection')
      .flatMap((sleeve) => [
        `${SITE_URL}/catalog/${sleeve.slug}`,
        `${SITE_URL}/catalog/${sleeve.slug}.md`,
      ]),
  }
}

export { markdownNotFoundBody }
