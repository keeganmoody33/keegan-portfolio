import {
  DiscogsRateLimitError,
  isDiscogsAuthError,
  isDiscogsRateLimitError,
  isDiscogsTerminalClientError,
  type DiscogsCollection,
  type DiscogsRelease,
} from '../discogs.ts'
import {
  fetchDiscogsReleaseDetail,
  type DiscogsReleaseDetail,
} from './discogs-release.ts'
import {
  coverageOf,
  defaultLifecycles,
  hydratePressing,
  identityChanged,
  isPlayableOccurrence,
  researchIsFresh,
  trackIdentityKey,
  touchAttempt,
  touchVerified,
} from './lifecycle.ts'
import {
  classifyReleaseMatch,
  matchDiscogsTrackToMb,
  parseDurationToMs,
  type ReleaseMatchCandidate,
} from './match.ts'
import {
  createMusicBrainzClient,
  isMusicBrainzAuthError,
  isMusicBrainzRateLimitError,
  musicbrainzRecordingUrl,
  musicbrainzReleaseUrl,
  type MbSearchHit,
  type MusicBrainzClient,
} from './musicbrainz.ts'
import {
  AUTH_RETRY_MS,
  hasPriorVerifiedRecord,
  isoFromMs,
  keepPriorMatch,
  preservePressingOnFailure,
  storedPressingHasVisitorFacts,
  withClearedDeadlineStops,
  SUCCESS_REFRESH_MS,
} from './preserve.ts'
import { fixturePressing } from './read.ts'
import { resolveDescription } from './description.ts'
import {
  INFLIGHT_TTL_SECONDS,
  DRAFT_TTL_SECONDS,
  randomLockToken,
  type CrateStore,
} from './store.ts'
import { collectionReleaseId } from './sync.ts'
import {
  factsFromRecordings,
  mergeResearchFacts,
  researchFactsFromDiscogs,
} from './research.ts'
import {
  isWikidataTemporaryError,
  lookupWikidataReleaseFacts,
  wikidataClientFor,
  type WikidataClient,
  type WikidataClientOptions,
  type WikidataLookupInput,
  type WikidataLookupResult,
} from './wikidata.ts'
import {
  CRATE_SCHEMA_VERSION,
  type DeadLetter,
  type DurableErrorKind,
  type FetchState,
  type LifecycleName,
  type PressingFacts,
  type ProvenanceError,
  type ResearchFact,
  type SourcedText,
  type StoredPressing,
  type StoredRecording,
  type TrackOccurrence,
} from './types.ts'

export { sentencesFrom } from './description.ts'

export const ENRICH_LOCK_SECONDS = 90
export const ENRICH_BATCH_DEFAULT = 1
export const ENRICH_BUDGET_MS = 45_000
export const ENRICH_TAKE_FLOOR_MS = 8_000
export const WORKER_MAX_DURATION_MS = 60_000
export const WORKER_DEADLINE_MARGIN_MS = 8_000
export const DEADLINE_STOP_LIMIT = 3
export const DEADLINE_BACKOFF_MS = ENRICH_TAKE_FLOOR_MS

export function workerDeadlineMs(nowMs = Date.now()): number {
  return nowMs + WORKER_MAX_DURATION_MS - WORKER_DEADLINE_MARGIN_MS
}

export function remainingBudgetMs(deadlineMs: number, nowMs: number): number {
  return Math.max(0, deadlineMs - nowMs)
}

export function remainingBelowTakeFloor(remainingMs: number, takeFloorMs: number): boolean {
  if (remainingMs <= 0) return true
  return remainingMs < takeFloorMs
}

export function shouldReuseDraft(
  draft: StoredPressing | null,
  committed: StoredPressing | null,
  nowMs: number,
  forceRefresh = false
): boolean {
  if (forceRefresh || !draft || !storedPressingHasVisitorFacts(draft)) return false
  const draftAt = Date.parse(draft.provenance.lastAttemptAt ?? draft.provenance.checkedAt)
  if (!Number.isFinite(draftAt)) return false
  if (nowMs - draftAt > DRAFT_TTL_SECONDS * 1000) return false
  if (committed) {
    const committedAt = Date.parse(
      committed.provenance.lastAttemptAt ?? committed.provenance.checkedAt
    )
    if (Number.isFinite(committedAt) && draftAt <= committedAt) return false
  }
  return true
}

export function deadlineBackoffMs(stopCount: number): number {
  const n = Math.max(1, stopCount)
  return Math.min(DEADLINE_BACKOFF_MS * 2 ** (n - 1), 60_000)
}

