export const COLLECTION_KEEP_PATH = '/api/cron/collection-keep'
export const COLLECTION_KEEP_REVALIDATE_SECONDS = 300

export type KeepFetch = (
  input: string,
  init?: RequestInit & { next?: { revalidate: number } }
) => Promise<Response>

export function collectionKeepUrl(
  env: Record<string, string | undefined> = process.env
): string | null {
  const host = env.VERCEL_URL || env.VERCEL_PROJECT_PRODUCTION_URL
  if (!host) return null
  const origin = /^https?:\/\//i.test(host) ? host : `https://${host}`
  return `${origin}${COLLECTION_KEEP_PATH}`
}

export function scheduleKeepPing(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: KeepFetch = fetch
): boolean {
  const secret = env.CRON_SECRET?.trim()
  const url = collectionKeepUrl(env)
  if (!secret || !url) return false
  void fetchImpl(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
    next: { revalidate: COLLECTION_KEEP_REVALIDATE_SECONDS },
  }).catch(() => {
    // Keep is best-effort. ISR HTML already served last-good.
  })
  return true
}
