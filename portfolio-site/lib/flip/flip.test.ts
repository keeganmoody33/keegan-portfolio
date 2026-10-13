/**
 * Preview /flip room — lookup mapping, validation, privacy, fixtures, Redis prefix.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/flip/flip.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FLIP_COPY, productInquiryLine, showAllLabel, sourceLine } from './copy.ts'
import { DONNY_HITS, fixtureLookup, fixtureSearch, parseFlipStub } from './fixtures.ts'
import {
  emptyLookup,
  lookupCacheKey,
  lookupEverysong,
  mapSampleHistory,
  mapSearchResults,
  samplesForSong,
  searchEverysong,
  songFromSearchHit,
} from './everysong.ts'
import { artistYearLine, parseLookupResult, parseSearchResult } from './result.ts'
import { FLIP_PATH, flipHrefForTrack } from './route.ts'
import {
  flipLookupCacheKey,
  flipRequestsEnabled,
  flipRequestsKey,
  flipSearchCacheKey,
  readFlipLookupCache,
  readFlipSearchCache,
  storeFlipRequest,
  writeFlipLookupCache,
  writeFlipSearchCache,
  type FlipRedis,
} from './store.ts'
import { FLIP_REDIS_PREFIX, FLIP_REQUESTS_KEY } from './types.ts'
import { hasSongIdentity, validateFlipRequest } from './validate.ts'

function readSite(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
}

function fakeRedis() {
  const strings = new Map<string, string>()
  const lists = new Map<string, string[]>()
  const db: FlipRedis = {
    async get(key: string) {
      return strings.get(key) ?? null
    },
    async set(key: string, value: string) {
      strings.set(key, value)
    },
    async rpush(key: string, ...values: string[]) {
      const list = lists.get(key) ?? []
      list.push(...values)
      lists.set(key, list)
    },
  }
  return { db, strings, lists }
}

describe('route constant', () => {
  it('is one path so the room is easy to move', () => {
    assert.equal(FLIP_PATH, '/flip')
    assert.equal(flipHrefForTrack(''), '/flip')
    assert.equal(
      flipHrefForTrack('Hotline Bling', 'Drake'),
      '/flip?title=Hotline+Bling&artist=Drake'
    )
  })
})

describe('copy', () => {
  it('keeps the LF Direction strings, sample-flip CTA, and a connect arm', () => {
    assert.equal(FLIP_COPY.h1, 'doingflips')
    assert.equal(FLIP_COPY.h1Mark, 'flip')
    assert.equal(
      FLIP_COPY.lede,
      "find a song you want me to flip. pick it, leave a way to reach you, i'll send the beat."
    )
    assert.equal(FLIP_COPY.submit, 'request a sample flip')
    assert.equal(FLIP_COPY.askFlip, 'request a sample flip')
    assert.equal(FLIP_COPY.lookup, 'song')
    assert.equal(FLIP_COPY.lookupPlaceholder, 'title, artist, a line you remember')
    assert.equal(FLIP_COPY.success, 'got it. if i make it, it comes to you.')
    assert.equal(FLIP_COPY.privacy, 'used only to send you this beat. never shared or added to a list.')
    assert.equal(FLIP_COPY.down, "couldn't reach everysong.")
    assert.equal(FLIP_COPY.empty, 'nothing on file yet')
    assert.equal(FLIP_COPY.noMatch, 'no match for that one.')
    assert.equal(
      productInquiryLine(),
      'connect jump on a call, or inquire about services. 33@lecturesfrom.com'
    )
    assert.equal(showAllLabel(12), 'show all (12)')
    assert.equal(sourceLine('2026-10-13', true), 'everysong.site · fixture')
    assert.equal(sourceLine('2026-10-13', false), 'everysong.site · checked 2026-10-13')
  })

  it('does not add GTM, Morph, or sales copy', () => {
    const blob = Object.values(FLIP_COPY).join(' ')
    assert.equal(/gtm|morph|book a call|let's talk|growth|pipeline/i.test(blob), false)
  })
})

describe('validateFlipRequest', () => {
  const song = {
    rid: 1,
    title: 'Hotline Bling',
    artist: 'Drake',
    year: '2015',
    isrc: null,
  }

  it('accepts email only', () => {
    const result = validateFlipRequest({ ...song, email: 'a@b.co', phone: '', smsOptIn: false })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.email, 'a@b.co')
      assert.equal(result.phone, null)
      assert.equal(result.smsOptIn, false)
    }
  })

  it('requires SMS opt-in for phone-only', () => {
    const missing = validateFlipRequest({ ...song, email: '', phone: '4045551212', smsOptIn: false })
    assert.deepEqual(missing, { ok: false, error: FLIP_COPY.smsRequired })
    const ok = validateFlipRequest({ ...song, email: '', phone: '404-555-1212', smsOptIn: true })
    assert.equal(ok.ok, true)
    if (ok.ok) {
      assert.equal(ok.phone, '404-555-1212')
      assert.equal(ok.smsOptIn, true)
    }
  })

  it('allows email plus phone without SMS', () => {
    const result = validateFlipRequest({
      ...song,
      email: 'a@b.co',
      phone: '4045551212',
      smsOptIn: false,
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.smsOptIn, false)
  })

  it('rejects empty contact and bad values', () => {
    assert.deepEqual(validateFlipRequest({ ...song, email: '', phone: '', smsOptIn: false }), {
      ok: false,
      error: FLIP_COPY.contactRequired,
    })
    assert.equal(
      validateFlipRequest({ ...song, email: 'nope', phone: '', smsOptIn: false }).ok,
      false
    )
    assert.equal(
      validateFlipRequest({ ...song, email: '', phone: '123', smsOptIn: true }).ok,
      false
    )
  })

  it('requires a song identity before a request', () => {
    assert.equal(hasSongIdentity('Hotline Bling', 'Drake'), true)
    assert.equal(hasSongIdentity('  ', 'Drake'), false)
  })
})

describe('everysong mapping', () => {
  it('keeps every spine search hit instead of auto-picking the first', () => {
    const songs = mapSearchResults({
      results: [
        { rid: 3602, title: 'Hotline Bling', artist: 'Drake', year: 2015, isrc: 'USCM51500238' },
        { rid: 9, title: 'Other', artist: 'Someone', year: 2016 },
      ],
    })
    assert.equal(songs.length, 2)
    assert.equal(songs[0]?.title, 'Hotline Bling')
    assert.equal(songs[0]?.year, '2015')
    assert.equal(songs[1]?.title, 'Other')
    assert.equal(songFromSearchHit({ title: 'x' }), null)
  })

  it('keeps sample edges and skips cover/remix', () => {
    const history = mapSampleHistory({
      upstream: [
        {
          family: 'sample',
          rel: 'samples',
          node: { title: "Why Can't We Live Together", artist: 'Timmy Thomas', year: '1972' },
        },
        { family: 'cover', rel: 'cover', node: { title: 'Cover', artist: 'X', year: '2016' } },
      ],
      downstream: [
        {
          family: 'sample',
          rel: 'sampled in',
          node: { title: 'Thot Line Bling', artist: 'Jadakiss feat. Nino Man', year: 2015 },
        },
        { family: 'remix', rel: 'remix', node: { title: 'Remix', artist: 'Y', year: '2016' } },
      ],
    })
    assert.equal(history.samples.length, 1)
    assert.equal(history.samples[0]?.title, "Why Can't We Live Together")
    assert.equal(history.sampledIn.length, 1)
    assert.equal(history.sampledIn[0]?.year, '2015')
  })

  it('returns down when search fails and no_match when empty', async () => {
    const down = await lookupEverysong('xx', {
      key: 'k',
      timeoutMs: 50,
      fetchImpl: async () => new Response('no', { status: 503 }),
    })
    assert.equal(down.status, 'down')
    const none = await lookupEverysong('xx', {
      key: 'k',
      fetchImpl: async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
    })
    assert.equal(none.status, 'no_match')
    assert.equal(emptyLookup('down').status, 'down')
  })

  it('does not fetch samples when search returns more than one hit', async () => {
    let calls = 0
    const many = await lookupEverysong('Funky Drummer', {
      key: 'k',
      fetchImpl: async (input) => {
        calls += 1
        const url = String(input)
        assert.equal(url.includes('/samples/song'), false)
        return new Response(
          JSON.stringify({
            results: [
              { rid: 1, title: 'Funky Drummer (Part 1 & 2)', artist: 'James Brown', year: 1986 },
              { rid: 2, title: 'Funky Drummer', artist: 'James Brown', year: 1970 },
            ],
          }),
          { status: 200 }
        )
      },
    })
    assert.equal(many.status, 'no_match')
    assert.equal(calls, 1)
  })

  it('searchEverysong returns the list; samplesForSong is a second call', async () => {
    const search = await searchEverysong('Donny Pathway Voices', {
      key: 'k',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            results: DONNY_HITS.slice(0, 2).map((hit) => ({
              rid: hit.rid,
              title: hit.title,
              artist: hit.artist,
              year: hit.year,
            })),
          }),
          { status: 200 }
        ),
    })
    assert.equal(search.status, 'ok')
    assert.equal(search.hits.length, 2)
    assert.equal(search.hits[0]?.title.includes('Voices Inside'), true)

    const history = await samplesForSong(search.hits[0]!, {
      key: 'k',
      fetchImpl: async () =>
        new Response(JSON.stringify({ upstream: [], downstream: [] }), { status: 200 }),
    })
    assert.equal(history.status, 'ok')
    assert.equal(history.song?.artist, 'Donny Hathaway')
  })

  it('hashes lookup queries without storing the raw string in the key', () => {
    const key = lookupCacheKey('Drake Hotline Bling')
    assert.equal(key.includes('Drake'), false)
    assert.equal(key.includes('Hotline'), false)
    assert.equal(key.length, 24)
  })
})

describe('fixtures', () => {
  it('parses stub names and marks fixture data', () => {
    assert.equal(parseFlipStub('results'), 'results')
    assert.equal(parseFlipStub('SUCCESS'), 'success')
    assert.equal(parseFlipStub('suggest'), 'suggest')
    assert.equal(parseFlipStub('nope'), null)
    const hotline = fixtureLookup('results')
    assert.equal(hotline.fixture, true)
    assert.equal(hotline.song?.title, 'Hotline Bling')
    assert.ok((hotline.sampledIn.length ?? 0) > 8)
    assert.equal(fixtureLookup('nomatch').status, 'no_match')
    assert.equal(fixtureLookup('down').status, 'down')
    assert.equal(fixtureLookup('empty').samples.length, 0)
    const donny = fixtureSearch('suggest')
    assert.equal(donny.status, 'ok')
    assert.equal(donny.hits[0]?.title, 'Voices Inside (Everything Is Everything)')
    assert.equal(donny.hits[0]?.artist, 'Donny Hathaway')
    assert.ok(donny.hits.length > 1)
    const voices = fixtureLookup('suggest', 'Voices Inside (Everything Is Everything)', 'Donny Hathaway')
    assert.equal(voices.song?.title, 'Voices Inside (Everything Is Everything)')
    assert.equal(voices.fixture, true)
  })
})

describe('parseLookupResult / artistYearLine', () => {
  it('accepts a valid payload and drops junk', () => {
    const parsed = parseLookupResult(fixtureLookup('results'))
    assert.equal(parsed?.song?.title, 'Hotline Bling')
    assert.equal(parseLookupResult({ status: 'weird' }), null)
    assert.equal(artistYearLine({ title: 'A', artist: 'B', year: '1972' }), 'B · 1972')
    assert.equal(artistYearLine({ title: 'A', artist: '', year: '1972' }), '1972')
    const search = parseSearchResult(fixtureSearch('suggest'))
    assert.equal(search?.hits[0]?.artist, 'Donny Hathaway')
    assert.equal(parseSearchResult({ status: 'weird' }), null)
  })
})

describe('preview Redis prefix', () => {
  it('always uses lf:preview:flip: and refuses prod writes', async () => {
    assert.equal(FLIP_REQUESTS_KEY.startsWith('lf:preview:flip:'), true)
    const preview = { VERCEL_ENV: 'preview' }
    assert.equal(flipLookupCacheKey('abc', preview).startsWith(FLIP_REDIS_PREFIX), true)
    assert.equal(flipSearchCacheKey('abc', preview).startsWith(`${FLIP_REDIS_PREFIX}search:`), true)
    assert.equal(flipRequestsKey(preview), FLIP_REQUESTS_KEY)
    const prod = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }
    assert.equal(flipRequestsEnabled(prod), false)
    const { db, lists } = fakeRedis()
    const stored = await storeFlipRequest(
      {
        at: '2026-10-13T00:00:00.000Z',
        rid: 1,
        title: 'Hotline Bling',
        artist: 'Drake',
        year: '2015',
        isrc: null,
        email: 'secret@example.com',
        phone: '4045551212',
        smsOptIn: true,
      },
      db,
      prod
    )
    assert.equal(stored, false)
    assert.equal(lists.size, 0)

    const previewStore = fakeRedis()
    const ok = await storeFlipRequest(
      {
        at: '2026-10-13T00:00:00.000Z',
        rid: 1,
        title: 'Hotline Bling',
        artist: 'Drake',
        year: '2015',
        isrc: null,
        email: 'secret@example.com',
        phone: null,
        smsOptIn: false,
      },
      previewStore.db,
      preview
    )
    assert.equal(ok, true)
    const dumped = previewStore.lists.get(FLIP_REQUESTS_KEY)?.[0]
    assert.ok(dumped)
    assert.equal(dumped.includes('secret@example.com'), true)

    await writeFlipLookupCache('abc', fixtureLookup('results'), previewStore.db, preview)
    const cached = await readFlipLookupCache('abc', previewStore.db, preview)
    assert.equal(cached?.song?.title, 'Hotline Bling')
    await writeFlipSearchCache('abc', fixtureSearch('suggest'), previewStore.db, preview)
    const searchCached = await readFlipSearchCache('abc', previewStore.db, preview)
    assert.equal(searchCached?.hits[0]?.artist, 'Donny Hathaway')
  })
})

describe('privacy in the room and APIs', () => {
  it('request handler never echoes contact fields', () => {
    const route = readSite('../../app/api/flip/request/route.ts')
    assert.equal(route.includes('{ ok: true }'), true)
    assert.equal(/NextResponse\.json\(\s*\{[^}]*email/.test(route), false)
    assert.equal(route.includes('console.log'), false)
  })

  it('everysong key stays on the server and is never logged', () => {
    const room = readSite('../../components/house/FlipRoom.tsx')
    const lookup = readSite('../../app/api/flip/lookup/route.ts')
    const search = readSite('../../app/api/flip/search/route.ts')
    const everysong = readSite('./everysong.ts')
    assert.equal(room.includes('EVERYSONG_API_KEY'), false)
    assert.equal(room.includes('everysongApiKey'), false)
    assert.equal(lookup.includes('console.log'), false)
    assert.equal(search.includes('console.log'), false)
    assert.equal(everysong.includes('console.log'), false)
  })

  it('FlipRoom keeps the connect mailto, privacy line, and song combobox', () => {
    const room = readSite('../../components/house/FlipRoom.tsx')
    const page = readSite('../../app/(house)/flip/page.tsx')
    const css = readSite('../../app/globals.css')
    assert.equal(room.includes('PRODUCT_MAILTO'), true)
    assert.equal(room.includes('FLIP_COPY.privacy'), true)
    assert.equal(room.includes('ProductInquiry'), true)
    assert.equal(room.includes('FLIP_COPY.connect'), true)
    assert.equal(room.includes('role="combobox"'), true)
    assert.equal(room.includes('/api/flip/search'), true)
    assert.equal(page.includes('doing'), true)
    assert.equal(page.includes('flip-h1'), true)
    assert.equal(css.includes('@keyframes flipLand'), true)
    assert.equal(/GTM|Morph/.test(room), false)
  })

  it('footer and record detail use the route constant', () => {
    const footer = readSite('../../components/house/HouseFooter.tsx')
    const detail = readSite('../../components/house/RecordDetail.tsx')
    assert.equal(footer.includes('FLIP_PATH'), true)
    assert.equal(footer.includes('FLIP_COPY.nav'), true)
    assert.equal(detail.includes('flipHrefForTrack'), true)
    assert.equal(detail.includes('FLIP_COPY.askFlip'), true)
  })
})