export async function applyDeadlineStop(
  store: CrateStore,
  releaseId: number,
  nowMs: number
): Promise<{ tooSlow: boolean; stops: number; retryAtMs: number }> {
  const draft = await store.getDraftPressing(releaseId)
  const live = draft ?? (await store.getPressing(releaseId))
  const stops = (live?.checkpoint?.deadlineStops ?? 0) + 1
  const retryAtMs = nowMs + deadlineBackoffMs(stops)
  if (stops >= DEADLINE_STOP_LIMIT) {
    await store.markUnresolved({
      releaseId,
      kind: 'too_slow',
      message: 'too slow',
      attempts: 0,
      at: isoFromMs(nowMs),
      stage: 'queue',
    })
    await store.drop(releaseId)
    return { tooSlow: true, stops, retryAtMs }
  }
  if (live) {
    await store.setDraftPressing(
      hydratePressing({
        ...live,
        checkpoint: {
          stage: live.checkpoint?.stage ?? 'pressing',
          researchCursor: live.checkpoint?.researchCursor ?? 0,
          deadlineStops: stops,
        },
      })
    )
  }
  await store.nack(releaseId, retryAtMs)
  return { tooSlow: false, stops, retryAtMs }
}

export class WorkerDeadlineError extends Error {
  readonly kind = 'deadline' as const

  constructor() {
    super('worker deadline')
    this.name = 'WorkerDeadlineError'
  }
}

export function isWorkerDeadlineError(error: unknown): error is WorkerDeadlineError {
  return error instanceof WorkerDeadlineError
}

function assertWithinWorkerDeadline(deps: EnrichDeps): void {
  if (deps.deadlineMs == null) return
  const nowMs = (deps.now ?? Date.now)()
  if (remainingBudgetMs(deps.deadlineMs, nowMs) <= 0) {
    throw new WorkerDeadlineError()
  }
}

export function lastErrorNeedsRematch(previous: StoredPressing | null): boolean {
  const kind = previous?.provenance.lastError?.kind
  return kind === 'exhausted' || kind === 'not_found' || kind === 'too_slow'
}

export function shouldSkipMatch(
  previous: StoredPressing | null,
  identityShifted: boolean,
  forceRefresh = false
): boolean {
  if (!previous || identityShifted || forceRefresh) return false
  if (lastErrorNeedsRematch(previous)) return false
  return previous.mbRelease.matchStatus !== 'pending'
}

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
  inflightTtlSeconds?: number
  deadlineMs?: number
  forceRefresh?: boolean
  fetchWikidata?: (input: WikidataLookupInput, fetchedAt: string) => Promise<ResearchFact[]>
  wikidata?: WikidataClientOptions
  wikidataClient?: WikidataClient
}

function errorKind(error: unknown): DurableErrorKind {
  if (isDiscogsAuthError(error) || isMusicBrainzAuthError(error)) return 'auth'
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
  if (isDiscogsAuthError(error) || isMusicBrainzAuthError(error)) {
    return 'authentication failed'
  }
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

function stageFromError(error: unknown, fallback: LifecycleName): LifecycleName {
  if (isDiscogsAuthError(error) || isDiscogsRateLimitError(error) || isDiscogsTerminalClientError(error)) {
    return 'pressing'
  }
  if (isMusicBrainzAuthError(error) || isMusicBrainzRateLimitError(error)) {
    return fallback
  }
  return fallback
}

export function failRefreshFromEnv(
  releaseId: number,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.VERCEL_ENV === 'production') return false
  if (env.NODE_TEST_CONTEXT || env.NODE_ENV === 'test') return false
  const raw = env.CRATE_ENRICH_FAIL_IDS?.trim()
  if (!raw || raw === '*') return false
  return raw.split(',').some((part) => part.trim() === String(releaseId))
}

