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
  const queued: number[] = []
  const seenQueued = new Set<number>()

  async function add(id: number) {
    if (id <= 0 || seenQueued.has(id)) return
    queued.push(id)
    seenQueued.add(id)
  }

  for (const id of newIds) await add(id)

  for (const id of nextIds) {
    if (seenQueued.has(id)) continue
    const pressing = await store.getPressing(id)
    if (shouldRefreshPressing(pressing, nowMs)) await add(id)
  }

  if (queued.length > 0) {
    await store.enqueue(queued)
  }
  await store.setSeen(nextIds)
  return { newIds, queued }
}
