import { Redis } from '@upstash/redis'
import { randomUUID } from 'node:crypto'
import {
  REDIS_PRESSING_READ_INIT,
  REDIS_READ_CACHE,
  assertPrefixedRedisKey,
  createUpstashRedis,
  discogsKeyPrefix,
  resolveRedisRestConfig,
  type RedisRestConfig,
  type UpstashFetch,
} from '../discogs-store.ts'
import { preferCompleteRecording } from './preserve.ts'
import type { BackfillState, CollectionEntry, DeadLetter, StoredPressing, StoredRecording } from './types.ts'

export const VISIT_THROTTLE_SECONDS = 300
export const INFLIGHT_TTL_SECONDS = 90
export const DRAFT_TTL_SECONDS = 900

export const TAKE_LUA = `
local now = tonumber(ARGV[1])
local count = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local prefix = ARGV[4]
local taken = {}
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now, 'LIMIT', 0, 100)
for _, id in ipairs(ids) do
  if #taken >= count then break end
  local ok = redis.call('SET', prefix .. id .. ':v1', '1', 'NX', 'EX', ttl)
  if ok then
    table.insert(taken, id)
  end
end
return taken
`

export const ENQUEUE_LUA = `
local score = tonumber(ARGV[1])
local retry = ARGV[2]
local added = {}
for i = 3, #ARGV do
  local id = ARGV[i]
  if retry ~= '1' and redis.call('SISMEMBER', KEYS[3], id) == 1 then
  else
    if retry == '1' then
      redis.call('SREM', KEYS[3], id)
    end
    if redis.call('SISMEMBER', KEYS[2], id) == 0 then
      redis.call('SADD', KEYS[2], id)
      redis.call('ZADD', KEYS[1], score, id)
      table.insert(added, id)
    end
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
redis.call('SADD', KEYS[2], ARGV[1])
redis.call('DEL', KEYS[3])
return 1
`

function lockTokenMatchesLua(): string {
  return `
local current = redis.call('GET', KEYS[1])
if current ~= ARGV[1] then return 0 end
`
}

export const RELEASE_LOCK_LUA = `
${lockTokenMatchesLua().trim()}
return redis.call('DEL', KEYS[1])
`

export const REFRESH_LOCK_LUA = `
${lockTokenMatchesLua().trim()}
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1
`

export type CrateRedisKeys = {
  prefix: string
  queue: string
  queued: string
  seen: string
  enrichLock: string
  visitThrottle: string
  inflightPrefix: string
  pressing: (releaseId: number) => string
  recording: (mbid: string) => string
  inflight: (releaseId: number) => string
  pressingDraft: (releaseId: number) => string
  dead: string
  unresolved: string
    inspect: string
    backfill: string
    cover: (releaseId: number) => string
  }

export function crateRedisKeys(env: Record<string, string | undefined> = process.env): CrateRedisKeys {
  const prefix = discogsKeyPrefix(env)
  return {
    prefix: assertPrefixedRedisKey(prefix, env),
    queue: assertPrefixedRedisKey(`${prefix}crate:queue:v1`, env),
    queued: assertPrefixedRedisKey(`${prefix}crate:queued:v1`, env),
    seen: assertPrefixedRedisKey(`${prefix}crate:seen:v1`, env),
    enrichLock: assertPrefixedRedisKey(`${prefix}crate:enrich:lock:v1`, env),
    visitThrottle: assertPrefixedRedisKey(`${prefix}crate:visit:v1`, env),
    inflightPrefix: assertPrefixedRedisKey(`${prefix}crate:inflight:`, env),
    pressing: (releaseId: number) =>
      assertPrefixedRedisKey(`${prefix}crate:pressing:${releaseId}:v1`, env),
    recording: (mbid: string) =>
      assertPrefixedRedisKey(`${prefix}crate:recording:${mbid}:v1`, env),
    inflight: (releaseId: number) =>
      assertPrefixedRedisKey(`${prefix}crate:inflight:${releaseId}:v1`, env),
    pressingDraft: (releaseId: number) =>
      assertPrefixedRedisKey(`${prefix}crate:pressing:${releaseId}:draft:v1`, env),
    dead: assertPrefixedRedisKey(`${prefix}crate:dead:v1`, env),
    unresolved: assertPrefixedRedisKey(`${prefix}crate:unresolved:v1`, env),
    inspect: assertPrefixedRedisKey(`${prefix}crate:inspect:v1`, env),
    backfill: assertPrefixedRedisKey(`${prefix}crate:backfill:v1`, env),
    cover: (releaseId: number) =>
      assertPrefixedRedisKey(`${prefix}crate:cover:${releaseId}:v1`, env),
  }
}