export function sourcedDescription(
  discogsNotes: string | null,
  discogsUrl: string,
  options: { previous?: SourcedText | null; releaseId?: number } = {}
): SourcedText | null {
  return resolveDescription({
    notes: discogsNotes,
    url: discogsUrl,
    previous: options.previous,
    releaseId: options.releaseId,
  })
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
    masterId: detail.masterId ?? null,
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
    masterId: null,
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

function emptyRecordingRef(reason: string): TrackOccurrence['recording'] {
  return {
    matchStatus: 'pending',
    confidence: 0,
    reason,
    mbid: null,
    recordingUrl: null,
  }
}

function priorWikidataFacts(previous: StoredPressing | null): ResearchFact[] {
  return (previous?.researchFacts ?? []).filter((fact) => fact.source === 'wikidata')
}

function wikidataLookupInput(
  releaseId: number,
  facts: PressingFacts,
  mbRelease: StoredPressing['mbRelease']
): WikidataLookupInput {
  return {
    discogsReleaseId: releaseId,
    masterId: facts.masterId ?? null,
    catalogId: facts.catno,
    mbReleaseGroupId: mbRelease.releaseGroupMbid ?? null,
  }
}

async function wikidataFactsFor(
  input: WikidataLookupInput,
  fetchedAt: string,
  deps: EnrichDeps
): Promise<WikidataLookupResult> {
  if (deps.fetchWikidata) {
    try {
      const facts = await deps.fetchWikidata(input, fetchedAt)
      return {
        status: 'ok',
        facts,
        identity: {
          status: facts.length > 0 ? 'ok' : 'empty',
          itemQid: null,
          matchProp: null,
          itemQids: [],
        },
      }
    } catch (error) {
      if (isWikidataTemporaryError(error)) {
        return { status: 'temporary', error }
      }
      throw error
    }
  }
  if (process.env.NODE_TEST_CONTEXT) {
    return {
      status: 'empty',
      facts: [],
      identity: { status: 'empty', itemQid: null, matchProp: null, itemQids: [] },
    }
  }
  if (deps.wikidataClient) {
    return deps.wikidataClient.lookupRelease(input, fetchedAt)
  }
  return lookupWikidataReleaseFacts(input, fetchedAt, deps.wikidata)
}

export function occurrencesFromDetail(detail: DiscogsReleaseDetail): TrackOccurrence[] {
  return detail.tracklist.map((track, index) => {
    const durationMs = parseDurationToMs(track.duration)
    const type_ = track.type_ || 'track'
    const shell: TrackOccurrence = {
      position: track.position,
      title: track.title,
      duration: track.duration.trim() ? track.duration.trim() : null,
      durationMs,
      index,
      type_,
      identityKey: trackIdentityKey({
        position: track.position,
        title: track.title,
        durationMs,
        type_,
      }),
      recording: emptyRecordingRef(isPlayableOccurrence({
        position: track.position,
        title: track.title,
        duration: track.duration.trim() ? track.duration.trim() : null,
        durationMs,
        index,
        type_,
        recording: emptyRecordingRef(''),
      })
        ? 'no matched recording yet'
        : ''),
    }
    return shell
  })
}

function adoptPriorRecordings(
  next: TrackOccurrence[],
  previous: TrackOccurrence[] | undefined
): TrackOccurrence[] {
  if (!previous || previous.length === 0) return next
  const byKey = new Map(
    previous.map((track) => [track.identityKey ?? trackIdentityKey(track), track])
  )
  return next.map((track) => {
    const prior = byKey.get(track.identityKey ?? trackIdentityKey(track))
    if (!prior) return track
    return { ...track, recording: prior.recording }
  })
}

function letterFrom(pressing: StoredPressing, stage: DeadLetter['stage']): DeadLetter {
  const error = pressing.provenance.lastError
  return {
    releaseId: pressing.releaseId,
    kind: error?.kind ?? 'unavailable',
    message: error?.message ?? pressing.provenance.reason,
    attempts: error?.attempts ?? 0,
    at: error?.at ?? pressing.provenance.lastAttemptAt ?? pressing.provenance.checkedAt,
    stage,
  }
}

async function matchRelease(
  facts: PressingFacts,
  playableCount: number,
  mb: MusicBrainzClient
) {
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
    trackCount: playableCount,
  })
  const mbReleaseDoc =
    releaseMatch.mbid && releaseMatch.matchStatus === 'matched'
      ? await mb.getRelease(releaseMatch.mbid)
      : null
  return { releaseMatch, mbReleaseDoc }
}

