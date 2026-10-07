/**
 * Redis env / prefix tests — Node built-in test runner.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/redis-env.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertPrefixedRedisKey,
  discogsKeyPrefix,
  isProductionRedisNamespace,
  resolveRedisRestConfig,
} from './redis-env.ts'

describe('resolveRedisRestConfig', () => {
  it('prefers KV_REST_API_* over UPSTASH_*', () => {
    assert.deepEqual(
      resolveRedisRestConfig({
        KV_REST_API_URL: 'https://kv.example/rest',
        KV_REST_API_TOKEN: 'kv-token',
        UPSTASH_REDIS_REST_URL: 'https://upstash.example/rest',
        UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
      }),
      { url: 'https://kv.example/rest', token: 'kv-token' }
    )
  })

  it('returns null when a pair is incomplete', () => {
    assert.equal(
      resolveRedisRestConfig({
        KV_REST_API_URL: 'https://kv.example/rest',
        KV_REST_API_TOKEN: undefined,
      }),
      null
    )
  })
})

describe('isProductionRedisNamespace / discogsKeyPrefix', () => {
  it('requires VERCEL_ENV=production and ref main (or unset)', () => {
    assert.equal(isProductionRedisNamespace({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }), true)
    assert.equal(isProductionRedisNamespace({ VERCEL_ENV: 'production' }), true)
    assert.equal(
      isProductionRedisNamespace({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'feat/request-tally' }),
      false
    )
    assert.equal(isProductionRedisNamespace({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'main' }), false)
    assert.equal(discogsKeyPrefix({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }), 'lf:')
    assert.equal(discogsKeyPrefix({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'feat/foo' }), 'lf:preview:')
  })

  it('blocks unprefixed lf: keys on preview', () => {
    const env = { VERCEL_ENV: 'preview' as const }
    assert.throws(() => assertPrefixedRedisKey('lf:tally:v1', env))
    assert.equal(assertPrefixedRedisKey('lf:preview:tally:v1', env), 'lf:preview:tally:v1')
  })
})
