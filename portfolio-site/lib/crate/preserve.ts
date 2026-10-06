import type {
  DurableErrorKind,
  PressingFacts,
  Provenance,
  StoredPressing,
  TrackOccurrence,
} from './types.ts'
import { CRATE_SCHEMA_VERSION } from './types.ts'
import { matchRank as rankOf } from './match-rank.ts'
import { normalizePosition, normalizeTitle } from './match.ts'

export const DISCOGS_REFRESH_MS = 6 * 60 * 60 * 1000
export const MB_REFRESH_MS = 30 * 24 * 60 * 60 * 1000
export const SUCCESS_REFRESH_MS = DISCOGS_REFRESH_MS
const BACKOFF_MS = [
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
] as const
export const TERMINAL_REFRESH_MS = 30 * 24 * 60 * 60 * 1000

export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString()
}

export function nextBackoffMs(attemptCount: number): number {
  const index = Math.max(0, attemptCount - 1)
  return BACKOFF_MS[Math.min(index, BACKOFF_MS.length - 1)] ?? TERMINAL_REFRESH_MS
}

export function hasSuccessfulPressing(pressing: StoredPressing | null | undefined): boolean {
  if (!pressing) return false
  if (pressing.provenance.matchStatus === 'pending') return false
  return pressing.tracks.length > 0 || pressing.facts.title.length > 0
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
  } = {}
): StoredPressing {
  const attempts = 1
  const backoff = options.terminal ? TERMINAL_REFRESH_MS : nextBackoffMs(attempts)
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
  } = {}
): StoredPressing {
  if (!previous) {
    return errorPressingStub(options.releaseId ?? options.facts?.releaseId ?? 0, nowMs, kind, message, options)
  }
  const attempts = (previous.provenance.lastError?.attempts ?? 0) + 1
  const backoff = options.terminal ? TERMINAL_REFRESH_MS : nextBackoffMs(attempts)
  const provenance: Provenance = {
    ...previous.provenance,
    checkedAt: isoFromMs(nowMs),
    lastError: {
      at: isoFromMs(nowMs),
      kind,
      message,
      attempts,
    },
    refreshAfter: isoFromMs(nowMs + backoff),
    matchStatus: options.terminal ? 'unmatched' : previous.provenance.matchStatus,
  }
  return {
    ...previous,
    provenance,
    mbRelease: options.terminal
      ? {
          ...previous.mbRelease,
          matchStatus: 'unmatched',
          reason: message,
        }
      : previous.mbRelease,
  }
}

export function shouldRefreshPressing(
  pressing: StoredPressing | null,
  nowMs: number
): boolean {
  if (!pressing) return true
  const refreshAt = Date.parse(pressing.provenance.refreshAfter)
  if (!Number.isFinite(refreshAt)) return true
  return nowMs >= refreshAt
}

export function matchRank(
  status: StoredPressing['mbRelease']['matchStatus']
): number {
  return rankOf(status)
}

export function isDiscogsUrlMatch(reason: string): boolean {
  return /discogs url/i.test(reason)
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
  return {
    ...next,
    tracks: mergeTracksKeepRecordings(next.tracks, previous.tracks),
    mbRelease: previous.mbRelease,
    recordings: previous.recordings,
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
    const prior = previousTracks.find(
      (row) =>
        normalizePosition(row.position) === normalizePosition(track.position) &&
        normalizeTitle(row.title) === normalizeTitle(track.title)
    )
    if (!prior) return track
    return { ...track, recording: prior.recording }
  })
}
