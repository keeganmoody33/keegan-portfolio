import { FLIP_COPY } from './copy.ts'
import { isProductionRedisNamespace } from '../redis-env.ts'
import type { FlipStoredRequest } from './types.ts'

type EnvMap = Record<string, string | undefined>

export const FLIP_NOTIFY_TIMEOUT_MS = 8_000
export const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

export type FlipNotifyFetch = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
  }
) => Promise<{ ok: boolean }>

export type FlipNotifyResult = {
  email: boolean
}

const SKIP: FlipNotifyResult = { email: false }

export function flipNotifyTo(env: EnvMap = process.env): string {
  const to = env.FLIP_NOTIFY_TO?.trim()
  return to && to.length > 0 ? to : FLIP_COPY.productEmail
}

export function flipNotifyFrom(env: EnvMap = process.env): string {
  const from = env.FLIP_NOTIFY_FROM?.trim()
  return from && from.length > 0 ? from : `doingflips <${FLIP_COPY.productEmail}>`
}

export function notifyEmailEnabled(env: EnvMap = process.env): boolean {
  if (isProductionRedisNamespace(env)) return false
  return Boolean(env.RESEND_API_KEY?.trim())
}

export function notifyEmailSubject(request: FlipStoredRequest): string {
  return `flip request: ${request.title}`
}

export function notifyEmailBody(request: FlipStoredRequest): string {
  const who = [request.email, request.phone].filter(Boolean).join('\n')
  const song = [request.title, [request.artist, request.year].filter(Boolean).join(' · ')]
    .filter((line) => line.length > 0)
    .join('\n')
  const sms = request.smsOptIn ? 'text the beat: yes' : ''
  return [song, who, sms].filter((block) => block.length > 0).join('\n\n')
}

export function flipNotifyIdempotencyKey(request: FlipStoredRequest): string {
  return `flip-request/${request.at}`
}

async function sendEmail(
  request: FlipStoredRequest,
  fetchImpl: FlipNotifyFetch,
  env: EnvMap
): Promise<boolean> {
  const key = env.RESEND_API_KEY?.trim()
  if (!key) return false
  try {
    const response = await fetchImpl(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': flipNotifyIdempotencyKey(request),
      },
      body: JSON.stringify({
        from: flipNotifyFrom(env),
        to: [flipNotifyTo(env)],
        subject: notifyEmailSubject(request),
        text: notifyEmailBody(request),
      }),
      signal: AbortSignal.timeout(FLIP_NOTIFY_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function notifyFlipRequest(
  request: FlipStoredRequest,
  fetchImpl: FlipNotifyFetch = fetch as FlipNotifyFetch,
  env: EnvMap = process.env
): Promise<FlipNotifyResult> {
  if (!notifyEmailEnabled(env)) return SKIP
  const email = await sendEmail(request, fetchImpl, env)
  return { email }
}
