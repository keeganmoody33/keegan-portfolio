/**
 * SIGNAL CUT leak check (Copilot 4111027402).
 *
 * Starts a house → person crossing, then either hides the page
 * (visibilitychange) or fires the fallback teardown. Asserts:
 * - overlay node is gone
 * - SignalCut rAF / timeout callbacks stop (callbackTicks stable)
 * - document.documentElement is not tearing / has no leftover transform
 *
 * Run against a local production server:
 *   SIGNAL_CUT_BASE=http://127.0.0.1:3000 node --experimental-strip-types \
 *     scripts/signal-cut-teardown-check.mjs
 * Playwright is not a repo dependency; resolve it from an install that has it.
 */

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const BASE = process.env.SIGNAL_CUT_BASE || 'http://127.0.0.1:3000'
const ROW04 = 'a[aria-label="keegan moody, principal channel"]'
const ART = process.env.SIGNAL_CUT_ART || '/opt/cursor/artifacts'
const OUT = path.join(ART, 'signal-cut-teardown-check.json')

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    '/tmp/signal-cut-pw/node_modules/playwright',
    path.resolve(process.cwd(), 'node_modules/playwright'),
    path.resolve(process.cwd(), '../node_modules/playwright'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      const require = createRequire(
        candidate.endsWith('playwright')
          ? path.join(candidate, 'package.json')
          : path.join(candidate, 'index.js'),
      )
      const loaded = require(candidate.endsWith('playwright') ? candidate : candidate)
      if (loaded?.chromium) return loaded
      if (loaded?.default?.chromium) return loaded.default
    } catch {
      // try ESM path
    }
    try {
      const href = pathToFileURL(path.resolve(candidate, 'index.js')).href
      const loaded = await import(href)
      if (loaded?.chromium) return loaded
      if (loaded?.default?.chromium) return loaded.default
    } catch {
      // try next
    }
  }
  throw new Error('playwright not found; set PLAYWRIGHT_MODULE or install it')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForOverlay(page) {
  await page.waitForFunction(
    () => {
      const el = document.getElementById('lf-signal-cut-overlay')
      const hook = window.__lfSignalCut
      return Boolean(el && hook && hook.getState().playing)
    },
    null,
    { timeout: 8000 },
  )
}

async function hidePage(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

async function snapshot(page) {
  return page.evaluate(() => {
    const hook = window.__lfSignalCut
    const root = document.documentElement
    return {
      ticks: hook?.callbackTicks ?? -1,
      state: hook?.getState() ?? null,
      overlay: Boolean(document.getElementById('lf-signal-cut-overlay')),
      htmlTearing: root.classList.contains('lf-sc-tearing'),
      htmlTransform: root.style.transform,
    }
  })
}

async function assertDead(page, label) {
  const first = await snapshot(page)
  await sleep(450)
  const later = await snapshot(page)
  const failures = []
  if (later.overlay) failures.push('overlay still in DOM')
  if (later.state?.playing) failures.push('playing still true')
  if (later.state?.snowing) failures.push('snowing still true')
  if (later.state?.clockRaf) failures.push(`clockRaf=${later.state.clockRaf}`)
  if (later.state?.waitRaf) failures.push(`waitRaf=${later.state.waitRaf}`)
  if (later.state?.timerCount) failures.push(`timerCount=${later.state.timerCount}`)
  if (later.htmlTearing) failures.push('html still tearing')
  if (later.htmlTransform) failures.push(`html transform=${later.htmlTransform}`)
  if (later.ticks !== first.ticks) {
    failures.push(`callbackTicks moved ${first.ticks} -> ${later.ticks}`)
  }
  if (failures.length > 0) {
    throw new Error(`${label}: ${failures.join('; ')} first=${JSON.stringify(first)} later=${JSON.stringify(later)}`)
  }
  return { label, first, later }
}

async function openHouse(context) {
  const page = await context.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem('lf-signal-cut-count')
    } catch {
      // ignore
    }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator(ROW04).waitFor({ state: 'visible', timeout: 15000 })
  return page
}

async function startCrossing(page) {
  await page.locator(ROW04).click({ noWaitAfter: true })
  await waitForOverlay(page)
  await page
    .waitForFunction(
      () => {
        const el = document.getElementById('lf-signal-cut-overlay')
        return el?.dataset.phase === 'snow' || el?.dataset.phase === 'black' || el?.dataset.phase === 'tear'
      },
      null,
      { timeout: 2000 },
    )
    .catch(() => undefined)
}

async function main() {
  const { chromium } = await loadPlaywright()
  fs.mkdirSync(ART, { recursive: true })
  const browser = await chromium.launch({ args: ['--disable-gpu'] })
  const context = await browser.newContext({ reducedMotion: 'no-preference' })
  const results = []

  try {
    {
      const page = await openHouse(context)
      await startCrossing(page)
      await hidePage(page)
      results.push(await assertDead(page, 'visibilitychange'))
      await page.close()
    }

    {
      const page = await openHouse(context)
      await startCrossing(page)
      await page.evaluate(() => {
        window.__lfSignalCut?.teardown()
      })
      results.push(await assertDead(page, 'fallback-teardown'))
      await page.close()
    }
  } finally {
    await browser.close()
  }

  const payload = { ok: true, comment: '4111027402', results }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
  console.log(JSON.stringify(payload, null, 2))
}

main().catch((error) => {
  const payload = { ok: false, comment: '4111027402', error: String(error?.stack || error) }
  try {
    fs.mkdirSync(ART, { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
  } catch {
    // ignore
  }
  console.error(payload.error)
  process.exit(1)
})
