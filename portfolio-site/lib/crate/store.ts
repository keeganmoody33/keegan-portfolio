import { Redis } from '@upstash/redis'
import { randomUUID } from 'node:crypto'
import {
  REDIS_READ_CACHE,
  createUpstashRedis,
  discogsKeyPrefix,
  resolveRedisRestConfig,
  type RedisRestConfig,
  type UpstashFetch,
} from '../discogs-store.ts'
import type { CollectionEntry, StoredPressing, StoredRecording } from './types.ts'

export const VISIT_THROTTLE_SECONDS = 300
export const INFLIGHT_TTL_SECONDS = 60

export const TAKE_LUA = `
local now = tonumber(ARGV[1])
local count = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local prefix = ARGV[4]
local taken = {}
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now, 'LIMIT', 0, 100)
for _, id in ipairs(ids) do
  if #taken >= count then break end
  local ok = redis.call('SET', prefix .. id, '1', 'NX', 'EX', ttl)
  if ok then
    table.insert(taken, id)
  end
end
return taken
`

export const ENQUEUE_LUA = `
local score = tonumber(ARGV[1])
local front = ARGV[2]
local added = {}
for i = 3, #ARGV do
  local id = ARGV[i]
  if redis.call('SISMEMBER', KEYS[2], id) == 0 then
    redis.call('SADD', KEYS[2], id)
    redis.call('ZADD', KEYS[1], score, id)
    table.insert(added, id)
  elseif front == '1' then
    redis.call('ZADD', KEYS[1], 0, id)
  end
end
return added
`

export const ACK_LUA = `
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('SREM', KEYS[2], ARGV[1])
redis.call('DEL', KEYS[3])
return 1
`

export const NACK_LUA = `
redis.call('ZADD', KEYS[1], tonumber(ARGV[2]), ARGV[1])
redis.call('DEL', KEYS[3])
return 1
`

export const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

export type CrateRedisKeys = {
  prefix: string
  queue: string
  queued: string
  seen: string
  enrichLock: string
  enrichMeta: string
  visitThrottle: string
  inflightPrefix: string
  pressing: (releaseId: number) => string
  recording: (mbid: string) => string
  inflight: (releaseId: number) => string
}

export function crateRedisKeys(env: Record<string, string | undefined> = process.env): CrateRedisKeys {
  const prefix = discogsKeyPrefix(env)
  return {
    prefix,
    queue: `${prefix}crate:queue:v1`,
    queued: `${prefix}crate:queued:v1`,
    seen: `${prefix}crate:seen:v1`,
    enrichLock: `${prefix}crate:enrich:lock:v1`,
    enrichMeta: `${prefix}crate:enrich:meta:v1`,
    visitThrottle: `${prefix}crate:visit:v1`,
    inflightPrefix: `${prefix}crate:inflight:`,
    pressing: (releaseId: number) => `${prefix}crate:pressing:${releaseId}:v1`,
    recording: (mbid: string) => `${prefix}crate:recording:${mbid}:v1`,
    inflight: (releaseId: number) => `${prefix}crate:inflight:${releaseId}:v1`,
  }
}

export type EnqueueOptions = {
  front?: boolean
  nowMs?: number
}

export type CrateStore = {
  getPressing(releaseId: number): Promise<StoredPressing | null>
  getPressings(releaseIds: number[]): Promise<Map<number, StoredPressing>>
  setPressing(pressing: StoredPressing): Promise<void>
  getRecording(mbid: string): Promise<StoredRecording | null>
  setRecording(recording: StoredRecording): Promise<void>
  getQueue(): Promise<number[]>
  enqueue(releaseIds: number[], options?: EnqueueOptions): Promise<number[]>
  takeDue(count: number, nowMs: number, inflightTtlSeconds: number): Promise<number[]>
  ack(releaseId: number): Promise<void>
  nack(releaseId: number, retryAtMs: number): Promise<void>
  drop(releaseId: number): Promise<void>
  getSeen(): Promise<number[]>
  setSeen(releaseIds: number[]): Promise<void>
  acquireEnrichLock(ttlSeconds: number, token: string): Promise<boolean>
  releaseEnrichLock(token: string): Promise<boolean>
  acquireVisitThrottle(ttlSeconds: number): Promise<boolean>
}

