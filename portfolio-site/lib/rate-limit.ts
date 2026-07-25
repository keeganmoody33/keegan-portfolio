import { NextRequest } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Module-level store for rate limit counts (in-memory, per-instance)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Periodic cleanup of expired entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60 * 1000 // 1 minute
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Get the client IP from a NextRequest.
 * Falls back to 'unknown' if no IP can be determined.
 */
function getClientIp(request: NextRequest): string {
  // request.ip is available in some Next.js deployments
  const ip = (request as NextRequest & { ip?: string }).ip
  if (ip) return ip

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return 'unknown'
}

/**
 * Check rate limit for a given key using a fixed-window counter.
 *
 * @param request The NextRequest to identify the client IP from
 * @param key A namespace for the rate limit (e.g. route path)
 * @param limit Maximum number of requests allowed in the window
 * @param windowMs Window size in milliseconds
 * @returns { success: boolean; retryAfter: number } — retryAfter is in seconds (ceiling)
 */
export function checkRateLimit(
  request: NextRequest,
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; retryAfter: number } {
  cleanupExpiredEntries()

  const ip = getClientIp(request)
  const storeKey = `${key}:${ip}`
  const now = Date.now()

  const entry = rateLimitStore.get(storeKey)

  if (!entry || now > entry.resetTime) {
    // Start a new window
    rateLimitStore.set(storeKey, {
      count: 1,
      resetTime: now + windowMs,
    })
    return { success: true, retryAfter: 0 }
  }

  entry.count += 1

  if (entry.count > limit) {
    const retryAfterMs = entry.resetTime - now
    const retryAfterSec = Math.ceil(retryAfterMs / 1000)
    return { success: false, retryAfter: Math.max(retryAfterSec, 1) }
  }

  return { success: true, retryAfter: 0 }
}
