/**
 * lecturesfrom line-mark (Server Component).
 *
 * Prop API
 * - `size` (default 32): reserved square in px. Width/height + `.house-logo-mark`
 *   (`aspect-ratio: 1`) so the box exists before the SVG paints (CLS 0).
 * - `className`: extra classes on the sizing wrapper (Motion can stack two
 *   instances with `absolute inset-0`).
 * - `decorative` (default true): `aria-hidden` when the visible wordmark already
 *   names the brand. Pass `false` for a standalone mark (`<title>` lecturesfrom
 *   via `aria-labelledby`). Never both next to the `h1`.
 * - `layer` (default `'all'`): `'all'` keeps `#lf-ring` and `#lf-core` in one
 *   SVG. `'ring'` / `'core'` render that group only, so a wrapper can stack two
 *   same-size layers without duplicate ids. `'wordmark'` is ring + orbit
 *   ellipse only (no inner detail), sharing one stroke, for the in-word o.
 * - `groupIds` (default true): set false when a second mark shares the page
 *   (wordmark o) so `#lf-ring` / `#lf-core` stay unique on the title-card globe.
 *   Wordmark clip/mask ids still use `useId()` so they cannot collide.
 * - `focusable` (default omit): pass `false` for the wordmark o so the SVG is
 *   not a tab stop. The title-card globe omits this; it stays as before.
 * - `strokeWidth` / `geometryScale` (default canonical 0.0625 / 224): the
 *   wordmark o passes the stem-ratio pair so ring and orbit share one stroke
 *   and extra width grows inward. Title-card / favicon / og keep defaults.
 *
 * Strokes are `currentColor` so the mark inherits house ink on `/` (and any
 * future parent color). Favicons cannot use currentColor — see `app/icon.svg`.
 */

import { useId } from 'react'

/** Canonical geometry (title-card globe, favicon, og). Do not change for the wordmark o. */
export const LF_MARK_GEOMETRY_SCALE = 224
export const LF_MARK_STROKE_WIDTH = 0.0625
const LF_MARK_VIEWBOX = 512
const LF_MARK_OUTER =
  LF_MARK_GEOMETRY_SCALE * (1 + LF_MARK_STROKE_WIDTH / 2)

/**
 * Space Grotesk SemiBold (Google Fonts v22 wght 600, UPM 1000) vertical stem:
 * `l` is a 73–188 rectangle (115 UPM); `m` stems are 115 / 114 / 115 at
 * sxHeight/2. In-word ring and orbit share one stroke = this ratio × stem.
 * The mark box is sxHeight (486 UPM). Scale drops so (r + stroke/2) stays
 * the canonical outer 231 viewBox units — the ring grows inward.
 */
export const LF_WORDMARK_STEM_UPM = 115
export const LF_WORDMARK_STEM_EM = LF_WORDMARK_STEM_UPM / 1000
/** Shared ring+orbit stroke as a fraction of the stem. Floor 0.6. */
export const LF_WORDMARK_STROKE_TO_STEM = 0.6
export const LF_WORDMARK_STROKE_EM =
  LF_WORDMARK_STEM_EM * LF_WORDMARK_STROKE_TO_STEM
const LF_WORDMARK_X_HEIGHT_EM = 486 / 1000

function emToLocalStroke(em: number, geometryScale: number): number {
  return ((em / LF_WORDMARK_X_HEIGHT_EM) * LF_MARK_VIEWBOX) / geometryScale
}

const LF_WORDMARK_STROKE_VIEWBOX =
  (LF_WORDMARK_STROKE_EM / LF_WORDMARK_X_HEIGHT_EM) * LF_MARK_VIEWBOX
export const LF_WORDMARK_GEOMETRY_SCALE =
  LF_MARK_OUTER - LF_WORDMARK_STROKE_VIEWBOX / 2
export const LF_WORDMARK_STROKE_WIDTH = emToLocalStroke(
  LF_WORDMARK_STROKE_EM,
  LF_WORDMARK_GEOMETRY_SCALE
)

/**
 * Wordmark orbit: flat ellipse, 18° off horizontal (not the old rotate(-60)
 * slash). Target overshoot is half a stem past the ring outer; r-ink at
 * tracking -0.045em only leaves 0.01373em before the gap drops under 0.5
 * stem. Width stays the o glyph advance. m-side gap is larger.
 */
export const LF_WORDMARK_ORBIT_TILT_DEG = 18
export const LF_WORDMARK_OVERSHOOT_TARGET_EM = LF_WORDMARK_STEM_EM / 2
export const LF_WORDMARK_NEIGHBOR_GAP_EM = LF_WORDMARK_STEM_EM / 2
const LF_O_CENTER_EM = 0.613 / 2
const LF_RING_OUTER_EM =
  (LF_MARK_OUTER / LF_MARK_VIEWBOX) * LF_WORDMARK_X_HEIGHT_EM
/** r xMax 362, advance 391, tracking -45 → r ink right is 16 UPM from o origin */
const LF_R_INK_RIGHT_FROM_O_EM = 0.016
/** o advance 613 + tracking -45 + m xMin 73 */
const LF_M_INK_LEFT_FROM_O_EM = 0.641
export const LF_WORDMARK_OVERSHOOT_EM =
  LF_O_CENTER_EM -
  LF_RING_OUTER_EM -
  LF_R_INK_RIGHT_FROM_O_EM -
  LF_WORDMARK_NEIGHBOR_GAP_EM
