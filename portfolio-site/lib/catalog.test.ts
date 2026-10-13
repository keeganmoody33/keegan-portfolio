/**
 * Catalog crate href and optional sleeve viewer field.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/catalog.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getCrateRows, getSleeveBySlug, sleeves } from './catalog.ts'
import { isBlockedViewerSrc } from './yadiggg-viewer.ts'

describe('yadiggg catalog wiring', () => {
  it('keeps the crate click on the on-site sleeve', () => {
    const row = getCrateRows().find((entry) => entry.kind === 'sleeve' && entry.sleeve.slug === 'yadiggg')
    assert.ok(row)
    assert.equal(row.href, '/catalog/yadiggg')
  })

  it('sets a ported viewer only on yadiggg', () => {
    const yadiggg = getSleeveBySlug('yadiggg')
    assert.ok(yadiggg?.viewer)
    assert.equal(yadiggg.viewer.mode, 'port')
    assert.equal(yadiggg.viewer.src, '/catalog/yadiggg/yadiggg_r1.glb')
    assert.equal(yadiggg.viewer.title, 'r1 design study')
    assert.equal(
      sleeves.filter((sleeve) => sleeve.viewer).map((sleeve) => sleeve.slug).join(','),
      'yadiggg'
    )
  })

  it('keeps the GitHub repo as contents track 01', () => {
    const yadiggg = getSleeveBySlug('yadiggg')
    assert.ok(yadiggg)
    assert.equal(yadiggg.tracks.length, 1)
    assert.equal(yadiggg.tracks[0]?.kind, 'repo')
    assert.equal(yadiggg.tracks[0]?.href, 'https://github.com/keeganmoody33/YADIGGG')
    assert.equal(yadiggg.tracks[0]?.title, 'keeganmoody33/YADIGGG')
  })
})

describe('isBlockedViewerSrc', () => {
  it('rejects share-token preview URLs', () => {
    assert.equal(
      isBlockedViewerSrc('https://yadiggg-viewer-foo.vercel.app/?_vercel_share=abc'),
      true
    )
    assert.equal(isBlockedViewerSrc('https://yadiggg-viewer.vercel.app/'), false)
    assert.equal(isBlockedViewerSrc('/catalog/yadiggg/yadiggg_r1.glb'), false)
  })
})
