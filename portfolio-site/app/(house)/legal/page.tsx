import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import type { Metadata } from 'next'
import { houseMetadata } from '@/lib/metadata'

export const metadata: Metadata = houseMetadata(
  '/legal',
  'legal — lecturesfrom',
  'lecturesfrom LLC. Atlanta, Georgia. a garage, not a studio.'
)

export default function LegalPage() {
  return (
    <HouseShell>
      <HouseRail left="atl 33.70n" center="legal" right="llc" />
      <article className="mx-auto max-w-2xl px-6 py-16 sm:px-10">
        <p className="font-mono text-[11px] tracking-wide text-[var(--house-muted)]">
          lecturesfrom LLC · Atlanta, Georgia 30316 · founded 2025 · self-owned
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.01em] sm:text-6xl">lecturesfrom</h1>
        <p className="mt-6 font-mono text-sm leading-relaxed text-[var(--house-orange)]">
          Transforming your business&apos;s Achilles&apos; heel into durable systems and crafted products that
          fuel growth and culture.
        </p>

        <div className="mt-10 space-y-6 font-mono text-sm leading-relaxed text-[var(--house-ink)]">
          <p>
            lecturesfrom is where technology helps creative expression see the light of day, and where the
            systems powering modern businesses honor authenticity, originality, and the intangible edge
            behind lasting success.
          </p>
          <p>Not a studio. More like a garage or workshop.</p>
          <p>
            Our advantage is embedding ourselves in your business from the ground up to understand the
            motions you are trying to carry out, the constraints holding them back, and the opportunity
            inside them.
          </p>
          <p>
            We hold a high standard for authenticity. If that is not important to you, we may not be
            aligned.
          </p>

          <h2 className="pt-4 font-display text-2xl font-semibold tracking-[-0.01em]">GTME &amp; Revenue Architecture</h2>
          <p>
            From customer journeys and revenue architecture to integrations, outbound operations, and
            workflow automation, every motion is engineered with intention. We partner with businesses
            ready to turn originality and authenticity into durable growth.
          </p>

          <h2 className="pt-4 font-display text-2xl font-semibold tracking-[-0.01em]">Publishing House &amp; Physical Products</h2>
          <p>
            lecturesfrom designs physical products that cultivate authenticity alongside digital
            experiences. Pressed records, printed books, art editions, objects, and original designs give
            ideas, brands, and creative work a permanent form in the physical world.
          </p>
          <p>
            We collaborate with businesses and artists committed to craft, vision, and principle. What
            others may view as sprawl, we see as an opportunity: even a cloud-native company can
            crystallize its identity into tangible objects for its team, customers, and community.
          </p>
          <p>
            Done with purpose, physical products become more than merchandise. They create artifacts
            people keep, signals people share, and touchpoints that reinforce adoption, employee
            retention, and brand belief.
          </p>

          <p>It is always deeper than it looks. We think through every thing we ship.</p>
          <p>Our HQ is a basement. The scope is an ACOG.</p>
        </div>
      </article>
      <HouseFooter />
    </HouseShell>
  )
}
