import {
  DiscogsRateLimitError,
  isDiscogsRateLimitError,
  type DiscogsCollection,
  type DiscogsRelease,
} from '../discogs.ts'
import {
  fetchDiscogsReleaseDetail,
  isPlayableDiscogsTrack,
  type DiscogsReleaseDetail,
} from './discogs-release.ts'
import { classifyReleaseMatch, matchDiscogsTrackToMb, parseDurationToMs } from './match.ts'
import {
  createMusicBrainzClient,
  musicbrainzRecordingUrl,
  musicbrainzReleaseUrl,
  type MusicBrainzClient,
} from './musicbrainz.ts'
import { isoFromMs, preservePressingOnFailure, SUCCESS_REFRESH_MS } from './preserve.ts'
import type { CrateStore } from './store.ts'
import {
  CRATE_SCHEMA_VERSION,
  type DurableErrorKind,
  type PressingFacts,
  type SourcedText,
  type StoredPressing,
  type StoredRecording,
  type TrackOccurrence,
} from './types.ts'

export const ENRICH_LOCK_SECONDS = 50
export const ENRICH_BATCH_DEFAULT = 2

export type EnrichDeps = {
  store: CrateStore
  now?: () => number
  mb?: MusicBrainzClient
  fetchDiscogs?: (releaseId: number) => Promise<DiscogsReleaseDetail>
}

function errorKind(error: unknown): DurableErrorKind {
  if (isDiscogsRateLimitError(error)) return 'rate_limit'
  if (error instanceof Error && 'kind' in error && error.kind === 'rate_limit') {
    return 'rate_limit'
  }
  return 'unavailable'
}

function errorMessage(error: unknown): string {
  if (isDiscogsRateLimitError(error)) return 'Too many requests'
  if (error instanceof Error) {
    if (error.message === 'MusicBrainz rate limited') return 'Too many requests'
    if (error.message === 'MusicBrainz unavailable') return 'Failed to fetch from MusicBrainz'
  }
  return 'Failed to enrich pressing'
}

export function sentencesFrom(raw: string | null | undefined, max = 4): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (cleaned.length < 24) return null
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 12)
  if (parts.length === 0) return null
  return parts.slice(0, max).join(' ')
}

export function sourcedDescription(
  discogsNotes: string | null,
  discogsUrl: string,
  mbAnnotation: string | null,
  mbUrl: string | null
): SourcedText | null {
  const discogsText = sentencesFrom(discogsNotes)
  if (discogsText) {
    return { text: discogsText, source: 'discogs', sourceUrl: discogsUrl }
  }
  const mbText = sentencesFrom(mbAnnotation)
  if (mbText && mbUrl) {
    return { text: mbText, source: 'musicbrainz', sourceUrl: mbUrl }
  }
  return null
}

export function factsFromDiscogsDetail(detail: DiscogsReleaseDetail): PressingFacts {
  return {
    releaseId: detail.id,
    title: detail.title,
    artist: detail.artist,
    label: detail.label,
    catno: detail.catno,
    format: detail.format,
    country: detail.country,
    released: detail.released ?? (detail.year ? String(detail.year) : null),
    year: detail.year,
    cover: detail.cover,
    thumbnail: detail.thumb || detail.cover,
    discogsUrl: detail.discogsUrl,
    barcode: detail.barcode,
  }
}

export function factsFromCollectionRelease(release: DiscogsRelease, releaseId: number): PressingFacts {
  return {
    releaseId,
    title: release.title,
    artist: release.artist,
    label: release.label || null,
    catno: release.catno || null,
    format: release.format || null,
    country: null,
    released: release.year ? String(release.year) : null,
    year: release.year || null,
    cover: release.cover,
    thumbnail: release.thumbnail || release.cover,
    discogsUrl: release.discogsUrl,
    barcode: null,
  }
}

