import { webglContextIsLost, webglContextIsUsable } from './webgl.ts'

type SizeTarget = { set: (width: number, height: number) => unknown }

export type StudyXrLike = {
  enabled: boolean
  isPresenting: boolean
  cameraAutoUpdate: boolean
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void
  dispatchEvent: (event: Event) => boolean
  setAnimationLoop: (callback: ((time: number, frame?: unknown) => void) | null) => void
  dispose: () => void
  getSession: () => unknown
  setSession: (session: unknown) => Promise<void>
  getReferenceSpace: () => unknown
  setReferenceSpace: (space: unknown) => void
  getCamera: () => { cameras: unknown[] }
  updateCamera: (camera: unknown) => void
  setFramebufferScaleFactor: (value: number) => void
  setReferenceSpaceType: (value: string) => void
  getController: (index: number) => unknown
  getControllerGrip: (index: number) => unknown
  getHand: (index: number) => unknown
  getFoveation: () => number | undefined
  setFoveation: (value: number) => void
  hasDepthSensing: () => boolean
  getDepthSensingMesh: () => unknown
  getFrame: () => unknown
  getBinding: () => unknown
  getBaseLayer: () => unknown
  getEnvironmentBlendMode: () => string | undefined
  getDepthTexture: () => unknown
  getCameraTexture: () => unknown
}

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
  xr?: StudyXrLike
  shadowMap?: { enabled: boolean; type: number; needsUpdate: boolean }
  autoClear?: boolean
  getRenderTarget?: () => unknown
  setRenderTarget?: (target: unknown) => void
  forceContextLoss?: () => void
  renderLists?: { dispose: () => void }
  capabilities?: { isWebGL2: boolean; maxSamples: number }
}

function emptyTarget(): EventTarget {
  return {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  }
}

function stubStudyXr(): StudyXrLike {
  return {
    enabled: false,
    isPresenting: false,
    cameraAutoUpdate: false,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
    setAnimationLoop() {},
    dispose() {},
    getSession() {
      return null
    },
    setSession() {
      return Promise.resolve()
    },
    getReferenceSpace() {
      return null
    },
    setReferenceSpace() {},
    getCamera() {
      return { cameras: [] }
    },
    updateCamera() {},
    setFramebufferScaleFactor() {},
    setReferenceSpaceType() {},
    getController() {
      return {}
    },
    getControllerGrip() {
      return {}
    },
    getHand() {
      return {}
    },
    getFoveation() {
      return undefined
    },
    setFoveation() {},
    hasDepthSensing() {
      return false
    },
    getDepthSensingMesh() {
      return null
    },
    getFrame() {
      return null
    },
    getBinding() {
      return null
    },
    getBaseLayer() {
      return null
    },
    getEnvironmentBlendMode() {
      return undefined
    },
    getDepthTexture() {
      return null
    },
    getCameraTexture() {
      return undefined
    },
  }
}

/**
 * R3F treats any object with `.render` as a renderer and will not construct
 * WebGLRenderer. Lost-on-create is detected inside the gl factory — `<Canvas>`
 * is already mounting, so we cannot skip it on this tick. `onError` flips to
 * the poster; this stub must survive R3F's xr bind (`gl.xr.addEventListener`)
 * and the other surfaces configure / ContactShadows touch before unmount.
 */
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
    xr: stubStudyXr(),
    shadowMap: { enabled: false, type: 0, needsUpdate: false },
    autoClear: true,
    getRenderTarget() {
      return null
    },
    setRenderTarget() {},
    forceContextLoss() {},
    renderLists: {
      dispose() {},
    },
    capabilities: { isWebGL2: true, maxSamples: 0 },
  }
}

/** Poster swap must wait a tick so R3F can finish onCreated bind before unmount. */
export function queueStudyError(onError: () => void): void {
  setTimeout(onError, 0)
}

/**
 * gl factory contract: never throw. A throw, or a non-renderer return, makes
 * R3F construct `WebGLRenderer` uncaught. Route failures to `onError` (poster)
 * on the next tick so the Canvas container is still mounted for R3F onCreated
 * (`events.connect` → `target.addEventListener`).
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
      queueStudyError(onError)
      return stubStudyRenderer(canvas ?? renderer.domElement ?? null)
    }
    return renderer
  } catch {
    queueStudyError(onError)
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
