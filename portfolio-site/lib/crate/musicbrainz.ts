import {
  MUSICBRAINZ_MIN_INTERVAL_MS,
  MUSICBRAINZ_RETRY_AFTER_CAP_MS,
  MUSICBRAINZ_TIMEOUT_MS,
  MUSICBRAINZ_USER_AGENT,
  isMusicBrainzUnknownArtist,
  type Credit,
  type SampleLink,
} from './types.ts'

export { MUSICBRAINZ_RETRY_AFTER_CAP_MS }

export const MUSICBRAINZ_RATE_LIMIT_MESSAGE = 'MusicBrainz rate limited'

export const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2'

export type MbFetch = (input: string, init?: RequestInit) => Promise<Response>

export type MbClientOptions = {
  fetchImpl?: MbFetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  minIntervalMs?: number
  timeoutMs?: number
  deadlineMs?: number
}

export type MbSearchHit = {
  mbid: string
  score: number
  title: string
  trackCount: number | null
}

export type MbRecordingFacts = {
  mbid: string
  title: string
  artist: string
  credits: Credit[]
  samplesFrom: SampleLink[]
  sampledIn: SampleLink[]
}

export class MusicBrainzRateLimitError extends Error {
  readonly kind = 'rate_limit' as const
  readonly retryAfterMs: number
  partialRecording: MbRecordingFacts | null = null

