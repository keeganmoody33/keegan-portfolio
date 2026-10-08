import type {
  CrateCheckpoint,
  DurableErrorKind,
  Lifecycles,
  PressingFacts,
  Provenance,
  StoredPressing,
  StoredRecording,
  TrackOccurrence,
} from './types.ts'
import { CRATE_MAX_ATTEMPTS, CRATE_RESEARCH_REFRESH_MS, CRATE_SCHEMA_VERSION } from './types.ts'
import { matchRank as rankOf } from './match-rank.ts'
import { normalizePosition, normalizeTitle } from './match.ts'
import { defaultLifecycles, emptyFetchState, shouldQueuePressing, touchAttempt } from './lifecycle.ts'

export const DISCOGS_COLLECTION_TTL_MS = 24 * 60 * 60 * 1000
export const RESEARCH_REFRESH_MS = CRATE_RESEARCH_REFRESH_MS
export const MB_REFRESH_MS = RESEARCH_REFRESH_MS
export const SUCCESS_REFRESH_MS = RESEARCH_REFRESH_MS
const BACKOFF_MS = [
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
] as const
export const TERMINAL_REFRESH_MS = 30 * 24 * 60 * 60 * 1000
export const AUTH_RETRY_MS = 15 * 60 * 1000
export const INCOMPLETE_RECORDING_MESSAGE = 'incomplete recording probe'
export { CRATE_MAX_ATTEMPTS }

export function recordingDocIsIncomplete(
  recording: StoredRecording | null | undefined
): boolean {
  return recording?.provenance.lastError?.message === INCOMPLETE_RECORDING_MESSAGE
}

export function recordingDocIsComplete(
  recording: StoredRecording | null | undefined
): boolean {
  if (!recording || recordingDocIsIncomplete(recording)) return false
  if (recording.provenance.verifiedAt) return true
  const sampleCount =
    (recording.samplesFrom?.length ?? 0) + (recording.sampledIn?.length ?? 0)
  return sampleCount > 0 && recording.provenance.lastError == null
}

export function coalesceRecordingLengthMs(
  ...values: Array<number | null | undefined>
): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  }
  return null
}

export function withRecordingLength(
  recording: StoredRecording,
  lengthMs: number | null | undefined
): StoredRecording {
  const next = coalesceRecordingLengthMs(recording.lengthMs, lengthMs)
  if (next == null) return recording
  if (recording.lengthMs === next) return recording
  return { ...recording, lengthMs: next }
}

/** Never replace a verified Redis recording with an incomplete timeout/429 stub. */
export function preferCompleteRecording(
  existing: StoredRecording | null | undefined,
  incoming: StoredRecording
): StoredRecording {
  if (!existing) return incoming
  if (recordingDocIsIncomplete(incoming) && recordingDocIsComplete(existing)) {
    return withRecordingLength(existing, incoming.lengthMs)
  }
  return withRecordingLength(incoming, existing.lengthMs)
}

export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString()
}

export function copyCheckpoint(
  checkpoint: CrateCheckpoint | null | undefined,
  patch: Partial<CrateCheckpoint> = {}
): CrateCheckpoint {
  return {
    stage: patch.stage ?? checkpoint?.stage ?? 'pressing',
    researchCursor: patch.researchCursor ?? checkpoint?.researchCursor ?? 0,
    trackSampleCursor: patch.trackSampleCursor ?? checkpoint?.trackSampleCursor,
    deadlineStops: patch.deadlineStops ?? checkpoint?.deadlineStops,
    forceRun: patch.forceRun ?? checkpoint?.forceRun,
    forceRunAt: patch.forceRunAt ?? checkpoint?.forceRunAt,
    forceSeriesId: patch.forceSeriesId ?? checkpoint?.forceSeriesId,
  }
}

export function nextBackoffMs(attemptCount: number): number {
  const index = Math.max(0, attemptCount - 1)
  return BACKOFF_MS[Math.min(index, BACKOFF_MS.length - 1)] ?? TERMINAL_REFRESH_MS
}

/** Auth and rate_limit never burn the 5-attempt exhausted/dead budget. */
export function countsTowardAttempts(kind: DurableErrorKind): boolean {
  return kind !== 'auth' && kind !== 'rate_limit'
}

export function storedPressingHasVisitorFacts(pressing: StoredPressing | null | undefined): boolean {
  if (!pressing) return false
  return pressing.facts.title.trim().length > 0 || pressing.tracks.length > 0
}

export function hasPriorVerifiedRecord(pressing: StoredPressing | null | undefined): boolean {
  if (!pressing?.provenance.verifiedAt) return false
  return storedPressingHasVisitorFacts(pressing)
}

