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
  it('does not throw when create fails; routes to onError and returns a renderer-like stub', async () => {
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
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    assert.equal(errors, 1)
    const ctx = gl.getContext?.()
    assert.equal((ctx as { isContextLost: () => boolean }).isContextLost(), true)
  })

  it('does not throw when the created context is already lost', async () => {
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
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
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

  it('live-only lost-on-create does not pageerror when R3F binds xr', async () => {
    const probe = {
      getExtension() {
        return null
      },
      isContextLost() {
        return false
      },
    }
    assert.equal(probe.isContextLost(), false)

    const pageerrors: unknown[] = []
    let errors = 0
    // R3F onCreated does `events.connect(divRef.current)` → target.addEventListener.
    // A sync poster swap unmounts that container in the same tick.
    let container: { addEventListener: (type: string, listener: () => void) => void } | null = {
      addEventListener() {},
    }

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
        container = null
      }
    )

    try {
      const target = container
      if (target == null) {
        throw new TypeError("Cannot read properties of null (reading 'addEventListener')")
      }
      target.addEventListener('pointerdown', () => {})
      const xr = gl.xr
      if (xr == null) throw new TypeError("Cannot read properties of null (reading 'addEventListener')")
      xr.addEventListener('sessionstart', () => {})
      xr.addEventListener('sessionend', () => {})
      xr.enabled = xr.isPresenting
      xr.setAnimationLoop(null)
      gl.setPixelRatio?.(1)
      gl.setSize?.(1, 1, false)
      if (gl.shadowMap) gl.shadowMap.enabled = false
      gl.outputColorSpace = ''
      gl.toneMapping = 0
      gl.render()
      const oldEnabled = xr.enabled
      const oldPresenting = xr.isPresenting
      gl.autoClear = true
      xr.enabled = false
      xr.isPresenting = false
      gl.getRenderTarget?.()
      gl.setRenderTarget?.(null)
      xr.enabled = oldEnabled
      xr.isPresenting = oldPresenting
      xr.removeEventListener('sessionstart', () => {})
      xr.removeEventListener('sessionend', () => {})
    } catch (error) {
      pageerrors.push(error)
    }
    assert.equal(pageerrors.length, 0)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    assert.equal(errors, 1)
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