  constructor(retryAfterMs = 60_000) {
    super(MUSICBRAINZ_RATE_LIMIT_MESSAGE)
    this.name = 'MusicBrainzRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export class MusicBrainzTimeoutError extends Error {
  readonly kind = 'unavailable' as const
  readonly deadlineExceeded: boolean
  partialRecording: MbRecordingFacts | null = null

  constructor(deadlineExceeded = false) {
    super(deadlineExceeded ? 'MusicBrainz deadline' : 'MusicBrainz timed out')
    this.name = 'MusicBrainzTimeoutError'
    this.deadlineExceeded = deadlineExceeded
  }
}

export function isMusicBrainzTimeoutError(error: unknown): error is MusicBrainzTimeoutError {
  return error instanceof MusicBrainzTimeoutError
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

export function isMusicBrainzRateLimitError(
  error: unknown
): error is MusicBrainzRateLimitError {
  return error instanceof MusicBrainzRateLimitError
}

export class MusicBrainzAuthError extends Error {
  readonly kind = 'auth' as const
  readonly status: 401 | 403

  constructor(status: 401 | 403 = 401) {
    super('MusicBrainz authentication failed')
    this.name = 'MusicBrainzAuthError'
    this.status = status
  }
}

export function isMusicBrainzAuthError(error: unknown): error is MusicBrainzAuthError {
  return error instanceof MusicBrainzAuthError
}

export type MbRecordingSearchHit = {
  mbid: string
  title: string
  artist: string
  lengthMs: number | null
  score: number
}

export const MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID = '9efd9ce9-e702-448b-8e76-641515e8fe62'
export const MB_SAMPLES_MATERIAL_RELEASE_TYPE_ID = '967746f9-9d79-456c-9d1e-50116f0b27fc'
export { MUSICBRAINZ_UNKNOWN_ARTIST_MBID, isMusicBrainzUnknownArtist } from './types.ts'

type MbArtistCreditPart = {
  name?: string
  artist?: { id?: string; name?: string }
  joinphrase?: string
}
type MbArtistCredit = MbArtistCreditPart[]

type MbRelation = {
  type?: string
  'type-id'?: string
  direction?: string
  'target-type'?: string
  attributes?: string[]
  artist?: { id?: string; name?: string }
  recording?: {
    id?: string
    title?: string
    'artist-credit'?: MbArtistCredit
  }
  work?: {
    id?: string
    title?: string
    'artist-credit'?: MbArtistCredit
  }
  release?: {
    id?: string
    title?: string
    'artist-credit'?: MbArtistCredit
  }
}

type MbUrlLookup = {
  error?: string
  relations?: MbRelation[]
}

type MbReleaseSearch = {
  releases?: Array<{
    id?: string
    title?: string
    score?: number
    'track-count'?: number
  }>
}

type MbRecordingDoc = {
  id?: string
  title?: string
  'artist-credit'?: MbArtistCredit
  relations?: MbRelation[]
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function artistCreditName(credit: MbArtistCredit | undefined): string {
  if (!credit || credit.length === 0) return ''
  const kept: MbArtistCredit = []
  for (const part of credit) {
    const name = part.name ?? part.artist?.name ?? ''
    if (isMusicBrainzUnknownArtist(name, part.artist?.id)) {
      if (kept.length > 0) {
        const prev = kept[kept.length - 1]!
        kept[kept.length - 1] = { ...prev, joinphrase: part.joinphrase ?? '' }
      }
      continue
    }
    kept.push(part)
  }
  if (kept.length === 0) return ''
  return kept
    .map((part, index) => {
      const name = part.name ?? part.artist?.name ?? ''
      if (index === kept.length - 1) return name
      return `${name}${part.joinphrase ?? ''}`
    })
    .join('')
}

export function musicbrainzRecordingUrl(mbid: string): string {
  return `https://musicbrainz.org/recording/${mbid}`
}

export function musicbrainzReleaseUrl(mbid: string): string {
  return `https://musicbrainz.org/release/${mbid}`
}

export function isSamplesMaterialRelation(rel: { 'type-id'?: string }): boolean {
  const typeId = (rel['type-id'] ?? '').toLowerCase()
  return (
    typeId === MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID ||
    typeId === MB_SAMPLES_MATERIAL_RELEASE_TYPE_ID
  )
}

const SAMPLE_ARTIST_LOOKUP_CAP = 8

function rememberArtist(
  cache: Map<string, string>,
  mbid: string | undefined,
  credit: MbRecordingDoc['artist-credit']
): void {
  const name = artistCreditName(credit)
  if (mbid && name) cache.set(mbid, name)
}

function presentLinkArtist(name: string | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed || isMusicBrainzUnknownArtist(trimmed)) return ''
  return trimmed
}

function sampleLinkFromRelation(rel: MbRelation, fallbackArtist = ''): SampleLink | null {
  if (rel.recording?.id) {
    return {
      title: rel.recording.title ?? '',
      artist:
        artistCreditName(rel.recording['artist-credit']) ||
        presentLinkArtist(fallbackArtist),
      mbid: rel.recording.id,
      sourceUrl: musicbrainzRecordingUrl(rel.recording.id),
      source: 'musicbrainz',
      providerId: rel.recording.id,
    }
  }
  if (rel.release?.id) {
    return {
      title: rel.release.title ?? '',
      artist:
        artistCreditName(rel.release['artist-credit']) ||
        presentLinkArtist(fallbackArtist),
      mbid: rel.release.id,
      sourceUrl: musicbrainzReleaseUrl(rel.release.id),
      source: 'musicbrainz',
      providerId: rel.release.id,
    }
  }
  return null
}

export function escapeLucene(value: string): string {
  return value.replace(/[+\-!(){}[\]^"~*?:\\/]/g, '\\$&')
}

export function stripDiscogsArtistSuffix(name: string): string {
  return name.replace(/\s+\(\d+\)$/u, '').trim()
}

export function readRetryAfterMs(
  response: Response,
  fallbackMs = 60_000,
  nowMs = Date.now()
): number {
  const raw = response.headers.get('Retry-After')
  if (!raw) return fallbackMs
  const seconds = Number.parseInt(raw, 10)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(raw)
  if (Number.isFinite(date)) return Math.max(0, date - nowMs)
  return fallbackMs
}

export function musicbrainzRetryAfterMs(
  response: Response,
  nowMs = Date.now()
): number {
  return Math.min(
    MUSICBRAINZ_RETRY_AFTER_CAP_MS,
    Math.max(0, readRetryAfterMs(response, 60_000, nowMs))
  )
}

function hitsFromSearch(data: MbReleaseSearch): MbSearchHit[] {
  const hits: MbSearchHit[] = []
  const seen = new Set<string>()
  for (const release of data.releases ?? []) {
    if (!release.id || seen.has(release.id)) continue
    seen.add(release.id)
    hits.push({
      mbid: release.id,
      score: typeof release.score === 'number' ? release.score : 0,
      title: release.title ?? '',
      trackCount: typeof release['track-count'] === 'number' ? release['track-count'] : null,
    })
  }
  return hits
}

export function createMusicBrainzClient(options: MbClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? defaultSleep
  const minInterval = options.minIntervalMs ?? MUSICBRAINZ_MIN_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? MUSICBRAINZ_TIMEOUT_MS
  const deadlineMs = options.deadlineMs
  let lastAt = 0
  let requestCount = 0

  const remainingMs = (): number =>
    deadlineMs == null ? Number.POSITIVE_INFINITY : Math.max(0, deadlineMs - now())

  async function getJson<T>(url: string): Promise<T> {
    const wait = lastAt + minInterval - now()
    const remaining = remainingMs()
    if (deadlineMs != null && remaining <= 0) {
      throw new MusicBrainzTimeoutError(true)
    }
    if (wait > 0) {
      if (deadlineMs != null && wait > remaining) {
        throw new MusicBrainzTimeoutError(true)
      }
      await sleep(wait)
    }
    lastAt = now()
    requestCount += 1
    const requestTimeout = Math.min(timeoutMs, remainingMs())
    if (requestTimeout <= 0) {
      throw new MusicBrainzTimeoutError(deadlineMs != null)
    }
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(),
      Number.isFinite(requestTimeout) ? requestTimeout : timeoutMs
    )
    try {
      const response = await fetchImpl(url, {
        headers: {
          'User-Agent': MUSICBRAINZ_USER_AGENT,
          Accept: 'application/json',
        },
        signal: controller.signal,
      })
      if (response.status === 404) {
        return { error: 'Not Found' } as T
      }
      if (response.status === 401 || response.status === 403) {
        throw new MusicBrainzAuthError(response.status)
      }
      if (response.status === 503 || response.status === 429) {
        throw new MusicBrainzRateLimitError(musicbrainzRetryAfterMs(response, now()))
      }
      if (!response.ok) {
        const error = new Error('MusicBrainz unavailable')
        ;(error as Error & { kind: 'unavailable' }).kind = 'unavailable'
        throw error
      }
      return (await response.json()) as T
    } catch (error) {
      if (isMusicBrainzRateLimitError(error) || isMusicBrainzAuthError(error)) throw error
      if (error instanceof Error && 'kind' in error && error.kind === 'unavailable') throw error
      if (isAbortError(error) || controller.signal.aborted) {
        throw new MusicBrainzTimeoutError(deadlineMs != null && remainingMs() <= 0)
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    get requestCount() {
      return requestCount
    },
    async lookupDiscogsReleaseUrl(discogsUrl: string): Promise<string[]> {
      const params = new URLSearchParams({
        resource: discogsUrl,
        inc: 'release-rels',
        fmt: 'json',
      })
      const data = await getJson<MbUrlLookup>(`${MUSICBRAINZ_API}/url?${params.toString()}`)
      if (data.error) return []
      const ids: string[] = []
      for (const rel of data.relations ?? []) {
        const id = rel.release?.id
        if (id && (rel.type === 'discogs' || rel['target-type'] === 'release')) {
          ids.push(id)
        }
      }
      return [...new Set(ids)]
    },

    async searchReleaseByBarcode(barcode: string): Promise<MbSearchHit[]> {
      const cleaned = barcode.replace(/\s+/g, '')
      if (!cleaned) return []
      const params = new URLSearchParams({
        query: `barcode:${escapeLucene(cleaned)}`,
        fmt: 'json',
      })
      const data = await getJson<MbReleaseSearch>(`${MUSICBRAINZ_API}/release?${params.toString()}`)
      return hitsFromSearch(data)
    },

    async searchReleaseByCatno(catno: string, artist: string): Promise<MbSearchHit[]> {
      const trimmed = catno.trim()
      if (!trimmed) return []
      const artistQuery = stripDiscogsArtistSuffix(artist)
      const query = artistQuery
        ? `catno:"${escapeLucene(trimmed)}" AND artist:"${escapeLucene(artistQuery)}"`
        : `catno:"${escapeLucene(trimmed)}"`
      const params = new URLSearchParams({ query, fmt: 'json' })
      const data = await getJson<MbReleaseSearch>(`${MUSICBRAINZ_API}/release?${params.toString()}`)
      return hitsFromSearch(data)
    },

    async searchReleaseByArtistTitle(input: {
      artist: string
      title: string
      year?: number | null
      label?: string | null
    }): Promise<MbSearchHit[]> {
      const artist = stripDiscogsArtistSuffix(input.artist)
      const title = input.title.trim()
      if (!artist || !title) return []
      const parts = [
        `artist:"${escapeLucene(artist)}"`,
        `release:"${escapeLucene(title)}"`,
      ]
      if (input.year && input.year > 0) parts.push(`date:${input.year}`)
      if (input.label?.trim()) parts.push(`label:"${escapeLucene(input.label.trim())}"`)
      const params = new URLSearchParams({ query: parts.join(' AND '), fmt: 'json' })
      const data = await getJson<MbReleaseSearch>(`${MUSICBRAINZ_API}/release?${params.toString()}`)
      return hitsFromSearch(data)
    },

    async searchRecordingsByArtistTitle(input: {
      artist: string
      title: string
    }): Promise<MbRecordingSearchHit[]> {
      const artist = stripDiscogsArtistSuffix(input.artist)
      const title = input.title.trim()
      if (!artist || !title) return []
      const query = `artist:"${escapeLucene(artist)}" AND recording:"${escapeLucene(title)}"`
      const params = new URLSearchParams({
        query,
        fmt: 'json',
        limit: '25',
      })
      const data = await getJson<{
        recordings?: Array<{
          id?: string
          title?: string
          score?: number
          length?: number
          'artist-credit'?: Array<{
            name?: string
            artist?: { name?: string }
            joinphrase?: string
          }>
        }>
      }>(`${MUSICBRAINZ_API}/recording?${params.toString()}`)
      const hits: MbRecordingSearchHit[] = []
      const seen = new Set<string>()
      for (const recording of data.recordings ?? []) {
        if (!recording.id || seen.has(recording.id)) continue
        seen.add(recording.id)
        hits.push({
          mbid: recording.id,
          title: recording.title ?? '',
          artist: artistCreditName(recording['artist-credit']),
          lengthMs: typeof recording.length === 'number' ? recording.length : null,
          score: typeof recording.score === 'number' ? recording.score : 0,
        })
      }
      return hits
    },

    async getRelease(mbid: string): Promise<{
      id: string
      title: string
      date: string | null
      country: string | null
      releaseGroupId: string | null
      tracks: Array<{
        index: number
        number: string
        title: string
        lengthMs: number | null
        recordingId: string
        recordingTitle: string
        disambiguation: string
      }>
    } | null> {
      const params = new URLSearchParams({
        inc: 'recordings+artist-credits+labels+url-rels+release-groups',
        fmt: 'json',
      })
      const data = await getJson<{
        error?: string
        id?: string
        title?: string
        date?: string
        country?: string
        'release-group'?: { id?: string }
        media?: Array<{
          position?: number
          tracks?: Array<{
            id?: string
            number?: string
            title?: string
            length?: number
            recording?: {
              id?: string
              title?: string
              length?: number
              disambiguation?: string
            }
          }>
        }>
      }>(`${MUSICBRAINZ_API}/release/${mbid}?${params.toString()}`)
      if (data.error || !data.id) return null
      const tracks: Array<{
        index: number
        number: string
        title: string
        lengthMs: number | null
        recordingId: string
        recordingTitle: string
        disambiguation: string
      }> = []
      let index = 0
      for (const medium of data.media ?? []) {
        const disc = medium.position && medium.position > 1 ? String(medium.position) : ''
        for (const track of medium.tracks ?? []) {
          const recordingId = track.recording?.id
          if (!recordingId) continue
          const rawNumber = track.number ?? ''
          const number =
            disc && /^\d+$/.test(rawNumber) ? `${disc}-${rawNumber}` : rawNumber
          tracks.push({
            index,
            number,
            title: track.title ?? track.recording?.title ?? '',
            lengthMs: track.length ?? track.recording?.length ?? null,
            recordingId,
            recordingTitle: track.recording?.title ?? track.title ?? '',
            disambiguation: track.recording?.disambiguation ?? '',
          })
          index += 1
        }
      }
      return {
        id: data.id,
        title: data.title ?? '',
        date: data.date ?? null,
        country: data.country ?? null,
        releaseGroupId: data['release-group']?.id?.trim() ? data['release-group'].id : null,
        tracks,
      }
    },

    async getRecording(mbid: string): Promise<MbRecordingFacts | null> {
      const params = new URLSearchParams({
        inc: 'artist-credits+artist-rels+recording-rels+release-rels+url-rels',
        fmt: 'json',
      })
      const data = await getJson<MbRecordingDoc>(
        `${MUSICBRAINZ_API}/recording/${mbid}?${params.toString()}`
      )
      if (!data.id) return null
      const sourceUrl = musicbrainzRecordingUrl(data.id)
      const credits: Credit[] = []
      const samplesFrom: SampleLink[] = []
      const sampledIn: SampleLink[] = []
      const artistCache = new Map<string, string>()
      const lookups = { count: 0 }
      rememberArtist(artistCache, data.id, data['artist-credit'])

      const facts = (): MbRecordingFacts => ({
        mbid: data.id!,
        title: data.title ?? '',
        artist: artistCreditName(data['artist-credit']),
        credits,
        samplesFrom,
        sampledIn,
      })

      const attachPartial = (error: unknown): unknown => {
        if (isMusicBrainzRateLimitError(error) || isMusicBrainzTimeoutError(error)) {
          error.partialRecording = facts()
        }
        return error
      }

      const fillBlankSampleArtists = async (links: SampleLink[]): Promise<void> => {
        for (const link of links) {
          link.artist = presentLinkArtist(link.artist)
          if (link.artist) continue
          const cached = presentLinkArtist(artistCache.get(link.mbid))
          if (cached) {
            link.artist = cached
            continue
          }
          if (!/\/recording\//.test(link.sourceUrl) && !/\/release\//.test(link.sourceUrl)) continue
          if (lookups.count >= SAMPLE_ARTIST_LOOKUP_CAP) continue
          lookups.count += 1
          if (/\/release\//.test(link.sourceUrl)) {
            const release = await getJson<{
              id?: string
              'artist-credit'?: MbRecordingDoc['artist-credit']
            }>(
              `${MUSICBRAINZ_API}/release/${link.mbid}?${new URLSearchParams({
                inc: 'artist-credits',
                fmt: 'json',
              }).toString()}`
            )
            rememberArtist(artistCache, release.id, release['artist-credit'])
            link.artist = presentLinkArtist(artistCache.get(link.mbid))
            continue
          }
          const rec = await getJson<MbRecordingDoc>(
            `${MUSICBRAINZ_API}/recording/${link.mbid}?${new URLSearchParams({
              inc: 'artist-credits',
              fmt: 'json',
            }).toString()}`
          )
          rememberArtist(artistCache, rec.id, rec['artist-credit'])
          link.artist = presentLinkArtist(artistCache.get(link.mbid))
        }
      }

      for (const rel of data.relations ?? []) {
        const type = (rel.type ?? '').toLowerCase()
        if (rel['target-type'] === 'artist' && rel.artist?.name) {
          if (type === 'performance') continue
          credits.push({
            name: rel.artist.name,
            role: rel.type ?? 'credit',
            attributes: rel.attributes ?? [],
            level: 'recording',
            source: 'musicbrainz',
            sourceUrl,
            providerId: rel.artist.id,
          })
        }
        if (isSamplesMaterialRelation(rel)) {
          const link = sampleLinkFromRelation(rel)
          if (link) {
            const incoming = (rel.direction ?? '').toLowerCase() === 'backward'
            if (incoming) sampledIn.push(link)
            else samplesFrom.push(link)
          }
        }
      }

      try {
        await fillBlankSampleArtists([...samplesFrom, ...sampledIn])
      } catch (error) {
        throw attachPartial(error)
      }

      return facts()
    },
  }
}

export type MusicBrainzClient = ReturnType<typeof createMusicBrainzClient>
