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
 *   same-size layers without duplicate ids. Geometry and group ids stay locked;
 *   Motion's globe spin should wrap these layers rather than rewrite the markup.
 * - `groupIds` (default true): set false when a second mark shares the page
 *   (wordmark o) so `#lf-ring` / `#lf-core` stay unique on the title-card globe.
 * - `focusable` (default omit): pass `false` for the wordmark o so the SVG is
 *   not a tab stop. The title-card globe omits this; it stays as before.
 * - `strokeWidth` / `geometryScale` (default canonical 0.0625 / 224): the
 *   wordmark o passes the stem-matched pair so the ring is 95% of the
 *   Space Grotesk SemiBold vertical stem and the extra width grows inward.
 *   Title-card globe, favicon, and og keep the defaults.
 *
 * Strokes are `currentColor` so the mark inherits house ink on `/` (and any
 * future parent color). Favicons cannot use currentColor — see `app/icon.svg`.
 */

/** Canonical geometry (title-card globe, favicon, og). Do not change for the wordmark o. */
export const LF_MARK_GEOMETRY_SCALE = 224
export const LF_MARK_STROKE_WIDTH = 0.0625
const LF_MARK_VIEWBOX = 512
const LF_MARK_OUTER =
  LF_MARK_GEOMETRY_SCALE * (1 + LF_MARK_STROKE_WIDTH / 2)

/**
 * Space Grotesk SemiBold (Google Fonts v22 wght 600, UPM 1000) vertical stem:
 * `l` is a 73–188 rectangle (115 UPM); `m` stems are 115 / 114 / 115 at
 * sxHeight/2. Ring stroke is 95% of that stem. The mark box is sxHeight
 * (486 UPM). Scale drops so (r + stroke/2) stays the canonical outer 231
 * viewBox units — stroke grows inward, paths are unchanged.
 */
export const LF_WORDMARK_STEM_UPM = 115
export const LF_WORDMARK_STEM_EM = LF_WORDMARK_STEM_UPM / 1000
export const LF_WORDMARK_RING_TO_STEM = 0.95
export const LF_WORDMARK_RING_STROKE_EM =
  LF_WORDMARK_STEM_EM * LF_WORDMARK_RING_TO_STEM
const LF_WORDMARK_X_HEIGHT_EM = 486 / 1000
const LF_WORDMARK_STROKE_VIEWBOX =
  (LF_WORDMARK_RING_STROKE_EM / LF_WORDMARK_X_HEIGHT_EM) * LF_MARK_VIEWBOX
export const LF_WORDMARK_GEOMETRY_SCALE =
  LF_MARK_OUTER - LF_WORDMARK_STROKE_VIEWBOX / 2
export const LF_WORDMARK_STROKE_WIDTH =
  LF_WORDMARK_STROKE_VIEWBOX / LF_WORDMARK_GEOMETRY_SCALE

export type LogoMarkLayer = 'all' | 'ring' | 'core'

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

function Core({ grouped }: { grouped: boolean }) {
  return (
    <g id={grouped ? 'lf-core' : undefined}>
      <ellipse rx="1" ry="0.43" transform="rotate(-60)" />
      <path d="M 0.605385 -0.384961 C 0.86 -0.09 0.94 0.22 0.852000 0.501000" />
      <path d="M 0.605385 -0.384961 L 0 0 L 0.852000 0.501000 M 0 0 L 0.837356 0.000000 M 0 0 L 0.237000 -0.482000" />
      <path d="M 0.197285 -0.587803 L 0.275803 -0.552715 L 0.240715 -0.474197 L 0.162197 -0.509285 Z" />
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
  strokeWidth = LF_MARK_STROKE_WIDTH,
  geometryScale = LF_MARK_GEOMETRY_SCALE,
}: LogoMarkProps) {
  const named = !decorative

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
          {layer === 'core' ? null : <Ring grouped={groupIds} />}
          {layer === 'ring' ? null : <Core grouped={groupIds} />}
        </g>
      </svg>
    </div>
  )
}
