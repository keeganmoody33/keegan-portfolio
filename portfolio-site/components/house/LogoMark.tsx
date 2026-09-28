/**
 * lecturesfrom mark (Server Component).
 * Geometry, strokes, and layer order are a trace of the owner
 * line-only PNG (the design file does not contain this drawing).
 *
 * `variant` (wordmark default `'line'`):
 * - `line` — same paths, no fills, every stroke `currentColor`.
 * - `pastel` — locked morning pastels, labelled as drawn / off-palette
 *   (reference only). House palette fills are on hold.
 *
 * Fill regions stay named (`LF_MARK_FILLS` / `data-lf-region`) so a
 * later palette is a CSS-variable swap. Do not invent house-token
 * fill variants until the palette is locked.
 *
 * Stroke width 0.0181 of ring radius (source ring ~8.25px on ~455.6px
 * midline). Pastel: any fill is `--house-bg`; empty / ring
 * `currentColor`. Paths that cross a fill edge are split (clipPaths
 * against the fill union). One pass per segment — no halo, doubled
 * outline, or glow.
 *
 * Wedges are a sector of the PNG's inner circle: radii from the
 * pivot, outer boundary a circular arc that meets the outer ring at
 * the green ray. The blue apex is the triple of the upper radius,
 * the ellipse, and that arc. The horizontal radius ends on the arc.
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
 * - `variant` (default `'line'`): see above. Fills are CSS custom properties
 *   on `.house-logo-mark[data-lf-variant]`.
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

/** On pastel fills. Later palettes swap the CSS vars, not this token. */
export const LF_MARK_STROKE_ON_FILL = 'var(--house-bg, #0a0a0a)'
/** Over empty and the outer ring. */
export const LF_MARK_STROKE_ON_EMPTY = 'currentColor'

/**
 * Named fill regions. Values live on `.house-logo-mark[data-lf-variant]`
 * in globals.css. A later palette is a new `[data-lf-variant]` block.
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

export const LF_MARK_ELLIPSE_RY = 0.424
export const LF_MARK_ELLIPSE_ROTATE = -57
export const LF_MARK_STEM_DEG = -66.9
export const LF_MARK_BLUE_TOP_DEG = -30.75
export const LF_MARK_HORIZ_DEG = 0
export const LF_MARK_GREEN_DEG = 30.14
export const LF_MARK_YELLOW_R = 0.178
export const LF_MARK_FLAG_INNER_R = 0.537076

/** Inner-arc circle (unit space). Green is arc ∩ unit ring. */
export const LF_MARK_ARC_CX = -0.130098
export const LF_MARK_ARC_CY = 0.304827
export const LF_MARK_ARC_R = 1.014266

export const LF_MARK_VARIANTS = ['line', 'pastel'] as const
export type LogoMarkVariant = (typeof LF_MARK_VARIANTS)[number]
export type LogoMarkLayer = 'all' | 'ring' | 'core'

