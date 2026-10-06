import { Redis } from '@upstash/redis'
import {
  REDIS_READ_CACHE,
  createUpstashRedis,
  discogsKeyPrefix,
  resolveRedisRestConfig,
  type RedisRestConfig,
  type UpstashFetch,
} from '../discogs-store.ts'
import type { CollectionEntry, StoredPressing, StoredRecording } from './types.ts'

export type CrateRedisKeys = {
  prefix: string
  queue: string
  seen: string
  enrichLock: string
  enrichMeta: string
  pressing: (releaseId: number) => string
  recording: (mbid: string) => string
}

export function crateRedisKeys(env: Record<string, string | undefined> = process.env): CrateRedisKeys {
  const prefix = discogsKeyPrefix(env)
  return {
    prefix,
    queue: `${prefix}crate:queue:v1`,
    seen: `${prefix}crate:seen:v1`,
    enrichLock: `${prefix}crate:enrich:lock:v1`,
    enrichMeta: `${prefix}crate:enrich:meta:v1`,
    pressing: (releaseId: number) => `${prefix}crate:pressing:${releaseId}:v1`,
    recording: (mbid: string) => `${prefix}crate:recording:${mbid}:v1`,
  }
}

export type CrateStore = {
  getPressing(releaseId: number): Promise<StoredPressing | null>
  setPressing(pressing: StoredPressing): Promise<void>
  getRecording(mbid: string): Promise<StoredRecording | null>
  setRecording(recording: StoredRecording): Promise<void>
  getQueue(): Promise<number[]>
  enqueue(releaseIds: number[]): Promise<number[]>
  dequeue(count: number): Promise<number[]>
  getSeen(): Promise<number[]>
  setSeen(releaseIds: number[]): Promise<void>
  acquireEnrichLock(ttlSeconds: number): Promise<boolean>
  releaseEnrichLock(): Promise<void>
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ids: number[] = []
  const seen = new Set<number>()
  for (const item of value) {
    if (typeof item === 'number' && Number.isInteger(item) && item > 0 && !seen.has(item)) {
      ids.push(item)
      seen.add(item)
    }
  }
  return ids
}

function isStoredPressing(value: unknown): value is StoredPressing {
  if (!value || typeof value !== 'object') return false
  const record = value as StoredPressing
  return (
    typeof record.releaseId === 'number' &&
    record.releaseId > 0 &&
    record.facts != null &&
    typeof record.facts.title === 'string' &&
    Array.isArray(record.tracks) &&
    record.provenance != null
  )
}

function isStoredRecording(value: unknown): value is StoredRecording {
  if (!value || typeof value !== 'object') return false
  const record = value as StoredRecording
  return typeof record.mbid === 'string' && record.mbid.length > 0 && Array.isArray(record.credits)
}

class RedisCrateStore implements CrateStore {
  private readonly keys: CrateRedisKeys
  private readonly readRedis: Redis
  private readonly writeRedis: Redis

  constructor(keys: CrateRedisKeys, readRedis: Redis, writeRedis: Redis) {
    this.keys = keys
    this.readRedis = readRedis
    this.writeRedis = writeRedis
  }

