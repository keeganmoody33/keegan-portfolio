import { getCatalogPageSleeves, getCrateRows, getSleeveBySlug, sleeves } from '@/lib/catalog'
import { SITE_URL } from '@/lib/site'

export function markdownHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  }
}

export function llmsMarkdown(): string {
  return `# lecturesfrom

> lecturesfrom is an atlanta llc — a garage, not a studio — that issues gtm systems, software, and physical products. work is catalogued as sleeves. the principal is keegan moody at /keeganmoody33.

## catalog

- [catalog](${SITE_URL}/catalog): crate permalink
- [punch2pen](${SITE_URL}/catalog/punch2pen): lf-01 software. vocals become a living transcript inside the DAW
- [proper-respect](${SITE_URL}/catalog/proper-respect): lf-02 software. evidence proposes. the person confirms
- [yadiggg](${SITE_URL}/catalog/yadiggg): lf-03 physical. pocket crate-digger. no phone. no shazam

## collection

- [collection](${SITE_URL}/collection): lf-00 issued. every release in the lecturesfrom discogs crate
- [api](${SITE_URL}/api/discogs/collection): paginated full crate, revalidate 300

## principal

- [keegan moody](${SITE_URL}/keeganmoody33): km-33 principal channel. ask ai and jd fit analyzer live here

## machine

- [llms.txt](${SITE_URL}/llms.txt)
- [ai-catalog](${SITE_URL}/.well-known/ai-catalog.json)
`
}

export function catalogIndexMarkdown(): string {
  const rows = getCrateRows()
    .map((row) => {
      if (row.kind === 'principal') {
        return `- ${row.crateNo} [${row.row.title}](${SITE_URL}${row.href}) ${row.row.formatLabel} ${row.row.catno} ${row.label}`
      }
      return `- ${row.crateNo} [${row.sleeve.title}](${SITE_URL}${row.href}) ${row.sleeve.format} ${row.sleeve.catno} ${row.label}`
    })
    .join('\n')

  return `# catalog — lecturesfrom

a catalog item is a record sleeve that holds artifacts.

${rows}

markdown mirrors: ${getCatalogPageSleeves()
    .map((sleeve) => `[${sleeve.slug}.md](${SITE_URL}/catalog/${sleeve.slug}.md)`)
    .join(', ')}
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
      : 'count is live at the html page and the json endpoint.'

  return `# collection — lecturesfrom

${sleeve?.aside ?? ''}

${sleeve?.notes ?? ''}

${countLine}

do not dump the full album list into markdown. use:

- html: ${SITE_URL}/collection
- json: ${SITE_URL}/api/discogs/collection
`
}

export function aiCatalogJson() {
  const sleeveUrls = getCatalogPageSleeves().flatMap((sleeve) => [
    `${SITE_URL}/catalog/${sleeve.slug}`,
    `${SITE_URL}/catalog/${sleeve.slug}.md`,
  ])

  return {
    name: 'lecturesfrom',
    legalName: 'lecturesfrom LLC',
    url: SITE_URL,
    description: 'not a studio. a garage.',
    llms: `${SITE_URL}/llms.txt`,
    pages: [
      SITE_URL + '/',
      `${SITE_URL}/catalog`,
      ...sleeves
        .filter((sleeve) => sleeve.slug !== 'collection')
        .map((sleeve) => `${SITE_URL}/catalog/${sleeve.slug}`),
      `${SITE_URL}/collection`,
      `${SITE_URL}/legal`,
      `${SITE_URL}/keeganmoody33`,
    ],
    markdown: [
      `${SITE_URL}/llms.md`,
      `${SITE_URL}/catalog.md`,
      ...getCatalogPageSleeves().map((sleeve) => `${SITE_URL}/catalog/${sleeve.slug}.md`),
      `${SITE_URL}/collection.md`,
    ],
    api: [`${SITE_URL}/api/discogs/collection`],
    sameAs: [
      'https://x.com/lecturesfrom',
      'https://github.com/lecturesfrom',
      'https://github.com/keeganmoody33',
      'https://www.linkedin.com/company/lecturesfrom',
    ],
    extra: sleeveUrls,
  }
}
