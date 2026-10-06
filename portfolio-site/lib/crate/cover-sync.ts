import { DISCOGS_USER_AGENT } from '../discogs.ts'
import { isProductionRedisNamespace } from '../discogs-store.ts'
import { fetchDiscogsReleaseDetail } from './discogs-release.ts'
import {
  COVER_ART_USER_AGENT,
  coverBlobPath,
  coverContentHash,
  createCoverPacer,
  discoverCover,
  lookupCoverSources,
  manifestFromDiscovery,
  type CoverDiscoverInput,
  type CoverDiscoverResult,
  type CoverManifest,
} from './cover.ts'
import { blobReadWriteToken, putCoverBlob } from './cover-blob.ts'
import type { CoverStore } from './cover-store.ts'
import { fixturePressing } from './read.ts'
import type { CrateStore } from './store.ts'

export const DISCOGS_AUTH_MIN_INTERVAL_MS = 1100
export const DISCOGS_UNAUTH_MIN_INTERVAL_MS = 2500

export function discogsCoverMinIntervalMs(
  env: Record<string, string | undefined> = process.env
): number {
  return env.DISCOGS_TOKEN?.trim() ? DISCOGS_AUTH_MIN_INTERVAL_MS : DISCOGS_UNAUTH_MIN_INTERVAL_MS
}

export type CoverSyncArgs = {
  ids?: number[]
  limit?: number
  force?: boolean
  prod?: boolean
  dryRun?: boolean
}

export type CoverSyncRow = {
  releaseId: number
  skipped: boolean
  reason?: string
  discogsPx: { width: number; height: number; url: string } | null
  best: {
    source: CoverManifest['source']
    width: number
    height: number
    originalUrl: string
    stored: boolean
    url: string
  } | null
  blob: 'stored' | 'skipped-no-token' | 'skipped-discogs-terms' | 'failed' | 'unchanged' | null
}

export function parseCoverSyncArgs(argv: string[]): CoverSyncArgs {
  const args: CoverSyncArgs = {}
  for (const raw of argv) {
    if (raw === '--force') args.force = true
    else if (raw === '--prod') args.prod = true
    else if (raw === '--dry-run') args.dryRun = true
    else if (raw.startsWith('--ids=')) {
      args.ids = raw
        .slice('--ids='.length)
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    } else if (raw.startsWith('--limit=')) {
      const limit = Number.parseInt(raw.slice('--limit='.length), 10)
      if (Number.isInteger(limit) && limit > 0) args.limit = limit
    }
  }
  return args
}

export function assertCoverSyncAllowed(
  options: { prod?: boolean; env?: Record<string, string | undefined> } = {}
): void {
  if (options.prod) return
  const env = options.env ?? process.env
  if (isProductionRedisNamespace(env)) {
    throw new Error('refusing prod Redis keys; pass --prod')
  }
}

async function storeCoverBytes(
  result: CoverDiscoverResult,
  token: string | null
): Promise<{ url: string; hash: string } | null> {
  const best = result.best
  if (!best || best.source !== 'caa' || !best.bytes) {
    return null
  }
  if (!token) return null
  const hash = coverContentHash(best.bytes)
  const pathname = coverBlobPath(hash, best.contentType ?? 'image/jpeg')
  const stored = await putCoverBlob(pathname, best.bytes, {
    token,
    contentType: best.contentType,
  })
  if (!stored) return null
  return { url: stored.url, hash }
}

export async function syncCovers(options: {
  ids: number[]
  force?: boolean
  dryRun?: boolean
  coverStore?: CoverStore | null
  crateStore?: CrateStore | null
  env?: Record<string, string | undefined>
  lookup?: (releaseId: number) => Promise<CoverDiscoverInput>
  discover?: typeof discoverCover
}): Promise<CoverSyncRow[]> {
  const env = options.env ?? process.env
  const token = blobReadWriteToken(env)
  const caaPacer = createCoverPacer({ userAgent: COVER_ART_USER_AGENT })
  const discogsPacer = createCoverPacer({
    userAgent: DISCOGS_USER_AGENT,
    minIntervalMs: discogsCoverMinIntervalMs(env),
  })
  const rows: CoverSyncRow[] = []
  const lookup = options.lookup
  const discover = options.discover ?? discoverCover

  for (const releaseId of options.ids) {
    const existing = options.force || options.dryRun ? null : await options.coverStore?.get(releaseId)
    if (existing) {
      rows.push({
        releaseId,
        skipped: true,
        reason: 'already stored',
        discogsPx: null,
        best: {
          source: existing.source,
          width: existing.width,
          height: existing.height,
          originalUrl: existing.originalUrl,
          stored: existing.stored,
          url: existing.url,
        },
        blob: 'unchanged',
      })
      continue
    }

    const input = lookup
      ? await lookup(releaseId)
      : await lookupCoverSources(releaseId, {
          fetchDiscogs: (id) =>
            fetchDiscogsReleaseDetail(id, { fetchImpl: discogsPacer.fetch }),
          getPressing: async (id) => {
            const stored = await options.crateStore?.getPressing(id)
            return stored ?? fixturePressing(id)
          },
        })
    const discovered = await discover(input, { pacer: caaPacer })
    const best = discovered.best
    if (!best) {
      rows.push({
        releaseId,
        skipped: true,
        reason: 'no cover found',
        discogsPx: discovered.discogsPx,
        best: null,
        blob: null,
      })
      continue
    }

    let blobStatus: CoverSyncRow['blob'] = null
    let stored: { url: string; hash: string } | null = null
    if (best.source === 'discogs') {
      blobStatus = 'skipped-discogs-terms'
    } else if (!token) {
      blobStatus = 'skipped-no-token'
    } else if (options.dryRun) {
      blobStatus = 'skipped-no-token'
    } else {
      stored = await storeCoverBytes(discovered, token)
      blobStatus = stored ? 'stored' : 'failed'
    }

    const manifest = manifestFromDiscovery(discovered, stored)
    if (!options.dryRun && manifest && options.coverStore) {
      await options.coverStore.set(manifest)
    }

    rows.push({
      releaseId,
      skipped: false,
      discogsPx: discovered.discogsPx,
      best: manifest
        ? {
            source: manifest.source,
            width: manifest.width,
            height: manifest.height,
            originalUrl: manifest.originalUrl,
            stored: manifest.stored,
            url: manifest.url,
          }
        : null,
      blob: blobStatus,
    })
  }

  return rows
}
