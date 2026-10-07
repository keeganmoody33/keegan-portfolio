/**
 * Strict positive decimal integer. Rejects `567894oops`, `567894.5`, `1e3`
 * instead of truncating them to a different valid id.
 */
export function parsePositiveId(raw: string): number | null {
  const token = raw.trim()
  if (!/^[1-9]\d*$/.test(token)) return null
  const n = Number(token)
  return Number.isSafeInteger(n) ? n : null
}

export function parseIdList(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return []
  const ids: number[] = []
  const seen = new Set<number>()
  for (const part of raw.split(',')) {
    const n = parsePositiveId(part)
    if (n !== null && !seen.has(n)) {
      ids.push(n)
      seen.add(n)
    }
  }
  return ids
}