export function hasSuccessfulPressing(pressing: StoredPressing | null | undefined): boolean {
  if (!pressing) return false
  if (pressing.provenance.matchStatus === 'pending') return false
  return storedPressingHasVisitorFacts(pressing)
}

export function emptyPressingFacts(releaseId: number): PressingFacts {
  return {
    releaseId,
    title: '',
    artist: '',
    label: null,
    catno: null,
    format: null,
    country: null,
    released: null,
    year: null,
    cover: '',
    thumbnail: '',
    discogsUrl: releaseId > 0 ? `https://www.discogs.com/release/${releaseId}` : '',
    barcode: null,
    masterId: null,
  }
}

export function errorPressingStub(
  releaseId: number,
  nowMs: number,
  kind: DurableErrorKind,
  message: string,
  options: {
    terminal?: boolean
    facts?: PressingFacts
    entryInstanceIds?: number[]
    countAttempt?: boolean
  } = {}
): StoredPressing {
  const attempts =
    options.countAttempt === false || !countsTowardAttempts(kind) ? 0 : 1
  const backoff =
    options.terminal
      ? TERMINAL_REFRESH_MS
      : kind === 'auth'
        ? AUTH_RETRY_MS
        : nextBackoffMs(attempts)
  const facts = options.facts ?? emptyPressingFacts(releaseId)
  const matchStatus = options.terminal ? 'unmatched' : 'pending'
  return {
    schemaVersion: CRATE_SCHEMA_VERSION,
    releaseId,
    entryInstanceIds: options.entryInstanceIds ?? [],
    facts,
    description: null,
    tracks: [],
    mbRelease: {
      mbid: null,
      url: null,
      matchStatus,
      confidence: 0,
      reason: message,
    },
    recordings: {},
    provenance: {
      sourceUrls: facts.discogsUrl ? [facts.discogsUrl] : [],
      matchStatus,
      confidence: 0,
      reason: message,
      checkedAt: isoFromMs(nowMs),
      refreshAfter: isoFromMs(nowMs + backoff),
      lastError: {
        at: isoFromMs(nowMs),
        kind,
        message,
        attempts,
      },
      verifiedAt: null,
      lastAttemptAt: isoFromMs(nowMs),
    },
    lifecycles: {
      pressing: {
        verifiedAt: null,
        lastAttemptAt: isoFromMs(nowMs),
        lastError: {
          at: isoFromMs(nowMs),
          kind,
          message,
          attempts,
        },
        attempts,
      },
      match: emptyFetchState(),
      research: emptyFetchState(),
    },
    coverage: {
      tracks: 0,
      matched: 0,
      withCredits: 0,
      withSamples: 0,
      withReleaseCredits: false,
      withReleaseSamples: false,
    },
    checkpoint: { stage: 'pressing', researchCursor: 0 },
    factsSource: {
      source: 'discogs',
      sourceUrl: facts.discogsUrl,
      providerId: String(releaseId),
    },
  }
}

export function preservePressingOnFailure(
  previous: StoredPressing | null,
  nowMs: number,
  kind: DurableErrorKind,
  message: string,
  options: {
    terminal?: boolean
    releaseId?: number
    facts?: PressingFacts
    entryInstanceIds?: number[]
    countAttempt?: boolean
    stage?: 'pressing' | 'match' | 'research'
  } = {}
): StoredPressing {
  if (!previous) {
    return errorPressingStub(options.releaseId ?? options.facts?.releaseId ?? 0, nowMs, kind, message, options)
  }
  const countAttempt = options.countAttempt !== false && countsTowardAttempts(kind)
  const attempts = countAttempt
    ? (previous.provenance.lastError?.attempts ?? 0) + 1
    : (previous.provenance.lastError?.attempts ?? 0)
  const exhausted =
    attempts >= CRATE_MAX_ATTEMPTS && countsTowardAttempts(kind) && kind !== 'not_found'
  const errorKind = exhausted ? 'exhausted' : kind
  const backoff =
    options.terminal || exhausted
      ? TERMINAL_REFRESH_MS
      : kind === 'auth'
        ? AUTH_RETRY_MS
        : nextBackoffMs(Math.max(attempts, 1))
  const nowIso = isoFromMs(nowMs)
  const lastError = {
    at: nowIso,
    kind: errorKind,
    message,
    attempts,
  }
  const provenance: Provenance = {
    ...previous.provenance,
    checkedAt: nowIso,
    lastAttemptAt: nowIso,
    verifiedAt:
      previous.provenance.verifiedAt !== undefined
        ? previous.provenance.verifiedAt
        : previous.provenance.lastError
          ? null
          : previous.provenance.checkedAt,
    lastError,
    refreshAfter: isoFromMs(nowMs + backoff),
    matchStatus: options.terminal || exhausted ? 'unmatched' : previous.provenance.matchStatus,
  }
  const cycles = previous.lifecycles ?? defaultLifecycles(previous.provenance)
  const stage = options.stage ?? 'pressing'
  const nextCycles: Lifecycles = {
    pressing: stage === 'pressing' ? touchAttempt(cycles.pressing, nowIso, lastError, { countAttempt }) : cycles.pressing,
    match: stage === 'match' ? touchAttempt(cycles.match, nowIso, lastError, { countAttempt }) : cycles.match,
    research: stage === 'research' ? touchAttempt(cycles.research, nowIso, lastError, { countAttempt }) : cycles.research,
  }
  return {
    ...previous,
    provenance,
    lifecycles: nextCycles,
    mbRelease: options.terminal || exhausted
      ? {
          ...previous.mbRelease,
          matchStatus: 'unmatched',
          reason: message,
        }
      : previous.mbRelease,
    checkpoint: copyCheckpoint(previous.checkpoint, { deadlineStops: 0 }),
  }
}

