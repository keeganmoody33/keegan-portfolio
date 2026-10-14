/** True when a WebGL context can actually serve three.js (getExtension must exist and not throw). */
export function webglContextIsUsable(gl: unknown): boolean {
  if (gl === null || typeof gl !== 'object') return false
  const getExtension = (gl as { getExtension?: unknown }).getExtension
  if (typeof getExtension !== 'function') return false
  try {
    getExtension.call(gl, 'WEBGL_debug_renderer_info')
    return true
  } catch {
    return false
  }
}

/** True when the context reports itself lost (missing isContextLost is treated as not lost). */
export function webglContextIsLost(gl: unknown): boolean {
  if (gl === null || typeof gl !== 'object') return true
  const isContextLost = (gl as { isContextLost?: unknown }).isContextLost
  if (typeof isContextLost !== 'function') return false
  try {
    return Boolean(isContextLost.call(gl))
  } catch {
    return true
  }
}

type LoseContextExt = { loseContext?: () => void }

/**
 * Drop a dummy-canvas probe so it does not leak a GPU context. Returns
 * `isContextLost()` after `WEBGL_lose_context.loseContext()`.
 */
export function releaseProbedWebGLContext(gl: unknown): boolean {
  if (gl === null || typeof gl !== 'object') return false
  const ctx = gl as {
    getExtension?: (name: string) => LoseContextExt | null
  }
  try {
    const ext = typeof ctx.getExtension === 'function' ? ctx.getExtension('WEBGL_lose_context') : null
    if (ext && typeof ext.loseContext === 'function') ext.loseContext()
  } catch {
    // Probe release is best-effort — a stub without the extension is still not a leak.
  }
  return webglContextIsLost(gl)
}

function isLiveProbe(gl: unknown): boolean {
  return webglContextIsUsable(gl) && !webglContextIsLost(gl)
}

type ProbeCanvas = {
  getContext: (id: string, attrs?: Record<string, unknown>) => unknown
} | null

/**
 * True when the given canvas can create a WebGL or WebGL2 context that three.js
 * can construct a renderer from. A stub context without getExtension (or one
 * that throws) is a failure — R3F creates WebGLRenderer outside React render,
 * so an error boundary will not catch that throw.
 *
 * Always probes a dummy canvas (never the live R3F canvas). After a successful
 * probe, `WEBGL_lose_context.loseContext()` releases that dummy context.
 */
export function hasWebGL(canvas: ProbeCanvas): boolean {
  if (!canvas) return false
  const attrs = { alpha: true, antialias: false }
  try {
    const gl2 = canvas.getContext('webgl2', attrs)
    if (isLiveProbe(gl2)) {
      releaseProbedWebGLContext(gl2)
      return true
    }
    const gl = canvas.getContext('webgl', attrs)
    if (isLiveProbe(gl)) {
      releaseProbedWebGLContext(gl)
      return true
    }
    return false
  } catch {
    return false
  }
}
