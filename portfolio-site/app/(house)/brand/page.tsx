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

const KIT = [
  { file: 'kit/lf-avatar-light-400.png', note: '400px · light · safe in a circle crop' },
  { file: 'kit/lf-avatar-dark-400.png', note: '400px · dark · safe in a circle crop' },
  { file: 'kit/lf-avatar-light-1024.png', note: '1024px · light' },
  { file: 'kit/lf-avatar-dark-1024.png', note: '1024px · dark' },
  { file: 'kit/lf-app-icon-light-1024.png', note: 'app icon · 1024 · full bleed · light' },
  { file: 'kit/lf-app-icon-dark-1024.png', note: 'app icon · 1024 · full bleed · dark' },
  { file: 'kit/lf-maskable-light-512.png', note: 'maskable · 512 · light' },
  { file: 'kit/lf-maskable-dark-512.png', note: 'maskable · 512 · dark' },
  { file: 'kit/lf-favicon-plate.svg', note: 'favicon cut on a white plate · reads on dark tabs' },
  { file: 'kit/lf-slack-128.png', note: 'slack emoji · 128 · white plate' },
  { file: 'kit/lf-spin.gif', note: 'slack emoji · the orbit turning once' },
]

const PRINT = [
  { file: 'kit/lf-mark-ink.eps', note: 'eps · ink · for printers and plants' },
  { file: 'kit/lf-mark-ink.pdf', note: 'pdf · ink · vector' },
]

const COLORS = [
  { name: 'ink', hex: '#20262b', note: 'the mark on light grounds' },
  { name: 'house black', hex: '#0a0a0a', note: 'ground' },
  { name: 'house white', hex: '#ececec', note: 'type on dark' },
  { name: 'house orange', hex: '#e23d00', note: 'the one key · hover, plates, the flag' },
  { name: 'lcd', hex: '#afc875', note: 'readouts only' },
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

        <p className="mt-6 font-mono text-sm">
          <a href="/brand/kit/lf-brand-kit.zip" download className="text-[var(--house-ink)] underline underline-offset-4">
            lf-brand-kit.zip
          </a>
          <span className="text-[var(--house-muted)]"> · everything on this page in one file</span>
        </p>

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.01em]">Name</h2>
        <p className="mt-4 font-mono text-sm leading-relaxed text-[var(--house-ink)]">
          lecturesfrom. One word, always lowercase. Not Lectures From, not LecturesFrom. lecturesfrom LLC only in legal lines.
        </p>

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

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.01em]">Avatars and icons</h2>
        <div className="mt-4 grid grid-cols-2 gap-px border border-[var(--house-line)] bg-[var(--house-line)] sm:grid-cols-4">
          {['lf-avatar-light-400.png', 'lf-avatar-dark-400.png', 'lf-app-icon-dark-1024.png', 'lf-slack-128.png'].map((f) => (
            <figure key={f} className="flex aspect-square items-center justify-center bg-[var(--house-bg)] p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brand/kit/${f}`} alt="" width={160} height={160} className="h-auto w-full max-w-[160px]" />
            </figure>
          ))}
        </div>
        <ul className="mt-4 divide-y divide-[var(--house-line)] border-y border-[var(--house-line)] font-mono text-sm">
          {[...KIT, ...PRINT].map((d) => (
            <li key={d.file} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
              <a href={`/brand/${d.file}`} download className="text-[var(--house-ink)] underline underline-offset-4">
                {d.file.replace('kit/', '')}
              </a>
              <span className="text-[var(--house-muted)]">{d.note}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.01em]">Color</h2>
        <ul className="mt-4 divide-y divide-[var(--house-line)] border-y border-[var(--house-line)] font-mono text-sm">
          {COLORS.map((c) => (
            <li key={c.hex} className="flex items-center gap-4 py-3">
              <span aria-hidden className="h-6 w-6 shrink-0 border border-[var(--house-line)]" style={{ background: c.hex }} />
              <span className="w-32 text-[var(--house-ink)]">{c.name}</span>
              <span className="w-20 text-[var(--house-ink)]">{c.hex}</span>
              <span className="text-[var(--house-muted)]">{c.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-sm leading-relaxed text-[var(--house-muted)]">
          Tokens as CSS: <a href="/brand/kit/house.css" download className="text-[var(--house-ink)] underline underline-offset-4">house.css</a>. Pantone matches are unproofed until a vendor draws them down.
        </p>

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-[-0.01em]">Built by lecturesfrom</h2>
        <p className="mt-4 font-mono text-sm leading-relaxed text-[var(--house-ink)]">
          Products like punch2pen keep their own name, colors and type. They carry one line, built by lecturesfrom, on the back: footer, about panel, installer, sleeve back. Small caps mono, one color, the product&apos;s own ink. Never inside the product logo, never in house orange.
        </p>

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
