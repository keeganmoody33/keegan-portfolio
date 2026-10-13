import { Redis } from '@upstash/redis'
import {
  assertPrefixedRedisKey,
  isProductionRedisNamespace,
  resolveRedisRestConfig,
} from '../redis-env.ts'
import {
  FLIP_LOOKUP_CACHE_TTL_SECONDS,
  FLIP_REDIS_PREFIX,
  FLIP_REQUESTS_KEY,
  FLIP_SEARCH_CACHE_TTL_SECONDS,
  type FlipLookupResult,
  type FlipSearchResult,
  type FlipStoredRequest,
} from './types.ts'

type EnvMap = Record<string, string | undefined>

export type FlipRedis = {
  get(key: string): Promise<unknown>
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>
  rpush(key: string, ...values: string[]): Promise<unknown>
}

let client: Redis | null | undefined

function redis(env: EnvMap = process.env): FlipRedis | null {
  if (isProductionRedisNamespace(env)) return null
  const config = resolveRedisRestConfig(env)
  if (!config) return null
  if (client === undefined) {
    client = new Redis({ url: config.url, token: config.token })
  }
  return client
}

export function flipRequestsEnabled(env: EnvMap = process.env): boolean {
  return !isProductionRedisNamespace(env) && resolveRedisRestConfig(env) != null
}

export function flipLookupCacheKey(hash: string, env: EnvMap = process.env): string {
  return assertPrefixedRedisKey(`${FLIP_REDIS_PREFIX}lookup:${hash}`, env)
}

export function flipSearchCacheKey(hash: string, env: EnvMap = process.env): string {
  return assertPrefixedRedisKey(`${FLIP_REDIS_PREFIX}search:${hash}`, env)
}

export function flipRequestsKey(env: EnvMap = process.env): string {
  return assertPrefixedRedisKey(FLIP_REQUESTS_KEY, env)
}

export async function readFlipLookupCache(
  hash: string,
  db?: FlipRedis | null,
  env: EnvMap = process.env
): Promise<FlipLookupResult | null> {
  try {
    const store = db === undefined ? redis(env) : db
    if (!store) return null
    const raw = await store.get(flipLookupCacheKey(hash, env))
    if (raw == null) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as FlipLookupResult
  } catch {
    return null
  }
}

export async function writeFlipLookupCache(
  hash: string,
  value: FlipLookupResult,
  db?: FlipRedis | null,
  env: EnvMap = process.env
): Promise<void> {
  try {
    const store = db === undefined ? redis(env) : db
    if (!store) return
    await store.set(flipLookupCacheKey(hash, env), JSON.stringify(value), {
      ex: FLIP_LOOKUP_CACHE_TTL_SECONDS,
    })
  } catch {
    return
  }
}

export async function readFlipSearchCache(
  hash: string,
  db?: FlipRedis | null,
  env: EnvMap = process.env
): Promise<FlipSearchResult | null> {
  try {
    const store = db === undefined ? redis(env) : db
    if (!store) return null
    const raw = await store.get(flipSearchCacheKey(hash, env))
    if (raw == null) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as FlipSearchResult
  } catch {
    return null
  }
}

export async function writeFlipSearchCache(
  hash: string,
  value: FlipSearchResult,
  db?: FlipRedis | null,
  env: EnvMap = process.env
): Promise<void> {
  try {
    const store = db === undefined ? redis(env) : db
    if (!store) return
    await store.set(flipSearchCacheKey(hash, env), JSON.stringify(value), {
      ex: FLIP_SEARCH_CACHE_TTL_SECONDS,
    })
  } catch {
    return
  }
}

export async function storeFlipRequest(
  request: FlipStoredRequest,
  db?: FlipRedis | null,
  env: EnvMap = process.env
): Promise<boolean> {
  try {
    if (isProductionRedisNamespace(env)) return false
    const store = db === undefined ? redis(env) : db
    if (!store) return false
    await store.rpush(flipRequestsKey(env), JSON.stringify(request))
    return true
  } catch {
    return false
  }
}
