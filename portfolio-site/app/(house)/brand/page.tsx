import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import HouseShell from '@/components/house/HouseShell'
import type { Metadata } from 'next'
import { houseMetadata } from '@/lib/metadata'

export const metadata: Metadata = houseMetadata(
  '/brand',
  'brand · lecturesfrom',
  'The official lecturesfrom mark. Downloads, stable URLs, and usage rules.'
)

const DOWNLOADS = [
  { file: 'logo.svg', label: 'logo.svg', note: 'vector · dark ink · the official file' },
  { file: 'logo-white.svg', label: 'logo-white.svg', note: 'vector · for dark backgrounds' },
  { file: 'logo-1024.png', label: 'logo-1024.png', note: '1024px · transparent' },
  { file: 'logo-512.png', label: 'logo-512.png', note: '512px · transparent · email signatures' },
  { file: 'logo-white-1024.png', label: 'logo-white-1024.png', note: '1024px · transparent' },
  { file: 'logo-white-512.png', label: 'logo-white-512.png', note: '512px · transparent' },
  { file: 'manifest.json', label: 'manifest.json', note: 'every file, size, and hash · for machines' },
]

const RULES = [
  'Dark mark on light backgrounds. White mark on dark backgrounds.',
  'Leave clear space around the mark of at least a third of its width.',
  'Smallest size for the full mark is 24px on screen.',
  'Do not stretch, rotate, recolor, outline, or add effects.',
  'Do not place the wordmark or anything else inside the circle.',
  'Link to www.lecturesfrom.com/brand/logo.svg instead of copying the file. It stays current.',
]

export default function BrandPage() {
  return (
    <HouseShell>
      <HouseRail left="atl 33.70n" center="brand" right="llc" />
      <article className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
        <p className="font-mono text-[11px] tracking-wide text-[var(--house-muted)]">
          lecturesfrom LLC · the mark · ink #20262b
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.01em] sm:text-6xl">brand</h1>

        <div className="mt-10 grid gap-px border border-[var(--house-line)] bg-[var(--house-line)] sm:grid-cols-2">
          <figure className="flex aspect-square items-center justify-center bg-white p-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="lecturesfrom mark, dark" width={320} height={320} className="h-auto w-full max-w-[320px]" />
          </figure>
          <figure className="flex aspect-square items-center justify-center bg-[#0a0a0a] p-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-white.svg" alt="lecturesfrom mark, white" width={320} height={320} className="h-auto w-full max-w-[320px]" />
          </figure>
        </div>

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.01em]">Downloads</h2>
        <ul className="mt-4 divide-y divide-[var(--house-line)] border-y border-[var(--house-line)] font-mono text-sm">
          {DOWNLOADS.map((d) => (
            <li key={d.file} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
              <a href={`/brand/${d.file}`} download className="text-[var(--house-ink)] underline underline-offset-4">
                {d.label}
              </a>
              <span className="text-[var(--house-muted)]">{d.note}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.01em]">Stable URLs</h2>
        <p className="mt-4 font-mono text-sm leading-relaxed text-[var(--house-ink)]">
          These addresses never change. When the mark is updated, the file behind them is replaced.
        </p>
        <pre className="mt-4 overflow-x-auto border border-[var(--house-line)] p-4 font-mono text-xs leading-relaxed text-[var(--house-ink)]">
{`https://www.lecturesfrom.com/brand/logo.svg
https://www.lecturesfrom.com/brand/logo-white.svg
https://www.lecturesfrom.com/brand/logo-1024.png
https://www.lecturesfrom.com/brand/manifest.json`}
        </pre>
        <p className="mt-4 font-mono text-sm leading-relaxed text-[var(--house-muted)]">
          Need a frozen version that never updates? Use the hashed URLs listed in manifest.json.
        </p>

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.01em]">Use</h2>
        <ul className="mt-4 space-y-3 font-mono text-sm leading-relaxed text-[var(--house-ink)]">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        <p className="mt-14 font-mono text-[11px] tracking-wide text-[var(--house-muted)]">
          © lecturesfrom LLC. The mark may be used to refer to lecturesfrom
        </p>
      </article>
      <HouseFooter />
    </HouseShell>
  )
}
