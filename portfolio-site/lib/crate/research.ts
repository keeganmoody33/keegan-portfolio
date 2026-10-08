import type { DiscogsReleaseDetail } from './discogs-release.ts'
import {
  isMusicBrainzUnknownArtist,
  type Credit,
  type ResearchFact,
  type SampleLink,
  type SourceName,
  type StoredPressing,
  type TrackOccurrence,
} from './types.ts'

const SOURCE_ORDER: Record<SourceName, number> = {
  musicbrainz: 0,
  discogs: 1,
  wikidata: 2,
}

const ROLE_SYNONYMS: Record<string, string> = {
  producer: 'producer',
  'produced by': 'producer',
  'executive producer': 'executive producer',
  'executive-producer': 'executive producer',
  'exec-producer': 'executive producer',
  'exec producer': 'executive producer',
  'written-by': 'written by',
  'written by': 'written by',
  writer: 'written by',
  composer: 'written by',
  'composed by': 'written by',
  lyricist: 'lyricist',
  'lyrics by': 'lyricist',
  'lyrics': 'lyricist',
  librettist: 'librettist',
  performer: 'performer',
  vocals: 'performer',
  'mastered by': 'mastered by',
  mastering: 'mastered by',
  remix: 'remixer',
  remixer: 'remixer',
  'remixed by': 'remixer',
}

export function normalizeFactText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeCreditRole(role: string): string {
  const collapsed = normalizeFactText(role).replace(/[_/]+/g, ' ').replace(/-/g, ' ')
  return ROLE_SYNONYMS[collapsed] ?? collapsed
}

export function splitCreditRoles(role: string): string[] {
  return role
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function presentSampleArtist(name: string | undefined | null): string {
  let trimmed = (name ?? '').trim()
  trimmed = trimmed.replace(/(?:^|(?<=[&,])|(?<=\s))\[unknown\](?=$|(?=[&,])|(?=\s))/gi, '')
  trimmed = trimmed.replace(/\s+/g, ' ').trim()
  trimmed = trimmed.replace(/(?:\s*[&,]\s*){2,}/g, (chunk) => (chunk.includes('&') ? ' & ' : ', '))
  trimmed = trimmed.replace(/^(?:[&,]\s+)+/g, '')
  trimmed = trimmed.replace(/(?:\s*[&,])+\s*$/g, '')
  trimmed = trimmed.replace(/\s+(?:feat|ft)\.\s*$/i, '')
  trimmed = trimmed.replace(/\s+x\s*$/g, '')
  trimmed = trimmed.replace(/\s+/g, ' ').trim()
  if (!trimmed || isMusicBrainzUnknownArtist(trimmed)) return ''
  return trimmed
}

export function sampleFactIdentityKey(fact: ResearchFact): string {
  return [fact.kind, fact.trackKey, fact.sourceId || fact.sourceUrl].join('\u001f')
}

export function factDedupeKey(fact: ResearchFact): string {
  if (fact.kind === 'sample_of' || fact.kind === 'sampled_by') {
    return sampleFactIdentityKey(fact)
  }
  return [
    fact.kind,
    fact.trackKey,
    fact.kind === 'credit' ? normalizeCreditRole(fact.role) : normalizeFactText(fact.role),
    normalizeFactText(fact.person),
    normalizeFactText(fact.relatedTitle),
    normalizeFactText(fact.relatedArtist),
  ].join('\u001f')
}

function creditIdentityKey(fact: ResearchFact): string {
  return [normalizeCreditRole(fact.role), normalizeFactText(fact.person)].join('\u001f')
}

export function creditLine(credit: Credit): string {
  const attrs = credit.attributes.filter(Boolean).join(' ')
  if (attrs) return `${attrs} ${credit.role}`
  return credit.role
}

export function mergeSampleLinks(...groups: SampleLink[][]): SampleLink[] {
  const index = new Map<string, number>()
  const merged: SampleLink[] = []
  for (const group of groups) {
    for (const link of group) {
      const next = { ...link, artist: presentSampleArtist(link.artist) }
      const key = next.mbid || next.sourceUrl
      const at = index.get(key)
      if (at == null) {
        index.set(key, merged.length)
        merged.push(next)
        continue
      }
      if (next.artist && !merged[at]!.artist) merged[at] = next
    }
  }
  return merged
}

export function mergeResearchFacts(...groups: ResearchFact[][]): ResearchFact[] {
  const ranked = groups
    .flat()
    .slice()
    .sort((left, right) => SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source])
  const seen = new Set<string>()
  const merged: ResearchFact[] = []
  const sampleIndex = new Map<string, number>()
  const creditTracks = new Map<string, Set<string>>()
  const creditReleaseIndex = new Map<string, number>()
  for (const fact of ranked) {
    if (!fact.person && fact.kind === 'credit') continue
    if (fact.kind === 'sample_of' || fact.kind === 'sampled_by') {
      const sample = {
        ...fact,
        relatedArtist: presentSampleArtist(fact.relatedArtist),
      }
      if (!sample.relatedTitle && !sample.relatedArtist) continue
      if (!isRecordingOrReleaseSampleLink(sample)) continue
      const key = factDedupeKey(sample)
      const at = sampleIndex.get(key)
      if (at == null) {
        sampleIndex.set(key, merged.length)
        seen.add(key)
        merged.push(sample)
        continue
      }
      if (sample.relatedArtist && !merged[at]!.relatedArtist) merged[at] = sample
      continue
    }
    if (fact.kind === 'credit') {
      const identity = creditIdentityKey(fact)
      const tracks = creditTracks.get(identity) ?? new Set<string>()
      if (!fact.trackKey) {
        if (tracks.size > 0) continue
        if (creditReleaseIndex.has(identity)) continue
        creditReleaseIndex.set(identity, merged.length)
      } else {
        if (tracks.has(fact.trackKey)) continue
        const releaseAt = creditReleaseIndex.get(identity)
        if (releaseAt != null) {
          merged.splice(releaseAt, 1)
          creditReleaseIndex.delete(identity)
          for (const [key, index] of creditReleaseIndex) {
            if (index > releaseAt) creditReleaseIndex.set(key, index - 1)
          }
        }
        tracks.add(fact.trackKey)
        creditTracks.set(identity, tracks)
      }
    }
    const key = factDedupeKey(fact)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(fact)
  }
  return merged
}

