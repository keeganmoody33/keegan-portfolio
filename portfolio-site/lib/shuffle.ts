export type Rng = () => number

export const CRATE_PULL_ONE_ID = 'crate-pull-one'

/**
 * Fisher-Yates copy. Does not mutate `items`.
 * `rng` must return a number in [0, 1). Defaults to `Math.random`.
 */
export function shuffledCopy<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const current = copy[i]
    const swap = copy[j]
    if (current === undefined || swap === undefined) continue
    copy[i] = swap
    copy[j] = current
  }
  return copy
}

export function listedReleaseIds(
  releases: ReadonlyArray<{ releaseId: number }>
): number[] {
  return releases.map((release) => release.releaseId).filter((id) => id > 0)
}

export function pickListedId(
  releases: ReadonlyArray<{ releaseId: number }>,
  rng: Rng = Math.random
): number | null {
  const ids = listedReleaseIds(releases)
  if (ids.length === 0) return null
  const index = Math.floor(rng() * ids.length)
  return ids[index] ?? null
}