function applyReleaseMatch(
  tracks: TrackOccurrence[],
  releaseMatch: ReturnType<typeof classifyReleaseMatch>,
  mbReleaseDoc: Awaited<ReturnType<MusicBrainzClient['getRelease']>>
): TrackOccurrence[] {
  return tracks.map((track, index) => {
    if (!isPlayableOccurrence(track)) return track
    const discogs = {
      position: track.position,
      title: track.title,
      durationMs: track.durationMs,
      index,
    }
    if (!mbReleaseDoc || releaseMatch.matchStatus !== 'matched') {
      const reason =
        releaseMatch.matchStatus === 'ambiguous'
          ? 'pressing match is ambiguous; tracks not auto-accepted'
          : 'no matched recording yet'
      return {
        ...track,
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
      ...track,
      recording: {
        matchStatus: matched.matchStatus,
        confidence: matched.confidence,
        reason: matched.reason,
        mbid: matched.recordingId,
        recordingUrl: matched.recordingId ? musicbrainzRecordingUrl(matched.recordingId) : null,
      },
    }
  })
}

function markVocalInstrumentalAmbiguous(tracks: TrackOccurrence[]): void {
  for (const track of tracks) {
    if (!isPlayableOccurrence(track)) continue
    if (track.recording.matchStatus === 'unmatched') {
      track.recording.matchStatus = 'ambiguous'
      track.recording.reason =
        'no musicbrainz release for this pressing; vocal/instrumental recordings share this title'
    }
  }
}

export async function enrichPressing(
  releaseId: number,
  deps: EnrichDeps
): Promise<StoredPressing> {
  const nowMs = (deps.now ?? Date.now)()
  const nowIso = isoFromMs(nowMs)
  const previousRaw = await deps.store.getPressing(releaseId)
  const storedPrevious = previousRaw ? hydratePressing(previousRaw) : null
  const previous =
    storedPrevious && storedPressingHasVisitorFacts(storedPrevious)
      ? storedPrevious
      : fixturePressing(releaseId) ?? storedPrevious
  const mb = deps.mb ?? createMusicBrainzClient()
  const fetchDetail = deps.fetchDiscogs ?? ((id: number) => fetchDiscogsReleaseDetail(id))
  const shouldFail = deps.failRefresh ?? ((id: number) => failRefreshFromEnv(id))
  const entryInstanceIds =
    instanceIdsFor(releaseId, deps.collection).length > 0
      ? instanceIdsFor(releaseId, deps.collection)
      : previous?.entryInstanceIds ?? []
  const priorCycles = previous?.lifecycles ?? defaultLifecycles(previous?.provenance)
  let stage: LifecycleName = 'pressing'

  try {
    if (shouldFail(releaseId)) {
      throw new Error('Failed to enrich pressing')
    }
    const existingDraft = await deps.store.getDraftPressing(releaseId)
    const hydratedDraft = existingDraft ? hydratePressing(existingDraft) : null
    const remaining =
      deps.deadlineMs == null ? Number.POSITIVE_INFINITY : remainingBudgetMs(deps.deadlineMs, nowMs)
    const takeFloorMs = deps.takeFloorMs ?? ENRICH_TAKE_FLOOR_MS
    const reuseDraft = shouldReuseDraft(hydratedDraft, previous, nowMs, Boolean(deps.forceRefresh))

    if (remainingBelowTakeFloor(remaining, takeFloorMs)) {
      throw new WorkerDeadlineError()
    }

    let facts: PressingFacts
    let tracks: TrackOccurrence[]
    let skipMatch: boolean
    let pressingDraft: StoredPressing
    let playable: TrackOccurrence[]
    let discogsFacts: ResearchFact[] = []

    if (reuseDraft && hydratedDraft) {
      pressingDraft = hydratedDraft
      facts = pressingDraft.facts
      tracks = pressingDraft.tracks
      playable = tracks.filter(isPlayableOccurrence)
      skipMatch = shouldSkipMatch(previous, false, Boolean(deps.forceRefresh))
      discogsFacts = (pressingDraft.researchFacts ?? []).filter((fact) => fact.source === 'discogs')
    } else {
      assertWithinWorkerDeadline(deps)
      const detail = await fetchDetail(releaseId)
      facts = factsFromDiscogsDetail(detail)
      tracks = occurrencesFromDetail(detail)
      playable = tracks.filter(isPlayableOccurrence)
      const identityShifted = identityChanged(previous, tracks)
      skipMatch = shouldSkipMatch(previous, identityShifted, Boolean(deps.forceRefresh))
      discogsFacts = researchFactsFromDiscogs(detail, tracks, nowIso)

      pressingDraft = hydratePressing({
        schemaVersion: CRATE_SCHEMA_VERSION,
        releaseId,
        entryInstanceIds,
        facts,
        factsSource: {
          source: 'discogs',
          sourceUrl: facts.discogsUrl,
          providerId: String(releaseId),
        },
        description: sourcedDescription(detail.notes, facts.discogsUrl, {
          previous: previous?.description ?? null,
          releaseId,
        }),
        tracks: skipMatch ? adoptPriorRecordings(tracks, previous?.tracks) : tracks,
        mbRelease: skipMatch && previous
          ? previous.mbRelease
          : {
              mbid: null,
              url: null,
              matchStatus: 'pending',
              confidence: 0,
              reason: 'queued for matching',
            },
        recordings: skipMatch && previous ? { ...previous.recordings } : {},
        researchFacts: discogsFacts,
        provenance: {
          sourceUrls: [facts.discogsUrl],
          matchStatus: skipMatch && previous ? previous.provenance.matchStatus : 'pending',
          confidence: skipMatch && previous ? previous.provenance.confidence : 0,
          reason: skipMatch && previous ? previous.provenance.reason : 'queued for matching',
          checkedAt: nowIso,
          refreshAfter: isoFromMs(nowMs + SUCCESS_REFRESH_MS),
          lastError: null,
          verifiedAt: previous?.provenance.verifiedAt ?? null,
          lastAttemptAt: nowIso,
        },
        lifecycles: {
          pressing: touchVerified(priorCycles.pressing, nowIso),
          match: priorCycles.match,
          research: priorCycles.research,
        },
        coverage: {
          tracks: playable.length,
          matched: 0,
          withCredits: 0,
          withSamples: 0,
          withReleaseCredits: false,
          withReleaseSamples: false,
        },
        checkpoint: {
          stage: skipMatch ? 'research' : 'match',
          researchCursor: previous?.checkpoint?.researchCursor ?? 0,
          deadlineStops: 0,
        },
      })
      await deps.store.setDraftPressing(pressingDraft)
    }

    tracks = pressingDraft.tracks
    let mbRelease = pressingDraft.mbRelease
    const recordings = { ...pressingDraft.recordings }
    let matchCycle = priorCycles.match
    let researchCycle = priorCycles.research
    let researchCursor = pressingDraft.checkpoint?.researchCursor ?? 0

    if (!skipMatch) {
      assertWithinWorkerDeadline(deps)
      stage = 'match'
      const { releaseMatch, mbReleaseDoc } = await matchRelease(facts, playable.length, mb)
      assertWithinWorkerDeadline(deps)
      tracks = applyReleaseMatch(tracks, releaseMatch, mbReleaseDoc)
      if (
        releaseMatch.matchStatus === 'unmatched' &&
        playable.some((track) => /vocal|instrumental/i.test(track.title))
      ) {
        markVocalInstrumentalAmbiguous(tracks)
      }
      const mbUrl = releaseMatch.mbid ? musicbrainzReleaseUrl(releaseMatch.mbid) : null
      mbRelease = {
        mbid: releaseMatch.mbid,
        url: mbUrl,
        matchStatus: releaseMatch.matchStatus,
        confidence: releaseMatch.confidence,
        reason: releaseMatch.reason,
        releaseGroupMbid: mbReleaseDoc?.releaseGroupId ?? null,
      }
      matchCycle = touchVerified(priorCycles.match, nowIso)
      researchCursor = 0
      await deps.store.setDraftPressing(
        hydratePressing({
          ...pressingDraft,
          tracks,
          mbRelease,
          provenance: {
            ...pressingDraft.provenance,
            sourceUrls: mbUrl ? [facts.discogsUrl, mbUrl] : [facts.discogsUrl],
            matchStatus: releaseMatch.matchStatus,
            confidence: releaseMatch.confidence,
            reason: releaseMatch.reason,
          },
          lifecycles: {
            pressing: touchVerified(priorCycles.pressing, nowIso),
            match: matchCycle,
            research: researchCycle,
          },
          checkpoint: { stage: 'research', researchCursor: 0 },
        })
      )
    }

    stage = 'research'
    const acceptedMbids = [
      ...new Set(
        tracks
          .filter((track) => isPlayableOccurrence(track) && track.recording.matchStatus === 'matched')
          .map((track) => track.recording.mbid)
          .filter((id): id is string => Boolean(id))
      ),
    ]
    for (let index = 0; index < acceptedMbids.length; index++) {
      if (index < researchCursor) continue
      const mbid = acceptedMbids[index]
      if (!mbid) continue
      const previousRecording = recordings[mbid] ?? previous?.recordings[mbid] ?? (await deps.store.getRecording(mbid))
      if (!deps.forceRefresh && researchIsFresh(previousRecording, nowMs)) {
        if (previousRecording) recordings[mbid] = previousRecording
        researchCursor = index + 1
        continue
      }
      try {
        assertWithinWorkerDeadline(deps)
        const doc = await mb.getRecording(mbid)
        if (!doc) {
          if (previousRecording) recordings[mbid] = previousRecording
          researchCursor = index + 1
          continue
        }
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
            checkedAt: nowIso,
            refreshAfter: isoFromMs(nowMs + SUCCESS_REFRESH_MS),
            lastError: null,
            verifiedAt: nowIso,
            lastAttemptAt: nowIso,
          },
        }
        recordings[mbid] = recording
        await deps.store.setRecording(recording)
        researchCursor = index + 1
        researchCycle = touchVerified(researchCycle, nowIso)
        await deps.store.setDraftPressing(
          hydratePressing({
            ...pressingDraft,
            tracks,
            mbRelease,
            recordings,
            lifecycles: {
              pressing: touchVerified(priorCycles.pressing, nowIso),
              match: matchCycle,
              research: researchCycle,
            },
            checkpoint: { stage: 'research', researchCursor },
          })
        )
      } catch (error) {
        if (isMusicBrainzRateLimitError(error) || isMusicBrainzAuthError(error)) throw error
        if (previousRecording) {
          recordings[mbid] = previousRecording
          researchCursor = index + 1
        } else {
          throw error
        }
      }
    }

    const mbUrl = mbRelease.url
    const sourceUrls = [facts.discogsUrl]
    if (mbUrl) sourceUrls.push(mbUrl)
    const priorWiki = priorWikidataFacts(previous)
    let wikiFacts: ResearchFact[] = priorWiki
    let wikiError: ProvenanceError | null = null
    let wikiTemporary = false
    let wikiBudgetSkipped = false
    const wikiRemaining =
      deps.deadlineMs == null
        ? Number.POSITIVE_INFINITY
        : remainingBudgetMs(deps.deadlineMs, (deps.now ?? Date.now)())
    if (!remainingBelowTakeFloor(wikiRemaining, takeFloorMs)) {
      const outcome = await wikidataFactsFor(
        wikidataLookupInput(releaseId, facts, mbRelease),
        nowIso,
        deps
      )
      if (outcome.status === 'temporary') {
        wikiTemporary = true
        wikiFacts = priorWiki
        wikiError = {
          at: nowIso,
          kind: outcome.error.kind,
          message: outcome.error.message,
          attempts: 0,
        }
      } else if (outcome.status === 'ambiguous') {
        wikiFacts = []
        wikiError = {
          at: nowIso,
          kind: 'ambiguous',
          message: 'wikidata identity is ambiguous',
          attempts: 0,
        }
      } else {
        wikiFacts = outcome.facts
      }
    } else {
      // Budget below the floor: the Wikidata fallback was never attempted.
      // Keep research retryable instead of verifying (and settling) without it.
      wikiTemporary = true
      wikiBudgetSkipped = true
      wikiFacts = priorWiki
      wikiError = {
        at: nowIso,
        kind: 'unavailable',
        message: 'wikidata skipped: worker budget below floor',
        attempts: 0,
      }
    }
    const researchFacts = mergeResearchFacts(
      factsFromRecordings({ tracks, recordings }),
      discogsFacts,
      wikiFacts
    )
    if (wikiFacts.length > 0) {
      const wikiUrl = wikiFacts.find((fact) => fact.sourceUrl.includes('wikidata.org'))?.sourceUrl
      sourceUrls.push(wikiUrl ?? 'https://www.wikidata.org/')
    }
    let researched: FetchState
    if (wikiTemporary) {
      researched = touchAttempt(
        { ...researchCycle, verifiedAt: priorCycles.research.verifiedAt },
        nowIso,
        wikiError,
        // A budget skip is not a source failure; don't burn an attempt on it.
        { countAttempt: !wikiBudgetSkipped }
      )
    } else if (acceptedMbids.length > 0 || researchFacts.length > 0) {
      researched = touchVerified(researchCycle, nowIso)
      if (wikiError?.kind === 'ambiguous') {
        researched = { ...researched, lastError: { ...wikiError, attempts: 0 } }
      }
    } else if (wikiError) {
      researched = touchAttempt(priorCycles.research, nowIso, wikiError)
    } else {
      researched = priorCycles.research
    }
    assertWithinWorkerDeadline(deps)
    const nextPressing: StoredPressing = hydratePressing({
      schemaVersion: CRATE_SCHEMA_VERSION,
      releaseId,
      entryInstanceIds,
      facts,
      factsSource: {
        source: 'discogs',
        sourceUrl: facts.discogsUrl,
        providerId: String(releaseId),
      },
      description: pressingDraft.description,
      tracks,
      mbRelease,
      recordings,
      researchFacts,
      provenance: {
        sourceUrls,
        matchStatus: mbRelease.matchStatus,
        confidence: mbRelease.confidence,
        reason: mbRelease.reason,
        checkedAt: nowIso,
        // A budget-skipped Wikidata step is retryable, not done: surface it on
        // provenance (which drives isBackfillSettled) with a near-term retry so
        // the backfill nacks the release instead of settling it.
        refreshAfter: isoFromMs(
          nowMs + (wikiBudgetSkipped ? DEADLINE_BACKOFF_MS : SUCCESS_REFRESH_MS)
        ),
        lastError: wikiBudgetSkipped && wikiError ? { ...wikiError, attempts: 0 } : null,
        verifiedAt: skipMatch ? previous?.provenance.verifiedAt ?? null : nowIso,
        lastAttemptAt: nowIso,
      },
      lifecycles: {
        pressing: reuseDraft
          ? pressingDraft.lifecycles?.pressing ?? touchVerified(priorCycles.pressing, nowIso)
          : touchVerified(priorCycles.pressing, nowIso),
        match: skipMatch ? priorCycles.match : matchCycle,
        research: researched,
      },
      coverage: coverageOf({ tracks, recordings, researchFacts }),
      checkpoint: { stage: 'research', researchCursor: acceptedMbids.length },
    })
    const pressing = hydratePressing(keepPriorMatch(previous, nextPressing))
    if (mbRelease.matchStatus === 'ambiguous' || mbRelease.matchStatus === 'unmatched') {
      await deps.store.markUnresolved({
        releaseId,
        kind: mbRelease.matchStatus === 'ambiguous' ? 'ambiguous' : 'not_found',
        message: mbRelease.reason,
        attempts: 0,
        at: nowIso,
        stage: 'match',
      })
    }
    const committed = withClearedDeadlineStops(pressing)
    await deps.store.setPressing(committed)
    return committed
  } catch (error) {
    if (isWorkerDeadlineError(error)) throw error
    const kind = errorKind(error)
    const draft = await deps.store.getDraftPressing(releaseId)
    const latest = hasPriorVerifiedRecord(previous)
      ? previous
      : hasPriorVerifiedRecord(storedPrevious)
        ? storedPrevious
        : storedPrevious && storedPressingHasVisitorFacts(storedPrevious) && storedPrevious.provenance.lastError
          ? storedPrevious
          : storedPressingHasVisitorFacts(draft)
            ? draft
            : previous
    const preserved = preservePressingOnFailure(
      latest,
      nowMs,
      kind,
      errorMessage(error),
      {
        terminal: isDiscogsTerminalClientError(error),
        releaseId,
        entryInstanceIds,
        countAttempt: kind !== 'auth',
        stage: stageFromError(error, stage),
      }
    )
    const letter = letterFrom(preserved, stageFromError(error, stage))
    if (letter.kind === 'exhausted') {
      await deps.store.markDead(letter)
    } else if (letter.kind === 'auth' || letter.kind === 'not_found') {
      await deps.store.markUnresolved(letter)
    }
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
  completed: number[]
  failed: number[]
  unresolved: number[]
  skipped: boolean
  stoppedOnRateLimit: boolean
  stoppedOnAuth: boolean
  mbRequests: number
}

