/**
 * Preview-only house banner — flag, wordmark, queue, phases.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/house-banner.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  HOUSE_BANNER_WORDMARK,
  bannerCoverUrl,
  bannerLiveText,
  buildBannerQueue,
  houseBannerGlyphs,
  initialBannerPhase,
  isHouseBannerPrototypeEnabled,
  lecturesfromWordmark,
  nextBannerPhase,
  phaseDurationMs,
  pullOneIndex,
  readForceBoot,
  toHouseBannerRelease,
  uniqueBannerReleases,
  wrapIndex,
  type HouseBannerRelease,
} from './house-banner.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

function sample(
  id: number,
  extra: Partial<HouseBannerRelease> = {}
): HouseBannerRelease {
  return {
    releaseId: id,
    artist: `Artist ${id}`,
    title: `Title ${id}`,
    label: `Label ${id}`,
    thumbnail: `https://i.discogs.com/${id}-thumb.jpg`,
    cover: `https://i.discogs.com/${id}-cover.jpg`,
    ...extra,
  }
}

describe('isHouseBannerPrototypeEnabled', () => {
  it('is off in production so a merge cannot change prod', () => {
    assert.equal(
      isHouseBannerPrototypeEnabled({ VERCEL_ENV: 'production' }),
      false
    )
  })

  it('is on for preview, development, and unset env', () => {
    assert.equal(isHouseBannerPrototypeEnabled({ VERCEL_ENV: 'preview' }), true)
    assert.equal(
      isHouseBannerPrototypeEnabled({ VERCEL_ENV: 'development' }),
      true
    )
    assert.equal(isHouseBannerPrototypeEnabled({}), true)
  })

  it('keeps production `/` on TitleCard and 404s the preview route in prod', () => {
    const home = readFileSync(`${root}app/(house)/page.tsx`, 'utf8')
    const preview = readFileSync(`${root}app/(house)/preview/banner/page.tsx`, 'utf8')
    const robots = readFileSync(`${root}app/robots.txt/route.ts`, 'utf8')
    assert.equal(home.includes('HouseBanner'), false)
    assert.equal(home.includes('TitleCard'), true)
    assert.match(preview, /isHouseBannerPrototypeEnabled/)
    assert.match(preview, /notFound/)
    assert.match(preview, /robots: \{ index: false/)
    assert.match(robots, /Disallow: \/preview\//)
  })
})

describe('lecturesfrom wordmark', () => {
  it('is always lowercase lecturesfrom with a lowercase l', () => {
    assert.equal(HOUSE_BANNER_WORDMARK, 'lecturesfrom')
    assert.equal(HOUSE_BANNER_WORDMARK[0], 'l')
    assert.equal(lecturesfromWordmark(), 'lecturesfrom')
    assert.deepEqual(houseBannerGlyphs(), [
      'l',
      'e',
      'c',
      't',
      'u',
      'r',
      'e',
      's',
      'f',
      'r',
      'o',
      'm',
    ])
  })

  it('rejects a title-cased L', () => {
    assert.throws(() => lecturesfromWordmark('Lecturesfrom'))
    assert.throws(() => lecturesfromWordmark('LECTURESFROM'))
  })
})

describe('uniqueBannerReleases / queue', () => {
  it('drops unlisted ids and duplicate release ids', () => {
    const out = uniqueBannerReleases([
      sample(0),
      sample(573292),
      sample(573292, { title: 'dup' }),
      sample(240128),
      { ...sample(-1), releaseId: -1 },
    ])
    assert.deepEqual(
      out.map((release) => release.releaseId),
      [573292, 240128]
    )
    assert.equal(out[0]?.title, 'Title 573292')
  })

  it('returns null for an unlisted source row', () => {
    assert.equal(toHouseBannerRelease(sample(0)), null)
  })

  it('rotates the shuffled queue so the SSR pick is first', () => {
    const releases = [sample(1), sample(2), sample(3)]
    const queue = buildBannerQueue(releases, 3, () => 0)
    assert.equal(queue[0]?.releaseId, 3)
    assert.deepEqual(
      queue.map((release) => release.releaseId).sort(),
      [1, 2, 3]
    )
  })
})

describe('cycle indexes', () => {
  it('wraps prev and next', () => {
    assert.equal(wrapIndex(0, 3, -1), 2)
    assert.equal(wrapIndex(2, 3, 1), 0)
    assert.equal(wrapIndex(1, 3, 1), 2)
    assert.equal(wrapIndex(0, 0, 1), 0)
  })

  it('pull one picks a different index when more than one record exists', () => {
    assert.equal(pullOneIndex(0, 1, () => 0.9), 0)
    assert.equal(pullOneIndex(0, 4, () => 0), 1)
    assert.equal(pullOneIndex(0, 4, () => 0.99), 3)
    assert.equal(pullOneIndex(2, 4, () => 0), 3)
  })
})

describe('phases', () => {
  it('skips boot under reduced motion or a seen visit', () => {
    assert.equal(
      initialBannerPhase({ reducedMotion: true, seen: false, forceBoot: true }),
      'playing'
    )
    assert.equal(
      initialBannerPhase({ reducedMotion: false, seen: true, forceBoot: false }),
      'playing'
    )
    assert.equal(
      initialBannerPhase({ reducedMotion: false, seen: false, forceBoot: false }),
      'boot'
    )
    assert.equal(
      initialBannerPhase({ reducedMotion: false, seen: true, forceBoot: true }),
      'boot'
    )
  })

  it('advances boot → assemble → playing and stays there', () => {
    assert.equal(nextBannerPhase('boot'), 'assemble')
    assert.equal(nextBannerPhase('assemble'), 'playing')
    assert.equal(nextBannerPhase('playing'), 'playing')
    assert.equal(phaseDurationMs('boot'), 1800)
    assert.equal(phaseDurationMs('assemble'), 1400)
    assert.equal(phaseDurationMs('playing'), null)
  })
})

describe('readout helpers', () => {
  it('hotlinks the listing thumb then the cover', () => {
    assert.equal(
      bannerCoverUrl(sample(1)),
      'https://i.discogs.com/1-thumb.jpg'
    )
    assert.equal(
      bannerCoverUrl(sample(1, { thumbnail: '' })),
      'https://i.discogs.com/1-cover.jpg'
    )
  })

  it('announces artist, title, and label politely', () => {
    assert.equal(
      bannerLiveText(sample(567894, { artist: 'Mtume', title: 'Juicy Fruit', label: 'Epic' })),
      'now playing: Mtume — Juicy Fruit · Epic'
    )
    assert.equal(bannerLiveText(null), '')
    assert.equal(
      bannerLiveText(sample(1, { label: '' })),
      'now playing: Artist 1 — Title 1'
    )
  })

  it('reads ?boot=1 as a replay', () => {
    assert.equal(readForceBoot('?boot=1'), true)
    assert.equal(readForceBoot('boot=1'), true)
    assert.equal(readForceBoot('?boot=0'), false)
    assert.equal(readForceBoot(''), false)
  })
})
