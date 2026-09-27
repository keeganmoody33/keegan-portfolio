import LogoMark from '@/components/house/LogoMark'

/**
 * Root title-card wordmark. The last o in "from" is a static LogoMark
 * (layer="all") sized to Space Grotesk SemiBold's x-height and sitting
 * on the baseline in a slot of the o's advance width. Face-on, no
 * LogoGlobe, no spin, no rim wall, no `data-logo-paused`. The spinning
 * mark above this heading is a separate instance.
 *
 * The real o stays in the DOM as `.sr-only` so the accessible name and
 * copy text stay "lecturesfrom". The mark is aria-hidden and not
 * focusable. Keep this lowercase.
 */
export default function HouseWordmark() {
  return (
    <h1 className="house-wordmark">
      {'lecturesfr'}
      <span className="house-wordmark-o">
        {[
          <span key="letter" className="sr-only">
            o
          </span>,
          <LogoMark
            key="mark"
            decorative
            groupIds={false}
            focusable={false}
            className="house-wordmark-o-mark"
          />,
        ]}
      </span>
      {'m'}
    </h1>
  )
}
