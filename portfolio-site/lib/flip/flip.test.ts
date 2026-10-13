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
import { fixtureLookup, parseFlipStub } from './fixtures.ts'
import { emptyLookup, lookupCacheKey, lookupEverysong, mapSampleHistory, mapSearchResults, songFromSearchHit } from './everysong.ts'
import { artistYearLine, parseLookupResult } from './result.ts'
import { FLIP_PATH, flipHrefForTrack } from './route.ts'
import {
  flipLookupCacheKey,
  flipRequestsEnabled,
  flipRequestsKey,
  readFlipLookupCache,
  storeFlipRequest,
  writeFlipLookupCache,
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
    assert.equal(flipHrefForTrack('Hotline Bling', 'Drake'), '/flip?track=Drake%20Hotline%20Bling')
  })
})

describe('copy', () => {
  it('keeps the LF Direction strings and a quiet product line', () => {
    assert.equal(FLIP_COPY.h1, 'flip')
    assert.equal(
      FLIP_COPY.lede,
      "look up a song. see what it sampled and what sampled it. if you want me to flip it, leave a way to reach you and i'll send the beat."
    )
    assert.equal(FLIP_COPY.success, 'got it. if i make it, it comes to you.')
    assert.equal(FLIP_COPY.privacy, 'used only to send you this beat. never shared or added to a list.')
    assert.equal(FLIP_COPY.down, "couldn't reach everysong.")
    assert.equal(FLIP_COPY.empty, 'nothing on file yet')
    assert.equal(FLIP_COPY.noMatch, 'no match for that one.')
    assert.equal(productInquiryLine(), 'building something? 33@lecturesfrom.com')
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
  it('takes the first spine search hit', () => {
    const songs = mapSearchResults({
      results: [
        { rid: 3602, title: 'Hotline Bling', artist: 'Drake', year: 2015, isrc: 'USCM51500238' },
        { rid: 9, title: 'Other', artist: 'Someone', year: 2016 },
      ],
    })
    assert.equal(songs[0]?.title, 'Hotline Bling')
    assert.equal(songs[0]?.year, '2015')
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
    const down = await lookupEverysong('x', {
      key: 'k',
      timeoutMs: 50,
      fetchImpl: async () => new Response('no', { status: 503 }),
    })
    assert.equal(down.status, 'down')
    const none = await lookupEverysong('x', {
      key: 'k',
      fetchImpl: async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
    })
    assert.equal(none.status, 'no_match')
    assert.equal(emptyLookup('down').status, 'down')
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
    assert.equal(parseFlipStub('nope'), null)
    const hotline = fixtureLookup('results')
    assert.equal(hotline.fixture, true)
    assert.equal(hotline.song?.title, 'Hotline Bling')
    assert.ok((hotline.sampledIn.length ?? 0) > 8)
    assert.equal(fixtureLookup('nomatch').status, 'no_match')
    assert.equal(fixtureLookup('down').status, 'down')
    assert.equal(fixtureLookup('empty').samples.length, 0)
  })
})

describe('parseLookupResult / artistYearLine', () => {
  it('accepts a valid payload and drops junk', () => {
    const parsed = parseLookupResult(fixtureLookup('results'))
    assert.equal(parsed?.song?.title, 'Hotline Bling')
    assert.equal(parseLookupResult({ status: 'weird' }), null)
    assert.equal(artistYearLine({ title: 'A', artist: 'B', year: '1972' }), 'B · 1972')
    assert.equal(artistYearLine({ title: 'A', artist: '', year: '1972' }), '1972')
  })
})

describe('preview Redis prefix', () => {
  it('always uses lf:preview:flip: and refuses prod writes', async () => {
    assert.equal(FLIP_REQUESTS_KEY.startsWith('lf:preview:flip:'), true)
    const preview = { VERCEL_ENV: 'preview' }
    assert.equal(flipLookupCacheKey('abc', preview).startsWith(FLIP_REDIS_PREFIX), true)
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
  })
})

describe('privacy in the room and APIs', () => {
  it('request handler never echoes contact fields', () => {
    const route = readSite('../../app/api/flip/request/route.ts')
    assert.equal(route.includes('{ ok: true }'), true)
    assert.equal(/NextResponse\.json\(\s*\{[^}]*email/.test(route), false)
    assert.equal(route.includes('console.log'), false)
  })

  it('FlipRoom keeps the product mailto and privacy line', () => {
    const room = readSite('../../components/house/FlipRoom.tsx')
    assert.equal(room.includes('PRODUCT_MAILTO'), true)
    assert.equal(room.includes('FLIP_COPY.privacy'), true)
    assert.equal(room.includes('ProductInquiry'), true)
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
