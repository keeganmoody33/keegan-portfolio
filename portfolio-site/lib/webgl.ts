/** True when the given canvas can create a WebGL or WebGL2 context. */
export function hasWebGL(canvas: { getContext: (id: string) => unknown } | null): boolean {
  if (!canvas) return false
  try {
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}
