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
  releases?: Array<{ id?: string; title?: string }>
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

export function createMusicBrainzClient(options: MbClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? defaultSleep
  const minInterval = options.minIntervalMs ?? MUSICBRAINZ_MIN_INTERVAL_MS
  let lastAt = 0

  async function getJson<T>(url: string): Promise<T> {
    const wait = lastAt + minInterval - now()
    if (wait > 0) await sleep(wait)
    lastAt = now()
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': MUSICBRAINZ_USER_AGENT,
        Accept: 'application/json',
      },
    })
    if (response.status === 404) {
      return { error: 'Not Found' } as T
    }
    if (response.status === 503 || response.status === 429) {
      const error = new Error('MusicBrainz rate limited')
      ;(error as Error & { kind: 'rate_limit' }).kind = 'rate_limit'
      throw error
    }
    if (!response.ok) {
      const error = new Error('MusicBrainz unavailable')
      ;(error as Error & { kind: 'unavailable' }).kind = 'unavailable'
      throw error
    }
    return (await response.json()) as T
  }

  return {
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

    async searchReleaseByBarcode(barcode: string): Promise<string[]> {
      const cleaned = barcode.replace(/\s+/g, '')
      if (!cleaned) return []
      const params = new URLSearchParams({
        query: `barcode:${cleaned}`,
        fmt: 'json',
      })
      const data = await getJson<MbReleaseSearch>(`${MUSICBRAINZ_API}/release?${params.toString()}`)
      return uniqueIds(data.releases)
    },

    async searchReleaseByCatno(catno: string, artist: string): Promise<string[]> {
      const trimmed = catno.trim()
      if (!trimmed) return []
      const query = artist.trim()
        ? `catno:"${trimmed}" AND artist:"${artist.trim()}"`
        : `catno:"${trimmed}"`
      const params = new URLSearchParams({ query, fmt: 'json' })
      const data = await getJson<MbReleaseSearch>(`${MUSICBRAINZ_API}/release?${params.toString()}`)
      return uniqueIds(data.releases)
    },

    async getRelease(mbid: string): Promise<{
      id: string
      title: string
      annotation: string | null
      date: string | null
      country: string | null
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
        inc: 'recordings+artist-credits+labels+url-rels+annotation',
        fmt: 'json',
      })
      const data = await getJson<{
        error?: string
        id?: string
        title?: string
        annotation?: string
        date?: string
        country?: string
        media?: Array<{
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
        for (const track of medium.tracks ?? []) {
          const recordingId = track.recording?.id
          if (!recordingId) continue
          tracks.push({
            index,
            number: track.number ?? '',
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
        annotation: data.annotation?.trim() ? data.annotation.trim() : null,
        date: data.date ?? null,
        country: data.country ?? null,
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

function uniqueIds(releases: Array<{ id?: string }> | undefined): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const release of releases ?? []) {
    if (release.id && !seen.has(release.id)) {
      ids.push(release.id)
      seen.add(release.id)
    }
  }
  return ids
}

export type MusicBrainzClient = ReturnType<typeof createMusicBrainzClient>
