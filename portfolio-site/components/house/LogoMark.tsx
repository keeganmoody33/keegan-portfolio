/**
 * lecturesfrom filled mark (Server Component). Source of truth is the
 * owner reference: outer circle, tilted ellipse, stem + flag, yellow
 * pie, blue wedge, lavender annulus, green wedge (darker overlap as
 * its own flat fill). Outlines are `currentColor` (house ink `#ececec`
 * on `/`). Fills are `var(--lf-mark-*)` on `.house-logo-mark`. Hexes
 * there are PLACEHOLDER pending design-file values. White in the
 * source is transparent — no disc behind the ring. Favicon / og stay
 * the older line-mark and now mismatch; follow-up needed.
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
 * ellipse rx=1 (touches the circle) ry=0.43 rotate(-60). Stroke 0.013 is
 * the reference image's ~4px stroke on a ~310px radius. Outer ink diameter
 * is `LF_MARK_OUTER_DIAMETER` of the 512 viewBox.
 */

export const LF_MARK_VIEWBOX = 512
export const LF_MARK_GEOMETRY_SCALE = 248
export const LF_MARK_STROKE_WIDTH = 0.013
export const LF_MARK_OUTER_DIAMETER =
  2 * LF_MARK_GEOMETRY_SCALE * (1 + LF_MARK_STROKE_WIDTH / 2)
export const LF_MARK_PAD = (LF_MARK_VIEWBOX - LF_MARK_OUTER_DIAMETER) / 2

/**
 * Fill tokens only. Hex placeholders live on `.house-logo-mark` in
 * globals.css (PLACEHOLDER pending design-file values). Do not put
 * hex here — swap the CSS custom properties.
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

export const LF_MARK_ELLIPSE_RY = 0.43
export const LF_MARK_ELLIPSE_ROTATE = -60
export const LF_MARK_STEM_DEG = -65
export const LF_MARK_BLUE_TOP_DEG = -30
export const LF_MARK_HORIZ_DEG = 0
export const LF_MARK_GREEN_DEG = 31
export const LF_MARK_YELLOW_R = 0.16

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

function piePath(fromDeg: number, toDeg: number, r = 1): string {
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  const sweep = toDeg > fromDeg ? 1 : 0
  return `M 0 0 L ${polar(fromDeg, r)} A ${r} ${r} 0 ${large} ${sweep} ${polar(toDeg, r)} Z`
}

const BLUE_PIE = piePath(LF_MARK_BLUE_TOP_DEG, LF_MARK_HORIZ_DEG)
const GREEN_PIE = piePath(LF_MARK_HORIZ_DEG, LF_MARK_GREEN_DEG)
const YELLOW_PIE = piePath(LF_MARK_STEM_DEG, LF_MARK_BLUE_TOP_DEG, LF_MARK_YELLOW_R)
const YELLOW_ARC = `M ${polar(LF_MARK_STEM_DEG, LF_MARK_YELLOW_R)} A ${LF_MARK_YELLOW_R} ${LF_MARK_YELLOW_R} 0 0 1 ${polar(LF_MARK_BLUE_TOP_DEG, LF_MARK_YELLOW_R)}`
const FLAG =
  'M 0.197285 -0.587803 L 0.275803 -0.552715 L 0.240715 -0.474197 L 0.162197 -0.509285 Z'
const STEM = `M 0 0 L 0.237000 -0.482000`
const RAY_BLUE = `M 0 0 L ${polar(LF_MARK_BLUE_TOP_DEG)}`
const RAY_HORIZ = `M 0 0 L ${polar(LF_MARK_HORIZ_DEG)}`
const RAY_GREEN = `M 0 0 L ${polar(LF_MARK_GREEN_DEG)}`

function Ring({ grouped }: { grouped: boolean }) {
  return (
    <g id={grouped ? 'lf-ring' : undefined}>
      <circle r="1" fill="none" />
    </g>
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

      <ellipse {...ell} fill="none" />
      <path d={STEM} fill="none" />
      <path d={RAY_BLUE} fill="none" />
      <path d={RAY_HORIZ} fill="none" />
      <path d={RAY_GREEN} fill="none" />
      <path d={YELLOW_ARC} fill="none" />
      <path d={FLAG} fill="none" />
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
          stroke="currentColor"
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
