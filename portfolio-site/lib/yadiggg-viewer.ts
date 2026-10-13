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

export const PART_READOUT_DEFAULT =
  'hover or click a part to inspect its allocation. dimensioned study, not manufacturing cad.'

export type PartReadout = {
  label: string
  note: string
}

export const PART_READOUT_IDLE: PartReadout = {
  label: 'YADIGGG',
  note: PART_READOUT_DEFAULT,
}

export function formatPartLabel(name: string): string {
  return name.replaceAll('_', ' ')
}
