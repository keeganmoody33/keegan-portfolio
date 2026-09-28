/**
 * lecturesfrom filled mark (Server Component).
 * Geometry, strokes, and layer order are a trace of the owner PNG
 * (the design file does not contain this drawing). Fills are the
 * locked `--lf-mark-*` tokens on `.house-logo-mark`; the flag uses
 * `var(--house-orange)`. White in the PNG is transparent — no disc
 * behind the ring.
 *
 * Outline rule (creative direction): a stroke segment on a filled
 * region is `var(--house-bg)` (black as drawn). A stroke segment over
 * the page or the transparent ring interior is `currentColor` (ink).
 * The outer ring is ink. Paths that cross the fill edge are split
 * (clipPaths against the fill union, or split path data) so each
 * piece follows the rule. One pass per segment — no halo, doubled
 * outline, or glow. Stroke width stays 0.013.
 *
 * Wedges are a sector of the PNG's inner circle: radii from the
 * pivot, outer boundary a circular arc (its own stroke) that meets
 * the outer ring at the green ray. The blue apex is the triple of
 * the upper radius, the ellipse, and that arc. The horizontal radius
 * ends on the arc.
 *
 * Prop API
 * - `size` (default 32): reserved square in px. Width/height + `.house-logo-mark`
 *   (`aspect-ratio: 1`) so the box exists before the SVG paints (CLS 0).
 * - `className`: extra classes on the sizing wrapper (a `span`, so the
 *   wordmark instance stays phrasing content inside the `h1`).
 * - `decorative` (default true): `aria-hidden` when the visible wordmark already
 *   names the brand. Pass `false` for a standalone mark (`<title>` lecturesfrom
 *   via `aria-labelledby`). Never both next to the `h1`.
 * - `layer` (default `'all'`): `'all'` keeps `#lf-ring` and `#lf-core` in one
 *   SVG. `'ring'` / `'core'` render that group only, so a wrapper can stack two
 *   same-size layers without duplicate ids.
 * - `groupIds` (default true): set false when a second mark shares the page
 *   (wordmark o) so `#lf-ring` / `#lf-core` and clip/mask ids stay unique if
 *   LogoGlobe is remounted.
 * - `focusable` (default omit): pass `false` for the wordmark o so the SVG is
 *   not a tab stop. Decorative instances also set `aria-hidden` on the svg.
 *
 * Unit geometry lives in a translate(256 256) scale(S) space: circle r=1,
 * ellipse rx=1 (touches the circle). Stroke 0.013 is the PNG ring
 * (~4px on ~310px midline radius). Outer ink diameter is
 * `LF_MARK_OUTER_DIAMETER` of the 512 viewBox.
 */

export const LF_MARK_VIEWBOX = 512
export const LF_MARK_GEOMETRY_SCALE = 248
export const LF_MARK_STROKE_WIDTH = 0.013
export const LF_MARK_OUTER_DIAMETER =
  2 * LF_MARK_GEOMETRY_SCALE * (1 + LF_MARK_STROKE_WIDTH / 2)
export const LF_MARK_PAD = (LF_MARK_VIEWBOX - LF_MARK_OUTER_DIAMETER) / 2

/** On-fill outlines. Page token so light house keeps the same rule. */
export const LF_MARK_STROKE_ON_FILL = 'var(--house-bg, #0a0a0a)'
/** Over empty / the outer ring. House ink via currentColor. */
export const LF_MARK_STROKE_ON_EMPTY = 'currentColor'

/**
 * Fill tokens only. Locked values live on `.house-logo-mark` in
 * globals.css. Do not put hex here — swap the CSS custom properties.
 * The flag is `var(--house-orange)`, not a literal.
 */
export const LF_MARK_FILLS = {
  ellipse: 'var(--lf-mark-ellipse)',
  wedgeUpIn: 'var(--lf-mark-wedge-up-in)',
  wedgeUpOut: 'var(--lf-mark-wedge-up-out)',
  wedgeLowIn: 'var(--lf-mark-wedge-low-in)',
  wedgeLowOut: 'var(--lf-mark-wedge-low-out)',
  angle: 'var(--lf-mark-angle)',
  square: 'var(--lf-mark-square)',
} as const

