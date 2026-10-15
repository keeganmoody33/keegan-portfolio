export type TrackKind = 'site' | 'repo' | 'file' | 'image' | 'audio' | 'pdf' | 'note'

export type Track = {
  no: string
  title: string
  kind: TrackKind
  href?: string
  src?: string
}

export type SleeveFormat = 'software' | 'system' | 'publication' | 'physical' | 'crate' | 'object'

export type SleeveStatus = 'in build' | 'issued' | 'parked'

/** Optional inline 3D / CAD study, rendered inside Sleeve (not the crate click target). */
export type SleeveViewerConfig = {
  /** Public origin or hosted asset. Never a share-token preview URL. */
  src: string
  title: string
  /** `iframe` until the three.js study is ported; `port` loads a house-styled client chunk. */
  mode: 'iframe' | 'port'
  poster?: string
}

export type Sleeve = {
  slug: string
  catno: string
  title: string
  format: SleeveFormat
  status: SleeveStatus
  year: number
  aside: string
  notes: string
  why: string
  notThis: string
  credits: string[]
  cover?: string
  viewer?: SleeveViewerConfig
  tracks: Track[]
}

export type PrincipalRow = {
  slug: 'keegan-moody'
  catno: 'km-33'
  title: 'keegan moody'
  formatLabel: 'principal'
  status: 'channel'
  href: '/keeganmoody33'
}

export const principal: PrincipalRow = {
  slug: 'keegan-moody',
  catno: 'km-33',
  title: 'keegan moody',
  formatLabel: 'principal',
  status: 'channel',
  href: '/keeganmoody33',
}

export const sleeves: Sleeve[] = [
  {
    slug: 'punch2pen',
    catno: 'lf-01',
    title: 'punch2pen',
    format: 'software',
    status: 'in build',
    year: 2026,
    aside: 'a vocal transcript that follows the track inside your daw.',
    notes:
      'punch2pen transcribes vocals inside your daw. the words follow the session, so you can read a take while you listen and correct what the engine misheard. mac au + vst3, with local transcription. in development; see the project site for status and install notes.',
    why: 'a good take should leave you with the words, not just the audio.',
    notThis: 'a meeting notetaker with a music skin',
    credits: [],
    tracks: [
      {
        no: '01',
        title: 'punch2pen.com',
        kind: 'site',
        href: 'https://punch2pen.com',
      },
      {
        no: '02',
        title: 'keeganmoody33/punch2pen',
        kind: 'repo',
        href: 'https://github.com/keeganmoody33/punch2pen',
      },
    ],
  },
  {
    slug: 'proper-respect',
    catno: 'lf-02',
    title: 'proper-respect',
    format: 'software',
    status: 'in build',
    year: 2026,
    aside: 'a place to share the tools you use and who put you on.',
    notes:
      'keep a private collection of tools, notes, and supporting evidence. choose which cards to publish and credit the people who introduced you. you review what goes public.',
    why: 'recommendations mean more when people can see why you stand behind them.',
    notThis: 'spyware, link-in-bio, or a score you did not approve',
    credits: [],
    cover: '/catalog/proper-respect/cover.png',
    tracks: [
      {
        no: '01',
        title: 'live profile site',
        kind: 'site',
        href: 'https://proper-respect.com',
      },
      {
        no: '02',
        title: 'keeganmoody33/PROPER-RESPECT',
        kind: 'repo',
        href: 'https://github.com/keeganmoody33/PROPER-RESPECT',
      },
    ],
  },
  {
    slug: 'yadiggg',
    catno: 'lf-03',
    title: 'yadiggg',
    format: 'physical',
    status: 'in build',
    year: 2026,
    aside: 'a pocket device for identifying records in the bin.',
    notes:
      'a hardware concept built around one action: point at a vinyl label or matrix and press the orange button. the intended result is an artist, label, catalog number, and year on a memory lcd, using an offline database. the interactive study explores the layout; the hardware is still in development.',
    why: 'the crate should answer in the bin, not after you unlock a phone.',
    notThis: 'a phone app',
    credits: ['hardware'],
    cover: '/catalog/yadiggg/cover.jpg',
    viewer: {
      src: '/catalog/yadiggg/yadiggg_r1.glb',
      title: 'r1 design study',
      mode: 'port',
      poster: '/catalog/yadiggg/poster.jpg',
    },
    tracks: [
      {
        no: '01',
        title: 'keeganmoody33/YADIGGG',
        kind: 'repo',
        href: 'https://github.com/keeganmoody33/YADIGGG',
      },
    ],
  },
  {
    slug: 'collection',
    catno: 'lf-00',
    title: 'collection',
    format: 'crate',
    status: 'issued',
    year: 2026,
    aside: 'the record collection. browse by artist, title, year, or label.',
    notes: 'the lecturesfrom record collection, synced from discogs. open a record for its pressing details, tracklist, and available credits and sample connections.',
    why: 'the publishing house already has a catalog. show it.',
    notThis: 'a merch shop or a top-10 list',
    credits: [],
    tracks: [],
  },
]

