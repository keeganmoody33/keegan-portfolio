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

export type SleeveImage = {
  src: string
  alt: string
  width: number
  height: number
  caption?: string
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
  /** Single cover path. Used when `images` is empty. Kept for back-compat. */
  cover?: string
  /** Owned art for the sleeve gallery. When set, this wins over `cover`. */
  images?: SleeveImage[]
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
    aside: 'after a punch-in, the take is already written.',
    notes:
      'a mac au + vst3 plugin with a local engine. living transcript: the word under the playhead, the active line as the title, click a mis-hear. free is local whisper, session-only dictionary, no account, no cloud. pro and studio seats are planned; sign-in is not in this build; prices are not published. unsigned pkg from github release — gatekeeper will warn. logic is the host they run; the site daw list is interest, not a compatibility chart. never a browser engine.',
    why: 'studio work still dies as memory. a take should leave a receipt.',
    notThis: 'a meeting notetaker with a music skin. not a windows build.',
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
    aside: 'your tools. your track record.',
    notes:
      'evidence proposes; the person confirms. a private collection of tools you use, test, or have moved on from — notes, proof, and who put you on. add a tool by hand or connect a supported source. measurements keep their native units: github contribution snapshots, sanitized claude code and codex packets, a strict proper-measurements-v1 file. usage does not rank. you preview the exact cards, then approve publication. private by default.',
    why: 'affiliate links and receipts are scattered. advocacy should have one sleeve.',
    notThis: 'spyware, link-in-bio, or a score you did not approve',
    credits: [],
    cover: '/catalog/proper-respect/cover.png',
    images: [
      {
        src: '/catalog/proper-respect/cover.png',
        alt: 'Proper Respect mark: PR letters in black on paper',
        width: 1024,
        height: 856,
        caption: 'proper respect mark',
      },
      {
        src: '/catalog/proper-respect/bump-art.webp',
        alt: 'Proper Respect bump art: two figures on a lime field with a red respect mark',
        width: 1536,
        height: 1024,
        caption: 'homepage bump art',
      },
      {
        src: '/catalog/proper-respect/fists-blueprint.webp',
        alt: 'Proper Respect fists blueprint: facing fists on lined paper',
        width: 1600,
        height: 900,
        caption: 'fists blueprint',
      },
      {
        src: '/catalog/proper-respect/share-image.png',
        alt: 'Proper Respect share image: wordmark and tagline on paper',
        width: 1200,
        height: 630,
        caption: 'share image',
      },
    ],
    tracks: [
      {
        no: '01',
        title: 'proper-respect.com',
        kind: 'site',
        href: 'https://proper-respect.com',
      },
      {
        no: '02',
        title: 'lecturesfrom profile',
        kind: 'site',
        href: 'https://proper-respect.com/lecturesfrom',
      },
      {
        no: '03',
        title: 'keeganmoody33/PROPER-RESPECT',
        kind: 'repo',
        href: 'https://github.com/keeganmoody33/PROPER-RESPECT',
      },
      {
        no: '04',
        title: 'agents.md',
        kind: 'note',
        href: 'https://proper-respect.com/agents.md',
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
