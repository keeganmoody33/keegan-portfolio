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
    aside: 'vocals become a living transcript inside the DAW',
    notes:
      'a mac plugin (au, vst3) that listens while the track plays. the line under the playhead is the title. click a wrong word, the correction feeds the model. local or cloud. built for the booth, not the standup.',
    why: 'studio work still dies as memory. a take should leave a receipt.',
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
    aside: 'evidence proposes. the person confirms.',
    notes:
      'a private collection of the tools you use, with notes and evidence. you choose which cards go public, with who put you on. not a scrape of a whole digital life.',
    why: 'affiliate links and receipts are scattered. advocacy should have one sleeve.',
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
    aside: 'pocket crate-digger. no phone. no shazam. no discogs login in the loop.',
    notes:
      'aim the rear camera at a vinyl label or matrix, press the orange button, get artist / label / catalog number / year on a memory lcd. offline intelligence, local database. a physical product from the publishing-house arm.',
    why: 'the crate should answer in the bin, not after you unlock a phone.',
    notThis: 'a phone app',
    credits: ['hardware'],
    cover: '/catalog/yadiggg/cover.jpg',
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
    aside: 'the whole library. when the discogs crate changes, this changes.',
    notes: 'every release in the lecturesfrom discogs collection. not a curated window.',
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