export function classifyQueueOutcome(pressing: StoredPressing): 'completed' | 'failed' | 'unresolved' {
  const kind = pressing.provenance.lastError?.kind
  if (kind === 'exhausted') return 'failed'
  if (kind === 'auth' || kind === 'not_found' || kind === 'too_slow') return 'unresolved'
  if (
    pressing.provenance.matchStatus === 'unmatched' ||
    pressing.provenance.matchStatus === 'ambiguous'
  ) {
    return 'unresolved'
  }
  if (kind === 'partial') return 'completed'
  if (kind) return 'failed'
  return 'completed'
}

export function isBackfillSettled(pressing: StoredPressing): boolean {
  const kind = pressing.provenance.lastError?.kind
  if (kind === 'auth' || kind === 'rate_limit' || kind === 'unavailable') return false
  if (kind === 'exhausted' || kind === 'not_found' || kind === 'too_slow') return true
  const outcome = classifyQueueOutcome(pressing)
  return outcome === 'completed' || outcome === 'unresolved' || outcome === 'failed'
}

function emptyQueueResult(skipped: boolean): EnrichQueueResult {
  return {
    processed: [],
    completed: [],
    failed: [],
    unresolved: [],
    skipped,
    stoppedOnRateLimit: false,
    stoppedOnAuth: false,
    mbRequests: 0,
  }
}

