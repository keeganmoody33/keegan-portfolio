import type { DurableErrorKind, Provenance, StoredPressing } from './types.ts'

export const SUCCESS_REFRESH_MS = 30 * 24 * 60 * 60 * 1000
const BACKOFF_MS = [
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
] as const

export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString()
}

export function nextBackoffMs(previousErrorAt: string | null, nowMs: number): number {
  if (!previousErrorAt) return BACKOFF_MS[0]
  const prev = Date.parse(previousErrorAt)
  if (!Number.isFinite(prev)) return BACKOFF_MS[0]
  const age = nowMs - prev
  for (const window of BACKOFF_MS) {
    if (age < window) return window
  }
  return BACKOFF_MS[BACKOFF_MS.length - 1] ?? 7 * 24 * 60 * 60 * 1000
}

export function hasSuccessfulPressing(pressing: StoredPressing | null | undefined): boolean {
  if (!pressing) return false
  if (pressing.provenance.matchStatus === 'pending') return false
  return pressing.tracks.length > 0 || pressing.facts.title.length > 0
}

export function preservePressingOnFailure(
  previous: StoredPressing | null,
  nowMs: number,
  kind: DurableErrorKind,
  message: string
): StoredPressing | null {
  if (!previous || !hasSuccessfulPressing(previous)) return previous
  const backoff = nextBackoffMs(previous.provenance.lastError?.at ?? null, nowMs)
  const provenance: Provenance = {
    ...previous.provenance,
    lastError: {
      at: isoFromMs(nowMs),
      kind,
      message,
    },
    refreshAfter: isoFromMs(nowMs + backoff),
  }
  return {
    ...previous,
    provenance,
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
