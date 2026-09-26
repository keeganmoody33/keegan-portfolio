/**
 * Rasterize brand/lecturesfrom-mark.svg into favicon, apple-icon, and house
 * share images. Geometry stays in the SVG; this script only paints colors
 * and backgrounds. Re-run after any mark change:
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * Requires rsvg-convert (librsvg) and Python 3 with Pillow (python3-pil).
 * No new npm dependencies.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'brand/lecturesfrom-mark.svg')
const APP = path.join(ROOT, 'app')
const HOUSE = path.join(APP, '(house)')

const HOUSE_BG = '#0a0a0a'
const HOUSE_INK = '#ececec'
const MARK_DARK = '#20262b'
const APPLE_BG = '#ececec'
const OG_W = 1200
const OG_H = 630
const OG_MARK = 288
const APPLE = 180

function which(bin) {
  try {
    execFileSync('which', [bin], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function raster(svgPath, pngPath, size) {
  execFileSync(
    'rsvg-convert',
    ['--format', 'png', '--width', String(size), '--height', String(size), '-o', pngPath, svgPath],
    { stdio: 'inherit' }
  )
}

function tintedSvg(stroke) {
  const raw = fs.readFileSync(SOURCE, 'utf8')
  if (!raw.includes('stroke="currentColor"')) {
    throw new Error('Source SVG must stroke with currentColor')
  }
  return raw
    .replace(/stroke="currentColor"/g, `stroke="${stroke}"`)
    .replace(/\srole="img"\saria-labelledby="lf-mark-title"/, '')
}

function writeIconSvg() {
  const dest = path.join(APP, 'icon.svg')
  const raw = fs.readFileSync(SOURCE, 'utf8')
  const withStyle = raw.replace(
    '<g transform="translate(256 256) scale(224)" stroke="currentColor" stroke-width="0.0625" stroke-linecap="round" stroke-linejoin="round">',
    `<style>
    .lf-stroke { stroke: ${MARK_DARK}; }
    @media (prefers-color-scheme: dark) {
      .lf-stroke { stroke: ${HOUSE_INK}; }
    }
  </style>
  <g class="lf-stroke" transform="translate(256 256) scale(224)" stroke-width="0.0625" stroke-linecap="round" stroke-linejoin="round">`
  )
  if (withStyle.includes('currentColor')) {
    throw new Error('icon.svg must not rely on currentColor')
  }
  if (withStyle.includes('<image') || withStyle.includes('data:image')) {
    throw new Error('icon.svg must stay a pure vector')
  }
  fs.writeFileSync(dest, withStyle)
  return dest
}

function encodeIco(pngs) {
  const count = pngs.length
  const headerSize = 6 + 16 * count
  let offset = headerSize
  const entries = pngs.map((png) => {
    const entry = { width: png.width, height: png.height, bytes: png.buffer.length, offset }
    offset += png.buffer.length
    return entry
  })
  const buf = Buffer.alloc(offset)
  buf.writeUInt16LE(0, 0)
  buf.writeUInt16LE(1, 2)
  buf.writeUInt16LE(count, 4)
  let cursor = 6
  for (const entry of entries) {
    buf.writeUInt8(entry.width >= 256 ? 0 : entry.width, cursor)
    buf.writeUInt8(entry.height >= 256 ? 0 : entry.height, cursor + 1)
    buf.writeUInt8(0, cursor + 2)
    buf.writeUInt8(0, cursor + 3)
    buf.writeUInt16LE(1, cursor + 4)
    buf.writeUInt16LE(32, cursor + 6)
    buf.writeUInt32LE(entry.bytes, cursor + 8)
    buf.writeUInt32LE(entry.offset, cursor + 12)
    cursor += 16
  }
  pngs.forEach((png, i) => {
    png.buffer.copy(buf, entries[i].offset)
  })
  return buf
}

function pythonComposite(script) {
  execFileSync('python3', ['-'], { input: script, stdio: ['pipe', 'inherit', 'inherit'] })
}

function main() {
  if (!which('rsvg-convert')) {
    throw new Error('rsvg-convert not found (install librsvg2-bin)')
  }
  try {
    execFileSync('python3', ['-c', 'from PIL import Image'], { stdio: 'pipe' })
  } catch {
    throw new Error('Python Pillow not found (install python3-pil)')
  }

  fs.mkdirSync(HOUSE, { recursive: true })
  writeIconSvg()

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-brand-'))
  const darkSvg = path.join(tmp, 'mark-dark.svg')
  const lightSvg = path.join(tmp, 'mark-light.svg')
  fs.writeFileSync(darkSvg, tintedSvg(MARK_DARK))
  fs.writeFileSync(lightSvg, tintedSvg(HOUSE_INK))

  const png16 = path.join(tmp, '16.png')
  const png32 = path.join(tmp, '32.png')
  const png48 = path.join(tmp, '48.png')
  const png180 = path.join(tmp, '180.png')
  const pngOgMark = path.join(tmp, 'og-mark.png')

  raster(darkSvg, png16, 16)
  raster(darkSvg, png32, 32)
  raster(darkSvg, png48, 48)
  raster(darkSvg, png180, APPLE)
  raster(lightSvg, pngOgMark, OG_MARK)

  const applePath = path.join(APP, 'apple-icon.png')
  const icoPath = path.join(APP, 'favicon.ico')
  const ogPath = path.join(HOUSE, 'opengraph-image.png')
  const twPath = path.join(HOUSE, 'twitter-image.png')

  pythonComposite(`
from PIL import Image
apple_bg = Image.new('RGBA', (${APPLE}, ${APPLE}), '${APPLE_BG}')
mark = Image.open(${JSON.stringify(png180)}).convert('RGBA')
apple_bg.alpha_composite(mark)
apple_bg.convert('RGB').save(${JSON.stringify(applePath)}, 'PNG')

og = Image.new('RGBA', (${OG_W}, ${OG_H}), '${HOUSE_BG}')
core = Image.open(${JSON.stringify(pngOgMark)}).convert('RGBA')
x = (${OG_W} - core.width) // 2
y = (${OG_H} - core.height) // 2
og.alpha_composite(core, (x, y))
og.convert('RGB').save(${JSON.stringify(ogPath)}, 'PNG')
og.convert('RGB').save(${JSON.stringify(twPath)}, 'PNG')
print('wrote apple-icon, opengraph-image, twitter-image')
`)

  fs.writeFileSync(
    icoPath,
    encodeIco([
      { width: 16, height: 16, buffer: fs.readFileSync(png16) },
      { width: 32, height: 32, buffer: fs.readFileSync(png32) },
      { width: 48, height: 48, buffer: fs.readFileSync(png48) },
    ])
  )

  fs.rmSync(tmp, { recursive: true, force: true })
  console.log('brand assets generated from', path.relative(ROOT, SOURCE))
}

main()
