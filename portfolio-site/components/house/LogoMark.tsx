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
 *   same-size layers without duplicate ids.
 * - `groupIds` (default true): set false when a second mark shares the page
 *   (wordmark o) so `#lf-ring` / `#lf-core` stay unique on the title-card globe.
 * - `focusable` (default omit): pass `false` for the wordmark o so the SVG is
 *   not a tab stop. The title-card globe omits this; it stays as before.
 *   The core group is scale(0.74) so the orbit sits inside the ring instead of
 *   sharing its radius. Motion's globe spin wraps these layers.
 *
 * Strokes are `currentColor` so the mark inherits house ink on `/` (and any
 * future parent color). Favicons cannot use currentColor — see `app/icon.svg`.
 */

export const LF_MARK_GEOMETRY_SCALE = 224
export const LF_MARK_STROKE_WIDTH = 0.0625

export type LogoMarkLayer = 'all' | 'ring' | 'core'

export type LogoMarkProps = {
  size?: number
  className?: string
  decorative?: boolean
  layer?: LogoMarkLayer
  groupIds?: boolean
  focusable?: false
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
    <g id={grouped ? 'lf-core' : undefined} transform="scale(0.74)">
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
}: LogoMarkProps) {
  const named = !decorative
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
          transform={`translate(256 256) scale(${LF_MARK_GEOMETRY_SCALE})`}
          stroke="currentColor"
          strokeWidth={LF_MARK_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {showRing ? <Ring grouped={groupIds} /> : null}
          {showCore ? <Core grouped={groupIds} /> : null}
        </g>
      </svg>
    </div>
  )
}