export const LF_MARK_ELLIPSE_RY = 0.44
export const LF_MARK_ELLIPSE_ROTATE = -56.75
export const LF_MARK_STEM_DEG = -66.8
export const LF_MARK_BLUE_TOP_DEG = -28.7
export const LF_MARK_HORIZ_DEG = 0
export const LF_MARK_GREEN_DEG = 31.5
export const LF_MARK_YELLOW_R = 0.172
export const LF_MARK_FLAG_INNER_R = 0.562

/** Inner-arc circle (unit space). Through the blue/ellipse triple, the +x hit, and the ring at green. */
export const LF_MARK_ARC_CX = 0.0365480293
export const LF_MARK_ARC_CY = 0.2666294124
export const LF_MARK_ARC_R = 0.8552633489

export type LogoMarkLayer = 'all' | 'ring' | 'core'

export type LogoMarkProps = {
  size?: number
  className?: string
  decorative?: boolean
  layer?: LogoMarkLayer
  groupIds?: boolean
  focusable?: false
}

function polar(deg: number, r = 1): string {
  const a = (deg * Math.PI) / 180
  return `${(r * Math.cos(a)).toFixed(6)} ${(r * Math.sin(a)).toFixed(6)}`
}

function rayArcR(deg: number): number {
  const a = (deg * Math.PI) / 180
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  const b = -2 * (ux * LF_MARK_ARC_CX + uy * LF_MARK_ARC_CY)
  const c =
    LF_MARK_ARC_CX * LF_MARK_ARC_CX +
    LF_MARK_ARC_CY * LF_MARK_ARC_CY -
    LF_MARK_ARC_R * LF_MARK_ARC_R
  const disc = b * b - 4 * c
  const t1 = (-b - Math.sqrt(disc)) / 2
  const t2 = (-b + Math.sqrt(disc)) / 2
  const ts = [t1, t2].filter((t) => t > 1e-6)
  return Math.min(...ts)
}

function piePath(fromDeg: number, toDeg: number, r: number): string {
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  const sweep = toDeg > fromDeg ? 1 : 0
  return `M 0 0 L ${polar(fromDeg, r)} A ${r} ${r} 0 ${large} ${sweep} ${polar(toDeg, r)} Z`
}

function sectorPath(fromDeg: number, toDeg: number): string {
  const r0 = rayArcR(fromDeg)
  const r1 = rayArcR(toDeg)
  return `M 0 0 L ${polar(fromDeg, r0)} A ${LF_MARK_ARC_R.toFixed(6)} ${LF_MARK_ARC_R.toFixed(6)} 0 0 1 ${polar(toDeg, r1)} Z`
}

/** Pad the fill-union clip by a full stroke so round caps stay "on fill". */
const STROKE_CLIP_PAD = 1 + LF_MARK_STROKE_WIDTH

/** Rotated ellipse as a closed path (holes in evenodd clipPaths). */
function ellipseHolePath(scale: number): string {
  const rx = scale
  const ry = LF_MARK_ELLIPSE_RY * scale
  const rot = LF_MARK_ELLIPSE_ROTATE
  const p0 = polar(rot, rx)
  const p1 = polar(rot + 180, rx)
  return `M ${p0} A ${rx} ${ry} ${rot} 1 1 ${p1} A ${rx} ${ry} ${rot} 1 1 ${p0}`
}

function sectorHole(fromDeg: number, toDeg: number, scale: number): string {
  const r0 = rayArcR(fromDeg) * scale
  const r1 = rayArcR(toDeg) * scale
  const ar = LF_MARK_ARC_R * scale
  return `M 0 0 L ${polar(fromDeg, r0)} A ${ar} ${ar} 0 0 1 ${polar(toDeg, r1)} Z`
}

