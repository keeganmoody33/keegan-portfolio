/**
 * lecturesfrom mark (Server Component).
 * Geometry, strokes, and layer order are a trace of the owner
 * line-only PNG (the design file does not contain this drawing).
 *
 * The only variant is `'line'`: same paths, no visible fills, every
 * stroke `currentColor`. Fill regions stay named (`LF_MARK_FILLS` /
 * `data-lf-region` / `--lf-mark-*`, default `transparent`) so a later
 * token map is a CSS-variable swap. Do not invent fill palettes until
 * the house tokens are locked.
 *
 * Stroke width 0.0181 of ring radius (source ring ~8.25px on ~455.6px
 * midline). Proportional hairline: the o fades on phones; do not
 * thicken with `vector-effect` / CSS px clamp.
 *
 * Ellipse centre is offset from the ring; rays meet 5 viewBox units
 * up-left of the ring centre. Wedges are a sector of the PNG's inner
 * circle: radii from that pivot, outer boundary a circular arc that
 * meets the outer ring at the green ray. The blue apex is the triple
 * of the upper radius, the ellipse, and that arc. The horizontal
 * radius ends on the arc.
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
 * - `variant` (default `'line'`): the only variant. Named fill regions still
 *   paint `var(--lf-mark-*)` (transparent until a token map lands).
 *
 * Unit geometry lives in a translate(256 256) scale(S) space: circle r=1,
 * ellipse rx=1 (touches the circle). Outer ink diameter is
 * `LF_MARK_OUTER_DIAMETER` of the 512 viewBox.
 */

export const LF_MARK_VIEWBOX = 512
export const LF_MARK_GEOMETRY_SCALE = 248
/** Source ring: 8.25px on 455.625px midline. */
export const LF_MARK_STROKE_WIDTH = 0.018107
export const LF_MARK_OUTER_DIAMETER =
  2 * LF_MARK_GEOMETRY_SCALE * (1 + LF_MARK_STROKE_WIDTH / 2)
export const LF_MARK_PAD = (LF_MARK_VIEWBOX - LF_MARK_OUTER_DIAMETER) / 2

/** Every stroke in the line variant. */
export const LF_MARK_STROKE_ON_EMPTY = 'currentColor'

/**
 * Named fill regions. Values live on `.house-logo-mark` in globals.css
 * (default `transparent`). A later palette assigns these vars.
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

export const LF_MARK_FILL_REGION_NAMES = [
  'ellipse',
  'wedge-up-in',
  'wedge-up-out',
  'wedge-low-in',
  'wedge-low-out',
  'angle',
  'square',
] as const

/** Ellipse centre relative to the ring centre (unit space). */
export const LF_MARK_ELLIPSE_CX = -0.016
export const LF_MARK_ELLIPSE_CY = 0
export const LF_MARK_ELLIPSE_RY = 0.4115
export const LF_MARK_ELLIPSE_ROTATE = -57.87

/** Rays meet 5 viewBox units up-left of the ring centre. */
export const LF_MARK_PIVOT_X = -5 / LF_MARK_GEOMETRY_SCALE
export const LF_MARK_PIVOT_Y = -5 / LF_MARK_GEOMETRY_SCALE

/** Flag inner point is origin-polar; stem is pivot → that point. */
export const LF_MARK_FLAG_ORIGIN_DEG = -66.9
export const LF_MARK_FLAG_INNER_R = 0.537076
export const LF_MARK_BLUE_TOP_DEG = -31.631847
export const LF_MARK_HORIZ_DEG = 0
export const LF_MARK_GREEN_DEG = 30.548655
export const LF_MARK_YELLOW_R = 0.178

/** Inner-arc circle (unit space). Green is arc ∩ unit ring. */
export const LF_MARK_ARC_CX = -0.130098
export const LF_MARK_ARC_CY = 0.304827
export const LF_MARK_ARC_R = 1.014266

export const LF_MARK_VARIANTS = ['line'] as const
export type LogoMarkVariant = (typeof LF_MARK_VARIANTS)[number]
export type LogoMarkLayer = 'all' | 'ring' | 'core'

type EllipseAttrs = {
  cx: number
  cy: number
  rx: number
  ry: number
  transform: string
}

export function parseLogoMarkVariant(
  value: string | undefined,
): LogoMarkVariant {
  if (value === 'line') return value
  return 'line'
}

export type LogoMarkProps = {
  size?: number
  className?: string
  decorative?: boolean
  layer?: LogoMarkLayer
  groupIds?: boolean
  focusable?: false
  variant?: LogoMarkVariant
}

function fmt(x: number, y: number): string {
  return `${x.toFixed(6)} ${y.toFixed(6)}`
}

function along(
  deg: number,
  r: number,
  ox = 0,
  oy = 0,
): readonly [number, number] {
  const a = (deg * Math.PI) / 180
  return [ox + r * Math.cos(a), oy + r * Math.sin(a)]
}

