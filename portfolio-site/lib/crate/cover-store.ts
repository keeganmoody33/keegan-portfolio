import { Redis } from '@upstash/redis'
import {
  REDIS_DURABLE_READ_INIT,
  REDIS_READ_CACHE,
  createUpstashRedis,
  resolveRedisRestConfig,
  type RedisRestConfig,
  type UpstashFetch,
} from '../discogs-store.ts'
import { crateRedisKeys } from './store.ts'
import { isCoverManifest, type CoverManifest } from './cover-display.ts'

export type CoverStore = {
  get(releaseId: number): Promise<CoverManifest | null>
  getMany(releaseIds: number[]): Promise<Map<number, CoverManifest>>
  set(manifest: CoverManifest): Promise<void>
}

function positiveIds(releaseIds: number[]): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const value of releaseIds) {
    if (!Number.isInteger(value) || value <= 0 || seen.has(value)) continue
    seen.add(value)
    ids.push(value)
  }
  return ids
}

class RedisCoverStore implements CoverStore {
  private readonly keys: ReturnType<typeof crateRedisKeys>
  private readonly readRedis: Redis
  private readonly writeRedis: Redis

  constructor(
    keys: ReturnType<typeof crateRedisKeys>,
    readRedis: Redis,
    writeRedis: Redis
  ) {
    this.keys = keys
    this.readRedis = readRedis
    this.writeRedis = writeRedis
  }

  async get(releaseId: number): Promise<CoverManifest | null> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null
    const value = await this.readRedis.get<unknown>(this.keys.cover(releaseId))
    return isCoverManifest(value) ? value : null
  }

  async getMany(releaseIds: number[]): Promise<Map<number, CoverManifest>> {
    const result = new Map<number, CoverManifest>()
    if (process.env.NEXT_PHASE === 'phase-production-build') return result
    const ids = positiveIds(releaseIds)
    if (ids.length === 0) return result
    const chunkSize = 50
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const keys = chunk.map((id) => this.keys.cover(id))
      const values = await this.readRedis.mget<(unknown | null)[]>(...keys)
      const rows = Array.isArray(values) ? values : []
      chunk.forEach((id, index) => {
        const value = rows[index]
        if (isCoverManifest(value)) result.set(id, value)
      })
    }
    return result
  }

  async set(manifest: CoverManifest): Promise<void> {
    await this.writeRedis.set(this.keys.cover(manifest.releaseId), manifest)
  }
}

export function createMemoryCoverStore(
  initial: Record<number, CoverManifest> = {}
): CoverStore {
  const covers = { ...initial }
  return {
    async get(releaseId) {
      return covers[releaseId] ?? null
    },
    async getMany(releaseIds) {
      const result = new Map<number, CoverManifest>()
      for (const id of positiveIds(releaseIds)) {
        const cover = covers[id]
        if (cover) result.set(id, cover)
      }
      return result
    },
    async set(manifest) {
      covers[manifest.releaseId] = manifest
    },
  }
}

export function createRedisCoverStore(
  config: RedisRestConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: UpstashFetch = fetch
): CoverStore {
  const keys = crateRedisKeys(env)
  const readRedis = createUpstashRedis(config, REDIS_DURABLE_READ_INIT, fetchImpl)
  const writeRedis = createUpstashRedis(config, { cache: REDIS_READ_CACHE }, fetchImpl)
  return new RedisCoverStore(keys, readRedis, writeRedis)
}

let defaultStore: CoverStore | null | undefined

export function getDefaultCoverStore(
  env: Record<string, string | undefined> = process.env
): CoverStore | null {
  if (defaultStore !== undefined) return defaultStore
  const config = resolveRedisRestConfig(env)
  if (!config) {
    defaultStore = null
    return null
  }
  defaultStore = createRedisCoverStore(config, env)
  return defaultStore
}

export function resetDefaultCoverStore(): void {
  defaultStore = undefined
}
