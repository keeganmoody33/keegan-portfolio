import HouseRail from '@/components/house/HouseRail'
import LogoGlobe from '@/components/house/LogoGlobe'
import LogoMark from '@/components/house/LogoMark'

export default function TitleCard() {
  return (
    <header className="pb-8">
      <HouseRail />
      <div className="mt-16 px-6 sm:mt-24 sm:px-10">
        {/* decorative: the h1 wordmark is the accessible name. Do not add aria-label. */}
        <LogoGlobe
          className="house-logo-mark mb-6"
          decorative
          ring={<LogoMark decorative layer="ring" />}
          core={<LogoMark decorative layer="core" />}
        />
        <div className="house-wordmark-slot">
          <h1 className="house-wordmark">lecturesfrom</h1>
        </div>
        <p className="house-meta mt-3">llc</p>
      </div>
      <div className="mt-10 max-w-xl space-y-1 px-6 font-mono text-sm leading-relaxed text-[var(--house-ink)] sm:px-10 sm:text-base">
        <p>not a studio. a garage.</p>
        <p>GTME &amp; revenue architecture.</p>
        <p>publishing house &amp; physical products.</p>
        <p>it is always deeper than it looks.</p>
      </div>
    </header>
  )
}