/** Empty parked array so dim spines can be appended later without a redesign. */
export const parkedSleeves: Sleeve[] = []

export type CrateSleeveRow = {
  kind: 'sleeve'
  crateNo: string
  href: string
  sleeve: Sleeve
  label: string
}

export type CratePrincipalRow = {
  kind: 'principal'
  crateNo: string
  href: string
  row: PrincipalRow
  label: string
}

export type CrateRow = CrateSleeveRow | CratePrincipalRow

function crateHref(sleeve: Sleeve): string {
  if (sleeve.slug === 'collection') return '/collection'
  return `/catalog/${sleeve.slug}`
}

/** Collection and the yadiggg study are heavy; `/` and `/catalog` must not prefetch them. */
export function crateLinkPrefetch(href: string): false | undefined {
  if (href === '/collection' || href === '/catalog/yadiggg') return false
  return undefined
}

function crateLabel(sleeve: Sleeve): string {
  if (sleeve.format === 'crate') return 'live'
  return sleeve.status
}

const ACTIVE_CRATE: { crateNo: string; slug: string }[] = [
  { crateNo: '01', slug: 'punch2pen' },
  { crateNo: '02', slug: 'proper-respect' },
  { crateNo: '03', slug: 'yadiggg' },
  { crateNo: '00', slug: 'collection' },
]

export function getSleeveBySlug(slug: string): Sleeve | undefined {
  return [...sleeves, ...parkedSleeves].find((sleeve) => sleeve.slug === slug)
}

/** Sleeve pages live at /catalog/[slug]. Collection is /collection, not a sleeve page. */
export function getCatalogPageSleeves(): Sleeve[] {
  return [...sleeves, ...parkedSleeves].filter((sleeve) => sleeve.slug !== 'collection')
}

/**
 * Shared `/catalog/[slug]` params. yadiggg has a dedicated page so SleeveViewer
 * is never imported from the slug route (or from Sleeve).
 */
export function getSharedCatalogSlugParams(): { slug: string }[] {
  return getCatalogPageSleeves()
    .filter((sleeve) => sleeve.slug !== 'yadiggg')
    .map((sleeve) => ({ slug: sleeve.slug }))
}

export function getCrateRows(): CrateRow[] {
  const bySlug = new Map(sleeves.map((sleeve) => [sleeve.slug, sleeve]))
  const rows: CrateRow[] = []

  for (const entry of ACTIVE_CRATE) {
    const sleeve = bySlug.get(entry.slug)
    if (!sleeve) continue
    rows.push({
      kind: 'sleeve',
      crateNo: entry.crateNo,
      href: crateHref(sleeve),
      sleeve,
      label: crateLabel(sleeve),
    })
  }

  rows.push({
    kind: 'principal',
    crateNo: '04',
    href: principal.href,
    row: principal,
    label: principal.status,
  })

  for (const sleeve of parkedSleeves) {
    rows.push({
      kind: 'sleeve',
      crateNo: '—',
      href: crateHref(sleeve),
      sleeve,
      label: sleeve.status,
    })
  }

  return rows
}
