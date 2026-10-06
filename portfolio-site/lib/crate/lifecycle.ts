import { normalizePosition, normalizeTitle } from './match.ts'
import type {
  Coverage,
  FetchState,
  Lifecycles,
  Provenance,
  ProvenanceError,
  StoredPressing,
  StoredRecording,
  TrackOccurrence,
} from './types.ts'
import { CRATE_MAX_ATTEMPTS, CRATE_RESEARCH_REFRESH_MS } from './types.ts'

export function emptyFetchState(): FetchState {
  return {
    verifiedAt: null,
    lastAttemptAt: null,
    lastError: null,
    attempts: 0,
  }
}

export function defaultLifecycles(provenance?: Provenance): Lifecycles {
  const verifiedAt = provenance?.verifiedAt ?? (provenance?.lastError ? null : provenance?.checkedAt ?? null)
  const lastAttemptAt = provenance?.lastAttemptAt ?? provenance?.checkedAt ?? null
  const lastError = provenance?.lastError ?? null
  const attempts = lastError?.attempts ?? 0
  const shared: FetchState = { verifiedAt, lastAttemptAt, lastError, attempts }
  return {
    pressing: { ...shared },
    match: { ...shared },
    research: { ...shared },
  }
}

export function mixIdentity(title: string): string {
  const parts = title.match(/\(([^)]+)\)/g) ?? []
  return parts.map((part) => normalizeTitle(part)).join(' ')
}

export function trackIdentityKey(track: {
  position: string
  title: string
  durationMs: number | null
  type_?: string
}): string {
  return [
    normalizePosition(track.position),
    normalizeTitle(track.title),
    mixIdentity(track.title),
    track.durationMs == null ? '' : String(track.durationMs),
    (track.type_ ?? 'track').toLowerCase(),
  ].join('\u001f')
}

export function pressingIdentity(tracks: TrackOccurrence[]): string {
  return tracks.map((track) => track.identityKey ?? trackIdentityKey(track)).join('\n')
}

export function identityChanged(previous: StoredPressing | null, nextTracks: TrackOccurrence[]): boolean {
  if (!previous) return true
  return pressingIdentity(previous.tracks) !== pressingIdentity(nextTracks)
}

export function coverageOf(pressing: Pick<StoredPressing, 'tracks' | 'recordings'>): Coverage {
  const playable = pressing.tracks.filter((track) => isPlayableOccurrence(track))
  let matched = 0
  let withCredits = 0
  let withSamples = 0
  for (const track of playable) {
    if (track.recording.matchStatus !== 'matched' || !track.recording.mbid) continue
    matched += 1
    const recording = pressing.recordings[track.recording.mbid]
    if (recording && recording.credits.length > 0) withCredits += 1
    if (recording && (recording.samplesFrom.length > 0 || recording.sampledIn.length > 0)) {
      withSamples += 1
    }
  }
  return {
    tracks: playable.length,
    matched,
    withCredits,
    withSamples,
  }
}

export function coverageLine(coverage: Coverage): string {
  return `matched ${coverage.matched}/${coverage.tracks} · credits ${coverage.withCredits} · samples ${coverage.withSamples}`
}

export function isPlayableOccurrence(track: TrackOccurrence): boolean {
  const type = (track.type_ ?? 'track').toLowerCase()
  if (type === 'heading' || type === 'index') return false
  return track.title.trim().length > 0
}

export function researchRefreshWindowMs(
  env: Record<string, string | undefined> = process.env
): number | null {
  if (env.CRATE_RESEARCH_REFRESH === '0' || env.CRATE_RESEARCH_REFRESH_MS === '0') {
    return null
  }
  const raw = env.CRATE_RESEARCH_REFRESH_MS
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : CRATE_RESEARCH_REFRESH_MS
  }
  if (env.CRATE_RESEARCH_REFRESH === '1') return CRATE_RESEARCH_REFRESH_MS
  return null
}