export function parseLogoMarkVariant(
  value: string | undefined,
): LogoMarkVariant {
  if (value === 'line' || value === 'pastel') return value
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

/** Named fill-region paths. Later palettes paint these; line does not. */
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

const YELLOW_ARC = `M ${polar(LF_MARK_STEM_DEG, LF_MARK_YELLOW_R)} A ${LF_MARK_YELLOW_R} ${LF_MARK_YELLOW_R} 0 0 1 ${polar(LF_MARK_BLUE_TOP_DEG, LF_MARK_YELLOW_R)}`
const STEM = `M 0 0 L ${polar(LF_MARK_STEM_DEG, LF_MARK_FLAG_INNER_R)}`
const RAY_BLUE = `M 0 0 L ${polar(LF_MARK_BLUE_TOP_DEG, R_BLUE)}`
const RAY_HORIZ = `M 0 0 L ${polar(LF_MARK_HORIZ_DEG, R_HORIZ)}`
const RAY_GREEN = `M 0 0 L ${polar(LF_MARK_GREEN_DEG, R_GREEN)}`
const WEDGE_ARC = `M ${polar(LF_MARK_BLUE_TOP_DEG, R_BLUE)} A ${LF_MARK_ARC_R.toFixed(6)} ${LF_MARK_ARC_R.toFixed(6)} 0 0 1 ${polar(LF_MARK_GREEN_DEG, R_GREEN)}`

/** Pastel: world minus padded ellipse + both full sectors. */
const PASTEL_ON_EMPTY = `M -2.5 -2.5 H 2.5 V 2.5 H -2.5 Z ${ellipseHolePath(STROKE_CLIP_PAD)} ${sectorHole(LF_MARK_BLUE_TOP_DEG, LF_MARK_HORIZ_DEG, STROKE_CLIP_PAD)} ${sectorHole(LF_MARK_HORIZ_DEG, LF_MARK_GREEN_DEG, STROKE_CLIP_PAD)}`

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
      <path d={LF_MARK_REGION_SQUARE} fill="none" />
    </>
  )
}

function FillRegions({
  ids,
  ell,
}: {
  ids: Record<string, string>
  ell: { rx: number; ry: number; transform: string }
}) {
  const fill = LF_MARK_FILLS
  return (
    <g stroke="none">
      <ellipse
        {...ell}
        fill={fill.ellipse}
        data-lf-region="ellipse"
      />
      <g clipPath={`url(#${ids.green})`} data-lf-region="wedge-low-in">
        <ellipse {...ell} fill={fill.wedgeLowIn} />
      </g>
      <path
        d={LF_MARK_REGION_WEDGE_LOW}
        fill={fill.wedgeLowOut}
        mask={`url(#${ids.out})`}
        data-lf-region="wedge-low-out"
      />
      <g clipPath={`url(#${ids.ell})`} data-lf-region="wedge-up-in">
        <path d={LF_MARK_REGION_WEDGE_UP} fill={fill.wedgeUpIn} />
      </g>
      <path
        d={LF_MARK_REGION_WEDGE_UP}
        fill={fill.wedgeUpOut}
        mask={`url(#${ids.out})`}
        data-lf-region="wedge-up-out"
      />
      <path
        d={LF_MARK_REGION_ANGLE}
        fill={fill.angle}
        data-lf-region="angle"
      />
      <path
        d={LF_MARK_REGION_SQUARE}
        fill={fill.square}
        data-lf-region="square"
      />
    </g>
  )
}

function Core({
  grouped,
  ids,
  variant,
}: {
  grouped: boolean
  ids: Record<string, string>
  variant: LogoMarkVariant
}) {
  const ell = {
    rx: 1,
    ry: LF_MARK_ELLIPSE_RY,
    transform: `rotate(${LF_MARK_ELLIPSE_ROTATE})`,
  }

  if (variant === 'line') {
    return (
      <g id={grouped ? 'lf-core' : undefined} stroke={LF_MARK_STROKE_ON_EMPTY}>
        <CoreStrokes ell={ell} />
      </g>
    )
  }

  return (
    <g id={grouped ? 'lf-core' : undefined}>
      <defs>
        <clipPath id={ids.ell} clipPathUnits="userSpaceOnUse">
          <ellipse {...ell} />
        </clipPath>
        <clipPath id={ids.green} clipPathUnits="userSpaceOnUse">
          <path d={LF_MARK_REGION_WEDGE_LOW} />
        </clipPath>
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
          <path d={PASTEL_ON_EMPTY} fillRule="evenodd" clipRule="evenodd" />
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
    onFill: `${prefix}-on-fill`,
    onEmpty: `${prefix}-on-empty`,
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
          {showCore ? (
            <Core grouped={groupIds} ids={ids} variant={variant} />
          ) : null}
          {showRing ? <Ring grouped={groupIds} /> : null}
        </g>
      </svg>
    </span>
  )
}
