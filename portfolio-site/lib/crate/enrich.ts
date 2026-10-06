import {
  DiscogsRateLimitError,
  isDiscogsRateLimitError,
  isDiscogsTerminalClientError,
  type DiscogsCollection,
  type DiscogsRelease,
} from '../discogs.ts'
import {
  fetchDiscogsReleaseDetail,
  isPlayableDiscogsTrack,
  type DiscogsReleaseDetail,
} from './discogs-release.ts'
import {
  classifyReleaseMatch,
  matchDiscogsTrackToMb,
  parseDurationToMs,
  type ReleaseMatchCandidate,
} from './match.ts'
import {
  createMusicBrainzClient,
  isMusicBrainzRateLimitError,
  musicbrainzRecordingUrl,
  musicbrainzReleaseUrl,
  type MbSearchHit,
  type MusicBrainzClient,
} from './musicbrainz.ts'
import {
  isoFromMs,
  keepPriorMatch,
  preservePressingOnFailure,
  SUCCESS_REFRESH_MS,
} from './preserve.ts'
import {
  INFLIGHT_TTL_SECONDS,
  randomLockToken,
  type CrateStore,
} from './store.ts'
import { collectionReleaseId } from './sync.ts'
import {
  CRATE_SCHEMA_VERSION,
  type DurableErrorKind,
  type PressingFacts,
  type SourcedText,
  type StoredPressing,
  type StoredRecording,
  type TrackOccurrence,
} from './types.ts'

export const ENRICH_LOCK_SECONDS = 60
export const ENRICH_BATCH_DEFAULT = 1
export const ENRICH_BUDGET_MS = 45_000
export const ENRICH_TAKE_FLOOR_MS = 8_000

export type EnrichDeps = {
  store: CrateStore
  now?: () => number
  mb?: MusicBrainzClient
  fetchDiscogs?: (releaseId: number) => Promise<DiscogsReleaseDetail>
  failRefresh?: (releaseId: number) => boolean
  collection?: DiscogsCollection | null
  budgetMs?: number
  takeFloorMs?: number
  lockToken?: string
  lockTtlSeconds?: number
}

function errorKind(error: unknown): DurableErrorKind {
  if (isDiscogsTerminalClientError(error)) return 'not_found'
  if (isDiscogsRateLimitError(error) || isMusicBrainzRateLimitError(error)) {
    return 'rate_limit'
  }
  if (error instanceof Error && 'kind' in error && error.kind === 'rate_limit') {
    return 'rate_limit'
  }
  return 'unavailable'
}

function errorMessage(error: unknown): string {
  if (isDiscogsTerminalClientError(error)) return 'Discogs release not found'
  if (isDiscogsRateLimitError(error) || isMusicBrainzRateLimitError(error)) {
    return 'Too many requests'
  }
  if (error instanceof Error) {
    if (error.message === 'MusicBrainz rate limited') return 'Too many requests'
    if (error.message === 'MusicBrainz unavailable') return 'Failed to fetch from MusicBrainz'
  }
  return 'Failed to enrich pressing'
}

function retryAtMs(error: unknown, nowMs: number, refreshAfter: string): number {
  if (isMusicBrainzRateLimitError(error)) {
    return Math.max(nowMs + error.retryAfterMs, Date.parse(refreshAfter) || nowMs)
  }
  if (isDiscogsRateLimitError(error)) {
    return Math.max(nowMs + error.retryAfter * 1000, Date.parse(refreshAfter) || nowMs)
  }
  const parsed = Date.parse(refreshAfter)
  return Number.isFinite(parsed) ? parsed : nowMs + 60 * 60 * 1000
}

export function failRefreshFromEnv(
  releaseId: number,
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = env.CRATE_ENRICH_FAIL_IDS?.trim()
  if (!raw) return false
  if (raw === '*') return true
  return raw.split(',').some((part) => part.trim() === String(releaseId))
}

export function sentencesFrom(raw: string | null | undefined, max = 4): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (cleaned.length < 24) return null
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 12)
  const kept = parts.filter((part) => !isMatrixDump(part))
  if (kept.length === 0) return null
  return kept.slice(0, max).join(' ')
}

function isMatrixDump(sentence: string): boolean {
  return /matrix|runout|etched|inscribed|variant \d|catalog number transcript|illegible/i.test(
    sentence
  )
}

