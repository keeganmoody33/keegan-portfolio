import LogoMark from '@/components/house/LogoMark'

/**
 * Root title-card wordmark. The last o in "from" is the lecturesfrom
 * filled LogoMark (geometry traced from the owner line-only PNG) sized
 * so the outer circle ink hits Chakra Petch 600's x-height and baseline
 * over an in-flow transparent o (exact advance). On-fill strokes use
 * `var(--house-bg)`; empty / the ring use `currentColor`. Face-on, no
 * LogoGlobe, no spin. Favicon / og stay the older line-mark and now
 * mismatch. There is no standalone coin above the wordmark.
 *
 * groupIds={false} so `#lf-ring` / `#lf-core` stay unique if a globe
 * is remounted. A visually hidden full word keeps the accessible name
 * "lecturesfrom". The painted letters are aria-hidden. The mark is
 * aria-hidden + focusable="false". Wrapper is a span (phrasing
 * content only inside the h1).
 *
 * `fills` defaults true (live lockup). Pass false to paint the mark
 * line-only from the same paths.
 */
export default function HouseWordmark({ fills = true }: { fills?: boolean }) {
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
            fills={fills}
            className="house-wordmark-o-mark"
          />
        </span>
        {'m'}
      </span>
    </h1>
  )
}
