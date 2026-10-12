/**
 * Sleeve gallery helpers — media resolution, wrap, aspect, scroll index.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/sleeve-gallery.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  galleryAspect,
  galleryIndexFromScroll,
  resolveSleeveMedia,
  wrapGalleryIndex,
} from './sleeve-gallery.ts'
import type { SleeveImage } from './catalog.ts'

const frames: SleeveImage[] = [
  { src: '/a.png', alt: 'a', width: 1024, height: 856 },
  { src: '/b.webp', alt: 'b', width: 1536, height: 1024, caption: 'bump' },
]

describe('resolveSleeveMedia', () => {
  it('prefers images[] over cover', () => {
    const media = resolveSleeveMedia({
      title: 'proper-respect',
      cover: '/catalog/proper-respect/cover.png',
      images: frames,
    })
    assert.deepEqual(media, { kind: 'gallery', images: frames })
  })

  it('falls back to cover when images is missing', () => {
    const media = resolveSleeveMedia({
      title: 'yadiggg',
      cover: '/catalog/yadiggg/cover.jpg',
    })
    assert.deepEqual(media, {
      kind: 'cover',
      src: '/catalog/yadiggg/cover.jpg',
      alt: 'yadiggg cover',
    })
  })

  it('falls back to cover when images is empty', () => {
    const media = resolveSleeveMedia({
      title: 'demo',
      cover: '/x.png',
      images: [],
    })
    assert.equal(media.kind, 'cover')
  })

  it('uses the issue plate when there is no cover and no images', () => {
    const media = resolveSleeveMedia({ title: 'punch2pen' })
    assert.deepEqual(media, { kind: 'plate' })
  })
})

describe('wrapGalleryIndex', () => {
  it('wraps forward and backward', () => {
    assert.equal(wrapGalleryIndex(0, 4), 0)
    assert.equal(wrapGalleryIndex(4, 4), 0)
    assert.equal(wrapGalleryIndex(-1, 4), 3)
    assert.equal(wrapGalleryIndex(5, 4), 1)
  })

  it('returns 0 for an empty gallery', () => {
    assert.equal(wrapGalleryIndex(3, 0), 0)
  })
})

describe('galleryAspect', () => {
  it('uses the first frame so the slot cannot shift', () => {
    assert.deepEqual(galleryAspect(frames), { width: 1024, height: 856 })
  })

  it('falls back to 1 / 1 when dimensions are missing', () => {
    assert.deepEqual(galleryAspect([]), { width: 1, height: 1 })
    assert.deepEqual(
      galleryAspect([{ src: '/x.png', alt: 'x', width: 0, height: 10 }]),
      { width: 1, height: 1 },
    )
  })
})

describe('galleryIndexFromScroll', () => {
  it('rounds to the nearest snap page', () => {
    assert.equal(galleryIndexFromScroll(0, 400, 4), 0)
    assert.equal(galleryIndexFromScroll(400, 400, 4), 1)
    assert.equal(galleryIndexFromScroll(210, 400, 4), 1)
    assert.equal(galleryIndexFromScroll(190, 400, 4), 0)
  })

  it('returns 0 when the scroller has no width', () => {
    assert.equal(galleryIndexFromScroll(80, 0, 4), 0)
  })
})
