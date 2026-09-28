import LogoGlobe from '@/components/house/LogoGlobe'
import LogoMark from '@/components/house/LogoMark'

/**
 * Root title-card wordmark. The last o in "from" is the spinning
 * lecturesfrom LogoGlobe — same ring + core geometry as the favicon /
 * og, sized to Chakra Petch 600's x-height and sitting on the
 * baseline over an in-flow transparent o (exact advance). The coin
 * spin + rim wall live on this instance; there is no standalone globe
 * above the wordmark.
 *
 * The globe is the only LogoMark tree on the title card, so
 * `#lf-ring` / `#lf-core` stay unique. A visually hidden full word
 * keeps the accessible name "lecturesfrom". The painted letters are
 * aria-hidden. The globe is aria-hidden too — the h1 names the brand.
 * Pause stays CSS-only via `html[data-logo-paused]` / SignalCut.
 */
export default function HouseWordmark() {
  return (
    <h1 className="house-wordmark">
      <span className="sr-only">lecturesfrom</span>
      <span className="house-wordmark-visual" aria-hidden="true">
        {'lecturesfr'}
        <span className="house-wordmark-o">
          <span className="house-wordmark-o-letter">o</span>
          <LogoGlobe
            decorative
            className="house-wordmark-o-mark"
            ring={<LogoMark decorative layer="ring" />}
            core={<LogoMark decorative layer="core" />}
          />
        </span>
        {'m'}
      </span>
    </h1>
  )
}
