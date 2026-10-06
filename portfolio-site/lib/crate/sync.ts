import type { DiscogsCollection, DiscogsRelease } from '../discogs.ts'
import { extractReleaseIdFromUrl } from '../discogs.ts'
import { detectNewReleaseIds } from './match.ts'
import { shouldRefreshPressing } from './preserve.ts'
import type { CrateStore } from './store.ts'

export function collectionReleaseId(release: DiscogsRelease): number {
  if (typeof release.releaseId === 'number' && release.releaseId > 0) {
    return release.releaseId
  }
  return extractReleaseIdFromUrl(release.discogsUrl) ?? 0
}

export function collectionReleaseIds(collection: DiscogsCollection | null): number[] {
  if (!collection) return []
  const ids: number[] = []
  const seen = new Set<number>()
  for (const release of collection.releases) {
    const id = collectionReleaseId(release)
    if (id > 0 && !seen.has(id)) {
      ids.push(id)
      seen.add(id)
    }
  }
  return ids
}

export async function queueNewAndMissing(
  store: CrateStore,
  previousIds: Iterable<number>,
  nextCollection: DiscogsCollection,
  nowMs = Date.now()
): Promise<{ newIds: number[]; queued: number[] }> {
  const nextIds = collectionReleaseIds(nextCollection)
  const newIds = detectNewReleaseIds(previousIds, nextIds)
  const newSet = new Set(newIds)
  const pressings = await store.getPressings(nextIds)
  const staleIds: number[] = []

  for (const id of nextIds) {
    if (newSet.has(id)) continue
    const pressing = pressings.get(id) ?? null
    if (shouldRefreshPressing(pressing, nowMs)) staleIds.push(id)
  }

  const queued: number[] = []
  if (newIds.length > 0) {
    queued.push(...(await store.enqueue(newIds, { front: true, nowMs })))
  }
  if (staleIds.length > 0) {
    queued.push(...(await store.enqueue(staleIds, { front: false, nowMs })))
  }
  await store.setSeen(nextIds)
  return { newIds, queued }
}