export type EnqueueOptions = {
  front?: boolean
  nowMs?: number
  score?: number
  retry?: boolean
}

export type CrateStore = {
  getPressing(releaseId: number): Promise<StoredPressing | null>
  getPressingCached?(releaseId: number): Promise<StoredPressing | null>
  getPressings(releaseIds: number[]): Promise<Map<number, StoredPressing>>
  setPressing(pressing: StoredPressing): Promise<void>
  setDraftPressing(pressing: StoredPressing): Promise<void>
  getDraftPressing(releaseId: number): Promise<StoredPressing | null>
  discardDraftPressing(releaseId: number): Promise<void>
  getRecording(mbid: string): Promise<StoredRecording | null>
  listRecordings?(): Promise<StoredRecording[]>
  setRecording(recording: StoredRecording): Promise<void>
  getQueue(): Promise<number[]>
  enqueue(releaseIds: number[], options?: EnqueueOptions): Promise<number[]>
  takeDue(count: number, nowMs: number, inflightTtlSeconds: number): Promise<number[]>
  ack(releaseId: number): Promise<void>
  nack(releaseId: number, retryAtMs: number): Promise<void>
  drop(releaseId: number): Promise<void>
  clearInflight(releaseId: number): Promise<void>
  getSeen(): Promise<number[]>
  setSeen(releaseIds: number[]): Promise<void>
  acquireEnrichLock(ttlSeconds: number, token: string): Promise<boolean>
  releaseEnrichLock(token: string): Promise<boolean>
  acquireVisitThrottle(ttlSeconds: number): Promise<boolean>
  markDead(letter: DeadLetter): Promise<void>
  unmarkDead(releaseId: number): Promise<void>
  markUnresolved(letter: DeadLetter): Promise<void>
  unmarkUnresolved(releaseId: number): Promise<void>
  getDead(): Promise<number[]>
  getUnresolved(): Promise<number[]>
  getInspect(): Promise<DeadLetter[]>
  getBackfill(): Promise<BackfillState | null>
  setBackfill(state: BackfillState): Promise<void>
  purgePressing(releaseId: number): Promise<void>
}

export function randomLockToken(): string {
  return randomUUID()
}

