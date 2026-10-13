/**
 * Preview-only house banner prototype helpers.
 * Production (`VERCEL_ENV=production`) never enables this surface.
 */

import { discogsGridHotlink } from './crate/cover-display.ts'
import { shuffledCopy, type Rng } from './shuffle.ts'

export const HOUSE_BANNER_WORDMARK = 'lecturesfrom'
export const HOUSE_BANNER_SEEN_KEY = 'lf:house-banner:seen'
export const HOUSE_BANNER_PREVIEW_PATH = '/preview/banner'
export const HOUSE_BANNER_BOOT_MS = 1800
export const HOUSE_BANNER_ASSEMBLE_MS = 1400
export const HOUSE_BANNER_BOOT_LINES = ['power on', 'house', 'lecturesfrom'] as const

export type HouseBannerPhase = 'boot' | 'assemble' | 'playing'

export type HouseBannerRelease = {
  releaseId: number
  artist: string
  title: string
  label: string
  thumbnail: string
  cover: string
}

export type HouseBannerSource = {
  releaseId: number
  artist: string
  title: string
  label: string
  thumbnail: string
  cover: string
}

export function isHouseBannerPrototypeEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.VERCEL_ENV !== 'production'
}

export function lecturesfromWordmark(value: string = HOUSE_BANNER_WORDMARK): string {
  if (value !== 'lecturesfrom' || value[0] !== 'l') {
    throw new Error('house banner wordmark must be lowercase lecturesfrom')
  }
  return value
}

export function houseBannerGlyphs(
  wordmark: string = HOUSE_BANNER_WORDMARK
): string[] {
  return Array.from(lecturesfromWordmark(wordmark))
}

export function toHouseBannerRelease(
  release: HouseBannerSource
): HouseBannerRelease | null {
  if (release.releaseId <= 0) return null
  return {
    releaseId: release.releaseId,
    artist: release.artist,
    title: release.title,
    label: release.label,
    thumbnail: release.thumbnail,
    cover: release.cover,
  }
}

export function uniqueBannerReleases(
  releases: readonly HouseBannerSource[]
): HouseBannerRelease[] {
  const seen = new Set<number>()
  const out: HouseBannerRelease[] = []
  for (const release of releases) {
    const mapped = toHouseBannerRelease(release)
    if (!mapped || seen.has(mapped.releaseId)) continue
    seen.add(mapped.releaseId)
    out.push(mapped)
  }
  return out
}

export function buildBannerQueue(
  releases: readonly HouseBannerRelease[],
  initialId: number | null,
  rng: Rng = Math.random
): HouseBannerRelease[] {
  const shuffled = shuffledCopy(releases, rng)
  if (initialId == null) return shuffled
  const start = shuffled.findIndex((release) => release.releaseId === initialId)
  if (start <= 0) return shuffled
  return [...shuffled.slice(start), ...shuffled.slice(0, start)]
}

export function wrapIndex(index: number, length: number, delta: number): number {
  if (length <= 0) return 0
  return (((index + delta) % length) + length) % length
}

export function pullOneIndex(
  current: number,
  length: number,
  rng: Rng = Math.random
): number {
  if (length <= 1) return 0
  const offset = 1 + Math.floor(rng() * (length - 1))
  return wrapIndex(current, length, offset)
}

export function initialBannerPhase(input: {
  reducedMotion: boolean
  seen: boolean
  forceBoot: boolean
}): HouseBannerPhase {
  if (input.reducedMotion) return 'playing'
  if (input.forceBoot) return 'boot'
  if (input.seen) return 'playing'
  return 'boot'
}

export function nextBannerPhase(phase: HouseBannerPhase): HouseBannerPhase {
  switch (phase) {
    case 'boot':
      return 'assemble'
    case 'assemble':
      return 'playing'
    case 'playing':
      return 'playing'
    default: {
      const exhaustive: never = phase
      return exhaustive
    }
  }
}

export function phaseDurationMs(phase: HouseBannerPhase): number | null {
  switch (phase) {
    case 'boot':
      return HOUSE_BANNER_BOOT_MS
    case 'assemble':
      return HOUSE_BANNER_ASSEMBLE_MS
    case 'playing':
      return null
    default: {
      const exhaustive: never = phase
      return exhaustive
    }
  }
}

export function bannerCoverUrl(release: HouseBannerRelease): string {
  return discogsGridHotlink(release.thumbnail, release.cover)
}

export function bannerLiveText(release: HouseBannerRelease | null): string {
  if (!release) return ''
  const label = release.label ? ` · ${release.label}` : ''
  return `now playing: ${release.artist} — ${release.title}${label}`
}

export function readForceBoot(search: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search
  return new URLSearchParams(query).get('boot') === '1'
}
