import LogoMark, {
  type LogoMarkVariant,
} from '@/components/house/LogoMark'

/**
 * Root title-card wordmark. The last o in "from" is the lecturesfrom
 * LogoMark (geometry traced from the owner line-only PNG) sized so the
 * outer circle ink hits Chakra Petch 600's x-height and baseline over
 * an in-flow transparent o (exact advance). Face-on, no LogoGlobe, no
 * spin. Favicon / og stay the older line-mark and now mismatch. There
 * is no standalone coin above the wordmark.
 *
 * `variant` defaults to `'line'` on this branch (owner picks later).
 * p1 / p2 / p3 / pastel are the same paths with their fill and stroke
 * rules. p3 square orange is CSS `:hover` on this wordmark
 * (`@media (hover: hover) and (pointer: fine)`; touch stays ink).
 *
 * groupIds={false} so `#lf-ring` / `#lf-core` stay unique if a globe
 * is remounted. A visually hidden full word keeps the accessible name
 * "lecturesfrom". The painted letters are aria-hidden. The mark is
 * aria-hidden + focusable="false". Wrapper is a span (phrasing
 * content only inside the h1).
 */
export default function HouseWordmark({
  variant = 'line',
}: {
  variant?: LogoMarkVariant
}) {
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
            variant={variant}
            className="house-wordmark-o-mark"
          />
        </span>
        {'m'}
      </span>
    </h1>
  )
}
