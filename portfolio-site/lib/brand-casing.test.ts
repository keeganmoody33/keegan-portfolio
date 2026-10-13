/**
 * Brand casing: the site/brand name is always lowercase `lecturesfrom`.
 *
 * Scans user-visible and metadata sources. Skips code identifiers
 * (User-Agent tokens), file paths, and URLs.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/brand-casing.test.ts
 */

import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const FORBIDDEN = /\bLecturesfrom\b|\bLecturesFrom\b|\bLectures From\b|\bLECTURESFROM\b/

const SKIP_LINE = /User-Agent|LecturesFromPortfolio/

const SCAN_ROOTS = [
  'app',
  'components',
  'lib/site.ts',
  'lib/metadata.ts',
  'lib/jsonld.tsx',
  'lib/markdown.ts',
  'lib/agent.ts',
  'public',
]

const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.txt', '.html', '.svg', '.md'])

function walk(abs: string, out: string[]): void {
  const st = statSync(abs)
  if (st.isDirectory()) {
    for (const name of readdirSync(abs)) {
      if (name === 'node_modules' || name === '.next') continue
      walk(join(abs, name), out)
    }
    return
  }
  const ext = abs.slice(abs.lastIndexOf('.'))
  if (SCAN_EXT.has(ext) || abs.endsWith('llms.txt')) out.push(abs)
}

describe('lecturesfrom brand casing', () => {
  it('user-visible and metadata sources stay lowercase lecturesfrom', () => {
    const files: string[] = []
    for (const rel of SCAN_ROOTS) {
      walk(join(ROOT, rel), files)
    }

    const hits: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      const lines = text.split('\n')
      lines.forEach((line, i) => {
        if (SKIP_LINE.test(line)) return
        if (FORBIDDEN.test(line)) {
          hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
        }
      })
    }

    assert.deepEqual(hits, [], `capital-L brand name in shipped text:\n${hits.join('\n')}`)
  })

  it('site constants use lowercase lecturesfrom', async () => {
    const { HOUSE_TITLE, PERSON_TITLE, HOUSE_OG_IMAGE } = await import('./site.ts')
    assert.equal(HOUSE_TITLE, 'lecturesfrom')
    assert.equal(PERSON_TITLE, 'Keegan Moody | lecturesfrom')
    assert.equal(HOUSE_OG_IMAGE.alt, 'lecturesfrom')
  })
})
