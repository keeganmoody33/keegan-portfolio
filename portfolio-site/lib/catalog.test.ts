/**
 * Catalog sleeve lock — copy honesty gates and yadiggg untouched.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/catalog.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSleeveBySlug } from './catalog.ts'
import { resolveSleeveMedia } from './sleeve-gallery.ts'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../public')

describe('punch2pen (lf-01)', () => {
  const sleeve = getSleeveBySlug('punch2pen')

  it('exists as software in build', () => {
    assert.ok(sleeve)
    assert.equal(sleeve?.catno, 'lf-01')
    assert.equal(sleeve?.format, 'software')
    assert.equal(sleeve?.status, 'in build')
  })

  it('keeps the issue plate: no cover, no screenshots', () => {
    assert.equal(sleeve?.cover, undefined)
    assert.equal(sleeve?.images, undefined)
    assert.equal(resolveSleeveMedia(sleeve!).kind, 'plate')
  })

  it('states the live honesty gates', () => {
    const notes = sleeve?.notes ?? ''
    for (const needle of [
      'living transcript',
      'session-only',
      'no account',
      'no cloud',
      'sign-in is not in this build',
      'prices are not published',
      'unsigned pkg',
      'gatekeeper',
      'logic is the host',
      'interest, not a compatibility chart',
      'never a browser engine',
    ]) {
      assert.ok(notes.includes(needle), `missing honesty gate: ${needle}`)
    }
    assert.ok((sleeve?.notThis ?? '').includes('not a windows build'))
  })

  it('does not invent a sku or a windows host', () => {
    const blob = `${sleeve?.aside} ${sleeve?.notes} ${sleeve?.why} ${sleeve?.notThis}`.toLowerCase()
    assert.equal(blob.includes('$'), false)
    assert.equal(/ableton|reaper|pro tools/.test(blob), false)
  })
})

describe('proper-respect (lf-02)', () => {
  const sleeve = getSleeveBySlug('proper-respect')

  it('keeps cover for back-compat and ships a 4-frame gallery', () => {
    assert.equal(sleeve?.cover, '/catalog/proper-respect/profile.png')
    assert.equal(sleeve?.images?.length, 4)
    assert.equal(sleeve?.images?.[0]?.src, sleeve?.cover)
    assert.equal(resolveSleeveMedia(sleeve!).kind, 'gallery')
  })

  it('self-hosts live product screenshots, not brand art', () => {
    const srcs = (sleeve?.images ?? []).map((image) => image.src)
    assert.deepEqual(srcs, [
      '/catalog/proper-respect/profile.png',
      '/catalog/proper-respect/item-detail.png',
      '/catalog/proper-respect/measurements.png',
      '/catalog/proper-respect/import.png',
    ])
    const blob = (sleeve?.images ?? []).map((image) => `${image.alt} ${image.caption}`).join(' ')
    for (const banned of ['logo', 'mark', 'bump art', 'share image', 'blueprint']) {
      assert.equal(blob.toLowerCase().includes(banned), false, `brand-art leftover: ${banned}`)
    }
    for (const needle of [
      '/lecturesfrom',
      'Wispr Flow',
      '1,304',
      'Start with one source',
      'Claude Code',
    ]) {
      assert.ok(blob.includes(needle), `missing product cue: ${needle}`)
    }
  })

  it('every gallery frame has src, alt, width, height, caption, file, and shared 3:2 aspect', () => {
    const images = sleeve?.images ?? []
    const first = images[0]
    assert.ok(first)
    for (const image of images) {
      assert.ok(image.src.startsWith('/catalog/proper-respect/'))
      assert.ok(image.alt.length > 0)
      assert.ok((image.caption ?? '').length > 0)
      assert.equal(image.width, 2880)
      assert.equal(image.height, 1920)
      assert.equal(image.width * first.height, image.height * first.width)
      assert.equal(existsSync(join(publicDir, image.src)), true, `missing ${image.src}`)
    }
    assert.equal(existsSync(join(publicDir, 'catalog/proper-respect/cover.png')), false)
    assert.equal(existsSync(join(publicDir, 'catalog/proper-respect/bump-art.webp')), false)
  })

  it('covers measurements and imports from the live product', () => {
    const notes = sleeve?.notes ?? ''
    for (const needle of [
      'your tools. your track record.',
      'github contribution snapshots',
      'claude code',
      'codex packets',
      'proper-measurements-v1',
      'usage does not rank',
      'approve publication',
      'private by default',
    ]) {
      const haystack = `${sleeve?.aside} ${notes}`
      assert.ok(haystack.includes(needle), `missing claim: ${needle}`)
    }
  })
})

describe('yadiggg (lf-03) lock', () => {
  const sleeve = getSleeveBySlug('yadiggg')

  it('does not grow a gallery or change liner copy', () => {
    assert.deepEqual(
      {
        slug: sleeve?.slug,
        catno: sleeve?.catno,
        title: sleeve?.title,
        format: sleeve?.format,
        status: sleeve?.status,
        year: sleeve?.year,
        aside: sleeve?.aside,
        notes: sleeve?.notes,
        why: sleeve?.why,
        notThis: sleeve?.notThis,
        credits: sleeve?.credits,
        cover: sleeve?.cover,
        images: sleeve?.images,
        tracks: sleeve?.tracks,
      },
      {
        slug: 'yadiggg',
        catno: 'lf-03',
        title: 'yadiggg',
        format: 'physical',
        status: 'in build',
        year: 2026,
        aside: 'pocket crate-digger. no phone. no shazam. no discogs login in the loop.',
        notes:
          'aim the rear camera at a vinyl label or matrix, press the orange button, get artist / label / catalog number / year on a memory lcd. offline intelligence, local database. a physical product from the publishing-house arm.',
        why: 'the crate should answer in the bin, not after you unlock a phone.',
        notThis: 'a phone app',
        credits: ['hardware'],
        cover: '/catalog/yadiggg/cover.jpg',
        images: undefined,
        tracks: [
          {
            no: '01',
            title: 'keeganmoody33/YADIGGG',
            kind: 'repo',
            href: 'https://github.com/keeganmoody33/YADIGGG',
          },
        ],
      },
    )
    assert.equal(resolveSleeveMedia(sleeve!).kind, 'cover')
  })
})
