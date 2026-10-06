import { after } from 'next/server.js'
import {
  DISCOGS_REFRESH_LOCK_SECONDS,
  DISCOGS_SNAPSHOT_TTL_MS,
  getDefaultRedisDurableStore,
  isSnapshotStale,
  type DurableErrorKind,
  type DurableStore,
} from './discogs-store.ts'

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
  releaseId: number
  instanceId: number
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
  cache?: RequestCache
}

export type DiscogsFetch = (
  input: string,
  init?: DiscogsFetchInit
) => Promise<Response>

export type LastGoodStore = {
  get(): DiscogsCollection | null
  set(collection: DiscogsCollection): void
}

export type DiscogsCacheMode = 'isr' | 'fresh'

export type ScheduleRefresh = (task: () => Promise<void>) => void

export type DiscogsClientOptions = {
  fetchImpl?: DiscogsFetch
  token?: string | undefined
  lastGood?: LastGoodStore
  durable?: DurableStore | null
  scheduleRefresh?: ScheduleRefresh
  now?: () => number
  isProductionBuild?: boolean
  cacheMode?: DiscogsCacheMode
  onCollectionComplete?: (
    previous: DiscogsCollection | null,
    next: DiscogsCollection
  ) => Promise<void>
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
  id?: number
  instance_id?: number
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
export const DISCOGS_RELEASE_URL_PREFIX = 'https://www.discogs.com/release/'
export const DISCOGS_SITE_URL = 'https://www.discogs.com/'

const COLLECTION_URL = `https://api.discogs.com/users/${DISCOGS_USER}/collection/folders/0/releases`
const RELEASE_URL_PATTERN = /^https:\/\/www\.discogs\.com\/release\/[1-9]\d*$/

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

export function discogsReleaseUrl(id: number | undefined): string {
  if (typeof id === 'number' && Number.isInteger(id) && id > 0) {
    return `${DISCOGS_RELEASE_URL_PREFIX}${id}`
  }
  return DISCOGS_SITE_URL
}

export function extractReleaseIdFromUrl(url: string): number | null {
  const match = url.match(/\/release\/([1-9]\d*)$/)
  if (!match || !match[1]) return null
  const id = Number.parseInt(match[1], 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function sanitizeDiscogsUrl(url: string): string {
  if (RELEASE_URL_PATTERN.test(url)) return url
  return DISCOGS_SITE_URL
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
  const releaseId =
    typeof info.id === 'number' && Number.isInteger(info.id) && info.id > 0
      ? info.id
      : typeof release.id === 'number' && Number.isInteger(release.id) && release.id > 0
        ? release.id
        : 0
  const instanceId =
    typeof release.instance_id === 'number' &&
    Number.isInteger(release.instance_id) &&
    release.instance_id > 0
      ? release.instance_id
      : 0

  return {
    title: info.title ?? '',
    artist: artists,
    year: info.year ?? 0,
    thumbnail: thumb,
    cover,
    format: formatLine(info.formats),
    label: label?.name ?? '',
    catno: label?.catno ?? '',
    discogsUrl: discogsReleaseUrl(releaseId || undefined),
    releaseId,
    instanceId,
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

export function isCompleteCollection(collection: DiscogsCollection): boolean {
  return collection.releases.length === collection.pagination.items
}

function isDiscogsRelease(value: unknown): value is DiscogsRelease {
  if (!value || typeof value !== 'object') return false
  const release = value as Record<string, unknown>
  const releaseIdOk =
    release.releaseId === undefined ||
    (typeof release.releaseId === 'number' &&
      Number.isInteger(release.releaseId) &&
      release.releaseId >= 0)
  const instanceIdOk =
    release.instanceId === undefined ||
    (typeof release.instanceId === 'number' &&
      Number.isInteger(release.instanceId) &&
      release.instanceId >= 0)
  return (
    typeof release.title === 'string' &&
    typeof release.artist === 'string' &&
    typeof release.year === 'number' &&
    typeof release.thumbnail === 'string' &&
    typeof release.cover === 'string' &&
    typeof release.format === 'string' &&
    typeof release.label === 'string' &&
    typeof release.catno === 'string' &&
    typeof release.discogsUrl === 'string' &&
    releaseIdOk &&
    instanceIdOk
  )
}

export function parseDurableCollection(value: unknown): DiscogsCollection | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.releases)) return null
  if (!record.pagination || typeof record.pagination !== 'object') return null
  const paginationRecord = record.pagination as Record<string, unknown>
  if (
    typeof paginationRecord.page !== 'number' ||
    typeof paginationRecord.pages !== 'number' ||
    typeof paginationRecord.items !== 'number' ||
    typeof paginationRecord.perPage !== 'number'
  ) {
    return null
  }

  const releases: DiscogsRelease[] = []
  for (const item of record.releases) {
    if (!isDiscogsRelease(item)) return null
    const discogsUrl = sanitizeDiscogsUrl(item.discogsUrl)
    const releaseId =
      item.releaseId && item.releaseId > 0
        ? item.releaseId
        : extractReleaseIdFromUrl(discogsUrl) ?? 0
    releases.push({
      ...item,
      discogsUrl,
      releaseId,
      instanceId: item.instanceId ?? 0,
    })
  }

  const collection: DiscogsCollection = {
    releases,
    pagination: {
      page: paginationRecord.page,
      pages: paginationRecord.pages,
      items: paginationRecord.items,
      perPage: paginationRecord.perPage,
    },
  }

  if (!isCompleteCollection(collection)) return null
  return collection
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
  token: string | undefined,
  cacheMode: DiscogsCacheMode
): Promise<Response> {
  const init: DiscogsFetchInit = {
    headers: discogsHeaders(token),
  }
  if (cacheMode === 'isr') {
    init.next = { revalidate: DISCOGS_REVALIDATE_SECONDS }
  } else {
    init.cache = 'no-store'
  }
  return fetchImpl(url, init)
}

function resolveCacheMode(options: DiscogsClientOptions): DiscogsCacheMode {
  if (options.cacheMode) return options.cacheMode
  return options.durable ? 'fresh' : 'isr'
}

function errorKind(error: unknown): DurableErrorKind {
  if (isDiscogsRateLimitError(error)) return 'rate_limit'
  if (error instanceof DiscogsUnavailableError) return 'unavailable'
  return 'unavailable'
}

function isProductionBuildPhase(options: DiscogsClientOptions): boolean {
  if (options.isProductionBuild !== undefined) return options.isProductionBuild
  return process.env.NEXT_PHASE === 'phase-production-build'
}

export function defaultScheduleRefresh(task: () => Promise<void>): void {
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (process.env.NODE_TEST_CONTEXT) {
    void task()
    return
  }

  try {
    after(() => {
      void task()
    })
  } catch {
    void task()
  }
}

function defaultDurableStore(
  options: DiscogsClientOptions
): DurableStore | null {
  if (options.durable !== undefined) return options.durable
  return getDefaultRedisDurableStore()
}

export async function crawlFullCollection(
  options: DiscogsClientOptions = {}
): Promise<DiscogsCollection> {
  const fetchImpl = options.fetchImpl ?? fetch
  const token = options.token !== undefined ? options.token : getDiscogsToken()
  const cacheMode = resolveCacheMode(options)

  const releases: DiscogsRelease[] = []
  let page = 1
  let pages = 1
  let items = 0
  const perPage = DISCOGS_COLLECTION_PER_PAGE

  while (page <= pages) {
    const url = collectionRequestUrl(page, perPage)
    const response = await fetchDiscogsPage(fetchImpl, url, token, cacheMode)

    if (response.status === 429) {
      throw new DiscogsRateLimitError(readRetryAfter(response))
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
      throw new DiscogsRateLimitError(readRetryAfter(response))
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

  return collection
}

async function notifyCollectionComplete(
  options: DiscogsClientOptions,
  previous: DiscogsCollection | null,
  next: DiscogsCollection
): Promise<void> {
  if (options.onCollectionComplete) {
    try {
      await options.onCollectionComplete(previous, next)
    } catch {
      // Collection snapshot already saved.
    }
    return
  }

  try {
    const { getDefaultCrateStore } = await import('./crate/store.ts')
    const { queueNewAndMissing } = await import('./crate/sync.ts')
    const { processEnrichmentQueue } = await import('./crate/enrich.ts')
    const store = getDefaultCrateStore()
    if (!store) return
    const previousIds = (previous?.releases ?? [])
      .map((release) => release.releaseId || extractReleaseIdFromUrl(release.discogsUrl) || 0)
      .filter((id) => id > 0)
    await queueNewAndMissing(store, previousIds, next)
    const schedule = options.scheduleRefresh ?? defaultScheduleRefresh
    schedule(async () => {
      await processEnrichmentQueue({ store }, 1)
    })
  } catch {
    // Enrichment is best-effort. Last-good collection still stands.
  }
}

async function refreshDurableCollection(
  durable: DurableStore,
  options: DiscogsClientOptions,
  now: () => number
): Promise<void> {
  const locked = await durable.acquireLock(DISCOGS_REFRESH_LOCK_SECONDS)
  if (!locked) return

  try {
    let previous: DiscogsCollection | null = null
    try {
      const snapshot = await durable.get()
      previous = parseDurableCollection(snapshot?.collection)
    } catch {
      previous = null
    }
    const collection = await crawlFullCollection({
      ...options,
      durable,
      cacheMode: 'fresh',
    })
    await durable.setComplete(collection, now())
    await notifyCollectionComplete(options, previous, collection)
  } catch (error) {
    try {
      await durable.recordError(errorKind(error), now())
    } catch {
      // Keep the last-good copy even if error bookkeeping fails.
    }
  } finally {
    try {
      await durable.releaseLock()
    } catch {
      // Lock TTL still expires.
    }
  }
}

async function fetchFromDiscogsWithMemoryFallback(
  options: DiscogsClientOptions,
  lastGood: LastGoodStore
): Promise<DiscogsCollection> {
  try {
    const collection = await crawlFullCollection(options)
    saveLastGood(lastGood, collection)
    return collection
  } catch (error) {
    if (isDiscogsRateLimitError(error)) {
      return lastGoodOrRateLimit(lastGood, error.retryAfter)
    }
    throw error
  }
}

export async function readCachedCollection(
  options: DiscogsClientOptions = {}
): Promise<DiscogsCollection | null> {
  const lastGood = options.lastGood ?? defaultLastGoodStore()
  const durable = defaultDurableStore(options)

  if (durable && process.env.NEXT_PHASE !== 'phase-production-build') {
    try {
      const snapshot = await durable.get()
      const parsed = parseDurableCollection(snapshot?.collection)
      if (parsed) {
        saveLastGood(lastGood, parsed)
        return parsed
      }
    } catch {
      // Fall through to in-process last-good.
    }
  }

  const memory = lastGood.get()
  if (memory && isCompleteCollection(memory)) return memory
  return null
}

export async function fetchRecentReleases(
  perPage = DISCOGS_RECENT_PER_PAGE,
  options: DiscogsClientOptions = {}
): Promise<DiscogsRecentRelease[]> {
  const fetchImpl = options.fetchImpl ?? fetch
  const token = options.token !== undefined ? options.token : getDiscogsToken()
  const url = collectionRequestUrl(1, perPage)
  const response = await fetchDiscogsPage(fetchImpl, url, token, 'isr')

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
  const lastGood = options.lastGood ?? defaultLastGoodStore()
  const durable = defaultDurableStore(options)
  const now = options.now ?? Date.now
  const schedule = options.scheduleRefresh ?? defaultScheduleRefresh
  const isBuild = isProductionBuildPhase(options)

  if (!durable) {
    return fetchFromDiscogsWithMemoryFallback(
      { ...options, cacheMode: options.cacheMode ?? 'isr' },
      lastGood
    )
  }

  if (isBuild) {
    return fetchFromDiscogsWithMemoryFallback(
      { ...options, cacheMode: options.cacheMode ?? 'isr' },
      lastGood
    )
  }

  let parsed: DiscogsCollection | null = null
  try {
    const snapshot = await durable.get()
    parsed = parseDurableCollection(snapshot?.collection)
    if (parsed) {
      saveLastGood(lastGood, parsed)
      const fetchedAt = snapshot?.meta?.fetchedAt ?? null
      if (!isBuild && isSnapshotStale(fetchedAt, now(), DISCOGS_SNAPSHOT_TTL_MS)) {
        schedule(() => refreshDurableCollection(durable, options, now))
      }
      return parsed
    }
  } catch {
    parsed = null
  }

  const memory = lastGood.get()
  if (memory && isCompleteCollection(memory)) {
    if (!isBuild) {
      schedule(() => refreshDurableCollection(durable, options, now))
    }
    return memory
  }

  try {
    const collection = await crawlFullCollection({
      ...options,
      durable,
      cacheMode: 'isr',
    })
    saveLastGood(lastGood, collection)
    if (!isBuild) {
      schedule(async () => {
        const locked = await durable.acquireLock(DISCOGS_REFRESH_LOCK_SECONDS)
        if (!locked) return
        try {
          await durable.setComplete(collection, now())
          await notifyCollectionComplete(options, null, collection)
        } finally {
          await durable.releaseLock()
        }
      })
    }
    return collection
  } catch (error) {
    if (isDiscogsRateLimitError(error)) {
      return lastGoodOrRateLimit(lastGood, error.retryAfter)
    }
    throw error
  }
}
