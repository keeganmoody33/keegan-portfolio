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

function WordmarkCover() {
  return (
    <figure className="house-sleeve-wordmark">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/catalog/yadiggg/wordmark.png" alt="yadiggg" />
    </figure>
  )
}

function StudyNotes({ sleeve }: { sleeve: SleeveRecord }) {
  return (
    <div className="mt-8 space-y-4 font-mono text-sm leading-relaxed text-[var(--house-ink)]">
      <p className="text-[var(--house-ink)]">{sleeve.aside}</p>
      <p>{sleeve.notes}</p>
      <p className="text-[var(--house-muted)]">{sleeve.why}</p>

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
          {sleeve.catno} · {sleeve.format} · {sleeve.year} · {sleeve.status}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.01em] sm:text-6xl">{sleeve.title}</h1>
        <p className="mt-3 font-mono text-sm text-[var(--house-ink)]">{sleeve.aside}</p>
        <a href="#project-links" className="house-button mt-6">project sites + source <span aria-hidden="true">↘</span></a>
      </div>
      <div className="mt-8 space-y-4 font-mono text-sm leading-relaxed text-[var(--house-ink)]">
        <p>{sleeve.notes}</p>
        <p className="text-[var(--house-muted)]">{sleeve.why}</p>

        {sleeve.credits.length > 0 && (
          <p className="house-meta pt-2">credits · {sleeve.credits.join(' · ')}</p>
        )}
      </div>
    </div>
  )
}

export default function Sleeve({ sleeve, study }: { sleeve: SleeveRecord; study?: ReactNode }) {
  const contents = (
    <section id="project-links" className="mt-12 border-t border-[var(--house-line)] pt-6" aria-label="project links">
      <h2 className="house-meta mb-2">explore the project</h2>
      <p className="mb-5 font-mono text-sm text-[var(--house-muted)]">project sites and source code open in a new tab.</p>
      {sleeve.tracks.length === 0 ? (
        <p className="font-mono text-sm text-[var(--house-dim)]">project links will appear here when they are ready.</p>
      ) : (
        <ol className="list-none p-0">
          {sleeve.tracks.map((track) => (
            <li key={`${track.no}-${track.title}`} className="border-t border-[var(--house-line)] last:border-b">
              {track.href ? (
                <a
                  href={track.href}
                  className="flex min-h-12 items-center gap-4 py-4 font-mono text-sm hover:text-[var(--house-orange)]"
                  rel={track.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  target={track.href.startsWith('http') ? '_blank' : undefined}
                >
                  <span className="text-[var(--house-dim)]">{track.no}</span>
                  <span className="house-track-title">{track.kind === 'site' ? `visit ${sleeve.title}` : track.kind === 'repo' ? `view ${sleeve.title} on github` : track.title}</span>
                  <span className="ml-auto text-[11px] tracking-[0.16em] uppercase text-[var(--house-muted)]">
                    {track.kind} <span aria-hidden="true">↗</span>
                  </span>
                </a>
              ) : (
                <div className="flex items-baseline gap-4 py-3 font-mono text-sm">
                  <span className="text-[var(--house-dim)]">{track.no}</span>
                  <span className="house-track-title">{track.kind === 'site' ? `visit ${sleeve.title}` : track.kind === 'repo' ? `view ${sleeve.title} on github` : track.title}</span>
                  <span className="ml-auto text-[11px] tracking-[0.16em] uppercase text-[var(--house-muted)]">
                    {track.kind} <span aria-hidden="true">↗</span>
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
        {study}
        <header className="mt-10">
          <p className="house-meta">
            {sleeve.catno} · {sleeve.format} · {sleeve.year} · {sleeve.status}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.01em] sm:text-6xl">
            {sleeve.title}
          </h1>
        </header>
        <WordmarkCover />
        <StudyNotes sleeve={sleeve} />
        {contents}
      </article>
    )
  }

  return (
    <article>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="order-2 lg:order-none">
          <SquareCover sleeve={sleeve} />
        </div>
        <Liner sleeve={sleeve} />
      </div>
      {contents}
    </article>
  )
}
