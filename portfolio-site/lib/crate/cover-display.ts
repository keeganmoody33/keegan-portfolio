export const COVER_PREFERRED_MIN_PX = 1200

export type CoverSource = 'caa' | 'discogs'

export type CoverManifest = {
  releaseId: number
  url: string
  width: number
  height: number
  source: CoverSource
  originalUrl: string
  stored: boolean
  hash?: string
}

export type CoverCandidate = {
  source: CoverSource
  originalUrl: string
  width: number
  height: number
  bytes?: Uint8Array
  contentType?: string
}

export function coverLongerEdge(cover: { width: number; height: number }): number {
  return Math.max(cover.width, cover.height)
}

export function pickLargestCover(candidates: CoverCandidate[]): CoverCandidate | null {
  const usable = candidates.filter(
    (candidate) => candidate.width > 0 && candidate.height > 0 && candidate.originalUrl
  )
  if (usable.length === 0) return null
  const preferred = usable.filter(
    (candidate) => coverLongerEdge(candidate) >= COVER_PREFERRED_MIN_PX
  )
  const pool = preferred.length > 0 ? preferred : usable
  return pool.reduce((best, current) => {
    const bestArea = best.width * best.height
    const currentArea = current.width * current.height
    if (currentArea !== bestArea) return currentArea > bestArea ? current : best
    if (current.source === 'caa' && best.source !== 'caa') return current
    return best
  })
}

export function parseDiscogsImageDimensions(
  url: string
): { width: number; height: number } | null {
  const widthMatch = url.match(/\/w:(\d+)\b/)
  const heightMatch = url.match(/\/h:(\d+)\b/)
  const width = widthMatch ? Number.parseInt(widthMatch[1] ?? '', 10) : 0
  const height = heightMatch ? Number.parseInt(heightMatch[1] ?? '', 10) : 0
  if (width > 0 && height > 0) return { width, height }
  if (width > 0) return { width, height: width }
  if (height > 0) return { width: height, height }
  return null
}

export function isCoverManifest(value: unknown): value is CoverManifest {
  if (!value || typeof value !== 'object') return false
  const record = value as CoverManifest
  return (
    typeof record.releaseId === 'number' &&
    record.releaseId > 0 &&
    typeof record.url === 'string' &&
    typeof record.width === 'number' &&
    typeof record.height === 'number' &&
    (record.source === 'caa' || record.source === 'discogs') &&
    typeof record.originalUrl === 'string' &&
    typeof record.stored === 'boolean'
  )
}

export function displayCoverUrl(
  cover: CoverManifest | null | undefined,
  fallback: string
): string {
  if (cover?.url) return cover.url
  return fallback
}

export function isSelfHostedCoverUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host.endsWith('.public.blob.vercel-storage.com')
  } catch {
    return false
  }
}

export function crateCoverSizes(kind: 'grid' | 'detail'): string {
  return kind === 'detail'
    ? '(min-width: 1280px) 50vw, 480px'
    : '(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw'
}
