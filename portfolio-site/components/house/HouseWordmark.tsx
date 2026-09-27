import LogoMark from '@/components/house/LogoMark'

/**
 * Root title-card wordmark. The last o in "from" is the lecturesfrom
 * LogoMark — same geometry as the title-card globe / favicon / og —
 * sized to Space Grotesk SemiBold's x-height and sitting on the
 * baseline over an in-flow transparent o (exact advance). Face-on, no
 * LogoGlobe, no spin, no rim wall, no `data-logo-paused`.
 *
 * groupIds={false} so `#lf-ring` / `#lf-core` stay unique on the
 * spinning title-card globe. A visually hidden full word keeps the
 * accessible name "lecturesfrom". The painted letters are aria-hidden.
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
          />
        </span>
        {'m'}
      </span>
    </h1>
  )
}