export function withClearedDeadlineStops(pressing: StoredPressing): StoredPressing {
  if ((pressing.checkpoint?.deadlineStops ?? 0) === 0 && !pressing.checkpoint?.forceRun) {
    return pressing
  }
  return {
    ...pressing,
    checkpoint: {
      ...copyCheckpoint(pressing.checkpoint, { deadlineStops: 0 }),
      forceRun: undefined,
      forceRunAt: undefined,
    },
  }
}

export function shouldRefreshPressing(
  pressing: StoredPressing | null,
  nowMs: number
): boolean {
  return shouldQueuePressing(pressing, nowMs)
}

export function matchRank(
  status: StoredPressing['mbRelease']['matchStatus']
): number {
  return rankOf(status)
}

export function isDiscogsUrlMatch(reason: string): boolean {
  return /discogs url/i.test(reason)
}

function inheritReleaseGroupMbid(
  previous: StoredPressing,
  next: StoredPressing
): string | null | undefined {
  if (previous.mbRelease.releaseGroupMbid !== undefined) {
    return previous.mbRelease.releaseGroupMbid
  }
  if (
    previous.mbRelease.mbid &&
    next.mbRelease.mbid &&
    previous.mbRelease.mbid === next.mbRelease.mbid
  ) {
    return next.mbRelease.releaseGroupMbid
  }
  return previous.mbRelease.releaseGroupMbid
}

export function keepPriorMatch(
  previous: StoredPressing | null,
  next: StoredPressing
): StoredPressing {
  if (!previous) return next
  const priorRank = rankOf(previous.mbRelease.matchStatus)
  const nextRank = rankOf(next.mbRelease.matchStatus)
  const counterEvidence =
    next.mbRelease.matchStatus === 'matched' && isDiscogsUrlMatch(next.mbRelease.reason)
  if (priorRank <= nextRank || counterEvidence) return next

  const attempts = (previous.provenance.lastError?.attempts ?? 0) + 1
  const priorCycles = previous.lifecycles ?? defaultLifecycles(previous.provenance)
  const nextCycles = next.lifecycles ?? defaultLifecycles(next.provenance)
  const research = nextCycles.research.lastError
    ? {
        ...priorCycles.research,
        lastAttemptAt: nextCycles.research.lastAttemptAt,
        lastError: nextCycles.research.lastError,
      }
    : priorCycles.research
  return {
    ...next,
    tracks: mergeTracksKeepRecordings(next.tracks, previous.tracks),
    mbRelease: {
      ...previous.mbRelease,
      releaseGroupMbid: inheritReleaseGroupMbid(previous, next),
    },
    recordings: previous.recordings,
    lifecycles: {
      pressing: nextCycles.pressing,
      match: priorCycles.match,
      research,
    },
    coverage: previous.coverage ?? next.coverage,
    provenance: {
      ...next.provenance,
      matchStatus: previous.provenance.matchStatus,
      confidence: previous.provenance.confidence,
      reason: previous.provenance.reason,
      lastError: {
        at: next.provenance.checkedAt,
        kind: 'partial',
        message: 'weaker musicbrainz refresh kept the prior match',
        attempts,
      },
    },
  }
}

function mergeTracksKeepRecordings(
  nextTracks: TrackOccurrence[],
  previousTracks: TrackOccurrence[]
): TrackOccurrence[] {
  return nextTracks.map((track) => {
    const prior = previousTracks.find((row) => {
      if (row.identityKey && track.identityKey && row.identityKey === track.identityKey) {
        return true
      }
      return (
        normalizePosition(row.position) === normalizePosition(track.position) &&
        normalizeTitle(row.title) === normalizeTitle(track.title)
      )
    })
    if (!prior) return track
    return { ...track, recording: prior.recording }
  })
}
