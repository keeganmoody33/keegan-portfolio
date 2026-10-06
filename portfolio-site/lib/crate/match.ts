import type { MatchStatus, TrackMatchInput, TrackMatchResult } from './types.ts'

const VERSION_TOKENS = [
  'vocal',
  'instrumental',
  'inst',
  'mix',
  'remix',
  'clean',
  'dirty',
  'radio',
  'album',
  'extended',
  'edit',
  'version',
] as const

export const DURATION_CLOSE_MS = 5000
export const DURATION_FAR_MS = 15000

export function parseDurationToMs(value: string | null | undefined): number | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split(':')
  if (parts.length < 2 || parts.length > 3) return null
  const nums = parts.map((part) => Number.parseInt(part, 10))
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null
  if (parts.length === 2) {
    const minutes = nums[0]
    const seconds = nums[1]
    if (minutes == null || seconds == null || seconds >= 60) return null
    return (minutes * 60 + seconds) * 1000
  }
  const hours = nums[0]
  const minutes = nums[1]
  const seconds = nums[2]
  if (
    hours == null ||
    minutes == null ||
    seconds == null ||
    minutes >= 60 ||
    seconds >= 60
  ) {
    return null
  }
  return ((hours * 60 + minutes) * 60 + seconds) * 1000
}

export function normalizeTitle(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2018\u2019\u201A\u201B]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function coreTitle(value: string): string {
  const withoutParens = value.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
  const normalized = normalizeTitle(withoutParens)
  return normalized || normalizeTitle(value)
}

export function normalizePosition(value: string): string {
  return value.toLowerCase().replace(/[\s./_-]/g, '')
}

function titleEquals(a: string, b: string): boolean {
  const left = normalizeTitle(a)
  const right = normalizeTitle(b)
  if (!left || !right) return false
  return left === right
}

function titleClose(a: string, b: string): boolean {
  if (titleEquals(a, b)) return true
  const left = coreTitle(a)
  const right = coreTitle(b)
  return Boolean(left && right && left === right)
}

function durationDeltaMs(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  return Math.abs(a - b)
}

function versionTokens(value: string): Set<string> {
  const haystack = normalizeTitle(value)
  const found = new Set<string>()
  for (const token of VERSION_TOKENS) {
    if (haystack.includes(token)) found.add(token)
  }
  if (haystack.includes('fruity')) found.add('instrumental')
  return found
}

function versionCompatible(discogsTitle: string, mbTitle: string, disambiguation: string): boolean {
  const discogs = versionTokens(discogsTitle)
  const mb = new Set([...versionTokens(mbTitle), ...versionTokens(disambiguation)])
  if (discogs.size === 0 || mb.size === 0) return true
  for (const token of discogs) {
    if (mb.has(token)) return true
  }
  const discogsInst = discogs.has('instrumental') || discogs.has('inst')
  const mbInst = mb.has('instrumental') || mb.has('inst')
  const discogsVocal = discogs.has('vocal')
  const mbVocal = mb.has('vocal')
  if (discogsInst && mbInst) return true
  if (discogsVocal && mbVocal) return true
  if (discogsInst && mbVocal) return false
  if (discogsVocal && mbInst) return false
  return discogs.size === 0 || mb.size === 0
}

function siblingAmbiguity(
  discogsTitle: string,
  candidates: TrackMatchInput['mbTracks']
): boolean {
  const core = coreTitle(discogsTitle)
  if (!core) return false
  const siblings = candidates.filter((track) => coreTitle(track.title) === core)
  if (siblings.length < 2) return false
  const discogsVersions = versionTokens(discogsTitle)
  if (discogsVersions.size === 0) return true
  const matchingVersion = siblings.filter((track) =>
    versionCompatible(discogsTitle, track.title, track.disambiguation)
  )
  return matchingVersion.length !== 1
}