export async function enrichPressing(
  releaseId: number,
  deps: EnrichDeps
): Promise<StoredPressing> {
  const nowMs = (deps.now ?? Date.now)()
  const previous = await deps.store.getPressing(releaseId)
  const mb = deps.mb ?? createMusicBrainzClient()
  const fetchDetail = deps.fetchDiscogs ?? ((id: number) => fetchDiscogsReleaseDetail(id))

  try {
    const detail = await fetchDetail(releaseId)
    const facts = factsFromDiscogsDetail(detail)
    const playable = detail.tracklist.filter(isPlayableDiscogsTrack)

    const candidates: Array<{ mbid: string; via: 'discogs_url' | 'barcode' | 'catno' }> = []
    for (const mbid of await mb.lookupDiscogsReleaseUrl(facts.discogsUrl)) {
      candidates.push({ mbid, via: 'discogs_url' })
    }
    if (facts.barcode) {
      for (const mbid of await mb.searchReleaseByBarcode(facts.barcode)) {
        candidates.push({ mbid, via: 'barcode' })
      }
    }
    if (facts.catno) {
      for (const mbid of await mb.searchReleaseByCatno(facts.catno, facts.artist)) {
        candidates.push({ mbid, via: 'catno' })
      }
    }

    const releaseMatch = classifyReleaseMatch(candidates)
    const mbReleaseDoc =
      releaseMatch.mbid && releaseMatch.matchStatus === 'matched'
        ? await mb.getRelease(releaseMatch.mbid)
        : null

    const tracks: TrackOccurrence[] = playable.map((track, index) => {
      const durationMs = parseDurationToMs(track.duration)
      const discogs = {
        position: track.position,
        title: track.title,
        durationMs,
        index,
      }
      if (!mbReleaseDoc || releaseMatch.matchStatus !== 'matched') {
        const reason =
          releaseMatch.matchStatus === 'ambiguous'
            ? 'pressing match is ambiguous; tracks not auto-accepted'
            : 'no matched recording yet'
        return {
          position: track.position,
          title: track.title,
          duration: track.duration.trim() ? track.duration.trim() : null,
          durationMs,
          index,
          recording: {
            matchStatus: releaseMatch.matchStatus === 'unmatched' ? 'unmatched' : 'ambiguous',
            confidence: 0,
            reason,
            mbid: null,
            recordingUrl: null,
          },
        }
      }
      const matched = matchDiscogsTrackToMb({
        discogs,
        mbTracks: mbReleaseDoc.tracks,
      })
      return {
        position: track.position,
        title: track.title,
        duration: track.duration.trim() ? track.duration.trim() : null,
        durationMs,
        index,
        recording: {
          matchStatus: matched.matchStatus,
          confidence: matched.confidence,
          reason: matched.reason,
          mbid: matched.recordingId,
          recordingUrl: matched.recordingId
            ? musicbrainzRecordingUrl(matched.recordingId)
            : null,
        },
      }
    })

    if (
      releaseMatch.matchStatus === 'unmatched' &&
      playable.some((track) => /vocal|instrumental/i.test(track.title))
    ) {
      for (const track of tracks) {
        if (track.recording.matchStatus === 'unmatched') {
          track.recording.matchStatus = 'ambiguous'
          track.recording.reason =
            'no musicbrainz release for this pressing; vocal/instrumental recordings share this title'
        }
      }
    }

    const recordings: Record<string, StoredRecording> = {}
    const acceptedMbids = [
      ...new Set(
        tracks
          .map((track) => track.recording.mbid)
          .filter((id): id is string => Boolean(id) && typeof id === 'string')
      ),
    ]
    for (const mbid of acceptedMbids) {
      const previousRecording = previous?.recordings[mbid] ?? (await deps.store.getRecording(mbid))
      try {
        const doc = await mb.getRecording(mbid)
        if (!doc) continue
        const recording: StoredRecording = {
          mbid: doc.mbid,
          title: doc.title,
          artist: doc.artist,
          credits: doc.credits,
          samplesFrom: doc.samplesFrom,
          sampledIn: doc.sampledIn,
          provenance: {
            sourceUrls: [musicbrainzRecordingUrl(doc.mbid)],
            matchStatus: 'matched',
            confidence: 0.9,
            reason: 'musicbrainz recording lookup',
            checkedAt: isoFromMs(nowMs),
            refreshAfter: isoFromMs(nowMs + SUCCESS_REFRESH_MS),
            lastError: null,
          },
        }
        recordings[mbid] = recording
        await deps.store.setRecording(recording)
      } catch (error) {
        if (previousRecording) recordings[mbid] = previousRecording
        else throw error
      }
    }

    const mbUrl = releaseMatch.mbid ? musicbrainzReleaseUrl(releaseMatch.mbid) : null
    const sourceUrls = [facts.discogsUrl]
    if (mbUrl) sourceUrls.push(mbUrl)

    const pressing: StoredPressing = {
      schemaVersion: CRATE_SCHEMA_VERSION,
      releaseId,
      entryInstanceIds: previous?.entryInstanceIds ?? [],
      facts,
      description: sourcedDescription(
        detail.notes,
        facts.discogsUrl,
        mbReleaseDoc?.annotation ?? null,
        mbUrl
      ),
      tracks,
      mbRelease: {
        mbid: releaseMatch.mbid,
        url: mbUrl,
        matchStatus: releaseMatch.matchStatus,
        confidence: releaseMatch.confidence,
        reason: releaseMatch.reason,
      },
      recordings,
      provenance: {
        sourceUrls,
        matchStatus: releaseMatch.matchStatus,
        confidence: releaseMatch.confidence,
        reason: releaseMatch.reason,
        checkedAt: isoFromMs(nowMs),
        refreshAfter: isoFromMs(nowMs + SUCCESS_REFRESH_MS),
        lastError: null,
      },
    }
    await deps.store.setPressing(pressing)
    return pressing
  } catch (error) {
    const preserved = preservePressingOnFailure(
      previous,
      nowMs,
      errorKind(error),
      errorMessage(error)
    )
    if (preserved) {
      await deps.store.setPressing(preserved)
      return preserved
    }
    throw error
  }
}

export async function processEnrichmentQueue(
  deps: EnrichDeps,
  limit = ENRICH_BATCH_DEFAULT
): Promise<{ processed: number[]; skipped: boolean }> {
  const locked = await deps.store.acquireEnrichLock(ENRICH_LOCK_SECONDS)
  if (!locked) return { processed: [], skipped: true }
  const processed: number[] = []
  try {
    const ids = await deps.store.dequeue(limit)
    for (const releaseId of ids) {
      try {
        await enrichPressing(releaseId, deps)
        processed.push(releaseId)
      } catch {
        await deps.store.enqueue([releaseId])
      }
    }
  } finally {
    try {
      await deps.store.releaseEnrichLock()
    } catch {
      // lock ttl still expires
    }
  }
  return { processed, skipped: false }
}

export function releaseIdsFromCollection(collection: DiscogsCollection): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const release of collection.releases) {
    const id =
      'releaseId' in release && typeof release.releaseId === 'number'
        ? release.releaseId
        : 0
    if (id > 0 && !seen.has(id)) {
      ids.push(id)
      seen.add(id)
    }
  }
  return ids
}

export { DiscogsRateLimitError }
