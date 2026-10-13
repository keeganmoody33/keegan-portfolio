import type { FlipLookupResult, FlipSearchResult, FlipSong, FlipStub } from './types.ts'

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

export const DONNY_HITS: FlipSong[] = [
  {
    rid: 19701,
    title: 'Voices Inside (Everything Is Everything)',
    artist: 'Donny Hathaway',
    year: '1970',
    isrc: null,
  },
  {
    rid: 19702,
    title: 'The Ghetto',
    artist: 'Donny Hathaway',
    year: '1970',
    isrc: null,
  },
  {
    rid: 19703,
    title: 'A Song for You',
    artist: 'Donny Hathaway',
    year: '1971',
    isrc: null,
  },
  {
    rid: 19704,
    title: 'Little Ghetto Boy',
    artist: 'Donny Hathaway',
    year: '1972',
    isrc: null,
  },
  {
    rid: 19705,
    title: 'This Christmas',
    artist: 'Donny Hathaway',
    year: '1970',
    isrc: null,
  },
  {
    rid: 19706,
    title: 'Giving Up',
    artist: 'Donny Hathaway',
    year: '1971',
    isrc: null,
  },
  {
    rid: 19707,
    title: 'Someday We\'ll All Be Free',
    artist: 'Donny Hathaway',
    year: '1973',
    isrc: null,
  },
  {
    rid: 19708,
    title: 'I Love You More Than You\'ll Ever Know',
    artist: 'Donny Hathaway',
    year: '1973',
    isrc: null,
  },
]

const VOICES: FlipLookupResult = {
  status: 'ok',
  fixture: true,
  checked: FLIP_FIXTURE_CHECKED,
  song: DONNY_HITS[0]!,
  samples: [],
  sampledIn: [
    { title: 'The 6th Sense', artist: 'Common', year: '2000' },
    { title: 'The Truth', artist: 'Beanie Sigel', year: '2000' },
    { title: 'Everything', artist: 'Foxy Brown', year: '1996' },
  ],
}

function titleLooksLikeVoices(title: string): boolean {
  const t = title.trim().toLowerCase()
  return t.includes('voices inside') || t === 'voices'
}

export function parseFlipStub(raw: string | null | undefined): FlipStub | null {
  if (raw == null) return null
  const value = raw.trim().toLowerCase()
  if (
    value === 'results' ||
    value === 'empty' ||
    value === 'nomatch' ||
    value === 'down' ||
    value === 'success' ||
    value === 'suggest'
  ) {
    return value
  }
  return null
}

export function fixtureLookup(stub: FlipStub, title = '', artist = ''): FlipLookupResult {
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
    case 'suggest':
      if (titleLooksLikeVoices(title) || artist.toLowerCase().includes('hathaway')) {
        if (!title || titleLooksLikeVoices(title)) return VOICES
      }
      if (title && artist) {
        const hit = DONNY_HITS.find(
          (song) =>
            song.title.toLowerCase() === title.trim().toLowerCase() &&
            song.artist.toLowerCase() === artist.trim().toLowerCase()
        )
        if (hit) {
          return {
            status: 'ok',
            fixture: true,
            checked: FLIP_FIXTURE_CHECKED,
            song: hit,
            samples: [],
            sampledIn: [],
          }
        }
      }
      return VOICES
    default: {
      const _exhaustive: never = stub
      return _exhaustive
    }
  }
}

export function fixtureSearch(stub: FlipStub): FlipSearchResult {
  switch (stub) {
    case 'suggest':
      return { status: 'ok', fixture: true, hits: DONNY_HITS }
    case 'nomatch':
      return { status: 'no_match', fixture: true, hits: [] }
    case 'down':
      return { status: 'down', fixture: true, hits: [] }
    case 'results':
    case 'success':
      return HOTLINE.song
        ? { status: 'ok', fixture: true, hits: [HOTLINE.song] }
        : { status: 'no_match', fixture: true, hits: [] }
    case 'empty':
      return EMPTY_SAMPLES.song
        ? { status: 'ok', fixture: true, hits: [EMPTY_SAMPLES.song] }
        : { status: 'no_match', fixture: true, hits: [] }
    default: {
      const _exhaustive: never = stub
      return _exhaustive
    }
  }
}
