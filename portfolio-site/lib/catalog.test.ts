/**
 * Catalog crate href and optional sleeve viewer field.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/catalog.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crateLinkPrefetch, getCrateRows, getSharedCatalogSlugParams, getSleeveBySlug, sleeves } from './catalog.ts'
import { isBlockedViewerSrc } from './yadiggg-viewer.ts'

describe('yadiggg catalog wiring', () => {
  it('keeps the crate click on the on-site sleeve', () => {
    const row = getCrateRows().find((entry) => entry.kind === 'sleeve' && entry.sleeve.slug === 'yadiggg')
    assert.ok(row)
    assert.equal(row.href, '/catalog/yadiggg')
  })

  it('does not prefetch yadiggg from the / and /catalog crate links', () => {
    assert.equal(crateLinkPrefetch('/catalog/yadiggg'), false)
    assert.equal(crateLinkPrefetch('/collection'), false)
    assert.equal(crateLinkPrefetch('/catalog/punch2pen'), undefined)
    const crate = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'components/house/Crate.tsx'), 'utf8')
    assert.match(crate, /crateLinkPrefetch\(row\.href\)/)
  })

  it('sets a ported viewer only on yadiggg', () => {
    const yadiggg = getSleeveBySlug('yadiggg')
    assert.ok(yadiggg?.viewer)
    assert.equal(yadiggg.viewer.mode, 'port')
    assert.equal(yadiggg.viewer.src, '/catalog/yadiggg/yadiggg_r1.glb')
    assert.equal(yadiggg.viewer.poster, '/catalog/yadiggg/poster.jpg')
    assert.equal(yadiggg.viewer.title, 'r1 design study')
    assert.equal(
      sleeves.filter((sleeve) => sleeve.viewer).map((sleeve) => sleeve.slug).join(','),
      'yadiggg'
    )
  })

  it('keeps SleeveViewer off the shared slug route and Sleeve shell', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    assert.equal(
      getSharedCatalogSlugParams().some((entry) => entry.slug === 'yadiggg'),
      false
    )
    assert.doesNotMatch(readFileSync(join(root, 'components/house/Sleeve.tsx'), 'utf8'), /SleeveViewer/)
    assert.doesNotMatch(
      readFileSync(join(root, 'app/(house)/catalog/[slug]/page.tsx'), 'utf8'),
      /SleeveViewer/
    )
    assert.match(
      readFileSync(join(root, 'app/(house)/catalog/yadiggg/page.tsx'), 'utf8'),
      /SleeveViewer/
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
