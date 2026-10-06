/**
 * Discogs helper tests — Node built-in test runner.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/discogs.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DiscogsRateLimitError,
  DiscogsUnavailableError,
  collectionRequestUrl,
  createMemoryLastGoodStore,
  discogsErrorHttp,
  discogsHeaders,
  discogsReleaseUrl,
  fetchFullCollection,
  fetchRecentReleases,
  mapRelease,
  parseDurableCollection,
  peekLastGoodCollection,
  readCachedCollection,
  toRecentRelease,
  type DiscogsCollection,
  type DiscogsFetch,
  type ScheduleRefresh,
} from './discogs.ts'
import {
  REDIS_READ_CACHE,
  createMemoryDurableStore,
  createRedisDurableStore,
  discogsRedisKeys,
  isEmptyUpstashReadResult,
  isSnapshotStale,
  resetDefaultRedisDurableStore,
  resolveRedisRestConfig,
} from './discogs-store.ts'

type PageSpec = {
  status?: number
  remaining?: string | null
  retryAfter?: string
  body?: unknown
  items?: number
  pages?: number
  page?: number
  releases?: Array<ReturnType<typeof sampleRelease>>
}

function sampleRelease(id: number, title: string) {
  return {
    basic_information: {
      id,
      title,
      year: 1977,
      thumb: `https://img.discogs.com/${id}-thumb.jpg`,
      cover_image: `https://img.discogs.com/${id}-cover.jpg`,
      artists: [{ name: 'Lecturer' }],
      formats: [{ name: 'Vinyl', descriptions: ['LP'] }],
      labels: [{ name: 'lf', catno: `lf-${id}` }],
    },
  }
}

function jsonResponse(spec: PageSpec, fallbackPage = 1): Response {
  const status = spec.status ?? 200
  const headers = new Headers()
  if (spec.remaining != null) {
    headers.set('X-Discogs-Ratelimit-Remaining', spec.remaining)
  }
  if (spec.retryAfter) {
    headers.set('Retry-After', spec.retryAfter)
  }
  headers.set('Content-Type', 'application/json')

  const body =
    spec.body ??
    (status === 200
      ? {
          pagination: {
            page: spec.page ?? fallbackPage,
            pages: spec.pages ?? 1,
            items: spec.items ?? (spec.releases?.length ?? 0),
            per_page: 100,
          },
          releases: spec.releases ?? [],
        }
      : { message: 'You are making requests too quickly. RAW UPSTREAM LEAK' })

  return new Response(JSON.stringify(body), { status, headers })
}

function mockFetch(pages: Record<number, PageSpec>): {
  fetchImpl: DiscogsFetch
  calls: Array<{ url: string; init?: RequestInit & { next?: { revalidate: number } } }>
} {
  const calls: Array<{
    url: string
    init?: RequestInit & { next?: { revalidate: number } }
  }> = []

  const fetchImpl: DiscogsFetch = async (url, init) => {
    calls.push({ url, init })
    const parsed = new URL(url)
    const page = Number.parseInt(parsed.searchParams.get('page') ?? '1', 10)
    const spec = pages[page]
    if (!spec) {
      return jsonResponse({ status: 500, body: { message: 'unexpected page' } })
    }
    return jsonResponse(spec, page)
  }

  return { fetchImpl, calls }
}

function completeCollection(count: number, titlePrefix = 'Cached'): DiscogsCollection {
  const releases = Array.from({ length: count }, (_, index) =>
    mapRelease(sampleRelease(index + 1, `${titlePrefix} ${index + 1}`))
  )
  return {
    releases,
    pagination: { page: 1, pages: 1, items: count, perPage: 100 },
  }
}

describe('mapRelease', () => {
  it('uses cover_image when present and falls back to thumb', () => {
    const withCover = mapRelease(sampleRelease(9, 'With Cover'))
    assert.equal(withCover.cover, 'https://img.discogs.com/9-cover.jpg')
    assert.equal(withCover.thumbnail, 'https://img.discogs.com/9-thumb.jpg')
    assert.equal(withCover.format, 'Vinyl, LP')
    assert.equal(withCover.label, 'lf')
    assert.equal(withCover.catno, 'lf-9')
    assert.equal(withCover.discogsUrl, 'https://www.discogs.com/release/9')
    assert.equal(withCover.releaseId, 9)
    assert.equal(withCover.instanceId, 0)

    const withInstance = mapRelease({
      id: 573292,
      instance_id: 1671298195,
      basic_information: {
        id: 573292,
        title: 'Bootsy? Player Of The Year',
        year: 1978,
        artists: [{ name: "Bootsy's Rubber Band" }],
      },
    })
    assert.equal(withInstance.releaseId, 573292)
    assert.equal(withInstance.instanceId, 1671298195)

    const thumbOnly = mapRelease({
      basic_information: {
        id: 8,
        title: 'Thumb Only',
        year: 1980,
        thumb: 'https://img.discogs.com/8-thumb.jpg',
        artists: [{ name: 'A' }, { name: 'B' }],
      },
    })
    assert.equal(thumbOnly.cover, 'https://img.discogs.com/8-thumb.jpg')
    assert.equal(thumbOnly.artist, 'A, B')
  })

  it('never emits /release/0 when id is missing or zero', () => {
    assert.equal(discogsReleaseUrl(0), 'https://www.discogs.com/')
    assert.equal(discogsReleaseUrl(undefined), 'https://www.discogs.com/')
    const missing = mapRelease({
      basic_information: { title: 'No Id', artists: [{ name: 'A' }] },
    })
    assert.equal(missing.discogsUrl, 'https://www.discogs.com/')
    assert.doesNotMatch(missing.discogsUrl, /\/release\/0$/)
    const zero = mapRelease({
      basic_information: { id: 0, title: 'Zero', artists: [{ name: 'A' }] },
    })
    assert.equal(zero.discogsUrl, 'https://www.discogs.com/')
    assert.doesNotMatch(zero.discogsUrl, /\/release\/0$/)
  })
})

describe('fetchRecentReleases', () => {
  it('returns exactly 5 mapped releases in the RecentDigs shape', async () => {
    const releases = Array.from({ length: 5 }, (_, index) =>
      sampleRelease(index + 1, `Recent ${index + 1}`)
    )
    const { fetchImpl, calls } = mockFetch({
      1: { releases, items: 279, pages: 56, remaining: '24' },
    })

    const result = await fetchRecentReleases(5, { fetchImpl, token: undefined })
    assert.equal(result.length, 5)
    assert.deepEqual(Object.keys(result[0]).sort(), [
      'artist',
      'discogsUrl',
      'thumbnail',
      'title',
      'year',
    ])
    assert.equal(result[0].title, 'Recent 1')
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /per_page=5/)
    assert.match(calls[0].url, /sort=added/)
    assert.equal(calls[0].init?.next?.revalidate, 300)
    assert.equal(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>)['User-Agent'], 'lecturesfrom/1.0 +https://lecturesfrom.com')
    assert.equal(
      calls[0].init?.headers &&
        (calls[0].init.headers as Record<string, string>).Authorization,
      undefined
    )
  })
})

describe('fetchFullCollection', () => {
  it('paginates at per_page=100 until pages are exhausted and count matches items', async () => {
    const page1 = Array.from({ length: 100 }, (_, index) =>
      sampleRelease(index + 1, `R ${index + 1}`)
    )
    const page2 = Array.from({ length: 79 }, (_, index) =>
      sampleRelease(index + 101, `R ${index + 101}`)
    )
    const { fetchImpl, calls } = mockFetch({
      1: { releases: page1, items: 179, pages: 2, remaining: '24' },
      2: { releases: page2, items: 179, pages: 2, remaining: '23' },
    })
    const store = createMemoryLastGoodStore()

    const collection = await fetchFullCollection({
      fetchImpl,
      lastGood: store,
      token: 'secret-token',
    })

    assert.equal(collection.releases.length, 179)
    assert.equal(collection.pagination.items, 179)
    assert.equal(collection.pagination.pages, 2)
    assert.equal(collection.pagination.perPage, 100)
    assert.equal(calls.length, 2)
    assert.match(calls[0].url, /per_page=100/)
    assert.match(calls[1].url, /page=2/)
    assert.equal(calls[0].init?.next?.revalidate, 300)
    assert.equal(
      (calls[0].init?.headers as Record<string, string>).Authorization,
      'Discogs token=secret-token'
    )
    assert.equal(peekLastGoodCollection(store)?.releases.length, 179)
  })

  it('serves last good cache when Discogs returns 429', async () => {
    const cached = completeCollection(3, 'Good')
    const store = createMemoryLastGoodStore(cached)
    const { fetchImpl } = mockFetch({
      1: {
        status: 429,
        retryAfter: '17',
        remaining: '0',
        body: { message: 'You are making requests too quickly. RAW UPSTREAM LEAK' },
      },
    })

    const collection = await fetchFullCollection({
      fetchImpl,
      lastGood: store,
    })

    assert.equal(collection.releases.length, 3)
    assert.equal(collection.releases[0].title, 'Good 1')
    assert.equal(collection.pagination.items, 3)
  })

  it('throws DiscogsRateLimitError with Retry-After when 429 and no last good', async () => {
    const store = createMemoryLastGoodStore()
    const { fetchImpl } = mockFetch({
      1: {
        status: 429,
        retryAfter: '22',
        body: { message: 'You are making requests too quickly. RAW UPSTREAM LEAK' },
      },
    })

    await assert.rejects(
      () => fetchFullCollection({ fetchImpl, lastGood: store }),
      (error: unknown) => {
        assert.ok(error instanceof DiscogsRateLimitError)
        assert.equal(error.retryAfter, 22)
        assert.equal(error.message, 'Too many requests')
        assert.doesNotMatch(error.message, /RAW UPSTREAM/)
        const http = discogsErrorHttp(error)
        assert.equal(http.status, 429)
        assert.equal(http.body.error, 'Too many requests')
        assert.equal(http.headers['Retry-After'], '22')
        assert.equal(http.headers['Cache-Control'], 'no-store')
        assert.doesNotMatch(http.body.error, /RAW UPSTREAM/)
        return true
      }
    )
    assert.equal(peekLastGoodCollection(store), null)
  })

  it('treats exhausted X-Discogs-Ratelimit-Remaining mid-crawl as a rate limit and does not save a partial', async () => {
    const cached = completeCollection(4, 'Prior')
    const store = createMemoryLastGoodStore(cached)
    const page1 = Array.from({ length: 100 }, (_, index) =>
      sampleRelease(index + 1, `Partial ${index + 1}`)
    )
    const { fetchImpl } = mockFetch({
      1: { releases: page1, items: 150, pages: 2, remaining: '0' },
    })

    const collection = await fetchFullCollection({
      fetchImpl,
      lastGood: store,
    })

    assert.equal(collection.releases[0].title, 'Prior 1')
    assert.equal(collection.releases.length, 4)
    assert.equal(store.get()?.releases.length, 4)
    assert.notEqual(store.get()?.releases[0].title, 'Partial 1')
  })

  it('does not save a partial crawl when a later page fails with a non-429 error', async () => {
    const store = createMemoryLastGoodStore()
    const page1 = Array.from({ length: 100 }, (_, index) =>
      sampleRelease(index + 1, `P ${index + 1}`)
    )
    const { fetchImpl } = mockFetch({
      1: { releases: page1, items: 150, pages: 2, remaining: '10' },
      2: { status: 500, body: { message: 'upstream 500 RAW' } },
    })

    await assert.rejects(
      () => fetchFullCollection({ fetchImpl, lastGood: store }),
      (error: unknown) => {
        assert.ok(error instanceof DiscogsUnavailableError)
        assert.equal(error.message, 'Failed to fetch from Discogs')
        const http = discogsErrorHttp(error)
        assert.equal(http.status, 502)
        assert.equal(http.body.error, 'Failed to fetch from Discogs')
        assert.doesNotMatch(http.body.error, /RAW/)
        return true
      }
    )
    assert.equal(peekLastGoodCollection(store), null)
  })

  it('refuses to treat a mismatched count as last good', async () => {
    const store = createMemoryLastGoodStore()
    const { fetchImpl } = mockFetch({
      1: {
        releases: [sampleRelease(1, 'Only one')],
        items: 50,
        pages: 1,
        remaining: '24',
      },
    })

    await assert.rejects(
      () => fetchFullCollection({ fetchImpl, lastGood: store }),
      DiscogsUnavailableError
    )
    assert.equal(store.get(), null)
  })
})

describe('discogsErrorHttp', () => {
  it('maps a Discogs 429 without cache to our route 429 + Retry-After', () => {
    const mapped = discogsErrorHttp(new DiscogsRateLimitError(60))
    assert.equal(mapped.status, 429)
    assert.deepEqual(mapped.body, { error: 'Too many requests' })
    assert.equal(mapped.headers['Retry-After'], '60')
    assert.equal(mapped.headers['Cache-Control'], 'no-store')
  })

  it('never forwards unknown error text to the client', () => {
    const mapped = discogsErrorHttp(
      new Error('Discogs said: You are making requests too quickly.')
    )
    assert.equal(mapped.status, 502)
    assert.equal(mapped.body.error, 'Failed to fetch from Discogs')
  })
})

describe('headers and recent shape', () => {
  it('omits Authorization when no token is present', () => {
    const headers = discogsHeaders()
    assert.equal(headers['User-Agent'], 'lecturesfrom/1.0 +https://lecturesfrom.com')
    assert.equal(headers.Authorization, undefined)
    assert.ok(collectionRequestUrl(1, 5).includes('per_page=5'))
  })

  it('RecentDigs mapper drops collection-only fields', () => {
    const recent = toRecentRelease(mapRelease(sampleRelease(3, 'Keep')))
    assert.equal('cover' in recent, false)
    assert.equal('format' in recent, false)
    assert.equal('label' in recent, false)
    assert.equal('catno' in recent, false)
  })
})

const NOW_MS = Date.parse('2026-09-26T12:00:00.000Z')
const FRESH_AT = NOW_MS - 60 * 60 * 1000
const STALE_AT = NOW_MS - 25 * 60 * 60 * 1000

function captureSchedule(): {
  tasks: Array<() => Promise<void>>
  scheduleRefresh: ScheduleRefresh
} {
  const tasks: Array<() => Promise<void>> = []
  return {
    tasks,
    scheduleRefresh: (task) => {
      tasks.push(task)
    },
  }
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const previous: Record<string, string | undefined> = {}
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key]
    const value = vars[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    resetDefaultRedisDurableStore()
    fn()
  } finally {
    for (const key of Object.keys(previous)) {
      const value = previous[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    resetDefaultRedisDurableStore()
  }
}

function twoPageFetch(): ReturnType<typeof mockFetch> {
  const page1 = Array.from({ length: 100 }, (_, index) =>
    sampleRelease(index + 1, `R ${index + 1}`)
  )
  const page2 = Array.from({ length: 79 }, (_, index) =>
    sampleRelease(index + 101, `R ${index + 101}`)
  )
  return mockFetch({
    1: { releases: page1, items: 179, pages: 2, remaining: '24' },
    2: { releases: page2, items: 179, pages: 2, remaining: '23' },
  })
}

function createInMemoryUpstash() {
  const kv = new Map<string, string>()
  const calls: Array<{
    op: string
    cache?: RequestCache
    body: unknown
  }> = []

  const fetchImpl: DiscogsFetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? 'null')) as unknown[]
    const op = String(body?.[0] ?? '').toLowerCase()
    calls.push({ op, cache: init?.cache, body })

    if (op === 'mget') {
      const values = body.slice(1).map((key) => kv.get(String(key)) ?? null)
      return new Response(JSON.stringify({ result: values }), { status: 200 })
    }
    if (op === 'get') {
      return new Response(
        JSON.stringify({ result: kv.get(String(body[1])) ?? null }),
        { status: 200 }
      )
    }
    if (op === 'set') {
      const key = String(body[1])
      const value = body[2]
      const nx = body.some((part) => String(part).toLowerCase() === 'nx')
      if (nx && kv.has(key)) {
        return new Response(JSON.stringify({ result: null }), { status: 200 })
      }
      kv.set(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      )
      return new Response(JSON.stringify({ result: 'OK' }), { status: 200 })
    }
    if (op === 'del') {
      const existed = kv.delete(String(body[1]))
      return new Response(JSON.stringify({ result: existed ? 1 : 0 }), {
        status: 200,
      })
    }
    return new Response(JSON.stringify({ error: 'unknown command' }), {
      status: 400,
    })
  }

  return { kv, calls, fetchImpl }
}

describe('env resolution and key prefix', () => {
  it('prefers KV_REST_API_URL/TOKEN and falls back to UPSTASH_*', () => {
    withEnv(
      {
        KV_REST_API_URL: 'https://kv.example/rest',
        KV_REST_API_TOKEN: 'kv-token',
        UPSTASH_REDIS_REST_URL: 'https://upstash.example/rest',
        UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
      },
      () => {
        assert.deepEqual(resolveRedisRestConfig(), {
          url: 'https://kv.example/rest',
          token: 'kv-token',
        })
      }
    )

    withEnv(
      {
        KV_REST_API_URL: undefined,
        KV_REST_API_TOKEN: undefined,
        UPSTASH_REDIS_REST_URL: 'https://upstash.example/rest',
        UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
      },
      () => {
        assert.deepEqual(resolveRedisRestConfig(), {
          url: 'https://upstash.example/rest',
          token: 'upstash-token',
        })
      }
    )

    withEnv(
      {
        KV_REST_API_URL: 'https://kv.example/rest',
        KV_REST_API_TOKEN: undefined,
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
      () => {
        assert.equal(resolveRedisRestConfig(), null)
      }
    )
  })

  it('namespaces preview/dev away from production keys', () => {
    withEnv({ VERCEL_ENV: 'production' }, () => {
      const keys = discogsRedisKeys()
      assert.equal(keys.prefix, 'lf:')
      assert.equal(keys.collection, 'lf:discogs:collection:v1')
      assert.equal(keys.meta, 'lf:discogs:meta:v1')
      assert.equal(keys.lock, 'lf:discogs:lock:v1')
    })

    withEnv({ VERCEL_ENV: 'preview' }, () => {
      const keys = discogsRedisKeys()
      assert.equal(keys.prefix, 'lf:preview:')
      assert.equal(keys.collection, 'lf:preview:discogs:collection:v1')
    })

    withEnv({ VERCEL_ENV: undefined }, () => {
      assert.equal(discogsRedisKeys().prefix, 'lf:preview:')
    })
  })

  it('treats missing fetchedAt as stale', () => {
    assert.equal(isSnapshotStale(FRESH_AT, NOW_MS), false)
    assert.equal(isSnapshotStale(STALE_AT, NOW_MS), true)
    assert.equal(isSnapshotStale(null, NOW_MS), true)
  })
})

describe('durable last-good snapshot', () => {
  it('serves a fresh snapshot on a cold instance with zero Discogs calls', async () => {
    const cached = completeCollection(4, 'Redis')
    const durable = createMemoryDurableStore({
      collection: cached,
      meta: { fetchedAt: FRESH_AT, items: 4, lastError: null },
    })
    const { fetchImpl, calls } = mockFetch({
      1: { status: 429, retryAfter: '60', body: { message: 'RAW' } },
    })
    const { tasks, scheduleRefresh } = captureSchedule()
    const memory = createMemoryLastGoodStore()

    const collection = await fetchFullCollection({
      fetchImpl,
      durable,
      lastGood: memory,
      scheduleRefresh,
      now: () => NOW_MS,
    })

    assert.equal(collection.releases.length, 4)
    assert.equal(collection.releases[0].title, 'Redis 1')
    assert.equal(calls.length, 0)
    assert.equal(tasks.length, 0)
    assert.equal(durable.getCalls, 1)
    assert.equal(peekLastGoodCollection(memory)?.releases.length, 4)
    assert.equal((await readCachedCollection({ durable, lastGood: memory }))?.releases.length, 4)
  })

  it('serves a stale snapshot, schedules one refresh, and respects the lock', async () => {
    const cached = completeCollection(2, 'Stale')
    const durable = createMemoryDurableStore({
      collection: cached,
      meta: { fetchedAt: STALE_AT, items: 2, lastError: null },
    })
    const { fetchImpl: liveFetch, calls: liveCalls } = twoPageFetch()

    let releaseFirstPage: () => void = () => {}
    let signalFirstPage: () => void = () => {}
    const firstPageStarted = new Promise<void>((resolve) => {
      signalFirstPage = resolve
    })
    const firstPageGate = new Promise<void>((resolve) => {
      releaseFirstPage = resolve
    })

    let discogsCalls = 0
    const fetchImpl: DiscogsFetch = async (url, init) => {
      discogsCalls += 1
      if (discogsCalls === 1) {
        signalFirstPage()
        await firstPageGate
      }
      return liveFetch(url, init)
    }

    const { tasks, scheduleRefresh } = captureSchedule()
    const collection = await fetchFullCollection({
      fetchImpl,
      durable,
      lastGood: createMemoryLastGoodStore(),
      scheduleRefresh,
      now: () => NOW_MS,
    })

    assert.equal(collection.releases[0].title, 'Stale 1')
    assert.equal(collection.releases.length, 2)
    assert.equal(tasks.length, 1)
    assert.equal(liveCalls.length, 0)

    const first = tasks[0]()
    await firstPageStarted
    const second = tasks[0]()
    await Promise.resolve()
    assert.equal(durable.lockCalls, 2)
    assert.equal(discogsCalls, 1)

    releaseFirstPage()
    await first
    await second

    assert.equal(durable.setCalls, 1)
    assert.equal((durable.collection as DiscogsCollection).releases.length, 179)
    assert.equal(durable.meta?.lastError, null)
    assert.equal(durable.lockHeld, false)
    assert.equal(liveCalls.length, 2)
    assert.equal(discogsCalls, 2)
  })

  it('keeps the stored copy when a refresh hits 429 and records the error', async () => {
    const cached = completeCollection(3, 'Keep')
    const durable = createMemoryDurableStore({
      collection: cached,
      meta: { fetchedAt: STALE_AT, items: 3, lastError: null },
    })
    const { fetchImpl } = mockFetch({
      1: {
        status: 429,
        retryAfter: '17',
        body: { message: 'You are making requests too quickly. RAW UPSTREAM LEAK' },
      },
    })
    const { tasks, scheduleRefresh } = captureSchedule()

    const collection = await fetchFullCollection({
      fetchImpl,
      durable,
      lastGood: createMemoryLastGoodStore(),
      scheduleRefresh,
      now: () => NOW_MS,
    })
    assert.equal(collection.releases[0].title, 'Keep 1')
    await tasks[0]()

    assert.equal(durable.setCalls, 0)
    assert.equal((durable.collection as DiscogsCollection).releases[0].title, 'Keep 1')
    assert.equal(durable.meta?.lastError?.kind, 'rate_limit')
    assert.equal(durable.meta?.lastError?.at, NOW_MS)
  })

  it('keeps the stored copy when a refresh is a partial crawl', async () => {
    const cached = completeCollection(3, 'Keep')
    const durable = createMemoryDurableStore({
      collection: cached,
      meta: { fetchedAt: STALE_AT, items: 3, lastError: null },
    })
    const page1 = Array.from({ length: 100 }, (_, index) =>
      sampleRelease(index + 1, `Partial ${index + 1}`)
    )
    const { fetchImpl } = mockFetch({
      1: { releases: page1, items: 150, pages: 2, remaining: '10' },
      2: { status: 500, body: { message: 'upstream 500 RAW' } },
    })
    const { tasks, scheduleRefresh } = captureSchedule()

    const collection = await fetchFullCollection({
      fetchImpl,
      durable,
      lastGood: createMemoryLastGoodStore(),
      scheduleRefresh,
      now: () => NOW_MS,
    })
    assert.equal(collection.releases[0].title, 'Keep 1')
    await tasks[0]()

    assert.equal(durable.setCalls, 0)
    assert.equal((durable.collection as DiscogsCollection).releases.length, 3)
    assert.equal(durable.meta?.lastError?.kind, 'unavailable')
  })

  it('crawls Discogs when the store is empty and writes a complete copy', async () => {
    const durable = createMemoryDurableStore()
    const { fetchImpl, calls } = twoPageFetch()
    const { tasks, scheduleRefresh } = captureSchedule()
    const memory = createMemoryLastGoodStore()

    const collection = await fetchFullCollection({
      fetchImpl,
      durable,
      lastGood: memory,
      scheduleRefresh,
      now: () => NOW_MS,
    })

    assert.equal(collection.releases.length, 179)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].init?.next?.revalidate, 300)
    await tasks[0]()
    assert.equal(durable.setCalls, 1)
    assert.equal((durable.collection as DiscogsCollection).pagination.items, 179)
    assert.equal(durable.meta?.fetchedAt, NOW_MS)
  })

  it('throws DiscogsRateLimitError when the store is empty and Discogs returns 429', async () => {
    const durable = createMemoryDurableStore()
    const memory = createMemoryLastGoodStore()
    const { fetchImpl, calls } = mockFetch({
      1: {
        status: 429,
        retryAfter: '22',
        body: { message: 'You are making requests too quickly. RAW UPSTREAM LEAK' },
      },
    })

    await assert.rejects(
      () =>
        fetchFullCollection({
          fetchImpl,
          durable,
          lastGood: memory,
          scheduleRefresh: () => {},
          now: () => NOW_MS,
        }),
      (error: unknown) => {
        assert.ok(error instanceof DiscogsRateLimitError)
        assert.equal(error.retryAfter, 22)
        assert.equal(error.message, 'Too many requests')
        return true
      }
    )
    assert.equal(calls.length, 1)
    assert.equal(durable.setCalls, 0)
    assert.equal(durable.collection, null)
  })

  it('falls back to Discogs when the store read throws', async () => {
    const durable = createMemoryDurableStore()
    durable.throwOnGet = new Error('socket hang up')
    const { fetchImpl, calls } = twoPageFetch()
    const { tasks, scheduleRefresh } = captureSchedule()

    const collection = await fetchFullCollection({
      fetchImpl,
      durable,
      lastGood: createMemoryLastGoodStore(),
      scheduleRefresh,
      now: () => NOW_MS,
    })

    assert.equal(collection.releases.length, 179)
    assert.equal(calls.length, 2)
    await tasks[0]()
    assert.equal(durable.setCalls, 1)
  })

  it('falls back when stored JSON is corrupt', async () => {
    const durable = createMemoryDurableStore({
      collection: { nope: true, releases: 'bad' },
      meta: { fetchedAt: FRESH_AT, items: 4, lastError: null },
    })
    const { fetchImpl, calls } = twoPageFetch()
    const { tasks, scheduleRefresh } = captureSchedule()

    const collection = await fetchFullCollection({
      fetchImpl,
      durable,
      lastGood: createMemoryLastGoodStore(),
      scheduleRefresh,
      now: () => NOW_MS,
    })

    assert.equal(collection.releases.length, 179)
    assert.equal(calls.length, 2)
    await tasks[0]()
    assert.equal(parseDurableCollection({ nope: true }), null)
    assert.equal(durable.setCalls, 1)
  })

  it('does not read or write Redis during next build', async () => {
    const cached = completeCollection(2, 'Build')
    const durable = createMemoryDurableStore({
      collection: cached,
      meta: { fetchedAt: STALE_AT, items: 2, lastError: null },
    })
    const { fetchImpl, calls } = twoPageFetch()
    const { tasks, scheduleRefresh } = captureSchedule()

    const collection = await fetchFullCollection({
      fetchImpl,
      durable,
      lastGood: createMemoryLastGoodStore(),
      scheduleRefresh,
      now: () => NOW_MS,
      isProductionBuild: true,
    })

    assert.equal(collection.releases.length, 179)
    assert.equal(tasks.length, 0)
    assert.equal(calls.length, 2)
    assert.equal(durable.getCalls, 0)
    assert.equal(durable.setCalls, 0)
  })

  it('does not cache an empty Redis read, so a later snapshot is visible without crawling', async () => {
    const fake = createInMemoryUpstash()
    const durable = createRedisDurableStore(
      { url: 'http://upstash.test', token: 'test-token' },
      { VERCEL_ENV: 'preview' },
      fake.fetchImpl
    )
    const { fetchImpl: liveFetch, calls: liveCalls } = twoPageFetch()
    const { tasks, scheduleRefresh } = captureSchedule()
    const memory = createMemoryLastGoodStore()

    const first = await fetchFullCollection({
      fetchImpl: liveFetch,
      durable,
      lastGood: memory,
      scheduleRefresh,
      now: () => NOW_MS,
    })
    assert.equal(first.releases.length, 179)
    assert.equal(liveCalls.length, 2)
    await tasks[0]()

    const mgets = fake.calls.filter((call) => call.op === 'mget')
    assert.ok(mgets.length >= 1)
    assert.equal(mgets[0]?.cache, REDIS_READ_CACHE)
    assert.equal(REDIS_READ_CACHE, 'no-store')
    assert.equal(isEmptyUpstashReadResult([null, null]), true)

    const { fetchImpl: blockedFetch, calls: blockedCalls } = mockFetch({
      1: { status: 429, retryAfter: '60', body: { message: 'RAW' } },
    })
    const later = await fetchFullCollection({
      fetchImpl: blockedFetch,
      durable,
      lastGood: createMemoryLastGoodStore(),
      scheduleRefresh: () => {},
      now: () => NOW_MS,
    })

    assert.equal(later.releases.length, 179)
    assert.equal(later.releases[0].title, first.releases[0].title)
    assert.equal(blockedCalls.length, 0)
  })

  it('skips RedisDurableStore.get during the production build phase', async () => {
    const fake = createInMemoryUpstash()
    const previous = process.env.NEXT_PHASE
    process.env.NEXT_PHASE = 'phase-production-build'
    try {
      const durable = createRedisDurableStore(
        { url: 'http://upstash.test', token: 'test-token' },
        { VERCEL_ENV: 'preview' },
        fake.fetchImpl
      )
      const snapshot = await durable.get()
      assert.equal(snapshot, null)
      assert.equal(fake.calls.length, 0)
    } finally {
      if (previous === undefined) delete process.env.NEXT_PHASE
      else process.env.NEXT_PHASE = previous
    }
  })

  it('rewrites stored /release/0 links when reading a snapshot', () => {
    const cached = completeCollection(1, 'Zero')
    cached.releases[0].discogsUrl = 'https://www.discogs.com/release/0'
    const parsed = parseDurableCollection(cached)
    assert.ok(parsed)
    assert.equal(parsed.releases[0].discogsUrl, 'https://www.discogs.com/')
    assert.doesNotMatch(parsed.releases[0].discogsUrl, /\/release\/0$/)
  })
})