export const LF_WORDMARK_GAP_R_EM = LF_WORDMARK_NEIGHBOR_GAP_EM
export const LF_WORDMARK_GAP_M_EM =
  LF_M_INK_LEFT_FROM_O_EM -
  LF_O_CENTER_EM -
  LF_RING_OUTER_EM -
  LF_WORDMARK_OVERSHOOT_EM

const LF_WORDMARK_OVERSHOOT_LOCAL =
  ((LF_WORDMARK_OVERSHOOT_EM / LF_WORDMARK_X_HEIGHT_EM) * LF_MARK_VIEWBOX) /
  LF_WORDMARK_GEOMETRY_SCALE
export const LF_WORDMARK_ORBIT_RX = 1 + LF_WORDMARK_OVERSHOOT_LOCAL
export const LF_WORDMARK_ORBIT_RY =
  LF_WORDMARK_ORBIT_RX *
  Math.sin((LF_WORDMARK_ORBIT_TILT_DEG * Math.PI) / 180)

export type LogoMarkLayer = 'all' | 'ring' | 'core' | 'wordmark'

export type LogoMarkProps = {
  size?: number
  className?: string
  decorative?: boolean
  layer?: LogoMarkLayer
  groupIds?: boolean
  focusable?: false
  strokeWidth?: number
  geometryScale?: number
}

function Ring({ grouped }: { grouped: boolean }) {
  return (
    <g id={grouped ? 'lf-ring' : undefined}>
      <circle r="1" />
    </g>
  )
}

function OrbitEllipse() {
  return <ellipse rx="1" ry="0.43" transform="rotate(-60)" />
}

function CoreDetail() {
  return (
    <>
      <path d="M 0.605385 -0.384961 C 0.86 -0.09 0.94 0.22 0.852000 0.501000" />
      <path d="M 0.605385 -0.384961 L 0 0 L 0.852000 0.501000 M 0 0 L 0.837356 0.000000 M 0 0 L 0.237000 -0.482000" />
      <path d="M 0.197285 -0.587803 L 0.275803 -0.552715 L 0.240715 -0.474197 L 0.162197 -0.509285 Z" />
    </>
  )
}

function Core({ grouped }: { grouped: boolean }) {
  return (
    <g id={grouped ? 'lf-core' : undefined}>
      <OrbitEllipse />
      <CoreDetail />
    </g>
  )
}

function WordmarkOrbit({ strokeWidth }: { strokeWidth: number }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const clipOut = `lf-wm-orbit-out-${uid}`
  const clipFront = `lf-wm-orbit-front-${uid}`
  const outer = 1 + strokeWidth / 2
  const inner = 1 - strokeWidth / 2
  const tilt = LF_WORDMARK_ORBIT_TILT_DEG
  const rx = LF_WORDMARK_ORBIT_RX
  const ry = LF_WORDMARK_ORBIT_RY
  const twoOuter = 2 * outer

  return (
    <>
      <defs>
        <clipPath id={clipOut} clipPathUnits="userSpaceOnUse">
          <path
            clipRule="evenodd"
            d={`M-8-8h16v16h-16zM${-outer} 0a${outer} ${outer} 0 1 0 ${twoOuter} 0a${outer} ${outer} 0 1 0 ${-twoOuter} 0`}
          />
        </clipPath>
        <clipPath id={clipFront} clipPathUnits="userSpaceOnUse">
          <path
            transform={`rotate(${tilt})`}
            d={`M ${-inner} 0 A ${inner} ${inner} 0 0 1 ${inner} 0 Z`}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipOut})`}>
        <ellipse rx={rx} ry={ry} transform={`rotate(${tilt})`} />
      </g>
      <g clipPath={`url(#${clipFront})`}>
        <ellipse rx={rx} ry={ry} transform={`rotate(${tilt})`} />
      </g>
    </>
  )
}

export default function LogoMark({
  size = 32,
  className,
  decorative = true,
  layer = 'all',
  groupIds = true,
  focusable,
  strokeWidth = LF_MARK_STROKE_WIDTH,
  geometryScale = LF_MARK_GEOMETRY_SCALE,
}: LogoMarkProps) {
  const named = !decorative
  const wordmark = layer === 'wordmark'
  const showRing = layer !== 'core'
  const showCore = layer === 'all' || layer === 'core'

  return (
    <div className={['house-logo-mark', className].filter(Boolean).join(' ')}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={size}
        height={size}
        fill="none"
        role={named ? 'img' : undefined}
        aria-labelledby={named ? 'lf-mark-title' : undefined}
        aria-hidden={decorative ? true : undefined}
        focusable={focusable === false ? 'false' : undefined}
      >
        {named ? <title id="lf-mark-title">lecturesfrom</title> : null}
        <g
          transform={`translate(256 256) scale(${geometryScale})`}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {wordmark ? (
            <>
              <WordmarkOrbit strokeWidth={strokeWidth} />
              {showRing ? <Ring grouped={groupIds} /> : null}
            </>
          ) : (
            <>
              {showRing ? <Ring grouped={groupIds} /> : null}
              {showCore ? <Core grouped={groupIds} /> : null}
            </>
          )}
        </g>
      </svg>
    </div>
  )
}