export function matchDiscogsTrackToMb(input: TrackMatchInput): TrackMatchResult {
  const { discogs, mbTracks } = input
  if (mbTracks.length === 0) {
    return {
      matchStatus: 'unmatched',
      confidence: 0,
      reason: 'musicbrainz release has no recordings',
      recordingId: null,
    }
  }

  const byPosition = mbTracks.filter(
    (track) =>
      track.number.length > 0 &&
      discogs.position.length > 0 &&
      normalizePosition(track.number) === normalizePosition(discogs.position)
  )
  const byIndex = mbTracks.filter((track) => track.index === discogs.index)
  const byTitle = mbTracks.filter((track) => titleClose(discogs.title, track.title))

  const ranked = new Map<string, { track: TrackMatchInput['mbTracks'][number]; score: number }>()
  function bump(track: TrackMatchInput['mbTracks'][number], amount: number) {
    const current = ranked.get(track.recordingId)
    const next = (current?.score ?? 0) + amount
    ranked.set(track.recordingId, { track, score: next })
  }

  for (const track of byPosition) bump(track, 4)
  for (const track of byIndex) bump(track, 2)
  for (const track of byTitle) bump(track, 3)

  for (const track of mbTracks) {
    const delta = durationDeltaMs(discogs.durationMs, track.lengthMs)
    if (delta == null) continue
    if (delta <= DURATION_CLOSE_MS) bump(track, 2)
    else if (delta > DURATION_FAR_MS) bump(track, -3)
  }

  const scored = [...ranked.values()].sort((a, b) => b.score - a.score)
  const best = scored[0]

  if (!best || best.score < 5) {
    if (siblingAmbiguity(discogs.title, mbTracks) || byTitle.length > 1) {
      return {
        matchStatus: 'ambiguous',
        confidence: 0.25,
        reason: 'multiple recordings could match this title; not auto-accepted',
        recordingId: null,
      }
    }
    return {
      matchStatus: 'unmatched',
      confidence: 0,
      reason: 'no musicbrainz recording matched position, title, and duration',
      recordingId: null,
    }
  }

  const tied = scored.filter((row) => row.score === best.score)
  if (tied.length > 1) {
    return {
      matchStatus: 'ambiguous',
      confidence: 0.4,
      reason: 'two musicbrainz recordings scored equally; not auto-accepted',
      recordingId: null,
    }
  }

  if (siblingAmbiguity(discogs.title, mbTracks)) {
    return {
      matchStatus: 'ambiguous',
      confidence: 0.35,
      reason: 'vocal/instrumental siblings share this title; not auto-accepted',
      recordingId: null,
    }
  }

  const titleOk = titleClose(discogs.title, best.track.title)
  const positionOk =
    (discogs.position.length > 0 &&
      normalizePosition(best.track.number) === normalizePosition(discogs.position)) ||
    best.track.index === discogs.index
  const delta = durationDeltaMs(discogs.durationMs, best.track.lengthMs)
  const durationFar = delta != null && delta > DURATION_FAR_MS

  if (!titleOk) {
    return {
      matchStatus: 'ambiguous',
      confidence: 0.3,
      reason: 'position aligned without a title match; not auto-accepted',
      recordingId: null,
    }
  }

  if (!positionOk && best.score < 7) {
    return {
      matchStatus: 'ambiguous',
      confidence: 0.35,
      reason: 'title matched without position; not auto-accepted',
      recordingId: null,
    }
  }

  if (durationFar) {
    return {
      matchStatus: 'ambiguous',
      confidence: 0.35,
      reason: 'duration disagrees with the candidate recording; not auto-accepted',
      recordingId: null,
    }
  }

  const confidence = Math.min(0.99, 0.55 + best.score * 0.05)
  return {
    matchStatus: 'matched',
    confidence,
    reason: 'matched via musicbrainz release using position, title, and duration',
    recordingId: best.track.recordingId,
  }
}

export function detectNewReleaseIds(
  previousIds: Iterable<number>,
  nextIds: Iterable<number>
): number[] {
  const seen = new Set<number>()
  for (const id of previousIds) {
    if (id > 0) seen.add(id)
  }
  const fresh: number[] = []
  const added = new Set<number>()
  for (const id of nextIds) {
    if (id > 0 && !seen.has(id) && !added.has(id)) {
      fresh.push(id)
      added.add(id)
    }
  }
  return fresh
}

export function detectNewInstanceIds(
  previousIds: Iterable<number>,
  nextIds: Iterable<number>
): number[] {
  return detectNewReleaseIds(previousIds, nextIds)
}

export type ReleaseMatchCandidate = {
  mbid: string
  via: 'discogs_url' | 'barcode' | 'catno'
}

export function classifyReleaseMatch(
  candidates: ReleaseMatchCandidate[]
): { matchStatus: MatchStatus; confidence: number; reason: string; mbid: string | null } {
  if (candidates.length === 0) {
    return {
      matchStatus: 'unmatched',
      confidence: 0,
      reason: 'no musicbrainz release matched this pressing via discogs url, barcode, or catalog number',
      mbid: null,
    }
  }

  const urlHits = candidates.filter((row) => row.via === 'discogs_url')
  if (urlHits.length === 1 && urlHits[0]) {
    return {
      matchStatus: 'matched',
      confidence: 0.95,
      reason: 'musicbrainz release linked by discogs url relationship',
      mbid: urlHits[0].mbid,
    }
  }
  if (urlHits.length > 1) {
    return {
      matchStatus: 'ambiguous',
      confidence: 0.4,
      reason: 'multiple musicbrainz releases claim this discogs url',
      mbid: null,
    }
  }

  const barcodeHits = uniqueMbids(candidates.filter((row) => row.via === 'barcode'))
  if (barcodeHits.length === 1 && barcodeHits[0]) {
    return {
      matchStatus: 'matched',
      confidence: 0.85,
      reason: 'musicbrainz release matched by barcode',
      mbid: barcodeHits[0],
    }
  }
  if (barcodeHits.length > 1) {
    return {
      matchStatus: 'ambiguous',
      confidence: 0.4,
      reason: 'multiple musicbrainz releases share this barcode',
      mbid: null,
    }
  }

  const catnoHits = uniqueMbids(candidates.filter((row) => row.via === 'catno'))
  if (catnoHits.length === 1 && catnoHits[0]) {
    return {
      matchStatus: 'matched',
      confidence: 0.7,
      reason: 'musicbrainz release matched by catalog number',
      mbid: catnoHits[0],
    }
  }
  if (catnoHits.length > 1) {
    return {
      matchStatus: 'ambiguous',
      confidence: 0.35,
      reason: 'multiple musicbrainz releases share this catalog number',
      mbid: null,
    }
  }

  return {
    matchStatus: 'unmatched',
    confidence: 0,
    reason: 'no musicbrainz release matched this pressing via discogs url, barcode, or catalog number',
    mbid: null,
  }
}

function uniqueMbids(rows: ReleaseMatchCandidate[]): string[] {
  return [...new Set(rows.map((row) => row.mbid))]
}

export function isWeakRecordingSearch(status: MatchStatus): boolean {
  return status !== 'matched'
}
