export type DiscogsRelease = {
  title: string
  artist: string
  year: number
  thumbnail: string
  cover: string
  format: string
  label: string
  catno: string
  discogsUrl: string
}

export type DiscogsCollection = {
  releases: DiscogsRelease[]
  pagination: {
    page: number
    pages: number
    items: number
    perPage: number
  }
}

type DiscogsArtist = { name?: string }
type DiscogsFormat = { name?: string; descriptions?: string[] }
type DiscogsLabel = { name?: string; catno?: string }

type DiscogsBasicInformation = {
  id: number
  title: string
  year: number
  thumb?: string
  cover_image?: string
  artists?: DiscogsArtist[]
  formats?: DiscogsFormat[]
  labels?: DiscogsLabel[]
}

type DiscogsApiRelease = {
  basic_information: DiscogsBasicInformation
}

type DiscogsApiPage = {
  releases?: DiscogsApiRelease[]
  pagination?: {
    page: number
    pages: number
    items: number
    per_page: number
  }
}

const DISCOGS_USER = 'lecturesfrom'
const DISCOGS_UA = 'lecturesfrom/1.0'
const COLLECTION_URL =
  `https://api.discogs.com/users/${DISCOGS_USER}/collection/folders/0/releases`

let lastGoodCollection: DiscogsCollection | null = null

function discogsHeaders(token: string): HeadersInit {
  return {
    Authorization: `Discogs token=${token}`,
    'User-Agent': DISCOGS_UA,
  }
}

function formatLine(formats: DiscogsFormat[] | undefined): string {
  if (!formats || formats.length === 0) return ''
  const first = formats[0]
  const bits = [first?.name, ...(first?.descriptions ?? [])].filter(Boolean)
  return bits.join(', ')
}

function mapRelease(release: DiscogsApiRelease): DiscogsRelease {
  const info = release.basic_information
  const artists = (info.artists ?? [])
    .map((artist) => artist.name)
    .filter((name): name is string => Boolean(name))
    .join(', ')
  const label = info.labels?.[0]
  const thumb = info.thumb ?? ''
  const cover = info.cover_image || thumb

  return {
    title: info.title,
    artist: artists,
    year: info.year,
    thumbnail: thumb,
    cover,
    format: formatLine(info.formats),
    label: label?.name ?? '',
    catno: label?.catno ?? '',
    discogsUrl: `https://www.discogs.com/release/${info.id}`,
  }
}

export function getDiscogsToken(): string | undefined {
  return process.env.DISCOGS_TOKEN
}

export async function fetchRecentReleases(perPage = 5): Promise<DiscogsRelease[]> {
  const token = getDiscogsToken()
  if (!token) {
    throw new Error('DISCOGS_TOKEN not configured')
  }

  const url = `${COLLECTION_URL}?sort=added&sort_order=desc&per_page=${perPage}&page=1`
  const response = await fetch(url, {
    headers: discogsHeaders(token),
    next: { revalidate: 300 },
  })

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const error = new Error('Discogs rate limited') as Error & { status: number; retryAfter?: string }
    error.status = 429
    error.retryAfter = retryAfter ?? undefined
    throw error
  }

  if (!response.ok) {
    throw new Error(`Discogs API error ${response.status}`)
  }

  const data = (await response.json()) as DiscogsApiPage
  return (data.releases ?? []).map(mapRelease)
}

export async function fetchFullCollection(): Promise<DiscogsCollection> {
  const token = getDiscogsToken()
  if (!token) {
    throw new Error('DISCOGS_TOKEN not configured')
  }

  const releases: DiscogsRelease[] = []
  let page = 1
  let pages = 1
  let items = 0
  const perPage = 100

  while (page <= pages) {
    const url = `${COLLECTION_URL}?sort=added&sort_order=desc&per_page=${perPage}&page=${page}`
    const response = await fetch(url, {
      headers: discogsHeaders(token),
      next: { revalidate: 300 },
    })

    if (response.status === 429) {
      if (lastGoodCollection) {
        return lastGoodCollection
      }
      const retryAfter = response.headers.get('Retry-After')
      const error = new Error('Discogs rate limited') as Error & { status: number; retryAfter?: string }
      error.status = 429
      error.retryAfter = retryAfter ?? undefined
      throw error
    }

    if (!response.ok) {
      if (lastGoodCollection) {
        return lastGoodCollection
      }
      throw new Error(`Discogs API error ${response.status}`)
    }

    const data = (await response.json()) as DiscogsApiPage
    releases.push(...(data.releases ?? []).map(mapRelease))
    pages = data.pagination?.pages ?? page
    items = data.pagination?.items ?? releases.length
    page += 1
  }

  const collection: DiscogsCollection = {
    releases,
    pagination: {
      page: 1,
      pages,
      items,
      perPage,
    },
  }
  lastGoodCollection = collection
  return collection
}

export function peekLastGoodCollection(): DiscogsCollection | null {
  return lastGoodCollection
}
