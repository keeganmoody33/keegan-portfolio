import HouseRail from '@/components/house/HouseRail'

export default function TitleCard() {
  return (
    <header className="px-6 pb-8 sm:px-10">
      <HouseRail />
      <div className="mt-16 sm:mt-24">
        <div className="house-wordmark-slot">
          <h1 className="house-wordmark">lecturesfrom</h1>
        </div>
        <p className="house-meta mt-3">llc</p>
      </div>
      <div className="mt-10 max-w-xl space-y-1 font-mono text-sm leading-relaxed text-[var(--house-ink)] sm:text-base">
        <p>not a studio. a garage.</p>
        <p>GTME &amp; revenue architecture.</p>
        <p>publishing house &amp; physical products.</p>
        <p>it is always deeper than it looks.</p>
      </div>
    </header>
  )
}
