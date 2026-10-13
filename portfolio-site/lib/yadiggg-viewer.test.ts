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

  it('drops the reserved rows in fallback', () => {
    assert.equal(shouldReserveViewerChrome('no-webgl', false, 'port'), false)
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
