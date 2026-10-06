import { createHash } from 'node:crypto'
import {
  fetchDiscogsReleaseDetail,
  type DiscogsCoverImage,
} from './discogs-release.ts'
import type { StoredPressing } from './types.ts'
import {
  COVER_PREFERRED_MIN_PX,
  coverLongerEdge,
  parseDiscogsImageDimensions,
  pickLargestCover,
  type CoverCandidate,
  type CoverManifest,
} from './cover-display.ts'

export {
  COVER_PREFERRED_MIN_PX,
  coverLongerEdge,
  crateCoverSizes,
  displayCoverUrl,
  isCoverManifest,
  isSelfHostedCoverUrl,
  parseDiscogsImageDimensions,
  pickLargestCover,
} from './cover-display.ts'
export type { CoverCandidate, CoverManifest, CoverSource } from './cover-display.ts'

export const COVER_ART_USER_AGENT = 'lecturesfrom/1.0 (33@lecturesfrom.com)'
export const COVER_ART_MIN_INTERVAL_MS = 1100
export const CAA_API = 'https://coverartarchive.org'
export const COVER_MAX_BYTES = 8 * 1024 * 1024

export type CoverDiscoverInput = {
  releaseId: number
  mbReleaseMbid?: string | null
  mbReleaseGroupMbid?: string | null
  discogsImage?: DiscogsCoverImage | null
  discogsCoverUrl?: string
}

export type CoverDiscoverResult = {
  releaseId: number
  best: CoverCandidate | null
  candidates: CoverCandidate[]
  discogsPx: { width: number; height: number; url: string } | null
}

type CoverFetch = (input: string, init?: RequestInit) => Promise<Response>

export type CoverPacer = {
  requestCount: number
  fetch(input: string, init?: RequestInit): Promise<Response>
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)
}

function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  )
}

export function parseImageSize(
  bytes: Uint8Array
): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    const width = readUInt32BE(bytes, 16)
    const height = readUInt32BE(bytes, 20)
    if (width > 0 && height > 0) return { width, height }
  }

  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    const width = readUInt16LE(bytes, 6)
    const height = readUInt16LE(bytes, 8)
    if (width > 0 && height > 0) return { width, height }
  }

  if (
    bytes.length >= 30 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const tag = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0)
    if (tag === 'VP8X' && bytes.length >= 30) {
      const width =
        1 + ((bytes[24] ?? 0) | ((bytes[25] ?? 0) << 8) | ((bytes[26] ?? 0) << 16))
      const height =
        1 + ((bytes[27] ?? 0) | ((bytes[28] ?? 0) << 8) | ((bytes[29] ?? 0) << 16))
      if (width > 0 && height > 0) return { width, height }
    }
    if (tag === 'VP8 ' && bytes.length >= 30) {
      const width = readUInt16LE(bytes, 26) & 0x3fff
      const height = readUInt16LE(bytes, 28) & 0x3fff
      if (width > 0 && height > 0) return { width, height }
    }
    if (tag === 'VP8L' && bytes.length >= 25) {
      const bits = readUInt32BE(bytes, 21)
      const width = (bits & 0x3fff) + 1
      const height = ((bits >> 14) & 0x3fff) + 1
      if (width > 0 && height > 0) return { width, height }
    }
  }

  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1
        continue
      }
      const marker = bytes[offset + 1] ?? 0
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2
        continue
      }
      const size = readUInt16BE(bytes, offset + 2)
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = readUInt16BE(bytes, offset + 5)
        const width = readUInt16BE(bytes, offset + 7)
        if (width > 0 && height > 0) return { width, height }
        return null
      }
      if (size < 2) return null
      offset += 2 + size
    }
  }

  return null
}

export function coverContentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function coverBlobPath(hash: string, contentType: string): string {
  const subtype = contentType.split('/')[1]?.split(';')[0]?.toLowerCase() ?? 'jpeg'
  const ext = subtype === 'png' ? 'png' : subtype === 'webp' ? 'webp' : 'jpg'
  return `covers/${hash}.${ext}`
}

export function createCoverPacer(options: {
  fetchImpl?: CoverFetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  minIntervalMs?: number
  userAgent?: string
} = {}): CoverPacer {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? defaultSleep
  const minInterval = options.minIntervalMs ?? COVER_ART_MIN_INTERVAL_MS
  const userAgent = options.userAgent ?? COVER_ART_USER_AGENT
  let lastAt = 0
  const pacer: CoverPacer = {
    requestCount: 0,
    async fetch(input, init) {
      const wait = lastAt + minInterval - now()
      if (wait > 0) await sleep(wait)
      lastAt = now()
      pacer.requestCount += 1
      const headers = new Headers(init?.headers)
      if (!headers.has('User-Agent')) headers.set('User-Agent', userAgent)
      return fetchImpl(input, { ...init, headers, redirect: init?.redirect ?? 'follow' })
    },
  }
  return pacer
}

type CaaImage = {
  front?: boolean
  types?: string[]
  image?: string
  thumbnails?: { '1200'?: string; '500'?: string }
}

type CaaIndex = {
  images?: CaaImage[]
}

