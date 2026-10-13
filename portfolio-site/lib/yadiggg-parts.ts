export type YadigggPartKind = 'physical' | 'surface' | 'construction'

export type YadigggPart = {
  name: string
  kind: YadigggPartKind
  note: string
  explodeMm: number
}

export const YADIGGG_PARTS: readonly YadigggPart[] = [
  { name: 'shell_front', kind: 'physical', note: 'hollow shell, provisional 1.5mm wall; no bosses, draft or seal', explodeMm: 30 },
  { name: 'shell_rear', kind: 'physical', note: '0.2mm study split; not a validated closure', explodeMm: -35 },
  { name: 'display_window', kind: 'physical', note: 'provisional flat protective window', explodeMm: 25 },
  { name: 'display_support', kind: 'physical', note: 'support reservation; attachment and gasket tbd', explodeMm: 20 },
  { name: 'display_module', kind: 'physical', note: 'sharp ls027b7dh01 catalog envelope; fpc and maximum-tolerance drawing not modeled', explodeMm: 15 },
  { name: 'display_active', kind: 'surface', note: '400x240 simulated interface; 0.02mm visualization layer', explodeMm: 15 },
  { name: 'pcb_allocation', kind: 'physical', note: 'new allocation only; no matching placed/routed pcb exists', explodeMm: 0 },
  { name: 'underside_population', kind: 'physical', note: 'maximum component allocation, not part count', explodeMm: -5 },
  { name: 'compute_shield_allocation', kind: 'physical', note: 'simplified shielding/compute volume, thermal path unvalidated', explodeMm: 5 },
  { name: 'battery', kind: 'physical', note: 'retained v1 placeholder envelope; not a verified 1500mah pack', explodeMm: -20 },
  { name: 'haptic_reservation', kind: 'physical', note: '10mm actuator reservation, actual part tbd', explodeMm: -15 },
  { name: 'camera_reservation', kind: 'physical', note: 'reservation, not ar1335 module drawing or optical proof', explodeMm: -12 },
  { name: 'usb_reservation', kind: 'physical', note: 'reserved volume only; not verified molex mating geometry', explodeMm: 0 },
  { name: 'jack_reservation', kind: 'physical', note: 'sj-3523-smt-tr body envelope; contact/mating strain space not validated', explodeMm: 0 },
  { name: 'camera_light_tube', kind: 'physical', note: 'light path concept only', explodeMm: -20 },
  { name: 'camera_lens', kind: 'physical', note: 'illustrative optical surface, no prescription', explodeMm: -12 },
  { name: 'mic_allocation_18', kind: 'physical', note: 'two mic zones and separate ports; acoustic channels/gaskets missing', explodeMm: -8 },
  { name: 'mic_allocation_6', kind: 'physical', note: 'two mic zones and separate ports; acoustic channels/gaskets missing', explodeMm: -8 },
  { name: 'control_mechanism', kind: 'physical', note: 'reservation only, compatible with pcb notch', explodeMm: 0 },
  { name: 'control_down', kind: 'physical', note: 'one orange side button — three-zone rocker on a single side opening', explodeMm: 0 },
  { name: 'control_select', kind: 'physical', note: 'one orange side button — three-zone rocker on a single side opening', explodeMm: 0 },
  { name: 'control_up', kind: 'physical', note: 'one orange side button — three-zone rocker on a single side opening', explodeMm: 0 },
  { name: 'rf_reservation', kind: 'construction', note: 'construction reservation only; antenna copper, ground and hand-loading rules tbd', explodeMm: 0 },
  { name: 'display_flex_reservation', kind: 'construction', note: 'unrouted fpc allowance; exact connector/bend radius tbd', explodeMm: 0 },
  { name: 'battery_service_reservation', kind: 'construction', note: 'cable/connector allocation; battery swelling is a separate requirement', explodeMm: 0 },
]

const CONTROL_A_NAMES = new Set(['control_up', 'control_select', 'control_down'])

export function isCandidateAControl(name: string): boolean {
  return CONTROL_A_NAMES.has(name)
}

export function partByName(name: string): YadigggPart | undefined {
  return YADIGGG_PARTS.find((part) => part.name === name)
}
