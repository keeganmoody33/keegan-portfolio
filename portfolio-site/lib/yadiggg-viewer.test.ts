/**
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/yadiggg-viewer.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isCandidateAControl, partByName, YADIGGG_PARTS } from './yadiggg-parts.ts'
import {
  CAMERA_PRESET_BUTTONS,
  SLEEVE_VIEW_MODES,
  YADIGGG_LOCKED_FACTS,
  YADIGGG_MODEL_ENVELOPE,
  YADIGGG_POSTER_SRC,
  formatPartLabel,
  isBlockedViewerSrc,
  shouldCaptureWheel,
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
