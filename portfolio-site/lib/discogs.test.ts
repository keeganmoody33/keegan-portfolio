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
  fetchFullCollection,
  fetchRecentReleases,
  mapRelease,
  peekLastGoodCollection,
  toRecentRelease,
  type DiscogsCollection,
  type DiscogsFetch,
} from './discogs.ts'

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
    assert.equal(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>)['User-Agent'], 'lecturesfrom/1.0')
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
    assert.equal(headers['User-Agent'], 'lecturesfrom/1.0')
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
