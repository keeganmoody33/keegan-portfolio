/**
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/webgl.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hasWebGL } from './webgl.ts'

describe('hasWebGL', () => {
  it('is false for a null canvas', () => {
    assert.equal(hasWebGL(null), false)
  })

  it('is true when webgl2 is available', () => {
    assert.equal(
      hasWebGL({
        getContext: (id: string) => (id === 'webgl2' ? {} : null),
      }),
      true
    )
  })

  it('falls back to webgl', () => {
    assert.equal(
      hasWebGL({
        getContext: (id: string) => (id === 'webgl' ? {} : null),
      }),
      true
    )
  })

  it('is false when both contexts fail', () => {
    assert.equal(
      hasWebGL({
        getContext: () => null,
      }),
      false
    )
  })
})