function fromPivot(deg: number, r: number): readonly [number, number] {
  return along(deg, r, LF_MARK_PIVOT_X, LF_MARK_PIVOT_Y)
}

const FLAG_INNER = along(LF_MARK_FLAG_ORIGIN_DEG, LF_MARK_FLAG_INNER_R)

/** Stem angle from the ray pivot, not the ring centre. */
export const LF_MARK_STEM_DEG =
  (Math.atan2(
    FLAG_INNER[1] - LF_MARK_PIVOT_Y,
    FLAG_INNER[0] - LF_MARK_PIVOT_X,
  ) *
    180) /
  Math.PI

function rayArcR(deg: number): number {
  const a = (deg * Math.PI) / 180
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  const dx = LF_MARK_PIVOT_X - LF_MARK_ARC_CX
  const dy = LF_MARK_PIVOT_Y - LF_MARK_ARC_CY
  const b = 2 * (ux * dx + uy * dy)
  const c =
    dx * dx + dy * dy - LF_MARK_ARC_R * LF_MARK_ARC_R
  const disc = b * b - 4 * c
  const t1 = (-b - Math.sqrt(disc)) / 2
  const t2 = (-b + Math.sqrt(disc)) / 2
  const ts = [t1, t2].filter((t) => t > 1e-6)
  return Math.min(...ts)
}

function piePath(fromDeg: number, toDeg: number, r: number): string {
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  const sweep = toDeg > fromDeg ? 1 : 0
  return `M ${fmt(LF_MARK_PIVOT_X, LF_MARK_PIVOT_Y)} L ${fmt(...fromPivot(fromDeg, r))} A ${r} ${r} 0 ${large} ${sweep} ${fmt(...fromPivot(toDeg, r))} Z`
}

function sectorPath(fromDeg: number, toDeg: number): string {
  const r0 = rayArcR(fromDeg)
  const r1 = rayArcR(toDeg)
  return `M ${fmt(LF_MARK_PIVOT_X, LF_MARK_PIVOT_Y)} L ${fmt(...fromPivot(fromDeg, r0))} A ${LF_MARK_ARC_R.toFixed(6)} ${LF_MARK_ARC_R.toFixed(6)} 0 0 1 ${fmt(...fromPivot(toDeg, r1))} Z`
}

const FLAG_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0.17247, -0.628917],
  [0.265228, -0.58563],
  [0.220371, -0.489508],
  [0.127613, -0.532795],
]

function flagPath(scale = 1): string {
  const cx =
    FLAG_CORNERS.reduce((s, p) => s + p[0], 0) / FLAG_CORNERS.length
  const cy =
    FLAG_CORNERS.reduce((s, p) => s + p[1], 0) / FLAG_CORNERS.length
  const pts = FLAG_CORNERS.map(
    ([x, y]) =>
      `${(cx + (x - cx) * scale).toFixed(6)} ${(cy + (y - cy) * scale).toFixed(6)}`,
  )
  return `M ${pts[0]} L ${pts[1]} L ${pts[2]} L ${pts[3]} Z`
}

const R_BLUE = rayArcR(LF_MARK_BLUE_TOP_DEG)
const R_HORIZ = rayArcR(LF_MARK_HORIZ_DEG)
const R_GREEN = rayArcR(LF_MARK_GREEN_DEG)

/** Named fill-region paths. Later palettes paint these; line leaves them transparent. */
export const LF_MARK_REGION_WEDGE_UP = sectorPath(
  LF_MARK_BLUE_TOP_DEG,
  LF_MARK_HORIZ_DEG,
)
export const LF_MARK_REGION_WEDGE_LOW = sectorPath(
  LF_MARK_HORIZ_DEG,
  LF_MARK_GREEN_DEG,
)
export const LF_MARK_REGION_ANGLE = piePath(
  LF_MARK_STEM_DEG,
  LF_MARK_BLUE_TOP_DEG,
  LF_MARK_YELLOW_R,
)
export const LF_MARK_REGION_SQUARE = flagPath(1)

