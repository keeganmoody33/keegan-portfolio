/**
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/yadiggg-viewer.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isCandidateAControl, partByName, YADIGGG_PARTS } from './yadiggg-parts.ts'
import {
  CAMERA_PRESET_BUTTONS,
  PART_READOUT_FALLBACK,
  PART_READOUT_IDLE,
  SLEEVE_VIEW_MODES,
  YADIGGG_GESTURE_HINT,
  YADIGGG_GESTURE_HINT_TOUCH,
  YADIGGG_LOCKED_FACTS,
  YADIGGG_MODEL_ENVELOPE,
  YADIGGG_POSTER_PORTRAIT_SRC,
  YADIGGG_POSTER_SRC,
  YADIGGG_RAIL_FALLBACK,
  YADIGGG_STAGE_INK,
  YADIGGG_STAGE_PAPER,
  formatPartLabel,
  isBlockedViewerSrc,
  shouldCaptureWheel,
  shouldReserveViewerChrome,
  shouldShowViewerChrome,
} from './yadiggg-viewer.ts'

function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) break
    const marker = buf[i + 1]
    if (marker === undefined) break
    const length = buf.readUInt16BE(i + 2)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    i += 2 + length
  }
  throw new Error('no JPEG SOF')
}

describe('sleeve view modes', () => {
  it('includes every workbench view including reference', () => {
    assert.deepEqual(
      SLEEVE_VIEW_MODES.map((mode) => mode.id),
      ['assembled', 'xray', 'exploded', 'section', 'compare']
    )
  })

  it('includes every camera preset', () => {
    assert.deepEqual(
      CAMERA_PRESET_BUTTONS.map((button) => button.id),
      ['front', 'rear', 'side', 'ports', 'reset']
    )
  })
})

describe('part lookup', () => {
  it('formats mesh names as labels', () => {
    assert.equal(formatPartLabel('shell_front'), 'shell front')
  })

  it('keeps one orange side-button rocker on the R1 controls', () => {
    const part = partByName('control_select')
    assert.ok(part)
    assert.match(part.note, /one orange side button/)
    assert.doesNotMatch(part.note, /Candidate B|capture/)
    assert.equal(isCandidateAControl('control_select'), true)
    assert.equal(partByName('control_capture'), undefined)
  })

  it('keeps part notes in lowercase house case', () => {
    for (const part of YADIGGG_PARTS) {
      assert.equal(part.note, part.note.toLowerCase())
    }
  })
})

describe('locked facts vs model envelope', () => {
  it('does not pair USB-C with the orange side button', () => {
    const usb = YADIGGG_LOCKED_FACTS.find((fact) => fact.value.includes('USB-C'))
    const button = YADIGGG_LOCKED_FACTS.find((fact) => fact.value.includes('orange'))
    assert.ok(usb)
    assert.ok(button)
    assert.equal(usb.label, 'ports')
    assert.equal(button.label, 'side control')
    assert.notEqual(usb.label, button.value)
  })

  it('labels the locked 105 body separately from the 70 model envelope', () => {
    const body = YADIGGG_LOCKED_FACTS.find((fact) => fact.value.includes('105'))
    assert.ok(body)
    assert.match(body.label, /locked product/)
    assert.match(YADIGGG_MODEL_ENVELOPE.value, /70/)
    assert.match(YADIGGG_MODEL_ENVELOPE.label, /envelope/)
    assert.equal(YADIGGG_POSTER_SRC, '/catalog/yadiggg/poster.jpg')
    assert.equal(YADIGGG_POSTER_PORTRAIT_SRC, '/catalog/yadiggg/poster-portrait.jpg')
  })
})

describe('drafting-table tokens', () => {
  it('uses the person-light warm-paper and ink tokens, not a new hex', () => {
    assert.equal(YADIGGG_STAGE_PAPER, '#E8E2D2')
    assert.equal(YADIGGG_STAGE_INK, '#2B241D')
  })

  it('defines --house-stage-paper / --house-stage-ink once and uses them on the stage', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app/globals.css'), 'utf8')
    assert.match(css, /--house-stage-paper:\s*#E8E2D2/)
    assert.match(css, /--house-stage-ink:\s*#2B241D/)
    assert.match(css, /background-color:\s*var\(--house-stage-paper\)/)
    assert.match(css, /outline-offset:\s*-4px/)
    assert.match(css, /--house-stage-ink\) 10%/)
    assert.match(css, /--house-stage-ink\) 28%/)
    assert.match(css, /@media \(min-width: 951px\)/)
    assert.doesNotMatch(css, /\.house-sleeve-modes[\s\S]{0,80}@media \(min-width: 640px\)/)
    assert.match(css, /--house-sleeve-chrome-row:\s*5\.75rem/)
    assert.doesNotMatch(css, /#fdfaf5/)
  })
})

describe('shouldShowViewerChrome', () => {
  it('hides mode/preset/hint until WebGL is confirmed on a ported study', () => {
    assert.equal(shouldShowViewerChrome(null, null, 'port'), false)
    assert.equal(shouldShowViewerChrome(null, true, 'port'), true)
  })

  it('hides live chrome in every fallback', () => {
    assert.equal(shouldShowViewerChrome('no-webgl', false, 'port'), false)
    assert.equal(shouldShowViewerChrome('error', true, 'port'), false)
    assert.equal(shouldShowViewerChrome('blocked', null, 'iframe'), false)
  })
})

describe('shouldReserveViewerChrome', () => {
  it('reserves mode/preset row height while the WebGL probe is in flight', () => {
    assert.equal(shouldReserveViewerChrome(null, null, 'port'), true)
    assert.equal(shouldReserveViewerChrome(null, true, 'port'), true)
  })

  it('collapses the reserved rows in every fallback', () => {
    assert.equal(shouldReserveViewerChrome('no-webgl', false, 'port'), false)
    assert.equal(shouldReserveViewerChrome('error', true, 'port'), false)
    assert.equal(shouldReserveViewerChrome('blocked', null, 'iframe'), false)
  })

  it('folds collapsed chrome tracks into the stage stack so the poster is one surface', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app/globals.css'), 'utf8')
    assert.match(css, /--house-sleeve-chrome-row:\s*5\.75rem/)
    assert.match(css, /@media \(min-width: 951px\)[\s\S]{0,120}--house-sleeve-chrome-row:\s*2\.5rem/)
    assert.match(css, /--house-sleeve-modes-gap:\s*1\.5rem/)
    assert.match(css, /--house-sleeve-presets-gap:\s*0\.75rem/)
    assert.match(css, /--house-sleeve-modes-track:/)
    assert.match(css, /--house-sleeve-presets-track:/)
    assert.match(css, /\.house-sleeve-stage-stack/)
    assert.match(css, /\.house-sleeve-stage-stack-fallback/)
    assert.match(css, /grid-row:\s*1\s*\/\s*-1/)
    assert.doesNotMatch(css, /house-sleeve-modes-pad-fallback/)
    assert.doesNotMatch(css, /house-sleeve-presets-pad-fallback/)
    const viewer = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'components/house/SleeveViewer.tsx'),
      'utf8'
    )
    assert.match(viewer, /house-sleeve-stage-stack/)
    assert.match(viewer, /house-sleeve-modes-pad/)
    assert.match(viewer, /house-sleeve-presets-pad/)
    assert.match(viewer, /aria-labelledby="yadiggg-study-heading"/)
    assert.match(viewer, /aria-labelledby="yadiggg-rail-heading"/)
  })
})

describe('keegan wordmark png', () => {
  it('is a trimmed cut-out lockup on a hugging paper plate', () => {
    const png = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'public/catalog/yadiggg/wordmark.png')
    )
    assert.equal(png.readUInt32BE(16), 323)
    assert.equal(png.readUInt32BE(20), 80)
    assert.equal(png[25], 6)
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app/globals.css'), 'utf8')
    assert.match(css, /padding:\s*5px/)
    assert.match(css, /aspect-ratio: 323 \/ 80/)
    assert.match(css, /\.house-sleeve-wordmark img[\s\S]{0,200}height:\s*40px/)
    assert.match(css, /\.house-sleeve-wordmark[\s\S]{0,400}background-color:\s*var\(--house-stage-paper\)/)
    assert.doesNotMatch(css, /\.house-sleeve-wordmark img[\s\S]{0,200}2\.75rem/)
    assert.doesNotMatch(css, /\.house-sleeve-wordmark img[\s\S]{0,200}3\.25rem/)
    const sleeve = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'components/house/Sleeve.tsx'),
      'utf8'
    )
    assert.doesNotMatch(sleeve, /srcSet/)
  })
})

describe('portrait poster', () => {
  it('is a 580×840 crop and is selected below 640px', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const portrait = readFileSync(join(root, 'public/catalog/yadiggg/poster-portrait.jpg'))
    assert.deepEqual(jpegSize(portrait), { width: 580, height: 840 })
    const viewer = readFileSync(join(root, 'components/house/SleeveViewer.tsx'), 'utf8')
    assert.match(viewer, /media="\(max-width: 639px\)"/)
    assert.match(viewer, /YADIGGG_POSTER_PORTRAIT_SRC/)
    assert.match(viewer, /sm:object-contain/)
  })
})

describe('fallback copy', () => {
  it('does not tell a poster visitor to hover or click', () => {
    assert.doesNotMatch(PART_READOUT_FALLBACK.note, /hover or click/i)
    assert.doesNotMatch(YADIGGG_RAIL_FALLBACK, /hover or click/i)
    assert.match(PART_READOUT_IDLE.note, /hover or click/)
    assert.match(YADIGGG_GESTURE_HINT, /pinch/)
    assert.equal(YADIGGG_GESTURE_HINT_TOUCH, 'two-finger orbit · pinch to zoom')
    assert.doesNotMatch(YADIGGG_GESTURE_HINT_TOUCH, /drag|ctrl/i)
  })
})

describe('shouldCaptureWheel', () => {
  it('lets the page scroll until the stage is focused', () => {
    assert.equal(shouldCaptureWheel(false, false), false)
  })

  it('captures ctrl/cmd + wheel without focus, and any wheel while focused', () => {
    assert.equal(shouldCaptureWheel(false, true), true)
    assert.equal(shouldCaptureWheel(true, false), true)
    assert.equal(shouldCaptureWheel(true, true), true)
  })
})

describe('isBlockedViewerSrc', () => {
  it('rejects share-token preview URLs', () => {
    assert.equal(
      isBlockedViewerSrc('https://yadiggg-viewer-foo.vercel.app/?_vercel_share=abc'),
      true
    )
    assert.equal(isBlockedViewerSrc('https://yadiggg-viewer.vercel.app/'), false)
  })
})
