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

type ProbeCanvas = {
  getContext: (id: string, attrs?: Record<string, unknown>) => unknown
} | null

/**
 * True when the given canvas can create a WebGL or WebGL2 context that three.js
 * can construct a renderer from. A stub context without getExtension (or one
 * that throws) is a failure — R3F creates WebGLRenderer outside React render,
 * so an error boundary will not catch that throw.
 */
export function hasWebGL(canvas: ProbeCanvas): boolean {
  if (!canvas) return false
  const attrs = { alpha: true, antialias: false }
  try {
    const gl2 = canvas.getContext('webgl2', attrs)
    if (webglContextIsUsable(gl2)) return true
    const gl = canvas.getContext('webgl', attrs)
    return webglContextIsUsable(gl)
  } catch {
    return false
  }
}
