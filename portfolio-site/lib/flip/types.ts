export type FlipSampleRow = {
  title: string
  artist: string
  year: string | null
}

export type FlipSong = {
  rid: number | null
  title: string
  artist: string
  year: string | null
  isrc: string | null
}

export type FlipLookupStatus = 'ok' | 'empty' | 'no_match' | 'down'

export type FlipLookupResult = {
  status: FlipLookupStatus
  fixture: boolean
  checked: string | null
  song: FlipSong | null
  samples: FlipSampleRow[]
  sampledIn: FlipSampleRow[]
}

export type FlipStub = 'results' | 'empty' | 'nomatch' | 'down' | 'success'

export type FlipRequestInput = {
  rid: number | null
  title: string
  artist: string
  year: string | null
  isrc: string | null
  email: string
  phone: string
  smsOptIn: boolean
}

export type FlipValidation =
  | { ok: true; email: string | null; phone: string | null; smsOptIn: boolean }
  | { ok: false; error: string }

export type FlipStoredRequest = {
  at: string
  rid: number | null
  title: string
  artist: string
  year: string | null
  isrc: string | null
  email: string | null
  phone: string | null
  smsOptIn: boolean
}

export const FLIP_REDIS_PREFIX = 'lf:preview:flip:'
export const FLIP_REQUESTS_KEY = `${FLIP_REDIS_PREFIX}requests`
export const EVERYSONG_ORIGIN = 'https://everysong.site'
export const EVERYSONG_SEARCH_PATH = '/api/v2/spine/search'
export const EVERYSONG_SAMPLES_PATH = '/api/v2/samples/song'
export const EVERYSONG_USER_AGENT =
  'lecturesfrom/1.0 +https://lecturesfrom.com ( 33@lecturesfrom.com )'
export const FLIP_LOOKUP_CACHE_TTL_SECONDS = 6 * 60 * 60
export const FLIP_LOOKUP_RATE_LIMIT = 10
export const FLIP_REQUEST_RATE_LIMIT = 6
export const FLIP_RATE_WINDOW_MS = 60 * 1000
export const EVERYSONG_TIMEOUT_MS = 25_000
export const FLIP_QUERY_MAX = 200
