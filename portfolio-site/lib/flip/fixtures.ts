import type { FlipLookupResult, FlipStub } from './types.ts'

/** Clearly marked stub data for screenshots when EVERYSONG_API_KEY is unset. */
export const FLIP_FIXTURE_CHECKED = '2026-10-13'

const HOTLINE: FlipLookupResult = {
  status: 'ok',
  fixture: true,
  checked: FLIP_FIXTURE_CHECKED,
  song: {
    rid: 3602,
    title: 'Hotline Bling',
    artist: 'Drake',
    year: '2015',
    isrc: 'USCM51500238',
  },
  samples: [
    { title: "Why Can't We Live Together", artist: 'Timmy Thomas', year: '1972' },
  ],
  sampledIn: [
    { title: 'Thot Line Bling', artist: 'Jadakiss feat. Nino Man', year: '2015' },
    { title: 'Hotline Bling', artist: 'Justin Bieber', year: '2015' },
    { title: 'Hotline Bling', artist: 'Alex G', year: '2015' },
    { title: 'Hotline Bling', artist: 'Pentatonix', year: '2016' },
    { title: 'Bling', artist: 'Chloe x Halle', year: '2016' },
    { title: 'Hotline', artist: 'Billboard Cover', year: '2016' },
    { title: 'Call Me', artist: 'Studio cover', year: '2017' },
    { title: 'Hotline Flip', artist: 'DJ Mustard', year: '2017' },
    { title: 'Line Bounce', artist: 'Unofficial mix', year: '2018' },
    { title: 'Bling Edit', artist: 'Club cut', year: '2019' },
    { title: 'Hotline Refix', artist: 'UKG mix', year: '2020' },
    { title: 'That Line', artist: 'Chopped mix', year: '2021' },
  ],
}

const EMPTY_SAMPLES: FlipLookupResult = {
  status: 'ok',
  fixture: true,
  checked: FLIP_FIXTURE_CHECKED,
  song: {
    rid: 111,
    title: 'Original Composition',
    artist: 'Fixture Artist',
    year: '1999',
    isrc: 'USFIX9900111',
  },
  samples: [],
  sampledIn: [],
}

const NO_MATCH: FlipLookupResult = {
  status: 'no_match',
  fixture: true,
  checked: null,
  song: null,
  samples: [],
  sampledIn: [],
}

const DOWN: FlipLookupResult = {
  status: 'down',
  fixture: true,
  checked: null,
  song: null,
  samples: [],
  sampledIn: [],
}

export function parseFlipStub(raw: string | null | undefined): FlipStub | null {
  if (raw == null) return null
  const value = raw.trim().toLowerCase()
  if (
    value === 'results' ||
    value === 'empty' ||
    value === 'nomatch' ||
    value === 'down' ||
    value === 'success'
  ) {
    return value
  }
  return null
}

export function fixtureLookup(stub: FlipStub): FlipLookupResult {
  switch (stub) {
    case 'results':
    case 'success':
      return HOTLINE
    case 'empty':
      return EMPTY_SAMPLES
    case 'nomatch':
      return NO_MATCH
    case 'down':
      return DOWN
    default: {
      const _exhaustive: never = stub
      return _exhaustive
    }
  }
}
