import HouseRail from '@/components/house/HouseRail'
import HouseWordmark from '@/components/house/HouseWordmark'
import Link from 'next/link'

export default function TitleCard() {
  return (
    <header className="pb-8">
      <HouseRail />
      <div className="mt-12 px-6 sm:mt-20 sm:px-10">
        <div className="house-wordmark-slot">
          <HouseWordmark />
        </div>
      </div>
      <div className="house-home-intro mt-10 px-6 sm:px-10">
        <div>
          <p className="house-meta">not a studio. a garage.</p>
          <p className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-[-0.01em] sm:text-4xl">
            sales systems, software, records, and things you can hold.
          </p>
        </div>
        <div className="max-w-xl font-mono text-sm leading-relaxed sm:text-base">
          <p className="text-[var(--house-muted)]">
            lecturesfrom is keegan moody&apos;s independent house in atlanta.
            i build revenue systems and make tools and objects for creative work.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="#catalog" className="house-button">explore the work <span aria-hidden="true">↘</span></Link>
            <a href="mailto:33@lecturesfrom.com" className="house-button house-button-secondary">talk about a project <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>
    </header>
  )
}
