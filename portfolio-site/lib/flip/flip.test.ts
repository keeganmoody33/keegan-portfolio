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
  pickedSong,
  samplesForSong,
  searchEverysong,
  songFromSearchHit,
} from './everysong.ts'
import { artistYearLine, fillSongIdentity, parseLookupResult, parseSearchResult } from './result.ts'
import { FLIP_PATH, flipHrefForTrack } from './route.ts'
import {
  flipLookupCacheKey,
  flipProductionLocked,
  flipRequestsEnabled,
  flipRequestsKey,
  flipSearchCacheKey,
  flipWriteLocked,
  readFlipLookupCache,
  readFlipSearchCache,
  storeFlipRequest,
  writeFlipLookupCache,
  writeFlipSearchCache,
  type FlipRedis,
} from './store.ts'
import { FLIP_PROD_REDIS_PREFIX, FLIP_PROD_REQUESTS_KEY, FLIP_REDIS_PREFIX, FLIP_REQUESTS_KEY } from './types.ts'
import {
  flipNotifyIdempotencyKey,
  notifyEmailBody,
  notifyEmailEnabled,
  notifyEmailSubject,
  notifyFlipRequest,
  RESEND_EMAILS_URL,
} from './notify.ts'
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
  it('sets honest request expectations and keeps contact consent and source attribution', () => {
    assert.equal(FLIP_COPY.h1, 'doingflips')
    assert.equal(FLIP_COPY.h1Mark, 'flip')
    assert.match(FLIP_COPY.lede, /if i make/)
    assert.match(FLIP_COPY.success, /if i make/)
    assert.equal(FLIP_COPY.submit, 'request a sample flip')
    assert.equal(FLIP_COPY.askFlip, 'request a sample flip')
    assert.equal(FLIP_COPY.contactHint, 'email or phone. one is enough.')
    assert.equal(FLIP_COPY.privacy, 'your email and phone stay private. used only for this request, never added to a list.')
    assert.ok(productInquiryLine().includes('33@lecturesfrom.com'))
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
    assert.equal(history.song?.rid, search.hits[0]?.rid)
    assert.equal(history.song?.year, search.hits[0]?.year)
  })

  it('keeps rid, year, and isrc from the picked search hit', () => {
    const song = pickedSong({
      title: 'Hotline Bling',
      artist: 'Drake',
      rid: '3602',
      year: '2015',
      isrc: 'USCM51500238',
    })
    assert.deepEqual(song, {
      rid: 3602,
      title: 'Hotline Bling',
      artist: 'Drake',
      year: '2015',
      isrc: 'USCM51500238',
    })
    assert.equal(pickedSong({ title: 'A', artist: 'B', year: 'nope', rid: 'x' }).year, null)
    assert.equal(pickedSong({ title: 'A', artist: 'B', rid: 'x' }).rid, null)
    const cached = {
      rid: null,
      title: 'Hotline Bling',
      artist: 'Drake',
      year: null,
      isrc: null,
    }
    assert.deepEqual(fillSongIdentity(cached, song), { ...cached, rid: 3602, year: '2015', isrc: 'USCM51500238' })
    assert.equal(fillSongIdentity(song, { rid: null, year: null, isrc: null }).year, '2015')
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

describe('flip Redis prefix', () => {
  it('uses lf:preview:flip: off main, lf:flip: on production main, and refuses non-main prod writes', async () => {
    assert.equal(FLIP_REQUESTS_KEY.startsWith('lf:preview:flip:'), true)
    const preview = { VERCEL_ENV: 'preview' }
    assert.equal(flipLookupCacheKey('abc', preview).startsWith(FLIP_REDIS_PREFIX), true)
    assert.equal(flipSearchCacheKey('abc', preview).startsWith(`${FLIP_REDIS_PREFIX}search:`), true)
    assert.equal(flipRequestsKey(preview), FLIP_REQUESTS_KEY)
    const prod = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }
    assert.equal(flipProductionLocked(prod), true)
    assert.equal(flipWriteLocked(prod), false)
    assert.equal(flipRequestsKey(prod), FLIP_PROD_REQUESTS_KEY)
    assert.equal(flipLookupCacheKey('abc', prod).startsWith(FLIP_PROD_REDIS_PREFIX), true)
    assert.equal(flipRequestsEnabled(prod), false)
    assert.equal(
      flipRequestsEnabled({ ...prod, KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't' }),
      true
    )
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
    assert.equal(stored, true)
    assert.equal(lists.get(FLIP_PROD_REQUESTS_KEY)?.length, 1)
    assert.equal([...lists.keys()].some((key) => key.startsWith('lf:preview:')), false)

    const prodBranch = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'feat/not-main' }
    assert.equal(flipProductionLocked(prodBranch), true)
    assert.equal(flipWriteLocked(prodBranch), true)
    assert.equal(flipRequestsEnabled(prodBranch), false)
    const branchDb = fakeRedis()
    const branchStored = await storeFlipRequest(
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
      branchDb.db,
      prodBranch
    )
    assert.equal(branchStored, false)
    assert.equal(branchDb.lists.size, 0)
    await writeFlipLookupCache('abc', fixtureLookup('results'), branchDb.db, prodBranch)
    assert.equal(await readFlipLookupCache('abc', branchDb.db, prodBranch), null)

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
    const notify = readSite('./notify.ts')
    assert.equal(route.includes('{ ok: true }'), true)
    assert.equal(/NextResponse\.json\(\s*\{[^}]*email/.test(route), false)
    assert.equal(route.includes('console.log'), false)
    assert.equal(notify.includes('console.log'), false)
    assert.equal(/twilio/i.test(notify), false)
    assert.equal(/twilio/i.test(route), false)
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
    assert.equal(room.includes('PRODUCT_MAILTO'), true)
    assert.equal(room.includes('FLIP_COPY.privacy'), true)
    assert.equal(room.includes('ProductInquiry'), true)
    assert.equal(room.includes('FLIP_COPY.connect'), true)
    assert.equal(room.includes('role="combobox"'), true)
    assert.equal(room.includes('/api/flip/search'), true)
    assert.equal(room.includes('FLIP_COPY.contactHint'), true)
    assert.equal(room.includes('validateFlipRequest'), true)
    assert.equal(room.includes('clearSelection()'), true)
    assert.equal(room.includes('hitsQuery === query.trim()'), true)
    assert.equal(room.includes('hitsQuery === q'), true)
    assert.equal(room.includes('searchGen.current !== gen'), true)
    assert.equal(room.includes('lookupGen.current !== gen'), true)
    assert.equal(room.includes('requestGen.current !== gen'), true)
    assert.equal(page.includes('doing'), true)
    assert.equal(page.includes('what’s stuck'), true)
    assert.equal(room.includes('creditOptIn: credit.creditOptIn'), true)
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

describe('notifyFlipRequest', () => {
  const payload = {
    at: '2026-10-13T00:00:00.000Z',
    rid: 1,
    title: 'Hotline Bling',
    artist: 'Drake',
    year: '2015',
    isrc: null,
    email: 'visitor@example.com',
    phone: '4045551212',
    smsOptIn: true,
  }

  it('skips when the Resend key is unset', async () => {
    let calls = 0
    const result = await notifyFlipRequest(payload, async () => {
      calls += 1
      return { ok: true }
    }, { VERCEL_ENV: 'preview' })
    assert.deepEqual(result, { email: false })
    assert.equal(calls, 0)
    assert.equal(notifyEmailEnabled({ VERCEL_ENV: 'preview' }), false)
  })

  it('sends on production main and skips a non-main production ref', async () => {
    let calls = 0
    const result = await notifyFlipRequest(
      payload,
      async () => {
        calls += 1
        return { ok: true }
      },
      {
        VERCEL_ENV: 'production',
        VERCEL_GIT_COMMIT_REF: 'main',
        RESEND_API_KEY: 're_test',
      }
    )
    assert.deepEqual(result, { email: true })
    assert.equal(calls, 1)

    const branch = await notifyFlipRequest(
      payload,
      async () => {
        calls += 1
        return { ok: true }
      },
      {
        VERCEL_ENV: 'production',
        VERCEL_GIT_COMMIT_REF: 'feat/not-main',
        RESEND_API_KEY: 're_test',
      }
    )
    assert.deepEqual(branch, { email: false })
    assert.equal(calls, 1)
  })

  it('strips line breaks from the subject', () => {
    const subject = notifyEmailSubject({ ...payload, title: 'Hotline\r\nBcc: x' })
    assert.equal(subject.includes('\n'), false)
    assert.equal(subject.includes('\r'), false)
    assert.equal(subject.startsWith('flip request: '), true)
  })

  it('keys retries from stored at, not contact', () => {
    const key = flipNotifyIdempotencyKey(payload)
    assert.equal(key, 'flip-request/2026-10-13T00:00:00.000Z')
    assert.equal(key.startsWith('flip-request/'), true)
    assert.equal(key.includes(payload.email), false)
    assert.equal(key.includes(payload.phone), false)
  })

  it('posts Resend with song and contact, and treats fetch failure as skip', async () => {
    const calls: Array<{ url: string; body: string; idempotency: string }> = []
    const ok = await notifyFlipRequest(
      payload,
      async (url, init) => {
        calls.push({
          url,
          body: String(init?.body ?? ''),
          idempotency: String(init?.headers?.['Idempotency-Key'] ?? ''),
        })
        assert.equal(url, RESEND_EMAILS_URL)
        assert.equal(init?.method, 'POST')
        return { ok: true }
      },
      { VERCEL_ENV: 'preview', RESEND_API_KEY: 're_test' }
    )
    assert.deepEqual(ok, { email: true })
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.idempotency, 'flip-request/2026-10-13T00:00:00.000Z')
    const sent = JSON.parse(calls[0]?.body ?? '{}') as Record<string, unknown>
    assert.deepEqual(sent.to, ['33@lecturesfrom.com'])
    assert.equal(sent.subject, notifyEmailSubject(payload))
    assert.equal(sent.text, notifyEmailBody(payload))
    assert.equal(String(sent.text).includes('visitor@example.com'), true)
    assert.equal(String(sent.text).includes('4045551212'), true)
    assert.equal(String(sent.from).includes('33@lecturesfrom.com'), true)

    const fail = await notifyFlipRequest(
      payload,
      async () => {
        throw new Error('down')
      },
      { VERCEL_ENV: 'preview', RESEND_API_KEY: 're_test' }
    )
    assert.deepEqual(fail, { email: false })
  })
})
