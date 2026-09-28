import {
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from 'react'

export type LogoGlobeSvg = ReactElement<SVGProps<SVGSVGElement>>

export type LogoGlobeProps = {
  className?: string
  style?: CSSProperties
  /** Explicit square size. Omit to fill the parent width with aspect-ratio 1. */
  size?: number | string
  /**
   * When true (title card next to the wordmark), no img role or name.
   * Standalone marks keep `role="img"` and `aria-label="lecturesfrom"`.
   */
  decorative?: boolean
  /**
   * One square-viewBox SVG with `<g id="lf-ring">` (outer circle) and
   * `<g id="lf-core">` (everything else). Rendered twice; each layer hides
   * the other group. Prefer `ring` + `core` when those nodes already exist.
   */
  children?: LogoGlobeSvg
  ring?: ReactNode
  core?: ReactNode
}

function layerClassName(svg: LogoGlobeSvg, extra: string): string {
  const prev = svg.props.className
  return [typeof prev === 'string' ? prev : undefined, 'lf-logo-globe-svg', extra]
    .filter(Boolean)
    .join(' ')
}

function cloneLayer(svg: LogoGlobeSvg, extra: string): LogoGlobeSvg {
  return cloneElement(svg, {
    className: layerClassName(svg, extra),
    'aria-hidden': true,
    focusable: 'false',
  })
}

/**
 * Lecturesfrom logo globe. Ring and core stay stacked and face-on to
 * each other. The shared `.lf-logo-globe-spin` wrapper turns the whole
 * mark as one coin (`rotateY` 12s linear infinite, west→east, `flat`
 * so Chrome rasterizes the SVG at device DPR). Core stays
 * `animation: none` / `transform: none` so the layers cannot drift.
 * The rim wall is a 2D sibling of the spin (not a 3D child) so
 * `preserve-3d` is not required. Both animations share the same 12s
 * linear infinite clock and live in the SSR markup so they start in
 * the same frame. Pause is CSS-only via `html[data-lf-signal-cut="active"]`
 * and `html[data-logo-paused="true"]` — never inline animation-play-state,
 * never the SignalCut debug hook. Either attribute pauses; dropping
 * one cannot resume while the other is set.
 *
 * Server Component. No JS animation loop. Currently unmounted: the
 * wordmark o uses static `LogoMark`, and TitleCard has no standalone
 * coin. Keep this file so the coin can return. Owner override of the
 * house "No 3D" rule, scoped to this mark.
 */
export default function LogoGlobe({
  className,
  style,
  size,
  decorative = false,
  children,
  ring,
  core,
}: LogoGlobeProps) {
  const boxStyle: CSSProperties = { ...style }
  if (size != null) {
    const length = typeof size === 'number' ? `${size}px` : size
    boxStyle.width = length
    boxStyle.height = length
  }

  let ringNode: ReactNode = ring
  let coreNode: ReactNode = core

  if ((ringNode == null || coreNode == null) && isValidElement(children)) {
    ringNode = cloneLayer(children, 'lf-logo-globe-svg-ring')
    coreNode = cloneLayer(children, 'lf-logo-globe-svg-core')
  }

  if (ringNode == null || coreNode == null) return null

  return (
    <div
      className={['lf-logo-globe', className].filter(Boolean).join(' ')}
      style={boxStyle}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'lecturesfrom'}
      aria-hidden={decorative ? true : undefined}
    >
      <div className="lf-logo-globe-spin" aria-hidden="true">
        <div className="lf-logo-globe-layer lf-logo-globe-ring">
          {ringNode}
        </div>
        <div className="lf-logo-globe-layer lf-logo-globe-core">
          {coreNode}
        </div>
      </div>
      <div className="lf-logo-globe-rim-wall" aria-hidden="true" />
    </div>
  )
}