export function sourcedDescription(
  discogsNotes: string | null,
  discogsUrl: string
): SourcedText | null {
  const discogsText = sentencesFrom(discogsNotes)
  if (!discogsText) return null
  return { text: discogsText, source: 'discogs', sourceUrl: discogsUrl }
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

function hitsToCandidates(hits: MbSearchHit[], via: ReleaseMatchCandidate['via']): ReleaseMatchCandidate[] {
  return hits.map((hit) => ({
    mbid: hit.mbid,
    via,
    score: hit.score,
    title: hit.title,
    trackCount: hit.trackCount,
  }))
}

function instanceIdsFor(
  releaseId: number,
  collection: DiscogsCollection | null | undefined
): number[] {
  if (!collection) return []
  const ids: number[] = []
  for (const release of collection.releases) {
    if (collectionReleaseId(release) !== releaseId) continue
    if (release.instanceId > 0) ids.push(release.instanceId)
  }
  return ids
}

export async function enrichPressing(
  releaseId: number,
  deps: EnrichDeps
): Promise<StoredPressing> {
  const nowMs = (deps.now ?? Date.now)()
  const previous = await deps.store.getPressing(releaseId)
  const mb = deps.mb ?? createMusicBrainzClient()
  const fetchDetail = deps.fetchDiscogs ?? ((id: number) => fetchDiscogsReleaseDetail(id))
  const shouldFail = deps.failRefresh ?? ((id: number) => failRefreshFromEnv(id))
  const entryInstanceIds =
    instanceIdsFor(releaseId, deps.collection).length > 0
      ? instanceIdsFor(releaseId, deps.collection)
      : previous?.entryInstanceIds ?? []

  try {
    if (shouldFail(releaseId)) {
      throw new Error('Failed to enrich pressing')
    }
    const detail = await fetchDetail(releaseId)
    const facts = factsFromDiscogsDetail(detail)
    const playable = detail.tracklist.filter(isPlayableDiscogsTrack)

    const candidates: ReleaseMatchCandidate[] = []
    const urlIds = await mb.lookupDiscogsReleaseUrl(facts.discogsUrl)
    for (const mbid of urlIds) {
      candidates.push({ mbid, via: 'discogs_url' })
    }
    const uniqueUrl = urlIds.length === 1
    if (!uniqueUrl) {
      if (facts.barcode) {
        candidates.push(...hitsToCandidates(await mb.searchReleaseByBarcode(facts.barcode), 'barcode'))
      }
      if (facts.catno) {
        candidates.push(
          ...hitsToCandidates(await mb.searchReleaseByCatno(facts.catno, facts.artist), 'catno')
        )
      }
      if (urlIds.length === 0) {
        candidates.push(
          ...hitsToCandidates(
            await mb.searchReleaseByArtistTitle({
              artist: facts.artist,
              title: facts.title,
              year: facts.year,
              label: facts.label,
            }),
            'artist_title'
          )
        )
      }
    }

    const releaseMatch = classifyReleaseMatch(candidates, {
      title: facts.title,
      trackCount: playable.length,
    })
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
        if (isMusicBrainzRateLimitError(error)) throw error
        if (previousRecording) recordings[mbid] = previousRecording
        else throw error
      }
    }

    const mbUrl = releaseMatch.mbid ? musicbrainzReleaseUrl(releaseMatch.mbid) : null
    const sourceUrls = [facts.discogsUrl]
    if (mbUrl) sourceUrls.push(mbUrl)

    const nextPressing: StoredPressing = {
      schemaVersion: CRATE_SCHEMA_VERSION,
      releaseId,
      entryInstanceIds,
      facts,
      description: sourcedDescription(detail.notes, facts.discogsUrl),
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
    const pressing = keepPriorMatch(previous, nextPressing)
    await deps.store.setPressing(pressing)
    return pressing
  } catch (error) {
    const preserved = preservePressingOnFailure(
      previous,
      nowMs,
      errorKind(error),
      errorMessage(error),
      {
        terminal: isDiscogsTerminalClientError(error),
        releaseId,
        entryInstanceIds,
      }
    )
    await deps.store.setPressing(preserved)
    if (isMusicBrainzRateLimitError(error) || isDiscogsRateLimitError(error)) {
      const timed = {
        ...preserved,
        provenance: {
          ...preserved.provenance,
          refreshAfter: isoFromMs(retryAtMs(error, nowMs, preserved.provenance.refreshAfter)),
        },
      }
      await deps.store.setPressing(timed)
      return timed
    }
    return preserved
  }
}

export type EnrichQueueResult = {
  processed: number[]
  skipped: boolean
  stoppedOnRateLimit: boolean
}

export async function processEnrichmentQueue(
  deps: EnrichDeps,
  limit?: number
): Promise<EnrichQueueResult> {
  const token = deps.lockToken ?? randomLockToken()
  const lockTtl = deps.lockTtlSeconds ?? ENRICH_LOCK_SECONDS
  const locked = await deps.store.acquireEnrichLock(lockTtl, token)
  if (!locked) return { processed: [], skipped: true, stoppedOnRateLimit: false }

  const now = deps.now ?? Date.now
  const started = now()
  const budgetMs = deps.budgetMs ?? ENRICH_BUDGET_MS
  const takeFloorMs = deps.takeFloorMs ?? ENRICH_TAKE_FLOOR_MS
  const cap = limit ?? Number.POSITIVE_INFINITY
  const mb = deps.mb ?? createMusicBrainzClient({ now: deps.now })
  const processed: number[] = []
  let stoppedOnRateLimit = false

  try {
    while (processed.length < cap) {
      if (now() - started >= budgetMs - takeFloorMs) break
      const ids = await deps.store.takeDue(1, now(), INFLIGHT_TTL_SECONDS)
      const releaseId = ids[0]
      if (releaseId == null) break
      try {
        const pressing = await enrichPressing(releaseId, { ...deps, mb })
        const kind = pressing.provenance.lastError?.kind
        if (kind === 'not_found') {
          await deps.store.drop(releaseId)
          processed.push(releaseId)
        } else if (kind) {
          const retryAt = Date.parse(pressing.provenance.refreshAfter)
          await deps.store.nack(
            releaseId,
            Number.isFinite(retryAt) ? retryAt : now() + 60 * 60 * 1000
          )
          processed.push(releaseId)
          if (kind === 'rate_limit') {
            stoppedOnRateLimit = true
            break
          }
        } else {
          await deps.store.ack(releaseId)
          processed.push(releaseId)
        }
      } catch (error) {
        const retryAt = now() + 60 * 60 * 1000
        await deps.store.nack(releaseId, retryAt)
        processed.push(releaseId)
        if (isMusicBrainzRateLimitError(error) || isDiscogsRateLimitError(error)) {
          stoppedOnRateLimit = true
          break
        }
      }
    }
  } finally {
    try {
      await deps.store.releaseEnrichLock(token)
    } catch {
      // lock ttl still expires
    }
  }
  return { processed, skipped: false, stoppedOnRateLimit }
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
