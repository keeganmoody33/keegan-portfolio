export type SleeveViewMode = 'assembled' | 'xray' | 'exploded' | 'section' | 'compare'

export const SLEEVE_VIEW_MODES: readonly { id: SleeveViewMode; label: string }[] = [
  { id: 'assembled', label: 'assembled' },
  { id: 'xray', label: 'x-ray' },
  { id: 'exploded', label: 'exploded' },
  { id: 'section', label: 'open front' },
  { id: 'compare', label: 'reference' },
]

export type CameraPreset = 'front' | 'rear' | 'side' | 'ports' | 'reset'

export const CAMERA_PRESETS: Record<CameraPreset, readonly [number, number, number]> = {
  front: [0, 0, 0.26],
  rear: [0, 0, -0.26],
  side: [0.26, 0, 0.0001],
  ports: [0, -0.26, 0.04],
  reset: [0.135, 0.078, 0.23],
}

export const CAMERA_PRESET_BUTTONS: readonly { id: CameraPreset; label: string }[] = [
  { id: 'front', label: 'front' },
  { id: 'rear', label: 'rear' },
  { id: 'side', label: 'side' },
  { id: 'ports', label: 'ports' },
  { id: 'reset', label: 'reset view' },
]

/** Share-token and SSO-gated preview URLs must never be embedded. */
export function isBlockedViewerSrc(src: string): boolean {
  const lower = src.toLowerCase()
  return lower.includes('_vercel_share') || lower.includes('_vercel_jwt')
}

export const YADIGGG_LOCKED_FACTS: readonly { value: string; label: string }[] = [
  { value: '105 × 60 × 15 mm', label: 'locked product' },
  { value: '2.7"', label: 'memory lcd' },
  { value: 'one orange side button', label: 'side control' },
  { value: 'USB-C · 3.5 mm', label: 'ports' },
]

/** R1 CAD envelope from the workbench geometry strip — allocation study, not the locked product. */
export const YADIGGG_CAD_GEOMETRY: readonly { value: string; label: string }[] = [
  { value: '21', label: 'nominal solid parts' },
  { value: '1.5 mm', label: 'provisional shell wall' },
  { value: '70.8 mm', label: 'width including control' },
]

export const YADIGGG_CAD_ENVELOPE = '70 × 110 × 18 mm'

export const YADIGGG_REFERENCE_SRC = '/catalog/yadiggg/reference.jpg'
export const YADIGGG_POSTER_SRC = '/catalog/yadiggg/poster.jpg'
/** 2× of the ~290×420 stage below 640px. Do not squeeze the 860×420 landscape poster there. */
export const YADIGGG_POSTER_PORTRAIT_SRC = '/catalog/yadiggg/poster-portrait.jpg'

/**
 * Drafting-table paper. Matches CSS `--house-stage-paper` (person-light
 * `--bg-body`, FRONTEND_GUIDELINES: "warm paper"). No named Electroscrum
 * token set exists; this is the lightest beige/paper token. Do not invent a
 * new hex. Three.js cannot read CSS vars — keep this in lockstep with globals.
 */
export const YADIGGG_STAGE_PAPER = '#E8E2D2'

/** Matches CSS `--house-stage-ink` (person-light `--text-bright`). */
export const YADIGGG_STAGE_INK = '#2B241D'
export const YADIGGG_MODEL_ENVELOPE = {
  value: YADIGGG_CAD_ENVELOPE,
  label: 'r1 model envelope',
} as const

/**
 * Canvas wheel zoom is gated so the page can scroll.
 * Capture only when the stage is focused, or immediately with ctrl/cmd + wheel.
 */
export function shouldCaptureWheel(focused: boolean, ctrlOrMeta: boolean): boolean {
  return focused || ctrlOrMeta
}

export type ViewerFallbackReason = 'no-webgl' | 'blocked' | 'error'

/**
 * Mode row, preset row, drag hint, and stage tabIndex are live-study chrome.
 * Hide them in fallback, and do not flash them before WebGL is confirmed.
 */
export function shouldShowViewerChrome(
  fallback: ViewerFallbackReason | null,
  webgl: boolean | null,
  mode: 'port' | 'iframe'
): boolean {
  if (fallback !== null) return false
  if (mode === 'iframe') return true
  return webgl === true
}

/** Reserve mode/preset chip overlays only while the WebGL probe is in flight (or the study is live). Collapse them on fallback; `.house-sleeve-stage-stack` already includes both chrome tracks so the cover-cropped poster fills one surface (CSS ruler hidden). */
export function shouldReserveViewerChrome(
  fallback: ViewerFallbackReason | null,
  webgl: boolean | null,
  mode: 'port' | 'iframe'
): boolean {
  if (fallback !== null) return false
  if (mode === 'iframe') return true
  return webgl === null || webgl === true
}

export const PART_READOUT_DEFAULT =
  'hover or click a part to inspect its allocation. dimensioned study, not manufacturing cad.'

export const PART_READOUT_FALLBACK_NOTE =
  'dimensioned study, not manufacturing cad. poster when the live canvas cannot run.'

export const YADIGGG_RAIL_LIVE =
  'hover or click the model. the lcd reads parts and facts — not a capture demo. one orange side button on the reserved opening.'

export const YADIGGG_RAIL_FALLBACK =
  'locked product facts on the poster. one orange side button on the reserved opening. live canvas is not running on this device.'

export const YADIGGG_GESTURE_HINT =
  'drag or two-finger orbit · pinch to zoom · focus or ctrl+scroll to zoom'

/** Below `sm` (640px): no drag / ctrl+scroll copy. */
export const YADIGGG_GESTURE_HINT_TOUCH = 'two-finger orbit · pinch to zoom'

export type PartReadout = {
  label: string
  note: string
}

export const PART_READOUT_IDLE: PartReadout = {
  label: 'YADIGGG',
  note: PART_READOUT_DEFAULT,
}

export const PART_READOUT_FALLBACK: PartReadout = {
  label: 'YADIGGG',
  note: PART_READOUT_FALLBACK_NOTE,
}

export function formatPartLabel(name: string): string {
  return name.replaceAll('_', ' ')
}