export function randomLockToken(): string {
  return randomUUID()
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ids: number[] = []
  const seen = new Set<number>()
  for (const item of value) {
    const n = typeof item === 'number' ? item : typeof item === 'string' ? Number.parseInt(item, 10) : NaN
    if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
      ids.push(n)
      seen.add(n)
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

function positiveIds(releaseIds: number[]): number[] {
  return asNumberArray(releaseIds)
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

  async getPressings(releaseIds: number[]): Promise<Map<number, StoredPressing>> {
    const result = new Map<number, StoredPressing>()
    if (process.env.NEXT_PHASE === 'phase-production-build') return result
    const ids = positiveIds(releaseIds)
    if (ids.length === 0) return result
    const chunkSize = 50
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const keys = chunk.map((id) => this.keys.pressing(id))
      const values = await this.readRedis.mget<(unknown | null)[]>(...keys)
      const rows = Array.isArray(values) ? values : []
      chunk.forEach((id, index) => {
        const value = rows[index]
        if (isStoredPressing(value)) result.set(id, value)
      })
    }
    return result
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
    const members = await this.readRedis.zrange<string[]>(this.keys.queue, 0, -1)
    return asNumberArray(members)
  }

  async enqueue(releaseIds: number[], options: EnqueueOptions = {}): Promise<number[]> {
    const ids = positiveIds(releaseIds)
    if (ids.length === 0) return []
    const score = options.front ? 0 : (options.nowMs ?? Date.now())
    const added = await this.writeRedis.eval<string[], unknown>(
      ENQUEUE_LUA,
      [this.keys.queue, this.keys.queued],
      [String(score), options.front ? '1' : '0', ...ids.map(String)]
    )
    return asNumberArray(added)
  }

  async takeDue(count: number, nowMs: number, inflightTtlSeconds: number): Promise<number[]> {
    if (count <= 0) return []
    const taken = await this.writeRedis.eval<string[], unknown>(
      TAKE_LUA,
      [this.keys.queue],
      [String(nowMs), String(count), String(inflightTtlSeconds), this.keys.inflightPrefix]
    )
    return asNumberArray(taken)
  }

  async ack(releaseId: number): Promise<void> {
    await this.writeRedis.eval(
      ACK_LUA,
      [this.keys.queue, this.keys.queued, this.keys.inflight(releaseId)],
      [String(releaseId)]
    )
  }

  async nack(releaseId: number, retryAtMs: number): Promise<void> {
    await this.writeRedis.eval(
      NACK_LUA,
      [this.keys.queue, this.keys.queued, this.keys.inflight(releaseId)],
      [String(releaseId), String(retryAtMs)]
    )
  }

  async drop(releaseId: number): Promise<void> {
    await this.ack(releaseId)
  }

  async getSeen(): Promise<number[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return []
    const members = await this.readRedis.smembers<string[]>(this.keys.seen)
    return asNumberArray(members)
  }

  async setSeen(releaseIds: number[]): Promise<void> {
    const ids = positiveIds(releaseIds)
    const pipeline = this.writeRedis.pipeline()
    pipeline.del(this.keys.seen)
    if (ids.length > 0) {
      const members = ids.map(String)
      pipeline.sadd(this.keys.seen, members[0] as string, ...members.slice(1))
    }
    await pipeline.exec()
  }

  async acquireEnrichLock(ttlSeconds: number, token: string): Promise<boolean> {
    const result = await this.writeRedis.set(this.keys.enrichLock, token, {
      nx: true,
      ex: ttlSeconds,
    })
    return result === 'OK'
  }

  async releaseEnrichLock(token: string): Promise<boolean> {
    const result = await this.writeRedis.eval<string[], number>(
      RELEASE_LOCK_LUA,
      [this.keys.enrichLock],
      [token]
    )
    return Number(result) === 1
  }

  async acquireVisitThrottle(ttlSeconds: number): Promise<boolean> {
    const result = await this.writeRedis.set(this.keys.visitThrottle, '1', {
      nx: true,
      ex: ttlSeconds,
    })
    return result === 'OK'
  }
}

export type MemoryCrateStore = CrateStore & {
  pressings: Record<number, StoredPressing>
  recordings: Record<string, StoredRecording>
  queue: Array<{ id: number; score: number }>
  queued: Set<number>
  inflight: Map<number, number>
  seen: number[]
  lockToken: string | null
  lockExpires: number
  visitUntil: number
  now: () => number
}

export function createMemoryCrateStore(
  initial: {
    pressings?: Record<number, StoredPressing>
    recordings?: Record<string, StoredRecording>
    queue?: number[] | Array<{ id: number; score: number }>
    seen?: number[]
    now?: () => number
  } = {}
): MemoryCrateStore {
  const initialQueue = Array.isArray(initial.queue)
    ? initial.queue.map((item, index) =>
        typeof item === 'number' ? { id: item, score: index } : item
      )
    : []
  const store: MemoryCrateStore = {
    pressings: { ...(initial.pressings ?? {}) },
    recordings: { ...(initial.recordings ?? {}) },
    queue: initialQueue.filter((row) => row.id > 0),
    queued: new Set(initialQueue.map((row) => row.id).filter((id) => id > 0)),
    inflight: new Map(),
    seen: asNumberArray(initial.seen ?? []),
    lockToken: null,
    lockExpires: 0,
    visitUntil: 0,
    now: initial.now ?? Date.now,
    async getPressing(releaseId: number) {
      return store.pressings[releaseId] ?? null
    },
    async getPressings(releaseIds: number[]) {
      const result = new Map<number, StoredPressing>()
      for (const id of positiveIds(releaseIds)) {
        const pressing = store.pressings[id]
        if (pressing) result.set(id, pressing)
      }
      return result
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
        .sort((a, b) => a.score - b.score || a.id - b.id)
        .map((row) => row.id)
    },
    async enqueue(releaseIds: number[], options: EnqueueOptions = {}) {
      const ids = positiveIds(releaseIds)
      const added: number[] = []
      const score = options.front ? 0 : (options.nowMs ?? store.now())
      for (const id of ids) {
        if (store.queued.has(id)) {
          if (options.front) {
            const existing = store.queue.find((row) => row.id === id)
            if (existing) existing.score = 0
          }
          continue
        }
        store.queued.add(id)
        store.queue.push({ id, score })
        added.push(id)
      }
      return added
    },
    async takeDue(count: number, nowMs: number, inflightTtlSeconds: number) {
      const taken: number[] = []
      const sorted = [...store.queue].sort((a, b) => a.score - b.score || a.id - b.id)
      for (const item of sorted) {
        if (taken.length >= count) break
        if (item.score > nowMs) continue
        const heldUntil = store.inflight.get(item.id)
        if (heldUntil != null && heldUntil > nowMs) continue
        store.inflight.set(item.id, nowMs + inflightTtlSeconds * 1000)
        taken.push(item.id)
      }
      return taken
    },
    async ack(releaseId: number) {
      store.queue = store.queue.filter((row) => row.id !== releaseId)
      store.queued.delete(releaseId)
      store.inflight.delete(releaseId)
    },
    async nack(releaseId: number, retryAtMs: number) {
      const existing = store.queue.find((row) => row.id === releaseId)
      if (existing) existing.score = retryAtMs
      else store.queue.push({ id: releaseId, score: retryAtMs })
      store.queued.add(releaseId)
      store.inflight.delete(releaseId)
    },
    async drop(releaseId: number) {
      await store.ack(releaseId)
    },
    async getSeen() {
      return [...store.seen]
    },
    async setSeen(releaseIds: number[]) {
      store.seen = positiveIds(releaseIds)
    },
    async acquireEnrichLock(ttlSeconds: number, token: string) {
      const nowMs = store.now()
      if (store.lockToken && store.lockExpires > nowMs) return false
      store.lockToken = token
      store.lockExpires = nowMs + ttlSeconds * 1000
      return true
    },
    async releaseEnrichLock(token: string) {
      if (store.lockToken !== token) return false
      store.lockToken = null
      store.lockExpires = 0
      return true
    },
    async acquireVisitThrottle(ttlSeconds: number) {
      const nowMs = store.now()
      if (store.visitUntil > nowMs) return false
      store.visitUntil = nowMs + ttlSeconds * 1000
      return true
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