const R_BLUE = rayArcR(LF_MARK_BLUE_TOP_DEG)
const R_HORIZ = rayArcR(LF_MARK_HORIZ_DEG)
const R_GREEN = rayArcR(LF_MARK_GREEN_DEG)

const BLUE_PIE = sectorPath(LF_MARK_BLUE_TOP_DEG, LF_MARK_HORIZ_DEG)
const GREEN_PIE = sectorPath(LF_MARK_HORIZ_DEG, LF_MARK_GREEN_DEG)
const YELLOW_PIE = piePath(LF_MARK_STEM_DEG, LF_MARK_BLUE_TOP_DEG, LF_MARK_YELLOW_R)
const YELLOW_ARC = `M ${polar(LF_MARK_STEM_DEG, LF_MARK_YELLOW_R)} A ${LF_MARK_YELLOW_R} ${LF_MARK_YELLOW_R} 0 0 1 ${polar(LF_MARK_BLUE_TOP_DEG, LF_MARK_YELLOW_R)}`
const FLAG =
  'M 0.161861 -0.542136 L 0.187180 -0.601242 L 0.250948 -0.573925 L 0.225628 -0.514819 Z'
const STEM = `M 0 0 L ${polar(LF_MARK_STEM_DEG, LF_MARK_FLAG_INNER_R)}`
const RAY_BLUE = `M 0 0 L ${polar(LF_MARK_BLUE_TOP_DEG, R_BLUE)}`
const RAY_HORIZ = `M 0 0 L ${polar(LF_MARK_HORIZ_DEG, R_HORIZ)}`
const RAY_GREEN = `M 0 0 L ${polar(LF_MARK_GREEN_DEG, R_GREEN)}`
const WEDGE_ARC = `M ${polar(LF_MARK_BLUE_TOP_DEG, R_BLUE)} A ${LF_MARK_ARC_R.toFixed(6)} ${LF_MARK_ARC_R.toFixed(6)} 0 0 1 ${polar(LF_MARK_GREEN_DEG, R_GREEN)}`
/** Evenodd: world minus the padded fill union. Complements `onFill`. */
const ON_EMPTY_CLIP = `M -2.5 -2.5 H 2.5 V 2.5 H -2.5 Z ${ellipseHolePath(STROKE_CLIP_PAD)} ${sectorHole(LF_MARK_BLUE_TOP_DEG, LF_MARK_HORIZ_DEG, STROKE_CLIP_PAD)} ${sectorHole(LF_MARK_HORIZ_DEG, LF_MARK_GREEN_DEG, STROKE_CLIP_PAD)}`

function Ring({ grouped }: { grouped: boolean }) {
  return (
    <g id={grouped ? 'lf-ring' : undefined} stroke={LF_MARK_STROKE_ON_EMPTY}>
      <circle r="1" fill="none" />
    </g>
  )
}

function CoreStrokes({
  ell,
}: {
  ell: { rx: number; ry: number; transform: string }
}) {
  return (
    <>
      <ellipse {...ell} fill="none" />
      <path d={STEM} fill="none" />
      <path d={RAY_BLUE} fill="none" />
      <path d={RAY_HORIZ} fill="none" />
      <path d={RAY_GREEN} fill="none" />
      <path d={WEDGE_ARC} fill="none" />
      <path d={YELLOW_ARC} fill="none" />
      <path d={FLAG} fill="none" />
    </>
  )
}

