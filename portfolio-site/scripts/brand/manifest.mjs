// Builds immutable, content-hashed copies of the official logo files and
// writes public/brand/manifest.json describing them.
//
//   node scripts/brand/manifest.mjs
//
// Stable URLs (/brand/logo.svg) always serve the current file.
// Hashed URLs (/brand/v/logo.<hash>.svg) never change once published.

import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { imageSize } from './image-size.mjs'

const SITE = 'https://www.lecturesfrom.com'
// Set BRAND_MIRROR_LIVE=1 once assets.lecturesfrom.com serves the R2 bucket.
const MIRROR = process.env.BRAND_MIRROR_LIVE === '1' ? 'https://assets.lecturesfrom.com' : null
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'brand')
const vdir = join(dir, 'v')
mkdirSync(vdir, { recursive: true })

const FILES = [
  { file: 'logo.svg', role: 'primary', background: 'light', canonical: true },
  { file: 'logo-white.svg', role: 'primary', background: 'dark' },
  { file: 'logo-1024.png', role: 'primary', background: 'light' },
  { file: 'logo-512.png', role: 'primary', background: 'light' },
  { file: 'logo-white-1024.png', role: 'primary', background: 'dark' },
  { file: 'logo-white-512.png', role: 'primary', background: 'dark' },
  { file: 'favicon.svg', role: 'favicon', background: 'auto' },
  { file: 'favicon.ico', role: 'favicon', background: 'light' },
  { file: 'favicon-32.png', role: 'favicon', background: 'light' },
  { file: 'apple-touch-icon.png', role: 'app-icon', background: 'white' },
  { file: 'icon-192.png', role: 'app-icon', background: 'white' },
  { file: 'icon-512.png', role: 'app-icon', background: 'white' },
]

const TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }

const assets = FILES.map((entry) => {
  const src = join(dir, entry.file)
  const buf = readFileSync(src)
  const sha256 = createHash('sha256').update(buf).digest('hex')
  const ext = extname(entry.file)
  const hashed = `${entry.file.slice(0, -ext.length)}.${sha256.slice(0, 10)}${ext}`
  copyFileSync(src, join(vdir, hashed))
  const size = imageSize(buf, ext)
  return {
    ...entry,
    type: TYPES[ext],
    ...(size ? { width: size.width, height: size.height } : {}),
    bytes: buf.length,
    sha256,
    url: `${SITE}/brand/${entry.file}`,
    immutable: `${SITE}/brand/v/${hashed}`,
    ...(MIRROR ? { mirror: `${MIRROR}/brand/v/${hashed}` } : {}),
  }
})

const manifest = {
  name: 'lecturesfrom',
  owner: 'lecturesfrom LLC',
  copyright: `© ${new Date().getUTCFullYear()} lecturesfrom LLC. All rights reserved.`,
  license:
    'May be used to refer to lecturesfrom. Do not alter, recolor, stretch, or combine with other marks.',
  guidelines: `${SITE}/brand`,
  canonical: `${SITE}/brand/logo.svg`,
  colors: { ink: '#20262b', paper: '#ffffff' },
  source: '2026-09-26 master SVG',
  generatedAt: new Date().toISOString(),
  assets,
}

writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`wrote manifest.json with ${assets.length} assets`)
