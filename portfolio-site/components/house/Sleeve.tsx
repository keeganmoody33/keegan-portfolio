import IssuePlate from '@/components/house/IssuePlate'
import type { Sleeve as SleeveRecord } from '@/lib/catalog'
import type { ReactNode } from 'react'

function SquareCover({ sleeve }: { sleeve: SleeveRecord }) {
  if (!sleeve.cover) return <IssuePlate sleeve={sleeve} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={sleeve.cover} alt={`${sleeve.title} cover`} className="aspect-square w-full object-cover" />
  )
}

function WordmarkCover({ sleeve }: { sleeve: SleeveRecord }) {
  if (!sleeve.cover) return null
  return (
    <figure className="house-sleeve-wordmark">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sleeve.cover} alt="yadiggg wordmark" />
    </figure>
  )
}

function StudyHeader({ sleeve }: { sleeve: SleeveRecord }) {
  return (
    <header className="mb-5">
      <p className="house-meta">
        {sleeve.catno} · {sleeve.format} · {sleeve.year}
      </p>
      <h1 className="mt-1 font-display text-xl font-semibold leading-tight tracking-[-0.01em] sm:text-2xl">
        {sleeve.title}
      </h1>
    </header>
  )
}

function StudyNotes({ sleeve }: { sleeve: SleeveRecord }) {
  return (
    <div className="mt-8 space-y-4 font-mono text-sm leading-relaxed text-[var(--house-ink)]">
      <p className="text-[var(--house-orange)]">{sleeve.aside}</p>
      <p>{sleeve.notes}</p>
      <p className="text-[var(--house-muted)]">why: {sleeve.why}</p>
      <p className="text-[var(--house-muted)]">not this: {sleeve.notThis}</p>
      {sleeve.credits.length > 0 && (
        <p className="house-meta pt-2">credits · {sleeve.credits.join(' · ')}</p>
      )}
    </div>
  )
}

function Liner({ sleeve }: { sleeve: SleeveRecord }) {
  return (
    <div className="flex flex-col justify-between">
      <div>
        <p className="house-meta">
          {sleeve.catno} · {sleeve.format} · {sleeve.year}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.01em] sm:text-6xl">{sleeve.title}</h1>
        <p className="mt-3 font-mono text-sm text-[var(--house-orange)]">{sleeve.aside}</p>
      </div>
      <div className="mt-8 space-y-4 font-mono text-sm leading-relaxed text-[var(--house-ink)]">
        <p>{sleeve.notes}</p>
        <p className="text-[var(--house-muted)]">why: {sleeve.why}</p>
        <p className="text-[var(--house-muted)]">not this: {sleeve.notThis}</p>
        {sleeve.credits.length > 0 && (
          <p className="house-meta pt-2">credits · {sleeve.credits.join(' · ')}</p>
        )}
      </div>
    </div>
  )
}

export default function Sleeve({ sleeve, study }: { sleeve: SleeveRecord; study?: ReactNode }) {
  const contents = (
    <section className="mt-12 border-t border-[var(--house-line)] pt-6" aria-label="contents">
      <h2 className="house-meta mb-4">contents</h2>
      {sleeve.tracks.length === 0 ? (
        <p className="font-mono text-sm text-[var(--house-dim)]">empty pocket</p>
      ) : (
        <ol className="list-none p-0">
          {sleeve.tracks.map((track) => (
            <li key={`${track.no}-${track.title}`} className="border-t border-[var(--house-line)] last:border-b">
              {track.href ? (
                <a
                  href={track.href}
                  className="flex items-baseline gap-4 py-3 font-mono text-sm hover:text-[var(--house-orange)]"
                  rel={track.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  target={track.href.startsWith('http') ? '_blank' : undefined}
                >
                  <span className="text-[var(--house-dim)]">{track.no}</span>
                  <span>{track.title}</span>
                  <span className="ml-auto text-[11px] tracking-[0.16em] uppercase text-[var(--house-muted)]">
                    {track.kind}
                  </span>
                </a>
              ) : (
                <div className="flex items-baseline gap-4 py-3 font-mono text-sm">
                  <span className="text-[var(--house-dim)]">{track.no}</span>
                  <span>{track.title}</span>
                  <span className="ml-auto text-[11px] tracking-[0.16em] uppercase text-[var(--house-muted)]">
                    {track.kind}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )

  if (study) {
    return (
      <article>
        <StudyHeader sleeve={sleeve} />
        {study}
        <WordmarkCover sleeve={sleeve} />
        <StudyNotes sleeve={sleeve} />
        {contents}
      </article>
    )
  }

  return (
    <article>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <SquareCover sleeve={sleeve} />
        </div>
        <Liner sleeve={sleeve} />
      </div>
      {contents}
    </article>
  )
}
