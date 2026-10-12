/**
 * Extra MusicBrainz searches when this-run near-top hits have 0 sampled
 * recordings. Typical +1 (second artistname + unquoted title). Worst +3
 * (second query + work search + work browse, or ISRC instead of one of those).
 * Stop as soon as any new hit has samples. Do not raise TRACK_LEVEL_ANNOTATE_CAP.
 * Do not add work-rels to getRecording. No WhoSampled. No /work/ on getRecording.
 */
import {
  artistsMatch,
  destinationIsLive,
  durationDeltaMs,
  DURATION_SIDECAR_MS,
  NEAR_TOP_SCORE_SLACK,
  promoteVersionContradicts,
  recordingHasSampleMaterial,
  recordingIsLive,
  searchVersionFit,
  songTitle,
  titlesSimilar,
  type TrackLevelRecordingHit,
} from './match.ts'
import { secondArtistTitleQuery, type MbRecordingSearchHit } from './musicbrainz.ts'

export { secondArtistTitleQuery }
import { isRecordingOrReleaseSampleLink } from './research.ts'
import type { StoredPressing, StoredRecording } from './types.ts'
import { isPlayableOccurrence } from './lifecycle.ts'

export type SearchExtrasDest = {
  albumTitle?: string | null
  trackTitle: string
}

export type SearchExtrasClient = {
  searchRecordingsByArtistNameTitle(input: {
    artist: string
    title: string
  }): Promise<MbRecordingSearchHit[]>
  searchRecordingsByIsrc(isrc: string): Promise<MbRecordingSearchHit[]>
  searchWorksByArtistTitle(input: {
    artist: string
    title: string
  }): Promise<Array<{ mbid: string; title: string; score: number }>>
  browseRecordingsByWork(workMbid: string): Promise<MbRecordingSearchHit[]>
}

export function normalizeIsrc(value: string): string | null {
  const compact = value.replace(/[\s-]/g, '').toUpperCase()
  if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(compact)) return null
  return compact
}

export function uniqueWorkMbid(
  works: Array<{ mbid: string; score?: number }>
): string | null {
  const ids = works.map((work) => work.mbid.trim()).filter(Boolean)
  if (ids.length !== 1) return null
  return ids[0] ?? null
}

export function extraHitIsLive(hit: TrackLevelRecordingHit): boolean {
  return recordingIsLive({
    title: hit.title,
    disambiguation: hit.disambiguation,
    releaseTitles: hit.releaseTitles,
  })
}

export function liveStudioCompatible(
  dest: SearchExtrasDest,
  hit: TrackLevelRecordingHit
): boolean {
  const destLive = destinationIsLive({
    albumTitle: dest.albumTitle,
    trackTitle: dest.trackTitle,
  })
  const hitLive = extraHitIsLive(hit)
  if (destLive) return hitLive
  return !hitLive
}

export function filterExtraSearchHits(
  hits: TrackLevelRecordingHit[],
  discogs: { artist: string; title: string; durationMs: number | null },
  dest: SearchExtrasDest,
  options?: { requireKnownLength?: boolean }
): TrackLevelRecordingHit[] {
  const discogsSong = songTitle(discogs.title)
  const requireKnown = Boolean(options?.requireKnownLength)
  return hits.filter((hit) => {
    if (!artistsMatch(discogs.artist, hit.artist)) return false
    const titleOk =
      titlesSimilar(discogs.title, hit.title) ||
      Boolean(discogsSong && songTitle(hit.title) && discogsSong === songTitle(hit.title))
    if (!titleOk) return false
    if (searchVersionFit(discogs.title, hit.title) === 'wrong') return false
    if (promoteVersionContradicts(discogs.title, hit.title)) return false
    if (!liveStudioCompatible({ ...dest, trackTitle: dest.trackTitle || discogs.title }, hit)) {
      return false
    }
    if (requireKnown && (discogs.durationMs == null || hit.lengthMs == null)) return false
    const delta = durationDeltaMs(discogs.durationMs, hit.lengthMs)
    if (delta != null && delta > DURATION_SIDECAR_MS) return false
    return true
  })
}

export function filterWorkBrowseHits(
  hits: TrackLevelRecordingHit[],
  discogs: { artist: string; title: string; durationMs: number | null },
  dest: SearchExtrasDest
): TrackLevelRecordingHit[] {
  return filterExtraSearchHits(hits, discogs, dest, { requireKnownLength: true })
}

export function nearTopHits(
  hits: TrackLevelRecordingHit[],
  discogs: { artist: string; title: string; durationMs: number | null }
): TrackLevelRecordingHit[] {
  if (hits.length === 0) return []
  const top = Math.max(...hits.map((hit) => hit.score ?? 0))
  return hits.filter((hit) => {
    if (!artistsMatch(discogs.artist, hit.artist)) return false
    const discogsSong = songTitle(discogs.title)
    const titleOk =
      titlesSimilar(discogs.title, hit.title) ||
      Boolean(discogsSong && songTitle(hit.title) && discogsSong === songTitle(hit.title))
    if (!titleOk) return false
    return (hit.score ?? 0) >= top - NEAR_TOP_SCORE_SLACK
  })
}

export function nearTopHasSamples(
  hits: TrackLevelRecordingHit[],
  discogs: { artist: string; title: string; durationMs: number | null }
): boolean {
  return nearTopHits(hits, discogs).some((hit) => hit.hasSamples === true)
}

