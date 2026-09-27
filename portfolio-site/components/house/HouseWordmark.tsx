import LogoMark, {
  LF_WORDMARK_GEOMETRY_SCALE,
  LF_WORDMARK_STROKE_WIDTH,
} from '@/components/house/LogoMark'

/**
 * Root title-card wordmark. The last o in "from" is a static LogoMark
 * (layer="all") sized to Space Grotesk SemiBold's x-height and sitting
 * on the baseline over an in-flow transparent o (exact advance). Face-on,
 * no LogoGlobe, no spin, no rim wall, no `data-logo-paused`.
 *
 * Ring stroke is 95% of the SemiBold vertical stem (115 UPM). Geometry
 * scale drops so the extra width grows inward; paths stay canonical.
 * Title-card globe / favicon / og keep the default stroke.
 *
 * A visually hidden full word keeps the accessible name "lecturesfrom"
 * (inline-block slots otherwise become "lecturesfr o m"). The painted
 * letters are aria-hidden. Copy still yields "lecturesfrom".
 */
export default function HouseWordmark() {
  return (
    <h1 className="house-wordmark">
      <span className="sr-only">lecturesfrom</span>
      <span className="house-wordmark-visual" aria-hidden="true">
        {'lecturesfr'}
        <span className="house-wordmark-o">
          <span className="house-wordmark-o-letter">o</span>
          <LogoMark
            groupIds={false}
            focusable={false}
            className="house-wordmark-o-mark"
            strokeWidth={LF_WORDMARK_STROKE_WIDTH}
            geometryScale={LF_WORDMARK_GEOMETRY_SCALE}
          />
        </span>
        {'m'}
      </span>
    </h1>
  )
}
