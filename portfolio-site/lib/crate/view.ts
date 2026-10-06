import {
  CRATE_NO_RECORDING,
  type Credit,
  type ResearchFact,
  type SampleLink,
  type SourceName,
  type StoredPressing,
  type StoredRecording,
  type TrackOccurrence,
} from './types.ts'
import { creditsFromFacts, factsForTrack, sampledByFacts, samplesFromFacts } from './research.ts'

export type Connection = {
  label: string
  title: string
  href: string
  source: SourceName
}

export function checkedDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10)
}

export function checkedNoMatchLine(
  status: string,
  reason: string,
  checked: string | null
): string | null {
  if (status === 'pending' || status === 'matched') return null
  if (status !== 'unmatched' && status !== 'ambiguous') return null
  if (!checked) return null
  const text = reason.trim()
  if (!text || text === CRATE_NO_RECORDING) return null
  return `${text} · checked ${checked}`
}

export function pressingCheckedNoMatchLine(pressing: StoredPressing): string | null {
  return checkedNoMatchLine(
    pressing.provenance.matchStatus,
    pressing.provenance.reason,
    checkedDate(
      pressing.provenance.verifiedAt ??
        pressing.lifecycles?.match.verifiedAt ??
        (pressing.provenance.lastError ? null : pressing.provenance.checkedAt)
    )
  )
}

export function overviewConnections(pressing: StoredPressing, limit = 3): Connection[] {
  const rows: Connection[] = []
  const seen = new Set<string>()
  const facts = pressing.researchFacts ?? []

  function add(row: Connection) {
    const key = `${row.label}:${row.href}`
    if (seen.has(key) || rows.length >= limit) return
    seen.add(key)
    rows.push(row)
  }

  for (const fact of facts) {
    if (fact.kind === 'sample_of') {
      add({
        label: `${fact.track?.title ?? pressing.facts.title} samples`,
        title: fact.relatedArtist
          ? `${fact.relatedArtist} — ${fact.relatedTitle}`
          : fact.relatedTitle,
        href: fact.sourceUrl,
        source: fact.source,
      })
    } else if (fact.kind === 'sampled_by') {
      add({
        label: `${fact.track?.title ?? pressing.facts.title} sampled in`,
        title: fact.relatedArtist
          ? `${fact.relatedArtist} — ${fact.relatedTitle}`
          : fact.relatedTitle,
        href: fact.sourceUrl,
        source: fact.source,
      })
    }
  }

  if (rows.length >= limit) return rows

  for (const track of pressing.tracks) {
    const mbid = track.recording.mbid
    if (!mbid) continue
    const recording = pressing.recordings[mbid]
    if (!recording) continue
    for (const sample of recording.samplesFrom) {
      add({
        label: `${track.title} samples`,
        title: sample.artist ? `${sample.artist} — ${sample.title}` : sample.title,
        href: sample.sourceUrl,
        source: sample.source,
      })
    }
    for (const sample of recording.sampledIn) {
      add({
        label: `${track.title} sampled in`,
        title: sample.artist ? `${sample.artist} — ${sample.title}` : sample.title,
        href: sample.sourceUrl,
        source: sample.source,
      })
    }
  }

  if (rows.length >= limit) return rows

  for (const fact of creditsFromFacts(facts)) {
    if (!notableFact(fact)) continue
    add({
      label: fact.role,
      title: fact.person,
      href: fact.sourceUrl,
      source: fact.source,
    })
  }

  for (const recording of Object.values(pressing.recordings) as StoredRecording[]) {
    for (const credit of recording.credits) {
      if (!notableCredit(credit)) continue
      add({
        label: creditLine(credit),
        title: recording.title,
        href: credit.sourceUrl,
        source: credit.source,
      })
    }
  }

  return rows
}

export function creditLine(credit: Credit): string {
  const attrs = credit.attributes.filter(Boolean).join(' ')
  if (attrs) return `${attrs} ${credit.role}`
  return credit.role
}

function notableCredit(credit: Credit): boolean {
  const role = credit.role.toLowerCase()
  if (role === 'producer' || role === 'vocal' || role === 'performer') return true
  return credit.attributes.includes('guest')
}

function notableFact(fact: ResearchFact): boolean {
  const role = fact.role.toLowerCase()
  return role === 'producer' || role === 'vocal' || role === 'performer'
}

export function factRows(pressing: StoredPressing): Array<{ label: string; value: string; tone: 'ink' | 'dim' }> {
  const facts = pressing.facts
  const rows: Array<{ label: string; value: string; tone: 'ink' | 'dim' }> = []
  if (facts.label) rows.push({ label: 'label', value: facts.label, tone: 'ink' })
  if (facts.catno) rows.push({ label: 'catno', value: facts.catno, tone: 'dim' })
  if (facts.format) rows.push({ label: 'format', value: facts.format, tone: 'ink' })
  if (facts.country) rows.push({ label: 'country', value: facts.country, tone: 'ink' })
  if (facts.released) rows.push({ label: 'released', value: facts.released, tone: 'dim' })
  return rows
}

export function trackResearchFacts(
  pressing: StoredPressing,
  track: TrackOccurrence | null
): ResearchFact[] {
  return factsForTrack(pressing.researchFacts ?? [], track)
}

export function trackCreditFacts(pressing: StoredPressing, track: TrackOccurrence | null): ResearchFact[] {
  return creditsFromFacts(trackResearchFacts(pressing, track))
}

export function trackSampleFacts(pressing: StoredPressing, track: TrackOccurrence | null): ResearchFact[] {
  return samplesFromFacts(trackResearchFacts(pressing, track))
}

export function trackSampledByFacts(pressing: StoredPressing, track: TrackOccurrence | null): ResearchFact[] {
  return sampledByFacts(trackResearchFacts(pressing, track))
}

export type SampleLinkView = SampleLink
