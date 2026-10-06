import { readCachedCollection, type DiscogsRelease } from '../discogs.ts'
import { collectionReleaseId } from './sync.ts'
import { getDefaultCrateStore, type CrateStore } from './store.ts'
import { CRATE_SCHEMA_VERSION, type StoredPressing, type TrackOccurrence } from './types.ts'
import { isoFromMs } from './preserve.ts'
import bootsy from './fixtures/573292.json' with { type: 'json' }
import goodieMob from './fixtures/240128.json' with { type: 'json' }
import mtume from './fixtures/567894.json' with { type: 'json' }

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
  return FIXTURES[releaseId] ?? null
}

export function parseReleaseParam(raw: string): number | null {
  if (!/^[1-9]\d{0,10}$/.test(raw)) return null
  const id = Number.parseInt(raw, 10)
  return Number.isSafeInteger(id) ? id : null
}

export function unavailablePressing(releaseId: number, nowMs = Date.now()): StoredPressing {
  return pendingPressingFromRelease(
    {
      title: '',
      artist: '',
      year: 0,
      thumbnail: '',
      cover: '',
      format: '',
      label: '',
      catno: '',
      discogsUrl: '',
      releaseId,
      instanceId: 0,
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
  return {
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
    provenance: {
      sourceUrls: release.discogsUrl ? [release.discogsUrl] : [],
      matchStatus: 'pending',
      confidence: 0,
      reason: 'queued for enrichment',
      checkedAt,
      refreshAfter: checkedAt,
      lastError: null,
    },
  }
}

export type RecordDetailRead =
  | { status: 'ok'; pressing: StoredPressing; from: 'store' | 'fixture' | 'collection' }
  | { status: 'not_found' }
  | { status: 'unavailable' }

export async function readStoredPressing(
  releaseId: number,
  options: { store?: CrateStore | null; collection?: DiscogsRelease[] | null } = {}
): Promise<RecordDetailRead> {
  let collectionReleases = options.collection
  if (collectionReleases === undefined) {
    try {
      const collection = await readCachedCollection()
      collectionReleases = collection?.releases ?? []
    } catch {
      collectionReleases = null
    }
  }

  const listed = collectionReleases?.find(
    (release) => collectionReleaseId(release) === releaseId
  )

  const store = options.store === undefined ? getDefaultCrateStore() : options.store
  if (store) {
    try {
      const stored = await store.getPressing(releaseId)
      if (stored) {
        return {
          status: 'ok',
          pressing: withCollectionArt(stored, listed),
          from: 'store',
        }
      }
    } catch {
      const fixture = fixturePressing(releaseId)
      if (fixture) {
        return {
          status: 'ok',
          pressing: withCollectionArt(fixture, listed),
          from: 'fixture',
        }
      }
      return { status: 'unavailable' }
    }
  }

  const fixture = fixturePressing(releaseId)
  if (fixture) {
    return {
      status: 'ok',
      pressing: withCollectionArt(fixture, listed),
      from: 'fixture',
    }
  }

  if (collectionReleases === null && !listed) return { status: 'unavailable' }
  if (!listed) return { status: 'not_found' }
  return {
    status: 'ok',
    pressing: pendingPressingFromRelease(listed, releaseId),
    from: 'collection',
  }
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
    const collection = await readCachedCollection()
    if (!collection) return null
    return (
      collection.releases.find((release) => collectionReleaseId(release) === releaseId) ??
      null
    )
  } catch {
    return null
  }
}
