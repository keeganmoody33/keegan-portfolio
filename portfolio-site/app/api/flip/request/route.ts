import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { FLIP_COPY } from '@/lib/flip/copy.ts'
import { hasSongIdentity, validateFlipRequest } from '@/lib/flip/validate.ts'
import { notifyFlipRequest } from '@/lib/flip/notify.ts'
import { flipProductionLocked, flipRequestsEnabled, storeFlipRequest } from '@/lib/flip/store.ts'
import { parseFlipStub } from '@/lib/flip/fixtures.ts'
import { FLIP_QUERY_MAX, FLIP_RATE_WINDOW_MS, FLIP_REQUEST_RATE_LIMIT } from '@/lib/flip/types.ts'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asRid(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10)
  }
  return null
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: NextRequest) {
  const posthog = getPostHogClient()
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'

  const rateLimit = checkRateLimit(request, 'api/flip/request', FLIP_REQUEST_RATE_LIMIT, FLIP_RATE_WINDOW_MS)
  if (!rateLimit.success) {
    posthog.capture({
      distinctId,
      event: 'api_rate_limited',
      properties: { route: 'api/flip/request' },
    })
    return jsonError(FLIP_COPY.storeDown, 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(FLIP_COPY.contactRequired, 400)
  }

  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const title = asString(rec.title).trim().slice(0, FLIP_QUERY_MAX)
  const artist = asString(rec.artist).trim().slice(0, FLIP_QUERY_MAX)
  if (!hasSongIdentity(title, artist)) {
    return jsonError(FLIP_COPY.songRequired, 400)
  }

  const validated = validateFlipRequest({
    rid: asRid(rec.rid),
    title,
    artist,
    year: asString(rec.year) || null,
    isrc: asString(rec.isrc) || null,
    email: asString(rec.email),
    phone: asString(rec.phone),
    smsOptIn: rec.smsOptIn === true,
  })
  if (!validated.ok) {
    return jsonError(validated.error, 400)
  }

  const stub = parseFlipStub(asString(rec.stub) || null)
  const fixtureAccept = Boolean(stub) && !flipProductionLocked()
  const payload = {
    at: new Date().toISOString(),
    rid: asRid(rec.rid),
    title,
    artist,
    year: asString(rec.year) || null,
    isrc: asString(rec.isrc) || null,
    email: validated.email,
    phone: validated.phone,
    smsOptIn: validated.smsOptIn,
  }
  const stored = fixtureAccept ? true : await storeFlipRequest(payload)

  if (!stored && !flipRequestsEnabled()) {
    posthog.capture({
      distinctId,
      event: 'api_flip_request',
      properties: { stored: false, has_email: Boolean(validated.email), has_phone: Boolean(validated.phone) },
    })
    return jsonError(FLIP_COPY.storeDown, 503)
  }

  if (!stored) {
    return jsonError(FLIP_COPY.storeDown, 503)
  }

  const notified = fixtureAccept ? { email: false } : await notifyFlipRequest(payload)

  posthog.capture({
    distinctId,
    event: 'api_flip_request',
    properties: {
      stored: true,
      fixture: fixtureAccept,
      has_email: Boolean(validated.email),
      has_phone: Boolean(validated.phone),
      sms_opt_in: validated.smsOptIn,
      notified_email: notified.email,
    },
  })

  return NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
