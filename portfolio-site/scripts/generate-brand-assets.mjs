/**
 * Rasterize brand/lecturesfrom-mark.svg into the house share image
 * (brand/house-share.png). Site icons (app/icon.svg, favicon.ico,
 * apple-icon.png) come from the official master via scripts/brand/render.py;
 * this script no longer writes them. Run everything with:
 *
 *   npm run generate:brand
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

const HOUSE_BG = '#0a0a0a'
const HOUSE_INK = '#ececec'
const OG_W = 1200
const OG_H = 630
const OG_MARK = 288

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

function main() {
  if (!which('rsvg-convert')) {
    throw new Error('rsvg-convert not found (install librsvg2-bin)')
  }
  try {
    execFileSync('python3', ['-c', 'from PIL import Image'], { stdio: 'pipe' })
  } catch {
    throw new Error('Python Pillow not found (install python3-pil)')
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-brand-'))
  const lightSvg = path.join(tmp, 'mark-light.svg')
  const pngOgMark = path.join(tmp, 'og-mark.png')
  const ogPath = path.join(ROOT, 'brand/house-share.png')
  fs.writeFileSync(lightSvg, tintedSvg(HOUSE_INK))
  raster(lightSvg, pngOgMark, OG_MARK)

  execFileSync('python3', ['-'], {
    input: `
from PIL import Image
og = Image.new('RGBA', (${OG_W}, ${OG_H}), '${HOUSE_BG}')
core = Image.open(${JSON.stringify(pngOgMark)}).convert('RGBA')
og.alpha_composite(core, ((${OG_W} - core.width) // 2, (${OG_H} - core.height) // 2))
og.convert('RGB').save(${JSON.stringify(ogPath)}, 'PNG')
`,
    stdio: ['pipe', 'inherit', 'inherit'],
  })

  fs.rmSync(tmp, { recursive: true, force: true })
  console.log('house-share.png generated from', path.relative(ROOT, SOURCE))
}

main()
