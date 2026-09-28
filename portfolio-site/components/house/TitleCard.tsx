import HouseRail from '@/components/house/HouseRail'
import HouseWordmark from '@/components/house/HouseWordmark'

export default function TitleCard() {
  return (
    <header className="pb-8">
      <HouseRail />
      <div className="mt-16 px-6 sm:mt-24 sm:px-10">
        <div className="house-wordmark-slot">
          <HouseWordmark />
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
