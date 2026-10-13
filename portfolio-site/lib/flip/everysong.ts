import { createHash } from 'node:crypto'
import {
  EVERYSONG_ORIGIN,
  EVERYSONG_SAMPLES_PATH,
  EVERYSONG_SEARCH_PATH,
  EVERYSONG_TIMEOUT_MS,
  EVERYSONG_USER_AGENT,
  FLIP_QUERY_MAX,
  FLIP_SEARCH_LIMIT,
  FLIP_SEARCH_MIN_CHARS,
  type FlipLookupResult,
  type FlipSampleRow,
  type FlipSearchResult,
  type FlipSong,
} from './types.ts'

type EnvMap = Record<string, string | undefined>

export function everysongApiKey(env: EnvMap = process.env): string | null {
  const raw = env.EVERYSONG_API_KEY?.trim()
  return raw ? raw : null
}

export function lookupCacheKey(query: string): string {
  const hash = createHash('sha256').update(query.trim().toLowerCase()).digest('hex').slice(0, 24)
  return hash
}

export function searchCacheKey(query: string): string {
  return lookupCacheKey(`search\0${query}`)
}

export function songLookupCacheKey(title: string, artist: string): string {
  return lookupCacheKey(`song\0${title}\0${artist}`)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asYear(value: unknown): string | null {
  const raw = asString(value)
  if (!raw) return null
  const match = raw.match(/(\d{4})/)
  return match ? match[1]! : null
}

function asRid(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10)
  }
  return null
}

function isSampleEdge(family: unknown, rel: unknown): boolean {
  const f = String(family ?? '').toLowerCase()
  const r = String(rel ?? '').toLowerCase().replace(/_/g, ' ')
  if (f === 'cover' || f === 'remix') return false
  if (r.includes('cover') || r.includes('remix')) return false
  return f === 'sample' || r === 'samples' || r === 'sampled in' || r === 'sampled by'
}

function sampleRowFromEdge(edge: unknown): FlipSampleRow | null {
  const rec = asRecord(edge)
  if (!rec) return null
  if (!isSampleEdge(rec.family, rec.rel)) return null
  const node = asRecord(rec.node) ?? rec
  const title = asString(node.title)
  if (!title) return null
  return {
    title,
    artist: asString(node.artist) ?? '',
    year: asYear(node.year) ?? asYear(node.released),
  }
}

export function songFromSearchHit(hit: unknown): FlipSong | null {
  const rec = asRecord(hit)
  if (!rec) return null
  const title = asString(rec.title)
  const artist = asString(rec.artist)
  if (!title || !artist) return null
  return {
    rid: asRid(rec.rid),
    title,
    artist,
    year: asYear(rec.year) ?? asYear(rec.released),
    isrc: asString(rec.isrc),
  }
}

export function mapSearchResults(payload: unknown): FlipSong[] {
  const rec = asRecord(payload)
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(rec?.results)
      ? rec.results
      : []
  const songs: FlipSong[] = []
  for (const hit of list) {
    const song = songFromSearchHit(hit)
    if (song) songs.push(song)
    if (songs.length >= FLIP_SEARCH_LIMIT) break
  }
  return songs
}

export function mapSampleHistory(payload: unknown): {
  samples: FlipSampleRow[]
  sampledIn: FlipSampleRow[]
} {
  const rec = asRecord(payload) ?? {}
  const upstream = Array.isArray(rec.upstream) ? rec.upstream : []
  const downstream = Array.isArray(rec.downstream) ? rec.downstream : []
  const samples: FlipSampleRow[] = []
  const sampledIn: FlipSampleRow[] = []
  for (const edge of upstream) {
    const row = sampleRowFromEdge(edge)
    if (row) samples.push(row)
  }
  for (const edge of downstream) {
    const row = sampleRowFromEdge(edge)
    if (row) sampledIn.push(row)
  }
  return { samples, sampledIn }
}

function checkedStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function emptyLookup(status: FlipLookupResult['status'], fixture = false): FlipLookupResult {
  return {
    status,
    fixture,
    checked: null,
    song: null,
    samples: [],
    sampledIn: [],
  }
}

export function emptySearch(status: FlipSearchResult['status'], fixture = false): FlipSearchResult {
  return { status, fixture, hits: [] }
}

export function okLookup(
  song: FlipSong,
  samples: FlipSampleRow[],
  sampledIn: FlipSampleRow[],
  fixture = false,
  now = new Date()
): FlipLookupResult {
  return {
    status: 'ok',
    fixture,
    checked: checkedStamp(now),
    song,
    samples,
    sampledIn,
  }
}

type FetchLike = typeof fetch

async function everysongGet(
  path: string,
  params: Record<string, string>,
  key: string,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<{ ok: true; json: unknown } | { ok: false; status: number }> {
  const url = new URL(path, EVERYSONG_ORIGIN)
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value)
  }
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'x-api-key': key,
        Accept: 'application/json',
        'User-Agent': EVERYSONG_USER_AGENT,
      },
      cache: 'no-store',
      signal,
    })
  } catch {
    return { ok: false, status: 0 }
  }
  if (!response.ok) {
    return { ok: false, status: response.status }
  }
  try {
    return { ok: true, json: await response.json() }
  } catch {
    return { ok: false, status: response.status }
  }
}

type EverysongCallOptions = {
  key: string
  fetchImpl?: FetchLike
  now?: Date
  timeoutMs?: number
}

async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

export async function searchEverysong(
  query: string,
  options: EverysongCallOptions
): Promise<FlipSearchResult> {
  const q = query.trim().slice(0, FLIP_QUERY_MAX)
  if (q.length < FLIP_SEARCH_MIN_CHARS) return emptySearch('ok')

  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? EVERYSONG_TIMEOUT_MS
  return withTimeout(timeoutMs, async (signal) => {
    const search = await everysongGet(
      EVERYSONG_SEARCH_PATH,
      { q, limit: String(FLIP_SEARCH_LIMIT) },
      options.key,
      fetchImpl,
      signal
    )
    if (!search.ok) return emptySearch('down')
    const hits = mapSearchResults(search.json)
    if (hits.length === 0) return emptySearch('no_match')
    return { status: 'ok', fixture: false, hits }
  })
}

export async function samplesForSong(
  song: FlipSong,
  options: EverysongCallOptions
): Promise<FlipLookupResult> {
  const title = song.title.trim().slice(0, FLIP_QUERY_MAX)
  const artist = song.artist.trim().slice(0, FLIP_QUERY_MAX)
  if (!title || !artist) return emptyLookup('no_match')

  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? EVERYSONG_TIMEOUT_MS
  return withTimeout(timeoutMs, async (signal) => {
    const samplesRes = await everysongGet(
      EVERYSONG_SAMPLES_PATH,
      { artist, title },
      options.key,
      fetchImpl,
      signal
    )
    if (!samplesRes.ok) return emptyLookup('down')
    const history = mapSampleHistory(samplesRes.json)
    return okLookup(
      { ...song, title, artist },
      history.samples,
      history.sampledIn,
      false,
      options.now
    )
  })
}

export async function lookupEverysong(
  query: string,
  options: EverysongCallOptions
): Promise<FlipLookupResult> {
  const search = await searchEverysong(query, options)
  if (search.status === 'down') return emptyLookup('down')
  if (search.status === 'no_match' || search.hits.length !== 1) {
    return emptyLookup('no_match')
  }
  return samplesForSong(search.hits[0]!, options)
}
