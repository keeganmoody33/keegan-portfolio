import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { crateRedisKeys } from './store.ts'
import {
  coverBlobPath,
  coverContentHash,
  coverLongerEdge,
  displayCoverUrl,
  discogsGridHotlink,
  isCoverManifest,
  isSelfHostedCoverUrl,
  manifestFromDiscovery,
  parseDiscogsImageDimensions,
  parseImageSize,
  pickLargestCover,
  type CoverCandidate,
  type CoverDiscoverResult,
} from './cover.ts'
import { blobReadWriteToken, putCoverBlob } from './cover-blob.ts'
import { createMemoryCoverStore } from './cover-store.ts'
import {
  assertCoverSyncAllowed,
  discogsCoverMinIntervalMs,
  parseCoverSyncArgs,
  syncCovers,
} from './cover-sync.ts'

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  bytes[16] = (width >> 24) & 0xff
  bytes[17] = (width >> 16) & 0xff
  bytes[18] = (width >> 8) & 0xff
  bytes[19] = width & 0xff
  bytes[20] = (height >> 24) & 0xff
  bytes[21] = (height >> 16) & 0xff
  bytes[22] = (height >> 8) & 0xff
  bytes[23] = height & 0xff
  return bytes
}

function jpegSof(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x22,
    0x00,
  ])
}

describe('cover image size parsers', () => {
  it('reads PNG IHDR and JPEG SOF dimensions', () => {
    assert.deepEqual(parseImageSize(pngHeader(1200, 800)), { width: 1200, height: 800 })
    assert.deepEqual(parseImageSize(jpegSof(600, 597)), { width: 600, height: 597 })
  })

  it('parses Discogs CDN width/height from the path', () => {
    const url =
      'https://i.discogs.com/x/rs:fit/g:sm/q:90/h:597/w:600/czM6Ly9kaXNjb2dz/example.jpeg'
    assert.deepEqual(parseDiscogsImageDimensions(url), { width: 600, height: 597 })
  })
})

describe('discogsGridHotlink', () => {
  it('prefers thumbnail then cover; stored Blob url still wins', () => {
    assert.equal(
      discogsGridHotlink('https://i.discogs.com/t.jpg', 'https://i.discogs.com/c.jpg'),
      'https://i.discogs.com/t.jpg'
    )
    assert.equal(discogsGridHotlink('', 'https://i.discogs.com/c.jpg'), 'https://i.discogs.com/c.jpg')
    const stored = {
      releaseId: 573292,
      url: 'https://store.public.blob.vercel-storage.com/covers/x.jpg',
      width: 1400,
      height: 1400,
      source: 'caa' as const,
      originalUrl: 'https://coverartarchive.org/front.jpg',
      stored: true,
    }
    assert.equal(
      displayCoverUrl(stored, discogsGridHotlink('https://i.discogs.com/t.jpg', 'https://i.discogs.com/c.jpg')),
      stored.url
    )
  })
})

describe('pickLargestCover', () => {
  it('prefers a >=1200 candidate even when a smaller one exists', () => {
    const discogs: CoverCandidate = {
      source: 'discogs',
      originalUrl: 'https://i.discogs.com/small.jpg',
      width: 600,
      height: 600,
    }
    const caa: CoverCandidate = {
      source: 'caa',
      originalUrl: 'https://coverartarchive.org/front.jpg',
      width: 1400,
      height: 1400,
    }
    const best = pickLargestCover([discogs, caa])
    assert.equal(best?.source, 'caa')
    assert.equal(coverLongerEdge(best!), 1400)
  })

  it('picks the largest Discogs image when CAA is smaller and neither is 1200', () => {
    const best = pickLargestCover([
      { source: 'caa', originalUrl: 'https://caa/a.jpg', width: 500, height: 500 },
      { source: 'discogs', originalUrl: 'https://i.discogs.com/a.jpg', width: 600, height: 597 },
    ])
    assert.equal(best?.source, 'discogs')
    assert.equal(best?.width, 600)
  })
})