  async getPressing(releaseId: number): Promise<StoredPressing | null> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null
    const value = await this.readRedis.get<unknown>(this.keys.pressing(releaseId))
    return isStoredPressing(value) ? value : null
  }

  async setPressing(pressing: StoredPressing): Promise<void> {
    await this.writeRedis.set(this.keys.pressing(pressing.releaseId), pressing)
  }

  async getRecording(mbid: string): Promise<StoredRecording | null> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null
    const value = await this.readRedis.get<unknown>(this.keys.recording(mbid))
    return isStoredRecording(value) ? value : null
  }

  async setRecording(recording: StoredRecording): Promise<void> {
    await this.writeRedis.set(this.keys.recording(recording.mbid), recording)
  }

  async getQueue(): Promise<number[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return []
    return asNumberArray(await this.readRedis.get<unknown>(this.keys.queue))
  }

  async enqueue(releaseIds: number[]): Promise<number[]> {
    const current = asNumberArray(await this.writeRedis.get<unknown>(this.keys.queue))
    const next = asNumberArray([...current, ...releaseIds])
    await this.writeRedis.set(this.keys.queue, next)
    return next
  }

  async dequeue(count: number): Promise<number[]> {
    const current = asNumberArray(await this.writeRedis.get<unknown>(this.keys.queue))
    const taken = current.slice(0, Math.max(0, count))
    const rest = current.slice(taken.length)
    await this.writeRedis.set(this.keys.queue, rest)
    return taken
  }

  async getSeen(): Promise<number[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return []
    return asNumberArray(await this.readRedis.get<unknown>(this.keys.seen))
  }

  async setSeen(releaseIds: number[]): Promise<void> {
    await this.writeRedis.set(this.keys.seen, asNumberArray(releaseIds))
  }

  async acquireEnrichLock(ttlSeconds: number): Promise<boolean> {
    const result = await this.writeRedis.set(this.keys.enrichLock, '1', {
      nx: true,
      ex: ttlSeconds,
    })
    return result === 'OK'
  }

  async releaseEnrichLock(): Promise<void> {
    await this.writeRedis.del(this.keys.enrichLock)
  }
}

export function createMemoryCrateStore(
  initial: {
    pressings?: Record<number, StoredPressing>
    recordings?: Record<string, StoredRecording>
    queue?: number[]
    seen?: number[]
  } = {}
): CrateStore & {
  pressings: Record<number, StoredPressing>
  recordings: Record<string, StoredRecording>
  queue: number[]
  seen: number[]
  lockHeld: boolean
} {
  const store = {
    pressings: { ...(initial.pressings ?? {}) },
    recordings: { ...(initial.recordings ?? {}) },
    queue: asNumberArray(initial.queue ?? []),
    seen: asNumberArray(initial.seen ?? []),
    lockHeld: false,
    async getPressing(releaseId: number) {
      return store.pressings[releaseId] ?? null
    },
    async setPressing(pressing: StoredPressing) {
      store.pressings[pressing.releaseId] = pressing
    },
    async getRecording(mbid: string) {
      return store.recordings[mbid] ?? null
    },
    async setRecording(recording: StoredRecording) {
      store.recordings[recording.mbid] = recording
    },
    async getQueue() {
      return [...store.queue]
    },
    async enqueue(releaseIds: number[]) {
      store.queue = asNumberArray([...store.queue, ...releaseIds])
      return [...store.queue]
    },
    async dequeue(count: number) {
      const taken = store.queue.slice(0, Math.max(0, count))
      store.queue = store.queue.slice(taken.length)
      return taken
    },
    async getSeen() {
      return [...store.seen]
    },
    async setSeen(releaseIds: number[]) {
      store.seen = asNumberArray(releaseIds)
    },
    async acquireEnrichLock() {
      if (store.lockHeld) return false
      store.lockHeld = true
      return true
    },
    async releaseEnrichLock() {
      store.lockHeld = false
    },
  }
  return store
}

let defaultStore: CrateStore | null | undefined

export function createRedisCrateStore(
  config: RedisRestConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: UpstashFetch = fetch
): CrateStore {
  const keys = crateRedisKeys(env)
  const readRedis = createUpstashRedis(config, { cache: REDIS_READ_CACHE }, fetchImpl)
  const writeRedis = createUpstashRedis(config, { cache: 'no-store' }, fetchImpl)
  return new RedisCrateStore(keys, readRedis, writeRedis)
}

export function getDefaultCrateStore(
  env: Record<string, string | undefined> = process.env
): CrateStore | null {
  if (defaultStore !== undefined) return defaultStore
  const config = resolveRedisRestConfig(env)
  if (!config) {
    defaultStore = null
    return null
  }
  defaultStore = createRedisCrateStore(config, env)
  return defaultStore
}

export function resetDefaultCrateStore(): void {
  defaultStore = undefined
}

export function entriesFromReleaseIds(
  releaseIds: number[],
  instanceFor: (releaseId: number) => number = () => 0
): CollectionEntry[] {
  return asNumberArray(releaseIds).map((releaseId) => ({
    releaseId,
    instanceId: instanceFor(releaseId),
  }))
}
