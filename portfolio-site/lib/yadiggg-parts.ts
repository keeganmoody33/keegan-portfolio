import type { ControlCandidate } from './yadiggg-viewer'

export type YadigggPartKind = 'physical' | 'surface' | 'construction'

export type YadigggPart = {
  name: string
  kind: YadigggPartKind
  note: string
  explodeMm: number
}

export const YADIGGG_PARTS: readonly YadigggPart[] = [
  { name: 'shell_front', kind: 'physical', note: 'Hollow shell, provisional 1.5mm wall; no bosses, draft or seal', explodeMm: 30 },
  { name: 'shell_rear', kind: 'physical', note: '0.2mm study split; not a validated closure', explodeMm: -35 },
  { name: 'display_window', kind: 'physical', note: 'Provisional flat protective window', explodeMm: 25 },
  { name: 'display_support', kind: 'physical', note: 'Support reservation; attachment and gasket TBD', explodeMm: 20 },
  { name: 'display_module', kind: 'physical', note: 'Sharp LS027B7DH01 catalog envelope; FPC and maximum-tolerance drawing not modeled', explodeMm: 15 },
  { name: 'display_active', kind: 'surface', note: '400x240 simulated interface; 0.02mm visualization layer', explodeMm: 15 },
  { name: 'pcb_allocation', kind: 'physical', note: 'New allocation only; no matching placed/routed PCB exists', explodeMm: 0 },
  { name: 'underside_population', kind: 'physical', note: 'Maximum component allocation, not part count', explodeMm: -5 },
  { name: 'compute_shield_allocation', kind: 'physical', note: 'Simplified shielding/compute volume, thermal path unvalidated', explodeMm: 5 },
  { name: 'battery', kind: 'physical', note: 'Retained V1 placeholder envelope; not a verified 1500mAh pack', explodeMm: -20 },
  { name: 'haptic_reservation', kind: 'physical', note: '10mm actuator reservation, actual part TBD', explodeMm: -15 },
  { name: 'camera_reservation', kind: 'physical', note: 'Reservation, not AR1335 module drawing or optical proof', explodeMm: -12 },
  { name: 'usb_reservation', kind: 'physical', note: 'Reserved volume only; not verified Molex mating geometry', explodeMm: 0 },
  { name: 'jack_reservation', kind: 'physical', note: 'Candidate SJ-3523-SMT-TR body envelope; contact/mating strain space not validated', explodeMm: 0 },
  { name: 'camera_light_tube', kind: 'physical', note: 'Light path concept only', explodeMm: -20 },
  { name: 'camera_lens', kind: 'physical', note: 'Illustrative optical surface, no prescription', explodeMm: -12 },
  { name: 'mic_allocation_18', kind: 'physical', note: 'Two mic zones and separate ports; acoustic channels/gaskets missing', explodeMm: -8 },
  { name: 'mic_allocation_6', kind: 'physical', note: 'Two mic zones and separate ports; acoustic channels/gaskets missing', explodeMm: -8 },
  { name: 'control_mechanism', kind: 'physical', note: 'Reservation only, compatible with PCB notch', explodeMm: 0 },
  { name: 'control_down', kind: 'physical', note: 'one orange side button — Candidate A rocker on a single side opening', explodeMm: 0 },
  { name: 'control_select', kind: 'physical', note: 'one orange side button — Candidate A rocker on a single side opening', explodeMm: 0 },
  { name: 'control_up', kind: 'physical', note: 'one orange side button — Candidate A rocker on a single side opening', explodeMm: 0 },
  { name: 'rf_reservation', kind: 'construction', note: 'Construction reservation only; antenna copper, ground and hand-loading rules TBD', explodeMm: 0 },
  { name: 'display_flex_reservation', kind: 'construction', note: 'Unrouted FPC allowance; exact connector/bend radius TBD', explodeMm: 0 },
  { name: 'battery_service_reservation', kind: 'construction', note: 'Cable/connector allocation; battery swelling is a separate requirement', explodeMm: 0 },
]

/** Candidate B occupies the same reserved opening. CAD layout comparison only — not a capture demo. */
export const YADIGGG_CANDIDATE_B_PARTS: readonly YadigggPart[] = [
  { name: 'control_capture', kind: 'physical', note: 'one orange side button — Candidate B capture on the same reserved opening', explodeMm: 0 },
  { name: 'control_down', kind: 'physical', note: 'one orange side button — Candidate B navigation on the same reserved opening', explodeMm: 0 },
  { name: 'control_select', kind: 'physical', note: 'one orange side button — Candidate B navigation on the same reserved opening', explodeMm: 0 },
  { name: 'control_up', kind: 'physical', note: 'one orange side button — Candidate B navigation on the same reserved opening', explodeMm: 0 },
]

const CONTROL_A_NAMES = new Set(['control_up', 'control_select', 'control_down'])

export function isCandidateAControl(name: string): boolean {
  return CONTROL_A_NAMES.has(name)
}

export function isCandidateBControl(name: string): boolean {
  return YADIGGG_CANDIDATE_B_PARTS.some((part) => part.name === name)
}

export function partByName(name: string, candidate: ControlCandidate = 'A'): YadigggPart | undefined {
  if (candidate === 'B') {
    const fromB = YADIGGG_CANDIDATE_B_PARTS.find((part) => part.name === name)
    if (fromB) return fromB
  }
  return YADIGGG_PARTS.find((part) => part.name === name)
}