export function skippedAuthQueueResult(): EnrichQueueResult {
  return {
    ...emptyQueueResult(true),
    stoppedOnAuth: true,
  }
}

export async function processEnrichmentQueue(
  deps: EnrichDeps,
  limit?: number
): Promise<EnrichQueueResult> {
  const token = deps.lockToken ?? randomLockToken()
  const lockTtl = deps.lockTtlSeconds ?? ENRICH_LOCK_SECONDS
  const locked = await deps.store.acquireEnrichLock(lockTtl, token)
  if (!locked) {
    return emptyQueueResult(true)
  }

  const now = deps.now ?? Date.now
  const started = now()
  const takeFloorMs = deps.takeFloorMs ?? ENRICH_TAKE_FLOOR_MS
  const deadlineMs =
    deps.deadlineMs ?? started + (deps.budgetMs ?? ENRICH_BUDGET_MS)
  const inflightTtl = deps.inflightTtlSeconds ?? INFLIGHT_TTL_SECONDS
  const cap = limit ?? Number.POSITIVE_INFINITY
  const mb = deps.mb ?? createMusicBrainzClient({ now: deps.now })
  const wikidataClient = deps.wikidataClient ?? wikidataClientFor(deps.wikidata)
  const processed: number[] = []
  const completed: number[] = []
  const failed: number[] = []
  const unresolved: number[] = []
  let stoppedOnRateLimit = false
  let stoppedOnAuth = false

  const record = (releaseId: number, bucket: 'completed' | 'failed' | 'unresolved') => {
    processed.push(releaseId)
    if (bucket === 'completed') completed.push(releaseId)
    else if (bucket === 'failed') failed.push(releaseId)
    else unresolved.push(releaseId)
  }

  try {
    while (processed.length < cap) {
      if (remainingBelowTakeFloor(remainingBudgetMs(deadlineMs, now()), takeFloorMs)) break
      const ids = await deps.store.takeDue(1, now(), inflightTtl)
      const releaseId = ids[0]
      if (releaseId == null) break
      // takeDue is async; remaining can drop below the floor after the loop's
      // check. Nack without a deadline stop so enrichPressing does not immediately
      // throw WorkerDeadlineError for an id we should not have taken.
      if (remainingBelowTakeFloor(remainingBudgetMs(deadlineMs, now()), takeFloorMs)) {
        await deps.store.nack(releaseId, now())
        break
      }
      try {
        const pressing = await enrichPressing(releaseId, {
          ...deps,
          mb,
          wikidataClient,
          deadlineMs,
        })
        const kind = pressing.provenance.lastError?.kind
        const outcome = classifyQueueOutcome(pressing)
        if (kind === 'auth') {
          console.error(
            JSON.stringify({
              event: 'crate-enrich-auth',
              releaseId,
              message: pressing.provenance.lastError?.message,
              attempts: pressing.provenance.lastError?.attempts ?? 0,
            })
          )
          await deps.store.nack(releaseId, now() + AUTH_RETRY_MS)
          record(releaseId, outcome)
          stoppedOnAuth = true
          break
        }
        if (kind === 'exhausted') {
          await deps.store.drop(releaseId)
          record(releaseId, outcome)
        } else if (kind === 'not_found') {
          await deps.store.drop(releaseId)
          record(releaseId, outcome)
        } else if (kind) {
          const retryAt = Date.parse(pressing.provenance.refreshAfter)
          await deps.store.nack(
            releaseId,
            Number.isFinite(retryAt) ? retryAt : now() + 60 * 60 * 1000
          )
          record(releaseId, outcome)
          if (kind === 'rate_limit') {
            stoppedOnRateLimit = true
            break
          }
        } else {
          await deps.store.ack(releaseId)
          record(releaseId, outcome)
        }
      } catch (error) {
        if (isWorkerDeadlineError(error)) {
          await applyDeadlineStop(deps.store, releaseId, now())
          break
        }
        const isAuth = isMusicBrainzAuthError(error) || isDiscogsAuthError(error)
        const retryAt = now() + (isAuth ? AUTH_RETRY_MS : 60 * 60 * 1000)
        await deps.store.nack(releaseId, retryAt)
        record(
          releaseId,
          isMusicBrainzAuthError(error) || isDiscogsAuthError(error) ? 'unresolved' : 'failed'
        )
        if (isMusicBrainzAuthError(error) || isDiscogsAuthError(error)) {
          stoppedOnAuth = true
          console.error(
            JSON.stringify({
              event: 'crate-enrich-auth',
              releaseId,
              message: errorMessage(error),
            })
          )
          break
        }
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
  console.info(
    JSON.stringify({
      event: 'crate-enrich',
      processed,
      completed,
      failed,
      unresolved,
      skipped: false,
      stoppedOnRateLimit,
      stoppedOnAuth,
      mbRequests: mb.requestCount,
    })
  )
  return {
    processed,
    completed,
    failed,
    unresolved,
    skipped: false,
    stoppedOnRateLimit,
    stoppedOnAuth,
    mbRequests: mb.requestCount,
  }
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