export function selectEnrichLockToken(explicit?: string): string {
  return explicit || randomLockToken()
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

function isDeadLetter(value: unknown): value is DeadLetter {
  if (!value || typeof value !== 'object') return false
  const record = value as DeadLetter
  return (
    typeof record.releaseId === 'number' &&
    record.releaseId > 0 &&
    typeof record.kind === 'string' &&
    typeof record.message === 'string'
  )
}

function isBackfillState(value: unknown): value is BackfillState {
  if (!value || typeof value !== 'object') return false
  const record = value as BackfillState
  if (typeof record.cursor !== 'number' || typeof record.status !== 'string') return false
  if (record.settled !== undefined && !Array.isArray(record.settled)) return false
  return true
}

function positiveIds(releaseIds: number[]): number[] {
  return asNumberArray(releaseIds)
}

class RedisCrateStore implements CrateStore {
  private readonly keys: CrateRedisKeys
  private readonly readRedis: Redis
  private readonly writeRedis: Redis
  private readonly pressingReadRedis: Redis
  private recordingList: StoredRecording[] | null = null

  constructor(
    keys: CrateRedisKeys,
    readRedis: Redis,
    writeRedis: Redis,
    pressingReadRedis: Redis
  ) {
    this.keys = keys
    this.readRedis = readRedis
    this.writeRedis = writeRedis
    this.pressingReadRedis = pressingReadRedis
  }

  async getPressing(releaseId: number): Promise<StoredPressing | null> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null
    const value = await this.writeRedis.get<unknown>(this.keys.pressing(releaseId))
    return isStoredPressing(value) ? value : null
  }

  async getPressingCached(releaseId: number): Promise<StoredPressing | null> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null
    const value = await this.pressingReadRedis.get<unknown>(this.keys.pressing(releaseId))
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
      const values = await this.writeRedis.mget<(unknown | null)[]>(...keys)
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
    await this.writeRedis.del(this.keys.pressingDraft(pressing.releaseId))
  }

  async setDraftPressing(pressing: StoredPressing): Promise<void> {
    await this.writeRedis.set(this.keys.pressingDraft(pressing.releaseId), pressing, {
      ex: DRAFT_TTL_SECONDS,
    })
  }

  async getDraftPressing(releaseId: number): Promise<StoredPressing | null> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null
    const value = await this.writeRedis.get<unknown>(this.keys.pressingDraft(releaseId))
    return isStoredPressing(value) ? value : null
  }

  async discardDraftPressing(releaseId: number): Promise<void> {
    await this.writeRedis.del(this.keys.pressingDraft(releaseId))
  }

  async getRecording(mbid: string): Promise<StoredRecording | null> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null
    const value = await this.readRedis.get<unknown>(this.keys.recording(mbid))
    return isStoredRecording(value) ? value : null
  }

  async listRecordings(): Promise<StoredRecording[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return []
    if (this.recordingList) return this.recordingList
    const match = this.keys.recording('*')
    const keys: string[] = []
    let cursor = '0'
    do {
      const scanned = await this.readRedis.scan(cursor, { match, count: 100 })
      const next = Array.isArray(scanned) ? scanned[0] : 0
      const batch = Array.isArray(scanned) ? scanned[1] ?? [] : []
      cursor = String(next)
      for (const key of batch) {
        if (typeof key === 'string') keys.push(key)
      }
    } while (cursor !== '0')
    const docs: StoredRecording[] = []
    const chunkSize = 20
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize)
      const values = await this.readRedis.mget<(unknown | null)[]>(...chunk)
      const rows = Array.isArray(values) ? values : []
      for (const value of rows) {
        if (isStoredRecording(value)) docs.push(value)
      }
    }
    this.recordingList = docs
    return docs
  }

  async setRecording(recording: StoredRecording): Promise<void> {
    const existing = await this.getRecording(recording.mbid)
    await this.writeRedis.set(
      this.keys.recording(recording.mbid),
      preferCompleteRecording(existing, recording)
    )
  }

  async getQueue(): Promise<number[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return []
    const members = await this.readRedis.zrange<string[]>(this.keys.queue, 0, -1)
    return asNumberArray(members)
  }

  async enqueue(releaseIds: number[], options: EnqueueOptions = {}): Promise<number[]> {
    const ids = positiveIds(releaseIds)
    if (ids.length === 0) return []
    const score = options.score ?? (options.front ? 0 : (options.nowMs ?? Date.now()))
    const added = await this.writeRedis.eval<string[], unknown>(
      ENQUEUE_LUA,
      [this.keys.queue, this.keys.queued, this.keys.dead],
      [String(score), options.retry ? '1' : '0', ...ids.map(String)]
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
    await this.discardDraftPressing(releaseId)
  }

  async clearInflight(releaseId: number): Promise<void> {
    await this.writeRedis.del(this.keys.inflight(releaseId))
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
    const created = await this.writeRedis.set(this.keys.enrichLock, token, {
      nx: true,
      ex: ttlSeconds,
    })
    if (created === 'OK') return true
    const refreshed = await this.writeRedis.eval<string[], number>(
      REFRESH_LOCK_LUA,
      [this.keys.enrichLock],
      [token, String(ttlSeconds)]
    )
    return Number(refreshed) === 1
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

  async markDead(letter: DeadLetter): Promise<void> {
    const pipeline = this.writeRedis.pipeline()
    pipeline.sadd(this.keys.dead, String(letter.releaseId))
    pipeline.srem(this.keys.unresolved, String(letter.releaseId))
    pipeline.hset(this.keys.inspect, { [String(letter.releaseId)]: letter })
    await pipeline.exec()
  }

  async unmarkDead(releaseId: number): Promise<void> {
    await this.writeRedis.srem(this.keys.dead, String(releaseId))
  }

  async markUnresolved(letter: DeadLetter): Promise<void> {
    const pipeline = this.writeRedis.pipeline()
    pipeline.sadd(this.keys.unresolved, String(letter.releaseId))
    pipeline.hset(this.keys.inspect, { [String(letter.releaseId)]: letter })
    await pipeline.exec()
  }

  async unmarkUnresolved(releaseId: number): Promise<void> {
    const pipeline = this.writeRedis.pipeline()
    pipeline.srem(this.keys.unresolved, String(releaseId))
    pipeline.hdel(this.keys.inspect, String(releaseId))
    await pipeline.exec()
  }

  async getDead(): Promise<number[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return []
    return asNumberArray(await this.readRedis.smembers<string[]>(this.keys.dead))
  }

  async getUnresolved(): Promise<number[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return []
    return asNumberArray(await this.readRedis.smembers<string[]>(this.keys.unresolved))
  }

  async getInspect(): Promise<DeadLetter[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return []
    const raw = await this.readRedis.hgetall<Record<string, unknown>>(this.keys.inspect)
    if (!raw || typeof raw !== 'object') return []
    return Object.values(raw).filter(isDeadLetter)
  }

  async getBackfill(): Promise<BackfillState | null> {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null
    const value = await this.readRedis.get<unknown>(this.keys.backfill)
    return isBackfillState(value) ? value : null
  }

  async setBackfill(state: BackfillState): Promise<void> {
    await this.writeRedis.set(this.keys.backfill, state)
  }

  async purgePressing(releaseId: number): Promise<void> {
    await this.ack(releaseId)
    await this.writeRedis.del(this.keys.pressing(releaseId), this.keys.pressingDraft(releaseId))
    const pipeline = this.writeRedis.pipeline()
    pipeline.srem(this.keys.dead, String(releaseId))
    pipeline.srem(this.keys.unresolved, String(releaseId))
    pipeline.hdel(this.keys.inspect, String(releaseId))
    await pipeline.exec()
  }
}

export type MemoryCrateStore = CrateStore & {
  pressings: Record<number, StoredPressing>
  drafts: Record<number, StoredPressing>
  draftExpires: Record<number, number>
  recordings: Record<string, StoredRecording>
  queue: Array<{ id: number; score: number }>
  queued: Set<number>
  inflight: Map<number, number>
  seen: number[]
  lockToken: string | null
  lockExpires: number
  visitUntil: number
  dead: Set<number>
  unresolved: Set<number>
  inspect: Map<number, DeadLetter>
  backfill: BackfillState | null
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
    drafts: {},
    draftExpires: {},
    recordings: { ...(initial.recordings ?? {}) },
    queue: initialQueue.filter((row) => row.id > 0),
    queued: new Set(initialQueue.map((row) => row.id).filter((id) => id > 0)),
    inflight: new Map(),
    seen: asNumberArray(initial.seen ?? []),
    lockToken: null,
    lockExpires: 0,
    visitUntil: 0,
    dead: new Set<number>(),
    unresolved: new Set<number>(),
    inspect: new Map<number, DeadLetter>(),
    backfill: null,
    now: initial.now ?? Date.now,
    async getPressing(releaseId: number) {
      return store.pressings[releaseId] ?? null
    },
    async getPressingCached(releaseId: number) {
      return store.getPressing(releaseId)
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
      delete store.drafts[pressing.releaseId]
    },
    async setDraftPressing(pressing: StoredPressing) {
      store.drafts[pressing.releaseId] = pressing
      store.draftExpires[pressing.releaseId] = store.now() + DRAFT_TTL_SECONDS * 1000
    },
    async getDraftPressing(releaseId: number) {
      const expires = store.draftExpires[releaseId]
      if (expires != null && expires <= store.now()) {
        delete store.drafts[releaseId]
        delete store.draftExpires[releaseId]
        return null
      }
      return store.drafts[releaseId] ?? null
    },
    async discardDraftPressing(releaseId: number) {
      delete store.drafts[releaseId]
      delete store.draftExpires[releaseId]
    },
    async getRecording(mbid: string) {
      return store.recordings[mbid] ?? null
    },
    async listRecordings() {
      return Object.values(store.recordings)
    },
    async setRecording(recording: StoredRecording) {
      store.recordings[recording.mbid] = preferCompleteRecording(
        store.recordings[recording.mbid],
        recording
      )
    },
    async getQueue() {
      return [...store.queue]
        .sort((a, b) => a.score - b.score || a.id - b.id)
        .map((row) => row.id)
    },
    async enqueue(releaseIds: number[], options: EnqueueOptions = {}) {
      const ids = positiveIds(releaseIds)
      const added: number[] = []
      const score = options.score ?? (options.front ? 0 : (options.nowMs ?? store.now()))
      for (const id of ids) {
        if (!options.retry && store.dead.has(id)) {
          continue
        }
        if (options.retry) {
          store.dead.delete(id)
        }
        if (store.queued.has(id)) {
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
      await store.discardDraftPressing(releaseId)
    },
    async clearInflight(releaseId: number) {
      store.inflight.delete(releaseId)
    },
    async getSeen() {
      return [...store.seen]
    },
    async setSeen(releaseIds: number[]) {
      store.seen = positiveIds(releaseIds)
    },
    async acquireEnrichLock(ttlSeconds: number, token: string) {
      const nowMs = store.now()
      if (store.lockToken && store.lockExpires > nowMs && store.lockToken !== token) {
        return false
      }
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
    async markDead(letter: DeadLetter) {
      store.dead.add(letter.releaseId)
      store.unresolved.delete(letter.releaseId)
      store.inspect.set(letter.releaseId, letter)
    },
    async unmarkDead(releaseId: number) {
      store.dead.delete(releaseId)
    },
    async markUnresolved(letter: DeadLetter) {
      store.unresolved.add(letter.releaseId)
      store.inspect.set(letter.releaseId, letter)
    },
    async unmarkUnresolved(releaseId: number) {
      store.unresolved.delete(releaseId)
      store.inspect.delete(releaseId)
    },
    async getDead() {
      return [...store.dead]
    },
    async getUnresolved() {
      return [...store.unresolved]
    },
    async getInspect() {
      return [...store.inspect.values()]
    },
    async getBackfill() {
      return store.backfill
    },
    async setBackfill(state: BackfillState) {
      store.backfill = state
    },
    async purgePressing(releaseId: number) {
      await store.ack(releaseId)
      delete store.pressings[releaseId]
      delete store.drafts[releaseId]
      delete store.draftExpires[releaseId]
      store.dead.delete(releaseId)
      store.unresolved.delete(releaseId)
      store.inspect.delete(releaseId)
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
  const pressingReadRedis = createUpstashRedis(config, REDIS_PRESSING_READ_INIT, fetchImpl)
  return new RedisCrateStore(keys, readRedis, writeRedis, pressingReadRedis)
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
