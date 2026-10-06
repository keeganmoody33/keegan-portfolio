import {
  MUSICBRAINZ_MIN_INTERVAL_MS,
  MUSICBRAINZ_USER_AGENT,
  type Credit,
  type SampleLink,
} from './types.ts'

export const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2'

export type MbFetch = (input: string, init?: RequestInit) => Promise<Response>

export type MbClientOptions = {
  fetchImpl?: MbFetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  minIntervalMs?: number
}

export type MbSearchHit = {
  mbid: string
  score: number
  title: string
  trackCount: number | null
}

export class MusicBrainzRateLimitError extends Error {
  readonly kind = 'rate_limit' as const
  readonly retryAfterMs: number

  constructor(retryAfterMs = 60_000) {
    super('MusicBrainz rate limited')
    this.name = 'MusicBrainzRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
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

type MbRelation = {
  type?: string
  direction?: string
  'target-type'?: string
  attributes?: string[]
  artist?: { id?: string; name?: string }
  recording?: {
    id?: string
    title?: string
    'artist-credit'?: Array<{ name?: string; artist?: { name?: string } }>
  }
  release?: { id?: string; title?: string }
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
  'artist-credit'?: Array<{ name?: string; artist?: { name?: string }; joinphrase?: string }>
  relations?: MbRelation[]
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function artistCreditName(
  credit: Array<{ name?: string; artist?: { name?: string }; joinphrase?: string }> | undefined
): string {
  if (!credit || credit.length === 0) return ''
  return credit
    .map((part) => `${part.name ?? part.artist?.name ?? ''}${part.joinphrase ?? ''}`)
    .join('')
}

export function musicbrainzRecordingUrl(mbid: string): string {
  return `https://musicbrainz.org/recording/${mbid}`
}

export function musicbrainzReleaseUrl(mbid: string): string {
  return `https://musicbrainz.org/release/${mbid}`
}

export function escapeLucene(value: string): string {
  return value.replace(/[+\-!(){}[\]^"~*?:\\/]/g, '\\$&')
}

export function stripDiscogsArtistSuffix(name: string): string {
  return name.replace(/\s+\(\d+\)$/u, '').trim()
}

export function readRetryAfterMs(response: Response, fallbackMs = 60_000): number {
  const raw = response.headers.get('Retry-After')
  if (!raw) return fallbackMs
  const seconds = Number.parseInt(raw, 10)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(raw)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return fallbackMs
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
  let lastAt = 0
  let requestCount = 0

  async function getJson<T>(url: string): Promise<T> {
    const wait = lastAt + minInterval - now()
    if (wait > 0) await sleep(wait)
    lastAt = now()
    requestCount += 1
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': MUSICBRAINZ_USER_AGENT,
        Accept: 'application/json',
      },
    })
    if (response.status === 404) {
      return { error: 'Not Found' } as T
    }
    if (response.status === 401 || response.status === 403) {
      throw new MusicBrainzAuthError(response.status)
    }
    if (response.status === 503 || response.status === 429) {
      throw new MusicBrainzRateLimitError(readRetryAfterMs(response))
    }
    if (!response.ok) {
      const error = new Error('MusicBrainz unavailable')
      ;(error as Error & { kind: 'unavailable' }).kind = 'unavailable'
      throw error
    }
    return (await response.json()) as T
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

    async getRecording(mbid: string): Promise<{
      mbid: string
      title: string
      artist: string
      credits: Credit[]
      samplesFrom: SampleLink[]
      sampledIn: SampleLink[]
    } | null> {
      const params = new URLSearchParams({
        inc: 'artist-credits+artist-rels+recording-rels+work-rels+url-rels',
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
        if (type === 'samples material' || type.includes('sample')) {
          const recording = rel.recording
          if (!recording?.id) continue
          const link: SampleLink = {
            title: recording.title ?? '',
            artist: artistCreditName(recording['artist-credit']),
            mbid: recording.id,
            sourceUrl: musicbrainzRecordingUrl(recording.id),
            source: 'musicbrainz',
            providerId: recording.id,
          }
          const incoming = (rel.direction ?? '').toLowerCase() === 'backward'
          if (incoming) sampledIn.push(link)
          else samplesFrom.push(link)
        }
      }

      return {
        mbid: data.id,
        title: data.title ?? '',
        artist: artistCreditName(data['artist-credit']),
        credits,
        samplesFrom,
        sampledIn,
      }
    },
  }
}

export type MusicBrainzClient = ReturnType<typeof createMusicBrainzClient>
