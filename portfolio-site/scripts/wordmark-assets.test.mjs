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

const RULE_FILL_CURRENT = 'var(--house-muted, #8a8a8a)'
const RULE_FILL_SOLID = '#8a8a8a'

function read(path) {
  return readFileSync(path, 'utf8')
}

function parseRule(svg) {
  const match = svg.match(
    /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="([^"]+)" \/>/,
  )
  assert.ok(match, 'wordmark must include a rule <rect> with fill')
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
    fill: match[5],
  }
}

function parseLInk(svg) {
  const match = svg.match(/<path d="M([\d.]+)[^"]*?H([\d.]+)/)
  assert.ok(match, 'first path must be the `l` stem')
  const left = Number(match[1])
  const right = Number(match[2])
  return { left, right, stem: right - left }
}

function parseViewBoxWidth(svg) {
  const match = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  assert.ok(match, 'svg must have a tight viewBox')
  return Number(match[1])
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

  it('currentColor SVG is fill-inheriting on the letters', () => {
    const svg = read(FILES.currentColor)
    assert.match(svg, /<svg[^>]*fill="currentColor"/)
  })

  it('dark variant letters use house ink', () => {
    assert.match(read(FILES.dark), /<svg[^>]*fill="#ececec"/)
  })

  it('light variant letters use #111', () => {
    assert.match(read(FILES.light), /<svg[^>]*fill="#111"/)
  })

  it('rule fill is --house-muted / #8a8a8a, not the letter fill', () => {
    assert.equal(parseRule(read(FILES.currentColor)).fill, RULE_FILL_CURRENT)
    assert.equal(parseRule(read(FILES.dark)).fill, RULE_FILL_SOLID)
    assert.equal(parseRule(read(FILES.light)).fill, RULE_FILL_SOLID)
    assert.notEqual(parseRule(read(FILES.dark)).fill, '#ececec')
    assert.notEqual(parseRule(read(FILES.light)).fill, '#111')
  })

  it('rule is inset half an `l` stem from the l and m ink edges', () => {
    for (const path of Object.values(FILES)) {
      const svg = read(path)
      const l = parseLInk(svg)
      const rule = parseRule(svg)
      const inkWidth = parseViewBoxWidth(svg)
      const mRight = l.left + inkWidth
      const halfStem = l.stem / 2
      assert.equal(rule.x, l.left + halfStem)
      assert.equal(rule.x + rule.width, mRight - halfStem)
      assert.equal(rule.width, inkWidth - l.stem)
    }
  })
})
