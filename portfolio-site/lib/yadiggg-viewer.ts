export type SleeveViewMode = 'assembled' | 'xray' | 'exploded' | 'section'

export const SLEEVE_VIEW_MODES: readonly { id: SleeveViewMode; label: string }[] = [
  { id: 'assembled', label: 'assembled' },
  { id: 'xray', label: 'x-ray' },
  { id: 'exploded', label: 'exploded' },
  { id: 'section', label: 'open front' },
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
  { id: 'reset', label: 'reset' },
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

export const PART_READOUT_DEFAULT =
  'click a part for its allocation. dimensioned study, not manufacturing cad.'

export function formatPartLabel(name: string): string {
  return name.replaceAll('_', ' ')
}
