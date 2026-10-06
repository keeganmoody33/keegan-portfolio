import type { Credit, SampleLink, StoredPressing, StoredRecording } from './types.ts'

export type Connection = {
  label: string
  title: string
  href: string
  source: 'musicbrainz'
}

export function checkedDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10)
}

export function overviewConnections(pressing: StoredPressing, limit = 3): Connection[] {
  const rows: Connection[] = []
  const seen = new Set<string>()

  function add(row: Connection) {
    const key = `${row.label}:${row.href}`
    if (seen.has(key) || rows.length >= limit) return
    seen.add(key)
    rows.push(row)
  }

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
        source: 'musicbrainz',
      })
    }
    for (const sample of recording.sampledIn) {
      add({
        label: `${track.title} sampled in`,
        title: sample.artist ? `${sample.artist} — ${sample.title}` : sample.title,
        href: sample.sourceUrl,
        source: 'musicbrainz',
      })
    }
  }

  if (rows.length >= limit) return rows

  for (const recording of Object.values(pressing.recordings) as StoredRecording[]) {
    for (const credit of recording.credits) {
      if (!notableCredit(credit)) continue
      add({
        label: creditLine(credit),
        title: recording.title,
        href: credit.sourceUrl,
        source: 'musicbrainz',
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

export type SampleLinkView = SampleLink
