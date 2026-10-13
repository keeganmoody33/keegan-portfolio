/**
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/yadiggg-gl.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  bindStudyContextLoss,
  handleStudyContextLost,
  handleStudyContextRestored,
  stubStudyRenderer,
  studyGlFromCreate,
} from './yadiggg-gl.ts'

describe('lost-on-create', () => {
  it('does not throw when create fails; routes to onError and returns a renderer-like stub', () => {
    let errors = 0
    const gl = studyGlFromCreate(
      () => {
        throw new Error('webgl unavailable')
      },
      () => {
        errors += 1
      }
    )
    assert.equal(typeof gl.render, 'function')
    assert.doesNotThrow(() => gl.render())
    assert.equal(errors, 1)
    const ctx = gl.getContext?.()
    assert.equal((ctx as { isContextLost: () => boolean }).isContextLost(), true)
  })

  it('does not throw when the created context is already lost', () => {
    let errors = 0
    const gl = studyGlFromCreate(
      () => ({
        render() {},
        dispose() {},
        getContext() {
          return {
            getExtension() {
              return null
            },
            isContextLost() {
              return true
            },
          }
        },
      }),
      () => {
        errors += 1
      }
    )
    assert.equal(typeof gl.render, 'function')
    assert.equal(errors, 1)
  })

  it('returns the live renderer when create succeeds', () => {
    let errors = 0
    const live = {
      render() {},
      getContext() {
        return {
          getExtension() {
            return null
          },
          isContextLost() {
            return false
          },
        }
      },
    }
    const gl = studyGlFromCreate(() => live, () => {
      errors += 1
    })
    assert.equal(gl, live)
    assert.equal(errors, 0)
  })
})

describe('lost-after-mount', () => {
  it('preventDefault then switches to the poster via onLost', () => {
    let prevented = false
    let lost = 0
    handleStudyContextLost(
      {
        preventDefault() {
          prevented = true
        },
      },
      () => {
        lost += 1
      }
    )
    assert.equal(prevented, true)
    assert.equal(lost, 1)
  })

  it('stays on the poster after webglcontextrestored', () => {
    assert.equal(handleStudyContextRestored(), 'stay-on-poster')
  })

  it('binds webglcontextlost (preventDefault + onLost) and restored (stay-on-poster)', () => {
    const listeners = new Map<string, EventListener>()
    const canvas = {
      addEventListener(type: string, listener: EventListener) {
        listeners.set(type, listener)
      },
      removeEventListener(type: string) {
        listeners.delete(type)
      },
      dispatchEvent() {
        return true
      },
    }
    let lost = 0
    const unbind = bindStudyContextLoss(canvas, () => {
      lost += 1
    })
    let prevented = false
    const event = {
      preventDefault() {
        prevented = true
      },
    } as Event & { preventDefault: () => void }
    listeners.get('webglcontextlost')?.(event)
    assert.equal(prevented, true)
    assert.equal(lost, 1)
    listeners.get('webglcontextrestored')?.(event)
    assert.equal(lost, 1)
    unbind()
    assert.equal(listeners.size, 0)
  })
})

describe('stubStudyRenderer', () => {
  it('is a renderer in the R3F isRenderer sense', () => {
    const stub = stubStudyRenderer()
    assert.equal(!!(stub != null && stub.render), true)
  })
})