function creditFact(
  credit: Credit,
  track: TrackOccurrence | null,
  fetchedAt: string
): ResearchFact {
  return {
    kind: 'credit',
    trackKey: track?.identityKey ?? '',
    track: track ? { position: track.position, title: track.title } : null,
    role: creditLine(credit),
    person: credit.name,
    relatedTitle: '',
    relatedArtist: '',
    source: credit.source,
    sourceId: credit.providerId ?? credit.name,
    sourceUrl: credit.sourceUrl,
    fetchedAt,
  }
}

function sampleFact(
  kind: 'sample_of' | 'sampled_by',
  sample: SampleLink,
  track: TrackOccurrence | null,
  fetchedAt: string
): ResearchFact {
  return {
    kind,
    trackKey: track?.identityKey ?? '',
    track: track ? { position: track.position, title: track.title } : null,
    role: kind === 'sample_of' ? 'samples' : 'sampled in',
    person: '',
    relatedTitle: sample.title,
    relatedArtist: presentSampleArtist(sample.artist),
    source: sample.source,
    sourceId: sample.providerId ?? sample.mbid,
    sourceUrl: sample.sourceUrl,
    fetchedAt,
  }
}

export function factsFromRecordings(
  pressing: Pick<StoredPressing, 'tracks' | 'recordings'>
): ResearchFact[] {
  const facts: ResearchFact[] = []
  const byMbid = new Map<string, TrackOccurrence[]>()
  for (const track of pressing.tracks) {
    const mbid = track.recording.mbid
    if (!mbid) continue
    const group = byMbid.get(mbid) ?? []
    group.push(track)
    byMbid.set(mbid, group)
  }
  for (const [mbid, tracks] of byMbid) {
    const recording = pressing.recordings[mbid]
    if (!recording) continue
    const fetchedAt =
      recording.provenance.verifiedAt ??
      recording.provenance.checkedAt ??
      recording.provenance.lastAttemptAt ??
      ''
    const targets = tracks.length > 0 ? tracks : [null]
    for (const track of targets) {
      for (const credit of recording.credits) {
        facts.push(creditFact(credit, track, fetchedAt))
      }
      for (const sample of recording.samplesFrom) {
        if (!isRecordingOrReleaseSampleLink(sample)) continue
        facts.push(sampleFact('sample_of', sample, track, fetchedAt))
      }
      for (const sample of recording.sampledIn) {
        if (!isRecordingOrReleaseSampleLink(sample)) continue
        facts.push(sampleFact('sampled_by', sample, track, fetchedAt))
      }
    }
  }
  return facts
}

export function ensureResearchFacts(pressing: StoredPressing): ResearchFact[] {
  return mergeResearchFacts(factsFromRecordings(pressing), pressing.researchFacts ?? [])
}

