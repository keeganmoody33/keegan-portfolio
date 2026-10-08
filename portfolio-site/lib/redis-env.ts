/**
 * Lightweight Redis REST env + key-prefix helpers.
 *
 * No Discogs, crate, or Upstash SDK imports — `proxy.ts` / `tally-store`
 * must stay off `discogs-store.ts` so the Edge middleware bundle stays small.
 */

export type RedisRestConfig = {
  url: string
  token: string
}

type EnvMap = Record<string, string | undefined>

const PRODUCTION_REDIS_PREFIX = 'lf:'
const PREVIEW_REDIS_PREFIX = 'lf:preview:'

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

/** Production Redis is Vercel production *and* git ref `main`. A `vercel --prod` from another branch stays on the preview prefix. */
export function isProductionRedisNamespace(env: EnvMap = process.env): boolean {
  if (env.VERCEL_ENV !== 'production') return false
  const ref = env.VERCEL_GIT_COMMIT_REF
  if (ref && ref !== 'main') return false
  return true
}

export function discogsKeyPrefix(env: EnvMap = process.env): string {
  return isProductionRedisNamespace(env) ? PRODUCTION_REDIS_PREFIX : PREVIEW_REDIS_PREFIX
}

export function assertPrefixedRedisKey(key: string, env: EnvMap = process.env): string {
  const prefix = discogsKeyPrefix(env)
  if (prefix === PREVIEW_REDIS_PREFIX && /^lf:(?!preview:)/.test(key)) {
    throw new Error(`preview Redis must not write unprefixed key: ${key}`)
  }
  if (!key.startsWith(prefix)) {
    throw new Error(`Redis key must start with ${prefix}`)
  }
  return key
}
