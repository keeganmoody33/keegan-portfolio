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

export type ControlCandidate = 'A' | 'B'

export const CONTROL_CANDIDATES: readonly {
  id: ControlCandidate
  label: string
  hint: string
}[] = [
  { id: 'A', label: 'A · side rocker', hint: 'one visually grouped three-zone rocker on the reserved opening' },
  { id: 'B', label: 'B · capture + nav', hint: 'capture plus navigation on the same reserved opening' },
]

/** Share-token and SSO-gated preview URLs must never be embedded. */
export function isBlockedViewerSrc(src: string): boolean {
  const lower = src.toLowerCase()
  return lower.includes('_vercel_share') || lower.includes('_vercel_jwt')
}

export const YADIGGG_LOCKED_FACTS: readonly { value: string; label: string }[] = [
  { value: '105 × 60 × 15 mm', label: 'smoke-clear shell' },
  { value: '2.7"', label: 'memory LCD' },
  { value: 'USB-C · 3.5 mm', label: 'one orange side button' },
]

/** R1 CAD envelope from the workbench geometry strip — allocation study, not the locked product. */
export const YADIGGG_CAD_GEOMETRY: readonly { value: string; label: string }[] = [
  { value: '21', label: 'nominal solid parts' },
  { value: '1.5 mm', label: 'provisional shell wall' },
  { value: '70.8 mm', label: 'width including control' },
]

export const YADIGGG_CAD_ENVELOPE = '70 × 110 × 18 mm'

export const YADIGGG_CANDIDATE_B_SRC = '/catalog/yadiggg/controls_candidate_b.glb'
export const YADIGGG_REFERENCE_SRC = '/catalog/yadiggg/reference.jpg'

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
