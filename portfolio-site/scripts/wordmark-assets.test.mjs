/**
 * Asset-only checks for the lecturesfrom nameplate wordmark.
 *
 * Run from portfolio-site/:
 *   node --test scripts/wordmark-assets.test.mjs
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILES = {
  currentColor: join(ROOT, 'brand/lecturesfrom-wordmark.svg'),
  dark: join(ROOT, 'brand/lecturesfrom-wordmark-dark.svg'),
  light: join(ROOT, 'brand/lecturesfrom-wordmark-light.svg'),
}

const FORBIDDEN = [
  '<linearGradient',
  '<radialGradient',
  '<filter',
  '<image',
  'text-shadow',
  'feDropShadow',
  'fill="url(',
]

function read(path) {
  return readFileSync(path, 'utf8')
}

describe('lecturesfrom wordmark SVGs', () => {
  for (const [label, path] of Object.entries(FILES)) {
    it(`${label} is a flat accessible nameplate`, () => {
      const svg = read(path)
      assert.match(svg, /role="img"/)
      assert.match(svg, /aria-label="lecturesfrom"/)
      assert.match(svg, /<path /)
      assert.match(svg, /<rect /)
      assert.doesNotMatch(svg, /<text[\s>]/)
      assert.doesNotMatch(svg, /LecturesFrom|LECTURESFROM/)
      for (const token of FORBIDDEN) {
        assert.equal(svg.includes(token), false, `must not contain ${token}`)
      }
    })
  }

  it('currentColor SVG is fill-inheriting', () => {
    const svg = read(FILES.currentColor)
    assert.match(svg, /fill="currentColor"/)
  })

  it('dark variant uses house ink', () => {
    assert.match(read(FILES.dark), /fill="#ececec"/)
  })

  it('light variant uses #111', () => {
    assert.match(read(FILES.light), /fill="#111"/)
  })
})
