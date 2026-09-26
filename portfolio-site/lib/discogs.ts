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

export type DiscogsRecentRelease = {
  title: string
  artist: string
  year: number
  thumbnail: string
  discogsUrl: string
}

export type DiscogsPagination = {
  page: number
  pages: number
  items: number
  perPage: number
}

export type DiscogsCollection = {
  releases: DiscogsRelease[]
  pagination: DiscogsPagination
}

export type DiscogsFetchInit = RequestInit & {
  next?: { revalidate: number }
}

export type DiscogsFetch = (
  input: string,
  init?: DiscogsFetchInit
) => Promise<Response>

export type LastGoodStore = {
  get(): DiscogsCollection | null
  set(collection: DiscogsCollection): void
}

export type DiscogsClientOptions = {
  fetchImpl?: DiscogsFetch
  token?: string | undefined
  lastGood?: LastGoodStore
}

export type DiscogsErrorHttp = {
  status: 429 | 502
  body: { error: string }
  headers: Record<string, string>
}

type DiscogsArtist = { name?: string }
type DiscogsFormat = { name?: string; descriptions?: string[] }
type DiscogsLabel = { name?: string; catno?: string }

type DiscogsBasicInformation = {
  id?: number
  title?: string
  year?: number
  thumb?: string
  cover_image?: string
  artists?: DiscogsArtist[]
  formats?: DiscogsFormat[]
  labels?: DiscogsLabel[]
}

type DiscogsApiRelease = {
  basic_information?: DiscogsBasicInformation
}

type DiscogsApiPage = {
  releases?: DiscogsApiRelease[]
  pagination?: {
    page?: number
    pages?: number
    items?: number
    per_page?: number
  }
}

type DiscogsGlobal = typeof globalThis & {
  __lfDiscogsLastGoodStore?: LastGoodStore
}

export const DISCOGS_USER = 'lecturesfrom'
export const DISCOGS_USER_AGENT = 'lecturesfrom/1.0'
export const DISCOGS_REVALIDATE_SECONDS = 300
export const DISCOGS_COLLECTION_PER_PAGE = 100
export const DISCOGS_RECENT_PER_PAGE = 5
export const DISCOGS_DEFAULT_RETRY_AFTER = 60

const COLLECTION_URL = `https://api.discogs.com/users/${DISCOGS_USER}/collection/folders/0/releases`

export class DiscogsRateLimitError extends Error {
  readonly status = 429 as const
  readonly retryAfter: number

  constructor(retryAfter = DISCOGS_DEFAULT_RETRY_AFTER) {
    super('Too many requests')
    this.name = 'DiscogsRateLimitError'
    this.retryAfter = retryAfter
  }
}

export class DiscogsUnavailableError extends Error {
  readonly status = 502 as const

  constructor() {
    super('Failed to fetch from Discogs')
    this.name = 'DiscogsUnavailableError'
  }
}

export function isDiscogsRateLimitError(
  error: unknown
): error is DiscogsRateLimitError {
  return error instanceof DiscogsRateLimitError
}

export function createMemoryLastGoodStore(
  initial: DiscogsCollection | null = null
): LastGoodStore {
  let value = initial
  return {
    get() {
      return value
    },
    set(collection) {
      value = collection
    },
  }
}

function defaultLastGoodStore(): LastGoodStore {
  const g = globalThis as DiscogsGlobal
  if (!g.__lfDiscogsLastGoodStore) {
    g.__lfDiscogsLastGoodStore = createMemoryLastGoodStore()
  }
  return g.__lfDiscogsLastGoodStore
}

export function getDiscogsToken(): string | undefined {
  const token = process.env.DISCOGS_TOKEN
  if (!token || token.trim() === '') return undefined
  return token
}

export function peekLastGoodCollection(
  store: LastGoodStore = defaultLastGoodStore()
): DiscogsCollection | null {
  return store.get()
}

export function discogsHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': DISCOGS_USER_AGENT,
    Accept: 'application/vnd.discogs.v2.discogs+json',
  }
  if (token) {
    headers.Authorization = `Discogs token=${token}`
  }
  return headers
}

export function collectionRequestUrl(
  page: number,
  perPage: number
): string {
  const params = new URLSearchParams({
    sort: 'added',
    sort_order: 'desc',
    per_page: String(perPage),
    page: String(page),
  })
  return `${COLLECTION_URL}?${params.toString()}`
}

export function toRecentRelease(release: DiscogsRelease): DiscogsRecentRelease {
  return {
    title: release.title,
    artist: release.artist,
    year: release.year,
    thumbnail: release.thumbnail,
    discogsUrl: release.discogsUrl,
  }
}

export function discogsErrorHttp(error: unknown): DiscogsErrorHttp {
  if (isDiscogsRateLimitError(error)) {
    return {
      status: 429,
      body: { error: 'Too many requests' },
      headers: {
        'Retry-After': String(error.retryAfter),
        'Cache-Control': 'no-store',
      },
    }
  }

  return {
    status: 502,
    body: { error: 'Failed to fetch from Discogs' },
    headers: {
      'Cache-Control': 'no-store',
    },
  }
}

