/**
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/yadiggg-viewer.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isCandidateAControl, isCandidateBControl, partByName } from './yadiggg-parts.ts'
import {
  CAMERA_PRESET_BUTTONS,
  CONTROL_CANDIDATES,
  SLEEVE_VIEW_MODES,
  formatPartLabel,
  isBlockedViewerSrc,
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

  it('exposes Candidate A and B as CAD layouts', () => {
    assert.deepEqual(
      CONTROL_CANDIDATES.map((entry) => entry.id),
      ['A', 'B']
    )
  })
})

describe('part lookup', () => {
  it('formats mesh names as labels', () => {
    assert.equal(formatPartLabel('shell_front'), 'shell front')
  })

  it('keeps Candidate A rocker notes on the R1 controls', () => {
    const part = partByName('control_select', 'A')
    assert.ok(part)
    assert.match(part.note, /Candidate A/)
    assert.equal(isCandidateAControl('control_select'), true)
    assert.equal(isCandidateBControl('control_select'), true)
  })

  it('switches control notes for Candidate B including capture', () => {
    const capture = partByName('control_capture', 'B')
    const select = partByName('control_select', 'B')
    assert.ok(capture)
    assert.ok(select)
    assert.match(capture.note, /Candidate B capture/)
    assert.match(select.note, /Candidate B navigation/)
    assert.equal(partByName('control_capture', 'A'), undefined)
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
