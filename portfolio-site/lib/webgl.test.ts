/**
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/webgl.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hasWebGL, releaseProbedWebGLContext, webglContextIsLost } from './webgl.ts'

describe('hasWebGL', () => {
  it('is false for a null canvas', () => {
    assert.equal(hasWebGL(null), false)
  })

  it('probes with alpha true so a later renderer can keep a transparent canvas', () => {
    let attrs: Record<string, unknown> | undefined
    hasWebGL({
      getContext: (_id: string, next?: Record<string, unknown>) => {
        attrs = next
        return { getExtension: () => null }
      },
    })
    assert.equal(attrs?.alpha, true)
  })

  it('is true when webgl2 is available', () => {
    assert.equal(
      hasWebGL({
        getContext: (id: string) => (id === 'webgl2' ? { getExtension: () => null } : null),
      }),
      true
    )
  })

  it('falls back to webgl', () => {
    assert.equal(
      hasWebGL({
        getContext: (id: string) => (id === 'webgl' ? { getExtension: () => null } : null),
      }),
      true
    )
  })

  it('is false when getExtension is missing so R3F never mounts a broken context', () => {
    assert.equal(
      hasWebGL({
        getContext: (id: string) => (id === 'webgl2' ? {} : null),
      }),
      false
    )
  })

  it('is false when getExtension throws', () => {
    assert.equal(
      hasWebGL({
        getContext: () => ({
          getExtension: () => {
            throw new TypeError('e.getExtension is not a function')
          },
        }),
      }),
      false
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

  it('is false when the probe context is already lost', () => {
    assert.equal(
      hasWebGL({
        getContext: () => ({
          getExtension: () => null,
          isContextLost: () => true,
        }),
      }),
      false
    )
  })

  it('releases the dummy probe with WEBGL_lose_context.loseContext and checks isContextLost', () => {
    let lost = false
    let loseCalls = 0
    const gl = {
      getExtension: (name: string) => {
        if (name !== 'WEBGL_lose_context') return null
        return {
          loseContext() {
            loseCalls += 1
            lost = true
          },
        }
      },
      isContextLost: () => lost,
    }
    assert.equal(
      hasWebGL({
        getContext: (id: string) => (id === 'webgl2' ? gl : null),
      }),
      true
    )
    assert.equal(loseCalls, 1)
    assert.equal(lost, true)
    assert.equal(webglContextIsLost(gl), true)
  })
})

describe('releaseProbedWebGLContext', () => {
  it('calls loseContext and returns isContextLost', () => {
    let lost = false
    const released = releaseProbedWebGLContext({
      getExtension: (name: string) =>
        name === 'WEBGL_lose_context'
          ? {
              loseContext() {
                lost = true
              },
            }
          : null,
      isContextLost: () => lost,
    })
    assert.equal(lost, true)
    assert.equal(released, true)
  })
})