export function hitFromMbSearch(
  hit: MbRecordingSearchHit,
  extra = true
): TrackLevelRecordingHit {
  return {
    mbid: hit.mbid,
    title: hit.title,
    artist: hit.artist,
    lengthMs: hit.lengthMs,
    score: hit.score,
    disambiguation: hit.disambiguation,
    extra,
  }
}

export async function fetchSecondQueryHits(
  mb: SearchExtrasClient,
  discogs: { artist: string; title: string }
): Promise<TrackLevelRecordingHit[]> {
  const query = secondArtistTitleQuery(discogs.artist, discogs.title)
  if (!query) return []
  const hits = await mb.searchRecordingsByArtistNameTitle({
    artist: discogs.artist,
    title: discogs.title,
  })
  return hits.map((hit) => hitFromMbSearch(hit))
}

export async function fetchIsrcHits(
  mb: SearchExtrasClient,
  hits: TrackLevelRecordingHit[]
): Promise<TrackLevelRecordingHit[]> {
  const isrc = hits
    .flatMap((hit) => hit.isrcs ?? [])
    .map(normalizeIsrc)
    .find((code): code is string => Boolean(code))
  if (!isrc) return []
  const found = await mb.searchRecordingsByIsrc(isrc)
  return found.map((hit) => hitFromMbSearch(hit))
}

export async function fetchWorkBrowseHits(
  mb: SearchExtrasClient,
  discogs: { artist: string; title: string }
): Promise<TrackLevelRecordingHit[]> {
  const works = await mb.searchWorksByArtistTitle({
    artist: discogs.artist,
    title: discogs.title,
  })
  const workMbid = uniqueWorkMbid(works)
  if (!workMbid) return []
  const found = await mb.browseRecordingsByWork(workMbid)
  return found.map((hit) => hitFromMbSearch(hit))
}

export type SampleTotals = {
  links: number
  records: number
  sampleOf: number
  sampledBy: number
}

function countRecordingLinks(recording: StoredRecording | null | undefined): {
  sampleOf: number
  sampledBy: number
  links: number
} {
  if (!recording) return { sampleOf: 0, sampledBy: 0, links: 0 }
  const sampleOf = recording.samplesFrom.filter(isRecordingOrReleaseSampleLink).length
  const sampledBy = recording.sampledIn.filter(isRecordingOrReleaseSampleLink).length
  return { sampleOf, sampledBy, links: sampleOf + sampledBy }
}

export function countPressingMapLinks(pressing: StoredPressing): SampleTotals {
  let sampleOf = 0
  let sampledBy = 0
  for (const recording of Object.values(pressing.recordings)) {
    const counts = countRecordingLinks(recording)
    sampleOf += counts.sampleOf
    sampledBy += counts.sampledBy
  }
  const links = sampleOf + sampledBy
  return { links, records: links > 0 ? 1 : 0, sampleOf, sampledBy }
}

export function sumTotals(rows: SampleTotals[]): SampleTotals {
  const summed: SampleTotals = { links: 0, records: 0, sampleOf: 0, sampledBy: 0 }
  for (const row of rows) {
    summed.links += row.links
    summed.records += row.records
    summed.sampleOf += row.sampleOf
    summed.sampledBy += row.sampledBy
  }
  return summed
}

function recordingAsHit(recording: StoredRecording): TrackLevelRecordingHit {
  const extra = recording as StoredRecording & {
    disambiguation?: string
    releaseTitles?: string[]
  }
  return {
    mbid: recording.mbid,
    title: recording.title,
    artist: recording.artist,
    lengthMs: recording.lengthMs ?? null,
    score: 100,
    hasSamples: recordingHasSampleMaterial(recording),
    ...(extra.disambiguation ? { disambiguation: extra.disambiguation } : {}),
    ...(extra.releaseTitles?.length ? { releaseTitles: extra.releaseTitles } : {}),
  }
}

/** Preview-prefix projection: map recordings extras would keep on a dest track. */
export function extrasAdmissibleRecordings(
  pressing: StoredPressing,
  options?: { requireKnownLength?: boolean }
): StoredRecording[] {
  const albumTitle = pressing.facts.title
  const artist = pressing.facts.artist
  const kept = new Map<string, StoredRecording>()
  for (const track of pressing.tracks) {
    if (!isPlayableOccurrence(track)) continue
    const discogs = {
      artist: (track.artist ?? '').trim() || artist,
      title: track.title,
      durationMs: track.durationMs,
    }
    const dest = { albumTitle, trackTitle: track.title }
    for (const recording of Object.values(pressing.recordings)) {
      const hit = recordingAsHit(recording)
      const ok = options?.requireKnownLength
        ? filterWorkBrowseHits([hit], discogs, dest).length > 0
        : filterExtraSearchHits([hit], discogs, dest).length > 0
      if (ok) kept.set(recording.mbid, recording)
    }
  }
  return [...kept.values()]
}

export function projectExtrasTotals(
  pressings: StoredPressing[],
  options?: { requireKnownLength?: boolean }
): SampleTotals {
  return sumTotals(
    pressings.map((pressing) => {
      const kept = extrasAdmissibleRecordings(pressing, options)
      const sampleOf = kept.reduce(
        (sum, recording) => sum + countRecordingLinks(recording).sampleOf,
        0
      )
      const sampledBy = kept.reduce(
        (sum, recording) => sum + countRecordingLinks(recording).sampledBy,
        0
      )
      const links = sampleOf + sampledBy
      return { links, records: links > 0 ? 1 : 0, sampleOf, sampledBy }
    })
  )
}
