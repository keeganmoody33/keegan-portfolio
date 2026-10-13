import { webglContextIsLost, webglContextIsUsable } from './webgl.ts'

export type StudyRendererLike = {
  render: (...args: never[]) => unknown
  dispose?: () => void
  getContext?: () => unknown
  setSize?: (width: number, height: number, updateStyle?: boolean) => void
  setPixelRatio?: (ratio: number) => void
  setClearColor?: (...args: never[]) => unknown
  getSize?: (target?: { set: (width: number, height: number) => unknown }) => unknown
  getDrawingBufferSize?: (target?: { set: (width: number, height: number) => unknown }) => unknown
  getPixelRatio?: () => number
  domElement?: EventTarget
  outputColorSpace?: string
  toneMapping?: number
  toneMappingExposure?: number
}

type SizeTarget = { set: (width: number, height: number) => unknown }

function emptyTarget(): EventTarget {
  return {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  }
}

/** R3F treats any object with `.render` as a renderer and will not construct WebGLRenderer. */
export function stubStudyRenderer(canvas?: EventTarget | null): StudyRendererLike {
  const size = { width: 1, height: 1 }
  const writeSize = (target?: SizeTarget) => {
    target?.set(size.width, size.height)
    return target ?? size
  }
  return {
    render() {},
    dispose() {},
    setSize(width, height) {
      size.width = width
      size.height = height
    },
    setPixelRatio() {},
    setClearColor() {},
    getSize: writeSize,
    getDrawingBufferSize: writeSize,
    getPixelRatio() {
      return 1
    },
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
    domElement: canvas ?? emptyTarget(),
    outputColorSpace: '',
    toneMapping: 0,
    toneMappingExposure: 1,
  }
}

/**
 * gl factory contract: never throw. A throw, or a non-renderer return, makes
 * R3F construct `WebGLRenderer` uncaught. Route failures to `onError` (poster).
 */
export function studyGlFromCreate(
  create: () => StudyRendererLike,
  onError: () => void,
  canvas?: EventTarget | null
): StudyRendererLike {
  try {
    const renderer = create()
    const ctx = typeof renderer.getContext === 'function' ? renderer.getContext() : null
    if (!webglContextIsUsable(ctx) || webglContextIsLost(ctx)) {
      renderer.dispose?.()
      onError()
      return stubStudyRenderer(canvas ?? renderer.domElement ?? null)
    }
    return renderer
  } catch {
    onError()
    return stubStudyRenderer(canvas ?? null)
  }
}

export function handleStudyContextLost(event: { preventDefault: () => void }, onLost: () => void): void {
  event.preventDefault()
  onLost()
}

/** Stay on the poster after a restore — do not remount a recovered context. */
export function handleStudyContextRestored(): 'stay-on-poster' {
  return 'stay-on-poster'
}

export function bindStudyContextLoss(canvas: EventTarget, onLost: () => void): () => void {
  const onLostEvent = (event: Event) => {
    handleStudyContextLost(event, onLost)
  }
  const onRestoredEvent = () => {
    handleStudyContextRestored()
  }
  canvas.addEventListener('webglcontextlost', onLostEvent)
  canvas.addEventListener('webglcontextrestored', onRestoredEvent)
  return () => {
    canvas.removeEventListener('webglcontextlost', onLostEvent)
    canvas.removeEventListener('webglcontextrestored', onRestoredEvent)
  }
}
