/**
 * Tally store tests — Node built-in test runner.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/tally-store.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  readTally,
  recordHit,
  tallyKeys,
  TALLY_SNAPSHOT_CACHE_CONTROL,
  TALLY_UNAVAILABLE_CACHE_CONTROL,
  type TallyRedis,
} from './tally-store.ts'

function fakeRedis(fail = false) {
  const hashes = new Map<string, Record<string, number>>()
  const strings = new Map<string, string>()
  let execCalls = 0
  let directMutations = 0

  const ops = {
    hincrby(key: string, field: string, by: number) {
      const h = hashes.get(key) ?? {}
      h[field] = (h[field] ?? 0) + by
      hashes.set(key, h)
      return h[field]
    },
    setnx(key: string, value: string) {
      if (strings.has(key)) return 0
      strings.set(key, value)
      return 1
    },
  }

  const db = {
    async hincrby(key: string, field: string, by: number) {
      directMutations += 1
      return ops.hincrby(key, field, by)
    },
    async setnx(key: string, value: string) {
      directMutations += 1
      return ops.setnx(key, value)
    },
    pipeline() {
      const queued: Array<() => unknown> = []
      const pipe = {
        hincrby(key: string, field: string, by: number) {
          queued.push(() => ops.hincrby(key, field, by))
          return pipe
        },
        setnx(key: string, value: string) {
          queued.push(() => ops.setnx(key, value))
          return pipe
        },
        async exec() {
          execCalls += 1
          if (fail) throw new Error('down')
          return queued.map((fn) => fn())
        },
      }
      return pipe
    },
    async hgetall(key: string) {
      return hashes.get(key) ?? null
    },
    async get(key: string) {
      return strings.get(key) ?? null
    },
  }
  return {
    db: db as unknown as TallyRedis,
    hashes,
    strings,
    execCalls: () => execCalls,
    directMutations: () => directMutations,
  }
}

describe('tallyKeys', () => {
  it('uses the public keys only in production on main', () => {
    assert.deepEqual(tallyKeys({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }), {
      counts: 'lf:tally:v1',
      since: 'lf:tally:v1:since',
    })
    assert.deepEqual(tallyKeys({ VERCEL_ENV: 'production' }), { counts: 'lf:tally:v1', since: 'lf:tally:v1:since' })
    assert.equal(tallyKeys({ VERCEL_ENV: 'preview' }).counts, 'lf:preview:tally:v1')
    assert.equal(tallyKeys({}).counts, 'lf:preview:tally:v1')
  })

  it('keeps vercel --prod off main on the preview prefix', () => {
    const keys = tallyKeys({
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'feat/request-tally',
    })
    assert.equal(keys.counts, 'lf:preview:tally:v1')
    assert.equal(keys.since, 'lf:preview:tally:v1:since')
  })
})

describe('tally cache headers', () => {
  it('gives 503s a short shared cache and 200s a minute', () => {
    assert.equal(TALLY_UNAVAILABLE_CACHE_CONTROL, 'public, s-maxage=10, stale-while-revalidate=30')
    assert.equal(TALLY_SNAPSHOT_CACHE_CONTROL, 'public, s-maxage=60, stale-while-revalidate=300')
  })
})

describe('recordHit / readTally', () => {
  it('keeps preview traffic out of the production count', async () => {
    const { db, hashes } = fakeRedis()
    await recordHit('presumed_human', db, { VERCEL_ENV: 'preview' })
    assert.equal(hashes.has('lf:tally:v1'), false)
    assert.equal(hashes.get('lf:preview:tally:v1')?.presumed_human, 1)
  })

  it('does not write production tally keys from a production deploy off main', async () => {
    const { db, hashes } = fakeRedis()
    await recordHit('presumed_human', db, {
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'feat/request-tally',
    })
    assert.equal(hashes.has('lf:tally:v1'), false)
    assert.equal(hashes.get('lf:preview:tally:v1')?.presumed_human, 1)
  })

  it('accumulates and stamps the first hit only once', async () => {
    const { db, strings } = fakeRedis()
    const env = { VERCEL_ENV: 'production' }
    await recordHit('presumed_human', db, env)
    const first = strings.get('lf:tally:v1:since')
    await recordHit('ai_training_crawler', db, env)
    await recordHit('presumed_human', db, env)
    assert.equal(strings.get('lf:tally:v1:since'), first)
    const snap = await readTally(db, env)
    assert.equal(snap?.presumedHuman, 2)
    assert.equal(snap?.automated, 1)
    assert.equal(snap?.since, first)
  })

  it('pipelines hincrby and setnx into a single round trip', async () => {
    const { db, hashes, strings, execCalls, directMutations } = fakeRedis()
    await recordHit('presumed_human', db, { VERCEL_ENV: 'preview' })
    assert.equal(execCalls(), 1)
    assert.equal(directMutations(), 0)
    assert.equal(hashes.get('lf:preview:tally:v1')?.presumed_human, 1)
    assert.equal(typeof strings.get('lf:preview:tally:v1:since'), 'string')
  })

  it('never throws when Redis is down', async () => {
    const { db, execCalls } = fakeRedis(true)
    await assert.doesNotReject(recordHit('presumed_human', db, { VERCEL_ENV: 'production' }))
    assert.equal(execCalls(), 1)
  })

  it('swallows errors thrown while resolving the Redis client', async () => {
    const db = {
      pipeline() {
        throw new Error('bad config')
      },
      async hgetall() {
        return null
      },
      async get() {
        return null
      },
    } as unknown as TallyRedis
    await assert.doesNotReject(recordHit('presumed_human', db, { VERCEL_ENV: 'production' }))
  })

  it('does nothing without a store', async () => {
    await assert.doesNotReject(recordHit('presumed_human', null))
    assert.equal(await readTally(null), null)
  })

  it('returns null when a Redis read hangs past the timeout', async () => {
    const db = {
      pipeline() {
        throw new Error('unused')
      },
      hgetall: () => new Promise(() => {}),
      get: () => new Promise(() => {}),
    } as unknown as TallyRedis
    const started = Date.now()
    assert.equal(await readTally(db, { VERCEL_ENV: 'preview' }, 25), null)
    assert.ok(Date.now() - started < 400)
  })
})
