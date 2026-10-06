import { cache } from 'react'
import {
  isCompleteCollection,
  readCachedCollection,
  type DiscogsRelease,
} from '../discogs.ts'
import { collectionReleaseId } from './sync.ts'
import {
  getDefaultCrateStore,
  type CrateStore,
} from './store.ts'
import { CRATE_SCHEMA_VERSION, type StoredPressing, type TrackOccurrence } from './types.ts'
import { isoFromMs, storedPressingHasVisitorFacts } from './preserve.ts'
import { withReadableDescription } from './description.ts'
import { hydratePressing } from './lifecycle.ts'
import bootsy from './fixtures/573292.json' with { type: 'json' }
import goodieMob from './fixtures/240128.json' with { type: 'json' }
import mtume from './fixtures/567894.json' with { type: 'json' }

const readCollectionOnce = cache(async () => readCachedCollection())

const FIXTURES: Record<number, StoredPressing> = {}

function asPressing(value: unknown): StoredPressing | null {
  if (!value || typeof value !== 'object') return null
  const record = value as StoredPressing
  if (typeof record.releaseId !== 'number' || record.releaseId <= 0) return null
  if (!record.facts || !Array.isArray(record.tracks)) return null
  return record
}

for (const raw of [bootsy, goodieMob, mtume]) {
  const pressing = asPressing(raw)
  if (pressing) FIXTURES[pressing.releaseId] = pressing
}

export const CRATE_FIXTURE_IDS = Object.freeze(
  Object.keys(FIXTURES).map((id) => Number.parseInt(id, 10))
)

export function fixturePressing(releaseId: number): StoredPressing | null {
  const pressing = FIXTURES[releaseId]
  return pressing ? hydratePressing(pressing) : null
}

export const readStoredPressingOnce = cache(async (releaseId: number) =>
  readStoredPressing(releaseId)
)

export function parseReleaseParam(raw: string): number | null {
  if (!/^[1-9]\d{0,10}$/.test(raw)) return null
  const id = Number.parseInt(raw, 10)
  return Number.isSafeInteger(id) ? id : null
}

export function unavailableHeading(
  releaseId: number,
  listed?: Pick<DiscogsRelease, 'catno'> | null
): string {
  const catno = listed?.catno?.trim()
  return catno || String(releaseId)
}

export function unavailablePressing(
  releaseId: number,
  listed?: DiscogsRelease | null,
  nowMs = Date.now()
): StoredPressing {
  const heading = unavailableHeading(releaseId, listed)
  return pendingPressingFromRelease(
    {
      title: heading,
      artist: '',
      year: 0,
      thumbnail: '',
      cover: '',
      format: '',
      label: '',
      catno: heading,
      discogsUrl: listed?.discogsUrl || '',
      releaseId,
      instanceId: listed?.instanceId ?? 0,
    },
    releaseId,
    nowMs
  )
}

export function pendingPressingFromRelease(
  release: DiscogsRelease,
  releaseId: number,
  nowMs = Date.now()
): StoredPressing {
  const checkedAt = isoFromMs(nowMs)
  return hydratePressing({
    schemaVersion: CRATE_SCHEMA_VERSION,
    releaseId,
    entryInstanceIds: release.instanceId ? [release.instanceId] : [],
    facts: {
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
    },
    description: null,
    tracks: [] as TrackOccurrence[],
    mbRelease: {
      mbid: null,
      url: null,
      matchStatus: 'pending',
      confidence: 0,
      reason: 'queued for enrichment',
    },
    recordings: {},
    researchFacts: [],
    provenance: {
      sourceUrls: release.discogsUrl ? [release.discogsUrl] : [],
      matchStatus: 'pending',
      confidence: 0,
      reason: 'queued for enrichment',
      checkedAt,
      refreshAfter: checkedAt,
      lastError: null,
    },
  })
}

export type RecordDetailRead =
  | { status: 'ok'; pressing: StoredPressing; from: 'store' | 'fixture' | 'collection' }
  | { status: 'not_found' }
  | { status: 'unavailable'; listed: DiscogsRelease | null }

export async function readStoredPressing(
  releaseId: number,
  options: { store?: CrateStore | null; collection?: DiscogsRelease[] | null } = {}
): Promise<RecordDetailRead> {
  let collectionReleases = options.collection
  let collectionComplete = options.collection !== undefined
  if (collectionReleases === undefined) {
    try {
      const collection = await readCollectionOnce()
      if (collection) {
        collectionReleases = collection.releases
        collectionComplete = isCompleteCollection(collection)
      } else {
        collectionReleases = null
        collectionComplete = false
      }
    } catch {
      collectionReleases = null
      collectionComplete = false
    }
  }

  const listed = collectionReleases?.find(
    (release) => collectionReleaseId(release) === releaseId
  )

  const store = options.store === undefined ? getDefaultCrateStore() : options.store
  if (store) {
    try {
      const stored = await (store.getPressingCached?.(releaseId) ?? store.getPressing(releaseId))
      if (stored && storedPressingHasVisitorFacts(stored)) {
        return {
          status: 'ok',
          pressing: presentPressing(hydratePressing(stored), listed),
          from: 'store',
        }
      }
      if (stored && !storedPressingHasVisitorFacts(stored)) {
        const fixture = fixturePressing(releaseId)
        if (fixture) {
          return {
            status: 'ok',
            pressing: presentPressing(fixture, listed),
            from: 'fixture',
          }
        }
      }
    } catch {
      const fixture = fixturePressing(releaseId)
      if (fixture) {
        return {
          status: 'ok',
          pressing: presentPressing(fixture, listed),
          from: 'fixture',
        }
      }
      return { status: 'unavailable', listed: listed ?? null }
    }
  }

  const fixture = fixturePressing(releaseId)
  if (fixture) {
    return {
      status: 'ok',
      pressing: presentPressing(fixture, listed),
      from: 'fixture',
    }
  }

  if (!listed) {
    if (!collectionReleases || collectionReleases.length === 0 || !collectionComplete) {
      return { status: 'unavailable', listed: null }
    }
    return { status: 'not_found' }
  }
  return {
    status: 'ok',
    pressing: pendingPressingFromRelease(listed, releaseId),
    from: 'collection',
  }
}

function presentPressing(
  pressing: StoredPressing,
  listed: DiscogsRelease | null | undefined
): StoredPressing {
  return withReadableDescription(withCollectionArt(pressing, listed))
}

function withCollectionArt(
  pressing: StoredPressing,
  listed: DiscogsRelease | null | undefined
): StoredPressing {
  if (!listed) return pressing
  const thumbnail = listed.thumbnail || listed.cover || pressing.facts.thumbnail
  const cover = listed.cover || listed.thumbnail || pressing.facts.cover
  if (thumbnail === pressing.facts.thumbnail && cover === pressing.facts.cover) {
    return pressing
  }
  return {
    ...pressing,
    facts: {
      ...pressing.facts,
      thumbnail,
      cover,
    },
  }
}

export async function findCollectionRelease(
  releaseId: number
): Promise<DiscogsRelease | null> {
  try {
    const collection = await readCollectionOnce()
    if (!collection) return null
    return (
      collection.releases.find((release) => collectionReleaseId(release) === releaseId) ??
      null
    )
  } catch {
    return null
  }
}
