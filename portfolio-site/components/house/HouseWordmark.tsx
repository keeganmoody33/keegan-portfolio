import LogoMark, {
  LF_WORDMARK_GEOMETRY_SCALE,
  LF_WORDMARK_STROKE_WIDTH,
} from '@/components/house/LogoMark'

/**
 * Root title-card wordmark. The last o in "from" is a static LogoMark
 * (layer="ring": outer ring only) sized to Space Grotesk SemiBold's
 * x-height and sitting on the baseline over an in-flow transparent o
 * (exact advance). Face-on, no LogoGlobe, no spin, no rim wall, no
 * `data-logo-paused`.
 *
 * Ring stroke is 95% of the SemiBold vertical stem (115 UPM = 0.10925em).
 * Geometry scale drops so the ring's extra width grows inward. Inner
 * detail and the orbit ellipse are omitted on this instance — Direction
 * asked for ring + orbit, then the darkness stop rule dropped the
 * orbit. Title-card globe / favicon / og keep the default stroke and
 * full core.
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
            layer="ring"
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
