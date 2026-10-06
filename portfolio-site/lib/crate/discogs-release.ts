import {
  DiscogsAuthError,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
  discogsHeaders,
  discogsReleaseUrl,
  getDiscogsToken,
  isDiscogsAuthError,
  type DiscogsFetch,
} from '../discogs.ts'

export type DiscogsReleaseDetail = {
  id: number
  title: string
  artist: string
  year: number | null
  released: string | null
  country: string | null
  thumb: string
  cover: string
  format: string | null
  label: string | null
  catno: string | null
  barcode: string | null
  notes: string | null
  discogsUrl: string
  tracklist: Array<{
    position: string
    title: string
    duration: string
    type_: string
  }>
}

type DiscogsArtist = { name?: string; join?: string }
type DiscogsLabel = { name?: string; catno?: string }
type DiscogsFormat = { name?: string; descriptions?: string[]; text?: string }
type DiscogsIdentifier = { type?: string; value?: string }
type DiscogsImage = { type?: string; uri?: string; uri150?: string }
type DiscogsTrack = {
  position?: string
  title?: string
  duration?: string
  type_?: string
}

function formatLine(formats: DiscogsFormat[] | undefined): string | null {
  if (!formats || formats.length === 0) return null
  const first = formats[0]
  if (!first) return null
  const bits = [first.name, ...(first.descriptions ?? [])].filter(Boolean)
  if (first.text) bits.push(first.text)
  const line = bits.join(', ')
  return line || null
}

function artistLine(artists: DiscogsArtist[] | undefined): string {
  return (artists ?? [])
    .map((artist) => artist.name)
    .filter((name): name is string => Boolean(name))
    .join(', ')
}

function barcodeOf(identifiers: DiscogsIdentifier[] | undefined): string | null {
  for (const item of identifiers ?? []) {
    if ((item.type ?? '').toLowerCase() === 'barcode' && item.value) {
      return item.value.replace(/\s+/g, '')
    }
  }
  return null
}

export function mapDiscogsReleaseDetail(raw: {
  id?: number
  title?: string
  year?: number
  released?: string
  country?: string
  thumb?: string
  notes?: string
  artists?: DiscogsArtist[]
  labels?: DiscogsLabel[]
  formats?: DiscogsFormat[]
  identifiers?: DiscogsIdentifier[]
  images?: DiscogsImage[]
  extraartists?: DiscogsArtist[]
  tracklist?: DiscogsTrack[]
}): DiscogsReleaseDetail | null {
  if (typeof raw.id !== 'number' || !Number.isInteger(raw.id) || raw.id <= 0) {
    return null
  }
  const primary = (raw.images ?? []).find((image) => image.type === 'primary') ?? raw.images?.[0]
  const cover = primary?.uri || raw.thumb || ''
  const label = raw.labels?.[0]
  return {
    id: raw.id,
    title: raw.title ?? '',
    artist: artistLine(raw.artists),
    year: typeof raw.year === 'number' && raw.year > 0 ? raw.year : null,
    released: raw.released?.trim() ? raw.released.trim() : null,
    country: raw.country?.trim() ? raw.country.trim() : null,
    thumb: primary?.uri150 || raw.thumb || '',
    cover,
    format: formatLine(raw.formats),
    label: label?.name?.trim() ? label.name.trim() : null,
    catno: label?.catno?.trim() ? label.catno.trim() : null,
    barcode: barcodeOf(raw.identifiers),
    notes: raw.notes?.trim() ? raw.notes.trim() : null,
    discogsUrl: discogsReleaseUrl(raw.id),
    tracklist: (raw.tracklist ?? []).map((track) => ({
      position: track.position ?? '',
      title: track.title ?? '',
      duration: track.duration ?? '',
      type_: track.type_ ?? 'track',
    })),
  }
}

export function isPlayableDiscogsTrack(track: {
  position: string
  title: string
  type_: string
}): boolean {
  if (!track.title.trim()) return false
  if (track.type_ === 'heading' || track.type_ === 'index') return false
  return true
}

function readRetryAfter(response: Response): number {
  const raw = response.headers.get('Retry-After')
  const value = raw ? Number.parseInt(raw, 10) : 60
  return Number.isFinite(value) && value > 0 ? value : 60
}

export const DISCOGS_IDENTITY_URL = 'https://api.discogs.com/oauth/identity'

export function errorForDiscogsStatus(response: Response): Error | null {
  if (response.ok) return null
  if (response.status === 429) {
    return new DiscogsRateLimitError(readRetryAfter(response))
  }
  if (response.status === 401 || response.status === 403) {
    return new DiscogsAuthError(response.status)
  }
  if (response.status === 404 || (response.status >= 400 && response.status < 500)) {
    return new DiscogsNotFoundError()
  }
  return new DiscogsUnavailableError()
}

export function throwForDiscogsStatus(response: Response): void {
  const error = errorForDiscogsStatus(response)
  if (error) throw error
}

export async function probeDiscogsIdentity(
  options: { fetchImpl?: DiscogsFetch; token?: string } = {}
): Promise<{ url: string; status: number; classified: 'auth' | 'other' }> {
  const fetchImpl = options.fetchImpl ?? fetch
  const token = options.token !== undefined ? options.token : getDiscogsToken()
  const url = DISCOGS_IDENTITY_URL
  const response = await fetchImpl(url, {
    headers: discogsHeaders(token),
    cache: 'no-store',
  })
  const error = errorForDiscogsStatus(response)
  return {
    url,
    status: response.status,
    classified: error && isDiscogsAuthError(error) ? 'auth' : 'other',
  }
}

export async function fetchDiscogsReleaseDetail(
  releaseId: number,
  options: { fetchImpl?: DiscogsFetch; token?: string } = {}
): Promise<DiscogsReleaseDetail> {
  const fetchImpl = options.fetchImpl ?? fetch
  const token = options.token !== undefined ? options.token : getDiscogsToken()
  const response = await fetchImpl(`https://api.discogs.com/releases/${releaseId}`, {
    headers: discogsHeaders(token),
    cache: 'no-store',
  })
  throwForDiscogsStatus(response)
  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    throw new DiscogsUnavailableError()
  }
  const mapped = mapDiscogsReleaseDetail(raw as Parameters<typeof mapDiscogsReleaseDetail>[0])
  if (!mapped) throw new DiscogsUnavailableError()
  return mapped
}
