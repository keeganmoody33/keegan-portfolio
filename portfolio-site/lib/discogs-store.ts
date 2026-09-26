import { Redis } from '@upstash/redis'
import type { Requester, UpstashRequest, UpstashResponse } from '@upstash/redis'
import type { DiscogsCollection } from './discogs.ts'

export const DISCOGS_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000
export const DISCOGS_REFRESH_LOCK_SECONDS = 120
export const DISCOGS_REDIS_READ_REVALIDATE_SECONDS = 300

export type DurableErrorKind = 'rate_limit' | 'unavailable' | 'partial'

export type DurableErrorRecord = {
  at: number
  kind: DurableErrorKind
}

export type DiscogsDurableMeta = {
  fetchedAt: number
  items: number
  lastError: DurableErrorRecord | null
}

export type DurableSnapshot = {
  collection: unknown
  meta: DiscogsDurableMeta | null
}

export type DurableStore = {
  get(): Promise<DurableSnapshot | null>
  setComplete(collection: DiscogsCollection, fetchedAt: number): Promise<void>
  recordError(kind: DurableErrorKind, at: number): Promise<void>
  acquireLock(ttlSeconds: number): Promise<boolean>
  releaseLock(): Promise<void>
}

export type RedisRestConfig = {
  url: string
  token: string
}

export type DiscogsRedisKeys = {
  prefix: string
  collection: string
  meta: string
  lock: string
}

type CachedFetchInit = RequestInit & {
  next?: { revalidate: number }
}

type EnvMap = Record<string, string | undefined>

function trimEnv(value: string | undefined): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export function resolveRedisRestConfig(
  env: EnvMap = process.env
): RedisRestConfig | null {
  const kvUrl = trimEnv(env.KV_REST_API_URL)
  const kvToken = trimEnv(env.KV_REST_API_TOKEN)
  if (kvUrl && kvToken) {
    return { url: kvUrl, token: kvToken }
  }

  const upstashUrl = trimEnv(env.UPSTASH_REDIS_REST_URL)
  const upstashToken = trimEnv(env.UPSTASH_REDIS_REST_TOKEN)
  if (upstashUrl && upstashToken) {
    return { url: upstashUrl, token: upstashToken }
  }

  return null
}

export function discogsKeyPrefix(env: EnvMap = process.env): string {
  return env.VERCEL_ENV === 'production' ? 'lf:' : 'lf:preview:'
}

export function discogsRedisKeys(env: EnvMap = process.env): DiscogsRedisKeys {
  const prefix = discogsKeyPrefix(env)
  return {
    prefix,
    collection: `${prefix}discogs:collection:v1`,
    meta: `${prefix}discogs:meta:v1`,
    lock: `${prefix}discogs:lock:v1`,
  }
}

export function isSnapshotStale(
  fetchedAt: number | null | undefined,
  now: number,
  ttlMs = DISCOGS_SNAPSHOT_TTL_MS
): boolean {
  if (fetchedAt == null || !Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    return true
  }
  return now - fetchedAt >= ttlMs
}

function parseMeta(value: unknown): DiscogsDurableMeta | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.fetchedAt !== 'number' || !Number.isFinite(record.fetchedAt)) {
    return null
  }
  if (typeof record.items !== 'number' || !Number.isFinite(record.items)) {
    return null
  }

  let lastError: DurableErrorRecord | null = null
  if (record.lastError && typeof record.lastError === 'object') {
    const errorRecord = record.lastError as Record<string, unknown>
    if (
      typeof errorRecord.at === 'number' &&
      (errorRecord.kind === 'rate_limit' ||
        errorRecord.kind === 'unavailable' ||
        errorRecord.kind === 'partial')
    ) {
      lastError = { at: errorRecord.at, kind: errorRecord.kind }
    }
  } else if (record.lastError != null) {
    return null
  }

  return {
    fetchedAt: record.fetchedAt,
    items: record.items,
    lastError,
  }
}

function createRequester(config: RedisRestConfig, init: CachedFetchInit): Requester {
  const baseUrl = config.url.replace(/\/$/, '')
  return {
    async request<TResult>(req: UpstashRequest): Promise<UpstashResponse<TResult>> {
      const requestUrl = [baseUrl, ...(req.path ?? [])].join('/')
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
          ...req.headers,
        },
        body: JSON.stringify(req.body ?? null),
        ...init,
      })
      const raw = await response.text()
      let parsed: UpstashResponse<TResult>
      try {
        parsed = JSON.parse(raw) as UpstashResponse<TResult>
      } catch {
        throw new Error('Upstash response was not JSON')
      }
      if (!response.ok) {
        throw new Error(parsed.error ?? 'Upstash request failed')
      }
      return parsed
    },
  }
}