const YELLOW_ARC = `M ${fmt(...fromPivot(LF_MARK_STEM_DEG, LF_MARK_YELLOW_R))} A ${LF_MARK_YELLOW_R} ${LF_MARK_YELLOW_R} 0 0 1 ${fmt(...fromPivot(LF_MARK_BLUE_TOP_DEG, LF_MARK_YELLOW_R))}`
const STEM = `M ${fmt(LF_MARK_PIVOT_X, LF_MARK_PIVOT_Y)} L ${fmt(...FLAG_INNER)}`
const RAY_BLUE = `M ${fmt(LF_MARK_PIVOT_X, LF_MARK_PIVOT_Y)} L ${fmt(...fromPivot(LF_MARK_BLUE_TOP_DEG, R_BLUE))}`
const RAY_HORIZ = `M ${fmt(LF_MARK_PIVOT_X, LF_MARK_PIVOT_Y)} L ${fmt(...fromPivot(LF_MARK_HORIZ_DEG, R_HORIZ))}`
const RAY_GREEN = `M ${fmt(LF_MARK_PIVOT_X, LF_MARK_PIVOT_Y)} L ${fmt(...fromPivot(LF_MARK_GREEN_DEG, R_GREEN))}`
const WEDGE_ARC = `M ${fmt(...fromPivot(LF_MARK_BLUE_TOP_DEG, R_BLUE))} A ${LF_MARK_ARC_R.toFixed(6)} ${LF_MARK_ARC_R.toFixed(6)} 0 0 1 ${fmt(...fromPivot(LF_MARK_GREEN_DEG, R_GREEN))}`

function Ring({ grouped }: { grouped: boolean }) {
  return (
    <g id={grouped ? 'lf-ring' : undefined} stroke={LF_MARK_STROKE_ON_EMPTY}>
      <circle r="1" fill="none" />
    </g>
  )
}

function CoreStrokes({ ell }: { ell: EllipseAttrs }) {
  return (
    <>
      <ellipse {...ell} fill="none" />
      <path d={STEM} fill="none" />
      <path d={RAY_BLUE} fill="none" />
      <path d={RAY_HORIZ} fill="none" />
      <path d={RAY_GREEN} fill="none" />
      <path d={WEDGE_ARC} fill="none" />
      <path d={YELLOW_ARC} fill="none" />
      <path d={LF_MARK_REGION_SQUARE} fill="none" />
    </>
  )
}

function FillRegions({
  ids,
  ell,
}: {
  ids: Record<string, string>
  ell: EllipseAttrs
}) {
  const fill = LF_MARK_FILLS
  return (
    <g stroke="none">
      <ellipse
        {...ell}
        fill={fill.ellipse}
        stroke="none"
        data-lf-region="ellipse"
      />
      <g clipPath={`url(#${ids.green})`} data-lf-region="wedge-low-in">
        <ellipse {...ell} fill={fill.wedgeLowIn} stroke="none" />
      </g>
      <path
        d={LF_MARK_REGION_WEDGE_LOW}
        fill={fill.wedgeLowOut}
        stroke="none"
        mask={`url(#${ids.out})`}
        data-lf-region="wedge-low-out"
      />
      <g clipPath={`url(#${ids.ell})`} data-lf-region="wedge-up-in">
        <path d={LF_MARK_REGION_WEDGE_UP} fill={fill.wedgeUpIn} stroke="none" />
      </g>
      <path
        d={LF_MARK_REGION_WEDGE_UP}
        fill={fill.wedgeUpOut}
        stroke="none"
        mask={`url(#${ids.out})`}
        data-lf-region="wedge-up-out"
      />
      <path
        d={LF_MARK_REGION_ANGLE}
        fill={fill.angle}
        stroke="none"
        data-lf-region="angle"
      />
      <path
        d={LF_MARK_REGION_SQUARE}
        fill={fill.square}
        stroke="none"
        data-lf-region="square"
      />
    </g>
  )
}

function Core({
  grouped,
  ids,
}: {
  grouped: boolean
  ids: Record<string, string>
}) {
  const ell: EllipseAttrs = {
    cx: LF_MARK_ELLIPSE_CX,
    cy: LF_MARK_ELLIPSE_CY,
    rx: 1,
    ry: LF_MARK_ELLIPSE_RY,
    transform: `rotate(${LF_MARK_ELLIPSE_ROTATE} ${LF_MARK_ELLIPSE_CX} ${LF_MARK_ELLIPSE_CY})`,
  }

  return (
    <g id={grouped ? 'lf-core' : undefined} stroke={LF_MARK_STROKE_ON_EMPTY}>
      <defs>
        <clipPath id={ids.ell} clipPathUnits="userSpaceOnUse">
          <ellipse {...ell} />
        </clipPath>
        <clipPath id={ids.green} clipPathUnits="userSpaceOnUse">
          <path d={LF_MARK_REGION_WEDGE_LOW} />
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
      <FillRegions ids={ids} ell={ell} />
      <CoreStrokes ell={ell} />
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
  variant = 'line',
}: LogoMarkProps) {
  const named = !decorative
  const showRing = layer !== 'core'
  const showCore = layer === 'all' || layer === 'core'
  const prefix = `${groupIds ? 'lf' : 'lf-wm'}-${variant}`
  const ids = {
    ell: `${prefix}-ell-clip`,
    green: `${prefix}-green-clip`,
    out: `${prefix}-out-mask`,
  }

  return (
    <span
      className={['house-logo-mark', className].filter(Boolean).join(' ')}
      data-lf-variant={variant}
    >
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