export function researchIsFresh(
  recording: StoredRecording | undefined,
  nowMs: number,
  refreshMs: number | null = researchRefreshWindowMs()
): boolean {
  if (!recording) return false
  const verified = recording.provenance.verifiedAt ?? (recording.provenance.lastError ? null : recording.provenance.checkedAt)
  if (!verified) return false
  if (refreshMs == null) return true
  const at = Date.parse(verified)
  if (!Number.isFinite(at)) return false
  return nowMs - at < refreshMs
}

export function shouldRetryFailure(
  state: FetchState,
  nowMs: number,
  refreshAfter?: string | null
): boolean {
  if (!state.lastError) return false
  if (state.lastError.kind === 'auth') return false
  if (state.lastError.kind === 'not_found' || state.lastError.kind === 'exhausted') return false
  if (state.attempts >= CRATE_MAX_ATTEMPTS) return false
  const at = refreshAfter
    ? Date.parse(refreshAfter)
    : state.lastAttemptAt
      ? Date.parse(state.lastAttemptAt)
      : NaN
  if (!Number.isFinite(at)) return true
  return nowMs >= at
}

export function shouldQueuePressing(pressing: StoredPressing | null, nowMs: number): boolean {
  if (!pressing) return true
  const cycles = pressing.lifecycles ?? defaultLifecycles(pressing.provenance)
  const refreshAfter = pressing.provenance.refreshAfter
  if (shouldRetryFailure(cycles.pressing, nowMs, refreshAfter)) return true
  if (shouldRetryFailure(cycles.match, nowMs, refreshAfter)) return true
  if (shouldRetryFailure(cycles.research, nowMs, refreshAfter)) return true
  if (pressing.provenance.matchStatus === 'pending' && !pressing.provenance.lastError) {
    return true
  }
  const matched = pressing.tracks.filter(
    (track) => isPlayableOccurrence(track) && Boolean(track.recording.mbid)
  ).length
  const cursor = pressing.checkpoint?.researchCursor ?? 0
  if (pressing.checkpoint?.stage === 'research' && cursor < matched && !pressing.provenance.lastError) {
    return true
  }
  return false
}

export function successfulVerifiedAt(provenance: Provenance): string | null {
  return provenance.verifiedAt ?? (provenance.lastError ? null : provenance.checkedAt)
}

export function touchAttempt(
  previous: FetchState,
  nowIso: string,
  error: ProvenanceError | null,
  options: { countAttempt?: boolean } = {}
): FetchState {
  const count = options.countAttempt !== false
  return {
    verifiedAt: previous.verifiedAt,
    lastAttemptAt: nowIso,
    lastError: error
      ? {
          ...error,
          attempts: count ? (previous.lastError?.attempts ?? previous.attempts) + 1 : previous.attempts,
        }
      : previous.lastError,
    attempts: count ? previous.attempts + 1 : previous.attempts,
  }
}

export function touchVerified(previous: FetchState, nowIso: string): FetchState {
  return {
    verifiedAt: nowIso,
    lastAttemptAt: nowIso,
    lastError: null,
    attempts: 0,
  }
}

export function hydratePressing(pressing: StoredPressing): StoredPressing {
  const tracks = pressing.tracks.map((track, index) => ({
    ...track,
    type_: track.type_ ?? 'track',
    identityKey: track.identityKey ?? trackIdentityKey(track),
    index: track.index ?? index,
  }))
  const lifecycles = pressing.lifecycles ?? defaultLifecycles(pressing.provenance)
  const coverage = pressing.coverage ?? coverageOf({ tracks, recordings: pressing.recordings })
  const provenance: Provenance = {
    ...pressing.provenance,
    verifiedAt: pressing.provenance.verifiedAt ?? successfulVerifiedAt(pressing.provenance),
    lastAttemptAt: pressing.provenance.lastAttemptAt ?? pressing.provenance.checkedAt,
  }
  return {
    ...pressing,
    tracks,
    lifecycles,
    coverage,
    provenance,
    checkpoint: pressing.checkpoint ?? null,
    factsSource: pressing.factsSource ?? {
      source: 'discogs',
      sourceUrl: pressing.facts.discogsUrl,
      providerId: String(pressing.releaseId),
    },
  }
}