function createRedis(config: RedisRestConfig, init: CachedFetchInit): Redis {
  return new Redis(createRequester(config, init) as unknown as ConstructorParameters<typeof Redis>[0])
}

class RedisDurableStore implements DurableStore {
  private readonly keys: DiscogsRedisKeys
  private readonly readRedis: Redis
  private readonly writeRedis: Redis

  constructor(config: RedisRestConfig, env: EnvMap = process.env) {
    this.keys = discogsRedisKeys(env)
    this.readRedis = createRedis(config, {
      cache: 'force-cache',
      next: { revalidate: DISCOGS_REDIS_READ_REVALIDATE_SECONDS },
    })
    this.writeRedis = createRedis(config, { cache: 'no-store' })
  }

  async get(): Promise<DurableSnapshot | null> {
    const [collection, metaValue] = await this.readRedis.mget<unknown[]>(
      this.keys.collection,
      this.keys.meta
    )
    if (collection == null) return null
    return {
      collection,
      meta: parseMeta(metaValue),
    }
  }

  async setComplete(collection: DiscogsCollection, fetchedAt: number): Promise<void> {
    const meta: DiscogsDurableMeta = {
      fetchedAt,
      items: collection.pagination.items,
      lastError: null,
    }
    await this.writeRedis.set(this.keys.collection, collection)
    await this.writeRedis.set(this.keys.meta, meta)
  }

  async recordError(kind: DurableErrorKind, at: number): Promise<void> {
    const current = parseMeta(await this.writeRedis.get<unknown>(this.keys.meta))
    const meta: DiscogsDurableMeta = {
      fetchedAt: current?.fetchedAt ?? 0,
      items: current?.items ?? 0,
      lastError: { at, kind },
    }
    await this.writeRedis.set(this.keys.meta, meta)
  }

  async acquireLock(ttlSeconds: number): Promise<boolean> {
    const result = await this.writeRedis.set(this.keys.lock, '1', {
      nx: true,
      ex: ttlSeconds,
    })
    return result === 'OK'
  }

  async releaseLock(): Promise<void> {
    await this.writeRedis.del(this.keys.lock)
  }
}

let defaultStore: DurableStore | null | undefined

export function getDefaultRedisDurableStore(
  env: EnvMap = process.env
): DurableStore | null {
  if (defaultStore !== undefined) return defaultStore
  const config = resolveRedisRestConfig(env)
  if (!config) {
    defaultStore = null
    return null
  }
  defaultStore = new RedisDurableStore(config, env)
  return defaultStore
}

export function resetDefaultRedisDurableStore(): void {
  defaultStore = undefined
}

export function createRedisDurableStore(
  config: RedisRestConfig,
  env: EnvMap = process.env
): DurableStore {
  return new RedisDurableStore(config, env)
}

export function createMemoryDurableStore(
  initial: {
    collection?: unknown
    meta?: DiscogsDurableMeta | null
  } = {}
): DurableStore & {
  collection: unknown
  meta: DiscogsDurableMeta | null
  lockHeld: boolean
  getCalls: number
  setCalls: number
  errorCalls: number
  lockCalls: number
  throwOnGet: Error | null
} {
  const store = {
    collection: initial.collection ?? null as unknown,
    meta: initial.meta ?? null,
    lockHeld: false,
    getCalls: 0,
    setCalls: 0,
    errorCalls: 0,
    lockCalls: 0,
    throwOnGet: null as Error | null,
    async get(): Promise<DurableSnapshot | null> {
      store.getCalls += 1
      if (store.throwOnGet) throw store.throwOnGet
      if (store.collection == null) return null
      return { collection: store.collection, meta: store.meta }
    },
    async setComplete(collection: DiscogsCollection, fetchedAt: number): Promise<void> {
      store.setCalls += 1
      store.collection = collection
      store.meta = {
        fetchedAt,
        items: collection.pagination.items,
        lastError: null,
      }
    },
    async recordError(kind: DurableErrorKind, at: number): Promise<void> {
      store.errorCalls += 1
      store.meta = {
        fetchedAt: store.meta?.fetchedAt ?? 0,
        items: store.meta?.items ?? 0,
        lastError: { at, kind },
      }
    },
    async acquireLock(ttlSeconds: number): Promise<boolean> {
      void ttlSeconds
      store.lockCalls += 1
      if (store.lockHeld) return false
      store.lockHeld = true
      return true
    },
    async releaseLock(): Promise<void> {
      store.lockHeld = false
    },
  }
  return store
}