describe('cover manifest and blob no-op', () => {
  it('keeps Discogs hotlinked and only stores CAA when a blob URL exists', () => {
    const discogsResult: CoverDiscoverResult = {
      releaseId: 567894,
      best: {
        source: 'discogs',
        originalUrl: 'https://i.discogs.com/mtume.jpg',
        width: 600,
        height: 593,
      },
      candidates: [],
      discogsPx: { width: 600, height: 593, url: 'https://i.discogs.com/mtume.jpg' },
    }
    const discogsManifest = manifestFromDiscovery(discogsResult, {
      url: 'https://blob.example/covers/x.jpg',
      hash: 'abc',
    })
    assert.equal(discogsManifest?.stored, false)
    assert.equal(discogsManifest?.url, 'https://i.discogs.com/mtume.jpg')
    assert.equal(discogsManifest?.source, 'discogs')

    const caaResult: CoverDiscoverResult = {
      releaseId: 573292,
      best: {
        source: 'caa',
        originalUrl: 'https://coverartarchive.org/front.jpg',
        width: 1400,
        height: 1400,
      },
      candidates: [],
      discogsPx: { width: 600, height: 597, url: 'https://i.discogs.com/bootsy.jpg' },
    }
    const withoutBlob = manifestFromDiscovery(caaResult, null)
    assert.equal(withoutBlob?.stored, false)
    assert.equal(withoutBlob?.url, '')
    assert.equal(displayCoverUrl(withoutBlob, 'https://i.discogs.com/fallback.jpg'), 'https://i.discogs.com/fallback.jpg')
    const withBlob = manifestFromDiscovery(caaResult, {
      url: 'https://store.public.blob.vercel-storage.com/covers/hash.jpg',
      hash: 'hash',
    })
    assert.equal(withBlob?.stored, true)
    assert.equal(withBlob?.url.startsWith('https://store.public.blob'), true)
    assert.equal(isCoverManifest(withBlob), true)
    assert.equal(isSelfHostedCoverUrl(withBlob!.url), true)
    assert.equal(isSelfHostedCoverUrl('https://i.discogs.com/x.jpg'), false)
  })

  it('no-ops blob puts without a token', async () => {
    assert.equal(blobReadWriteToken({}), null)
    const result = await putCoverBlob('covers/x.jpg', pngHeader(10, 10), { token: null })
    assert.equal(result, null)
  })

  it('hashes content for a stable blob path', () => {
    const bytes = pngHeader(10, 10)
    const hash = coverContentHash(bytes)
    assert.equal(hash.length, 64)
    assert.equal(coverBlobPath(hash, 'image/jpeg'), `covers/${hash}.jpg`)
    assert.equal(coverBlobPath(hash, 'image/png'), `covers/${hash}.png`)
  })
})

describe('cover sync guards', () => {
  it('parses ids, limit, force, prod, and dry-run flags', () => {
    assert.deepEqual(
      parseCoverSyncArgs(['--ids=573292,240128', '--limit=10', '--force', '--prod', '--dry-run']),
      { ids: [573292, 240128], limit: 10, force: true, prod: true, dryRun: true }
    )
  })

  it('paces unauthenticated Discogs at 25/min', () => {
    assert.equal(discogsCoverMinIntervalMs({}), 2500)
    assert.equal(discogsCoverMinIntervalMs({ DISCOGS_TOKEN: '   ' }), 2500)
    assert.equal(discogsCoverMinIntervalMs({ DISCOGS_TOKEN: 'secret' }), 1100)
  })

  it('refuses production Redis keys without --prod', () => {
    assert.throws(
      () => assertCoverSyncAllowed({ env: { VERCEL_ENV: 'production' } }),
      /refusing prod Redis keys/
    )
    assert.doesNotThrow(() =>
      assertCoverSyncAllowed({ prod: true, env: { VERCEL_ENV: 'production' } })
    )
    assert.doesNotThrow(() => assertCoverSyncAllowed({ env: { VERCEL_ENV: 'preview' } }))
  })

  it('writes preview cover keys and skips blob when Discogs wins', async () => {
    const keys = crateRedisKeys({ VERCEL_ENV: 'preview' })
    assert.equal(keys.cover(573292), 'lf:preview:crate:cover:573292:v1')
    const store = createMemoryCoverStore()
    const discogsUrl = 'https://i.discogs.com/x/rs:fit/g:sm/q:90/h:593/w:600/mtume.jpeg'
    const rows = await syncCovers({
      ids: [567894],
      dryRun: false,
      coverStore: store,
      crateStore: null,
      env: {},
      lookup: async (releaseId) => ({
        releaseId,
        discogsImage: {
          uri: discogsUrl,
          uri150: discogsUrl,
          width: 600,
          height: 593,
          type: 'primary',
        },
        discogsCoverUrl: discogsUrl,
      }),
      discover: async (input) => ({
        releaseId: input.releaseId,
        best: {
          source: 'discogs',
          originalUrl: discogsUrl,
          width: 600,
          height: 593,
        },
        candidates: [],
        discogsPx: { width: 600, height: 593, url: discogsUrl },
      }),
    })
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.blob, 'skipped-discogs-terms')
    assert.equal(rows[0]?.best?.stored, false)
    assert.equal(rows[0]?.best?.url, discogsUrl)
    const stored = await store.get(567894)
    assert.equal(stored?.source, 'discogs')
    assert.equal(stored?.stored, false)
  })

  it('skips blob without a token when CAA wins', async () => {
    const store = createMemoryCoverStore()
    const rows = await syncCovers({
      ids: [573292],
      coverStore: store,
      env: {},
      lookup: async (releaseId) => ({ releaseId, mbReleaseMbid: '72089134-a550-446e-b26d-8d3b523b05d6' }),
      discover: async (input) => ({
        releaseId: input.releaseId,
        best: {
          source: 'caa',
          originalUrl: 'https://coverartarchive.org/release/x/front.jpg',
          width: 1400,
          height: 1400,
        },
        candidates: [],
        discogsPx: { width: 600, height: 597, url: 'https://i.discogs.com/bootsy.jpg' },
      }),
    })
    assert.equal(rows[0]?.blob, 'skipped-no-token')
    assert.equal(rows[0]?.best?.stored, false)
    assert.equal(rows[0]?.best?.url, '')
    const stored = await store.get(573292)
    assert.equal(stored?.source, 'caa')
    assert.equal(displayCoverUrl(stored, 'https://i.discogs.com/fallback.jpg'), 'https://i.discogs.com/fallback.jpg')
  })
})
