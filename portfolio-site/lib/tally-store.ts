import { Redis } from '@upstash/redis'
import { resolveRedisRestConfig } from './discogs-store.ts'
import { toSnapshot, type TallyCategory, type TallySnapshot } from './tally.ts'

/**
 * Durable running totals in the site's existing Upstash Redis store.
 * One hash per environment so preview traffic never touches the public count.
 * Deploys don't reset it: the count lives in Redis, not in the build.
 */
export function tallyKeys(env: Record<string, string | undefined> = process.env) {
  const prefix = env.VERCEL_ENV === 'production' ? 'lf:' : 'lf:preview:'
  return { counts: `${prefix}tally:v1`, since: `${prefix}tally:v1:since` }
}

/** The two Redis calls the tally needs; a narrow type so tests can pass a fake. */
export type TallyRedis = Pick<Redis, 'hincrby' | 'setnx' | 'hgetall' | 'get'>

let client: Redis | null | undefined

function redis(): Redis | null {
  if (client !== undefined) return client
  const config = resolveRedisRestConfig()
  client = config ? new Redis({ url: config.url, token: config.token }) : null
  return client
}

/** Adds one page request to the running total. Never throws: counting must not break a page. */
export async function recordHit(
  category: TallyCategory,
  db: TallyRedis | null = redis(),
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  if (!db) return
  const k = tallyKeys(env)
  try {
    await db.hincrby(k.counts, category, 1)
    await db.setnx(k.since, new Date().toISOString())
  } catch {
    // Dropped hits are acceptable; a failed page is not.
  }
}

export async function readTally(
  db: TallyRedis | null = redis(),
  env: Record<string, string | undefined> = process.env
): Promise<TallySnapshot | null> {
  if (!db) return null
  const k = tallyKeys(env)
  const [counts, since] = await Promise.all([
    db.hgetall<Record<string, unknown>>(k.counts),
    db.get<string>(k.since),
  ])
  return toSnapshot(counts, typeof since === 'string' ? since : null)
}
