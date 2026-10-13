import { FLIP_COPY } from './copy.ts'
import type { FlipRequestInput, FlipValidation } from './types.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: string): string {
  return raw.trim()
}

export function digitsOfPhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export function normalizePhone(raw: string): string {
  return raw.trim()
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw)
  if (email.length === 0 || email.length > 254) return false
  return EMAIL_RE.test(email)
}

export function isValidPhone(raw: string): boolean {
  const digits = digitsOfPhone(raw)
  return digits.length >= 10 && digits.length <= 15
}

export function validateFlipRequest(input: FlipRequestInput): FlipValidation {
  const emailRaw = normalizeEmail(input.email)
  const phoneRaw = normalizePhone(input.phone)
  const hasEmail = emailRaw.length > 0
  const hasPhone = phoneRaw.length > 0

  if (!hasEmail && !hasPhone) {
    return { ok: false, error: FLIP_COPY.contactRequired }
  }

  if (hasEmail && !isValidEmail(emailRaw)) {
    return { ok: false, error: FLIP_COPY.emailBad }
  }

  if (hasPhone && !isValidPhone(phoneRaw)) {
    return { ok: false, error: FLIP_COPY.phoneBad }
  }

  const smsOptIn = Boolean(input.smsOptIn)
  if (hasPhone && !hasEmail && !smsOptIn) {
    return { ok: false, error: FLIP_COPY.smsRequired }
  }

  return {
    ok: true,
    email: hasEmail ? emailRaw : null,
    phone: hasPhone ? phoneRaw : null,
    smsOptIn: hasPhone ? smsOptIn : false,
  }
}

export function hasSongIdentity(title: string, artist: string): boolean {
  return title.trim().length > 0 && artist.trim().length > 0
}