function Core({ grouped, ids }: { grouped: boolean; ids: Record<string, string> }) {
  const fills = LF_MARK_FILLS
  const ell = {
    rx: 1,
    ry: LF_MARK_ELLIPSE_RY,
    transform: `rotate(${LF_MARK_ELLIPSE_ROTATE})`,
  }

  return (
    <g id={grouped ? 'lf-core' : undefined}>
      <defs>
        <clipPath id={ids.ell} clipPathUnits="userSpaceOnUse">
          <ellipse {...ell} />
        </clipPath>
        <clipPath id={ids.green} clipPathUnits="userSpaceOnUse">
          <path d={GREEN_PIE} />
        </clipPath>
        {/*
          Padded fill union and its complement. Core strokes are drawn
          twice: --house-bg clipped to onFill, ink clipped to onEmpty.
          The pad is one stroke so a fill-boundary path keeps full width
          (a centerline split would halo). Clips do not overlap. Ring is
          always ink, not in this pair.
        */}
        <clipPath id={ids.onFill} clipPathUnits="userSpaceOnUse">
          <ellipse
            rx={STROKE_CLIP_PAD}
            ry={LF_MARK_ELLIPSE_RY * STROKE_CLIP_PAD}
            transform={`rotate(${LF_MARK_ELLIPSE_ROTATE})`}
          />
          <path
            d={sectorHole(
              LF_MARK_BLUE_TOP_DEG,
              LF_MARK_HORIZ_DEG,
              STROKE_CLIP_PAD,
            )}
          />
          <path
            d={sectorHole(
              LF_MARK_HORIZ_DEG,
              LF_MARK_GREEN_DEG,
              STROKE_CLIP_PAD,
            )}
          />
        </clipPath>
        <clipPath id={ids.onEmpty} clipPathUnits="userSpaceOnUse">
          <path d={ON_EMPTY_CLIP} fillRule="evenodd" clipRule="evenodd" />
        </clipPath>
        <mask
          id={ids.out}
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
        >
          <rect x="-1.2" y="-1.2" width="2.4" height="2.4" fill="#fff" />
          <ellipse {...ell} fill="#000" />
        </mask>
      </defs>

      <g stroke="none">
        <ellipse {...ell} fill={fills.ellipse} />
        <g clipPath={`url(#${ids.green})`}>
          <ellipse {...ell} fill={fills.wedgeLowIn} />
        </g>
        <path d={GREEN_PIE} fill={fills.wedgeLowOut} mask={`url(#${ids.out})`} />
        <g clipPath={`url(#${ids.ell})`}>
          <path d={BLUE_PIE} fill={fills.wedgeUpIn} />
        </g>
        <path d={BLUE_PIE} fill={fills.wedgeUpOut} mask={`url(#${ids.out})`} />
        <path d={YELLOW_PIE} fill={fills.angle} />
        <path d={FLAG} fill={fills.square} />
      </g>

      <g stroke={LF_MARK_STROKE_ON_FILL} clipPath={`url(#${ids.onFill})`}>
        <CoreStrokes ell={ell} />
      </g>
      <g stroke={LF_MARK_STROKE_ON_EMPTY} clipPath={`url(#${ids.onEmpty})`}>
        <CoreStrokes ell={ell} />
      </g>
    </g>
  )
}

export default function LogoMark({
  size = 32,
  className,
  decorative = true,
  layer = 'all',
  groupIds = true,
  focusable,
}: LogoMarkProps) {
  const named = !decorative
  const showRing = layer !== 'core'
  const showCore = layer === 'all' || layer === 'core'
  const prefix = groupIds ? 'lf' : 'lf-wm'
  const ids = {
    ell: `${prefix}-ell-clip`,
    green: `${prefix}-green-clip`,
    out: `${prefix}-out-mask`,
    onFill: `${prefix}-on-fill`,
    onEmpty: `${prefix}-on-empty`,
  }

  return (
    <span className={['house-logo-mark', className].filter(Boolean).join(' ')}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${LF_MARK_VIEWBOX} ${LF_MARK_VIEWBOX}`}
        width={size}
        height={size}
        fill="none"
        overflow="visible"
        role={named ? 'img' : undefined}
        aria-labelledby={named ? 'lf-mark-title' : undefined}
        aria-hidden={decorative ? true : undefined}
        focusable={focusable === false ? 'false' : undefined}
      >
        {named ? <title id="lf-mark-title">lecturesfrom</title> : null}
        <g
          transform={`translate(256 256) scale(${LF_MARK_GEOMETRY_SCALE})`}
          strokeWidth={LF_MARK_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {showCore ? <Core grouped={groupIds} ids={ids} /> : null}
          {showRing ? <Ring grouped={groupIds} /> : null}
        </g>
      </svg>
    </span>
  )
}