function formatLine(formats: DiscogsFormat[] | undefined): string {
  if (!formats || formats.length === 0) return ''
  const first = formats[0]
  const bits = [first?.name, ...(first?.descriptions ?? [])].filter(Boolean)
  return bits.join(', ')
}

export function mapRelease(release: DiscogsApiRelease): DiscogsRelease {
  const info = release.basic_information ?? {}
  const artists = (info.artists ?? [])
    .map((artist) => artist.name)
    .filter((name): name is string => Boolean(name))
    .join(', ')
  const label = info.labels?.[0]
  const thumb = info.thumb ?? ''
  const cover = info.cover_image || thumb
  const id = info.id ?? 0

  return {
    title: info.title ?? '',
    artist: artists,
    year: info.year ?? 0,
    thumbnail: thumb,
    cover,
    format: formatLine(info.formats),
    label: label?.name ?? '',
    catno: label?.catno ?? '',
    discogsUrl: `https://www.discogs.com/release/${id}`,
  }
}

function readRemaining(response: Response): number | null {
  const raw = response.headers.get('X-Discogs-Ratelimit-Remaining')
  if (raw == null || raw === '') return null
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : null
}

function readRetryAfter(response: Response): number {
  const raw = response.headers.get('Retry-After')
  if (!raw) return DISCOGS_DEFAULT_RETRY_AFTER
  const value = Number.parseInt(raw, 10)
  if (Number.isFinite(value) && value > 0) return value
  return DISCOGS_DEFAULT_RETRY_AFTER
}

function isCompleteCollection(collection: DiscogsCollection): boolean {
  return collection.releases.length === collection.pagination.items
}

function saveLastGood(store: LastGoodStore, collection: DiscogsCollection): void {
  if (!isCompleteCollection(collection)) return
  store.set(collection)
}

function lastGoodOrRateLimit(
  store: LastGoodStore,
  retryAfter: number
): DiscogsCollection {
  const cached = store.get()
  if (cached && isCompleteCollection(cached)) {
    return cached
  }
  throw new DiscogsRateLimitError(retryAfter)
}

async function parsePage(response: Response): Promise<DiscogsApiPage> {
  try {
    return (await response.json()) as DiscogsApiPage
  } catch {
    throw new DiscogsUnavailableError()
  }
}

async function fetchDiscogsPage(
  fetchImpl: DiscogsFetch,
  url: string,
  token: string | undefined
): Promise<Response> {
  return fetchImpl(url, {
    headers: discogsHeaders(token),
    next: { revalidate: DISCOGS_REVALIDATE_SECONDS },
  })
}

export async function fetchRecentReleases(
  perPage = DISCOGS_RECENT_PER_PAGE,
  options: DiscogsClientOptions = {}
): Promise<DiscogsRecentRelease[]> {
  const fetchImpl = options.fetchImpl ?? fetch
  const token = options.token !== undefined ? options.token : getDiscogsToken()
  const url = collectionRequestUrl(1, perPage)
  const response = await fetchDiscogsPage(fetchImpl, url, token)

  if (
    response.status === 429 ||
    (readRemaining(response) === 0 && !response.ok)
  ) {
    throw new DiscogsRateLimitError(readRetryAfter(response))
  }

  if (!response.ok) {
    throw new DiscogsUnavailableError()
  }

  const data = await parsePage(response)
  return (data.releases ?? [])
    .slice(0, perPage)
    .map(mapRelease)
    .map(toRecentRelease)
}

export async function fetchFullCollection(
  options: DiscogsClientOptions = {}
): Promise<DiscogsCollection> {
  const fetchImpl = options.fetchImpl ?? fetch
  const token = options.token !== undefined ? options.token : getDiscogsToken()
  const lastGood = options.lastGood ?? defaultLastGoodStore()

  const releases: DiscogsRelease[] = []
  let page = 1
  let pages = 1
  let items = 0
  const perPage = DISCOGS_COLLECTION_PER_PAGE

  while (page <= pages) {
    const url = collectionRequestUrl(page, perPage)
    const response = await fetchDiscogsPage(fetchImpl, url, token)

    if (response.status === 429) {
      return lastGoodOrRateLimit(lastGood, readRetryAfter(response))
    }

    if (!response.ok) {
      throw new DiscogsUnavailableError()
    }

    const data = await parsePage(response)
    const pageReleases = (data.releases ?? []).map(mapRelease)
    releases.push(...pageReleases)
    pages = data.pagination?.pages ?? page
    items = data.pagination?.items ?? releases.length

    const remaining = readRemaining(response)
    const hasMore = page < pages
    if (remaining === 0 && hasMore) {
      return lastGoodOrRateLimit(lastGood, readRetryAfter(response))
    }

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

  if (!isCompleteCollection(collection)) {
    throw new DiscogsUnavailableError()
  }

  saveLastGood(lastGood, collection)
  return collection
}