function matchTracksByPositions(
  tracksField: string | null | undefined,
  tracks: TrackOccurrence[]
): TrackOccurrence[] {
  if (!tracksField?.trim()) return []
  const tokens = tracksField
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length === 0) return []
  const positionOf = (track: TrackOccurrence) => track.position.trim().toLowerCase()
  const matches = (token: string, track: TrackOccurrence) => {
    const position = positionOf(track)
    if (token === position) return true
    if (!position.startsWith(token)) return false
    // Prefix selects a side or subtrack ("A" → "A1", "3" → "3a" / "3.1"),
    // never a longer number: "1" must not match "10" or "20" → "2" etc.
    const last = token.charAt(token.length - 1)
    const next = position.charAt(token.length)
    return !(/\d/.test(last) && /\d/.test(next))
  }
  const picked = new Set<TrackOccurrence>()
  for (const token of tokens) {
    // Discogs range notation, e.g. "A1 to A3": inclusive span in tracklist order.
    const range = token.match(/^(.+?)\s+to\s+(.+)$/)
    if (range) {
      const start = tracks.findIndex((track) => matches(range[1]!.trim(), track))
      let end = -1
      for (let i = tracks.length - 1; i >= 0; i -= 1) {
        if (matches(range[2]!.trim(), tracks[i]!)) {
          end = i
          break
        }
      }
      if (start >= 0 && end >= start) {
        for (const track of tracks.slice(start, end + 1)) picked.add(track)
      }
      continue
    }
    for (const track of tracks) if (matches(token, track)) picked.add(track)
  }
  return tracks.filter((track) => picked.has(track))
}

function pushDiscogsCredit(
  facts: ResearchFact[],
  input: {
    name: string
    role: string
    id: number | null
    track: TrackOccurrence | null
    url: string
    fetchedAt: string
  }
): void {
  const person = input.name.trim()
  if (!person) return
  for (const role of splitCreditRoles(input.role || 'credit')) {
    facts.push({
      kind: 'credit',
      trackKey: input.track?.identityKey ?? '',
      track: input.track
        ? { position: input.track.position, title: input.track.title }
        : null,
      role,
      person,
      relatedTitle: '',
      relatedArtist: '',
      source: 'discogs',
      sourceId: input.id != null ? String(input.id) : person,
      sourceUrl: input.url,
      fetchedAt: input.fetchedAt,
    })
  }
}

export function researchFactsFromDiscogs(
  detail: DiscogsReleaseDetail,
  tracks: TrackOccurrence[],
  fetchedAt: string
): ResearchFact[] {
  const facts: ResearchFact[] = []
  const url = detail.discogsUrl
  const playable = tracks.filter((track) => (track.type_ ?? 'track') !== 'heading' && (track.type_ ?? 'track') !== 'index' && track.title.trim())

  for (const artist of detail.extraartists ?? []) {
    const matched = matchTracksByPositions(artist.tracks, playable)
    // Release-level only when Discogs gave no `tracks` at all. A track-scoped
    // credit we can't resolve stays unmatched rather than landing on every track.
    if (artist.tracks?.trim() && matched.length === 0) continue
    const targets = matched.length > 0 ? matched : [null]
    for (const track of targets) {
      pushDiscogsCredit(facts, {
        name: artist.name,
        role: artist.role,
        id: artist.id,
        track,
        url,
        fetchedAt,
      })
    }
  }

  for (const item of detail.tracklist) {
    const occurrence =
      playable.find(
        (track) =>
          track.position === item.position && track.title === item.title
      ) ??
      playable.find((track) => track.position === item.position) ??
      null
    for (const artist of item.artists ?? []) {
      pushDiscogsCredit(facts, {
        name: artist.name,
        role: 'performer',
        id: artist.id,
        track: occurrence,
        url,
        fetchedAt,
      })
    }
    for (const artist of item.extraartists ?? []) {
      pushDiscogsCredit(facts, {
        name: artist.name,
        role: artist.role,
        id: artist.id,
        track: occurrence,
        url,
        fetchedAt,
      })
    }
  }
  return facts
}

export function factsForTrack(
  facts: ResearchFact[],
  track: TrackOccurrence | null
): ResearchFact[] {
  if (!track) {
    return facts.filter((fact) => !fact.trackKey)
  }
  const key = track.identityKey ?? ''
  return facts.filter((fact) => !fact.trackKey || fact.trackKey === key)
}

export function creditsFromFacts(facts: ResearchFact[]): ResearchFact[] {
  return facts.filter((fact) => fact.kind === 'credit')
}

export function isRecordingOrReleaseSampleLink(sample: { sourceUrl: string }): boolean {
  return !/musicbrainz\.org\/work\//i.test(sample.sourceUrl ?? '')
}

export function samplesFromFacts(facts: ResearchFact[]): ResearchFact[] {
  return facts.filter(
    (fact) => fact.kind === 'sample_of' && isRecordingOrReleaseSampleLink(fact)
  )
}

export function sampledByFacts(facts: ResearchFact[]): ResearchFact[] {
  return facts.filter(
    (fact) => fact.kind === 'sampled_by' && isRecordingOrReleaseSampleLink(fact)
  )
}
