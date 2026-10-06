/**
 * Discogs API notice lives on /legal (and /legal.md), not HouseFooter.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/discogs-notice.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DISCOGS_API_NOTICE } from './discogs-notice.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

function readFromSite(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), 'utf8')
}

describe('Discogs API non-affiliation notice', () => {
  it('keeps the Discogs terms sentence verbatim', () => {
    assert.equal(
      DISCOGS_API_NOTICE,
      'This application uses Discogs\u2019 API but is not affiliated with, sponsored or endorsed by Discogs. \u2018Discogs\u2019 is a trademark of Zink Media, LLC.'
    )
  })

  it('lives on /legal HTML and the /legal.md twin, not HouseFooter', () => {
    const legalPage = readFileSync(`${root}app/(house)/legal/page.tsx`, 'utf8')
    const legalMd = readFromSite('./markdown.ts')
    const footer = readFromSite('../components/house/HouseFooter.tsx')

    assert.match(legalPage, /Data sources/)
    assert.match(legalPage, /DISCOGS_API_NOTICE/)
    assert.match(legalPage, /text-\[var\(--house-muted\)\]/)
    assert.match(legalMd, /## Data sources/)
    assert.match(legalMd, /DISCOGS_API_NOTICE/)

    assert.equal(footer.includes('not affiliated with'), false)
    assert.equal(footer.includes('Zink Media'), false)
    assert.equal(footer.includes('DISCOGS_API_NOTICE'), false)
  })

  it('leaves collection Data provided by Discogs. and detail source lines in place', () => {
    const credit = readFromSite('../components/house/DiscogsCredit.tsx')
    const collection = readFileSync(`${root}app/(house)/collection/page.tsx`, 'utf8')
    const jsonld = readFromSite('./jsonld.tsx')

    assert.match(credit, /Data provided by Discogs\./)
    assert.match(collection, /DiscogsCredit/)
    assert.equal(jsonld.includes('not affiliated with'), false)
    assert.equal(jsonld.includes('Zink Media'), false)
  })
})