function caaFrontUrl(index: CaaIndex): string | null {
  const images = index.images ?? []
  const front =
    images.find((image) => image.front === true) ??
    images.find((image) => (image.types ?? []).some((type) => type.toLowerCase() === 'front')) ??
    images[0]
  return front?.image || front?.thumbnails?.['1200'] || front?.thumbnails?.['500'] || null
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

async function fetchLimitedBytes(
  pacer: CoverPacer,
  url: string
): Promise<{ bytes: Uint8Array; contentType: string; finalUrl: string } | null> {
  const response = await pacer.fetch(url, { cache: 'no-store' })
  if (!response.ok) return null
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  const buffer = new Uint8Array(await response.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > COVER_MAX_BYTES) return null
  return { bytes: buffer, contentType, finalUrl: response.url || url }
}

async function caaCandidate(
  pacer: CoverPacer,
  path: string
): Promise<CoverCandidate | null> {
  const listing = await pacer.fetch(`${CAA_API}${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!listing.ok) return null
  const index = await readJson<CaaIndex>(listing)
  const originalUrl = index ? caaFrontUrl(index) : null
  if (!originalUrl) return null
  const body = await fetchLimitedBytes(pacer, originalUrl)
  if (!body) return null
  const size = parseImageSize(body.bytes)
  if (!size) return null
  return {
    source: 'caa',
    originalUrl: body.finalUrl || originalUrl,
    width: size.width,
    height: size.height,
    bytes: body.bytes,
    contentType: body.contentType,
  }
}

async function musicbrainzReleaseGroupId(
  pacer: CoverPacer,
  releaseMbid: string
): Promise<string | null> {
  const params = new URLSearchParams({ inc: 'release-groups', fmt: 'json' })
  const response = await pacer.fetch(
    `https://musicbrainz.org/ws/2/release/${releaseMbid}?${params.toString()}`,
    { cache: 'no-store' }
  )
  if (!response.ok) return null
  const data = await readJson<{ 'release-group'?: { id?: string } }>(response)
  const id = data?.['release-group']?.id
  return id && id.length > 0 ? id : null
}

export function discogsCoverCandidate(
  image: DiscogsCoverImage | null | undefined,
  fallbackUrl = ''
): CoverCandidate | null {
  const url = image?.uri || fallbackUrl
  if (!url) return null
  const parsed = parseDiscogsImageDimensions(url)
  const width = image?.width || parsed?.width || 0
  const height = image?.height || parsed?.height || 0
  if (width <= 0 || height <= 0) return null
  return {
    source: 'discogs',
    originalUrl: url,
    width,
    height,
  }
}

export async function discoverCover(
  input: CoverDiscoverInput,
  options: { pacer?: CoverPacer } = {}
): Promise<CoverDiscoverResult> {
  const pacer = options.pacer ?? createCoverPacer()
  const candidates: CoverCandidate[] = []
  const discogs = discogsCoverCandidate(input.discogsImage, input.discogsCoverUrl ?? '')
  if (discogs) candidates.push(discogs)

  const releaseMbid = input.mbReleaseMbid?.trim() || null
  if (releaseMbid) {
    const fromRelease = await caaCandidate(pacer, `/release/${releaseMbid}`)
    if (fromRelease) candidates.push(fromRelease)
    let groupMbid = input.mbReleaseGroupMbid?.trim() || null
    if (!fromRelease || coverLongerEdge(fromRelease) < COVER_PREFERRED_MIN_PX) {
      if (!groupMbid) groupMbid = await musicbrainzReleaseGroupId(pacer, releaseMbid)
      if (groupMbid) {
        const fromGroup = await caaCandidate(pacer, `/release-group/${groupMbid}`)
        if (fromGroup) candidates.push(fromGroup)
      }
    }
  }

  return {
    releaseId: input.releaseId,
    best: pickLargestCover(candidates),
    candidates,
    discogsPx: discogs
      ? { width: discogs.width, height: discogs.height, url: discogs.originalUrl }
      : null,
  }
}

export function manifestFromDiscovery(
  result: CoverDiscoverResult,
  stored: { url: string; hash: string } | null
): CoverManifest | null {
  const best = result.best
  if (!best) return null
  const mayStore = best.source === 'caa'
  const blob = mayStore ? stored : null
  return {
    releaseId: result.releaseId,
    url: blob?.url ?? (best.source === 'discogs' ? best.originalUrl : ''),
    width: best.width,
    height: best.height,
    source: best.source,
    originalUrl: best.originalUrl,
    stored: Boolean(blob?.url),
    hash: blob?.hash,
  }
}

export type CoverLookupDeps = {
  fetchDiscogs?: (releaseId: number) => Promise<{
    primaryImage?: DiscogsCoverImage | null
    cover: string
    thumb: string
  }>
  getPressing?: (releaseId: number) => Promise<StoredPressing | null>
}

export async function lookupCoverSources(
  releaseId: number,
  deps: CoverLookupDeps = {}
): Promise<CoverDiscoverInput> {
  const fetchDetail =
    deps.fetchDiscogs ?? ((id: number) => fetchDiscogsReleaseDetail(id))
  const getPressing = deps.getPressing ?? (async () => null)
  const [detail, pressing] = await Promise.all([
    fetchDetail(releaseId).catch(() => null),
    getPressing(releaseId).catch(() => null),
  ])
  return {
    releaseId,
    mbReleaseMbid: pressing?.mbRelease.mbid ?? null,
    discogsImage: detail?.primaryImage ?? null,
    discogsCoverUrl: detail?.cover || pressing?.facts.cover || '',
  }
}
