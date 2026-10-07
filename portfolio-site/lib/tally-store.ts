import { Redis } from '@upstash/redis'
import {
  assertPrefixedRedisKey,
  discogsKeyPrefix,
  resolveRedisRestConfig,
} from './redis-env.ts'
import { toSnapshot, type TallyCategory, type TallySnapshot } from './tally.ts'

export const TALLY_READ_TIMEOUT_MS = 1500
export const TALLY_SNAPSHOT_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300'
export const TALLY_UNAVAILABLE_CACHE_CONTROL = 'public, s-maxage=10, stale-while-revalidate=30'

/**
 * Durable running totals in the site's existing Upstash Redis store.
 * One hash per environment so preview traffic never touches the public count.
 * Deploys don't reset it: the count lives in Redis, not in the build.
 * Visitor writes are only `${prefix}tally:v1` and `${prefix}tally:v1:since`.
 */
export function tallyKeys(env: Record<string, string | undefined> = process.env) {
  const prefix = discogsKeyPrefix(env)
  return {
    counts: assertPrefixedRedisKey(`${prefix}tally:v1`, env),
    since: assertPrefixedRedisKey(`${prefix}tally:v1:since`, env),
  }
}

type TallyPipeline = {
  hincrby(key: string, field: string, increment: number): TallyPipeline
  setnx(key: string, value: string): TallyPipeline
  exec(): Promise<unknown>
}

/** The Redis surface the tally needs; a narrow type so tests can pass a fake. */
export type TallyRedis = Pick<Redis, 'hgetall' | 'get'> & {
  pipeline(): TallyPipeline
}

let client: Redis | null | undefined

function redis(): Redis | null {
  if (client !== undefined) return client
  const config = resolveRedisRestConfig()
  client = config ? new Redis({ url: config.url, token: config.token }) : null
  return client
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('tally read timed out')), ms)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * Adds one page request to the running total in a single Redis round trip
 * (pipeline hincrby + setnx). Never throws: counting must not break a page,
 * delay a response, or slow a crawler. Callers fire-and-forget via waitUntil.
 * The default Redis client is resolved inside the try so a config error is dropped too.
 */
export async function recordHit(
  category: TallyCategory,
  db?: TallyRedis | null,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  try {
    const store = db === undefined ? redis() : db
    if (!store) return
    const k = tallyKeys(env)
    const pipeline = store.pipeline()
    pipeline.hincrby(k.counts, category, 1)
    pipeline.setnx(k.since, new Date().toISOString())
    await pipeline.exec()
  } catch {
    // Dropped hits are acceptable; a failed page is not.
  }
}

export async function readTally(
  db?: TallyRedis | null,
  env: Record<string, string | undefined> = process.env,
  timeoutMs: number = TALLY_READ_TIMEOUT_MS
): Promise<TallySnapshot | null> {
  try {
    const store = db === undefined ? redis() : db
    if (!store) return null
    const k = tallyKeys(env)
    const [counts, since] = await withTimeout(
      Promise.all([
        store.hgetall<Record<string, unknown>>(k.counts),
        store.get<string>(k.since),
      ]),
      timeoutMs
    )
    return toSnapshot(counts, typeof since === 'string' ? since : null)
  } catch {
    return null
  }
}
