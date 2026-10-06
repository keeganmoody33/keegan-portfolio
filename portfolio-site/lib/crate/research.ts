import type { DiscogsReleaseDetail } from './discogs-release.ts'
import type {
  Credit,
  ResearchFact,
  SampleLink,
  SourceName,
  StoredPressing,
  TrackOccurrence,
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
  composer: 'composer',
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

export function factDedupeKey(fact: ResearchFact): string {
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

export function mergeResearchFacts(...groups: ResearchFact[][]): ResearchFact[] {
  const ranked = groups
    .flat()
    .slice()
    .sort((left, right) => SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source])
  const seen = new Set<string>()
  const merged: ResearchFact[] = []
  const creditTracks = new Map<string, Set<string>>()
  const creditReleaseIndex = new Map<string, number>()
  for (const fact of ranked) {
    if (!fact.person && fact.kind === 'credit') continue
    if (
      (fact.kind === 'sample_of' || fact.kind === 'sampled_by') &&
      !fact.relatedTitle &&
      !fact.relatedArtist
    ) {
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
    role: credit.role,
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
    relatedArtist: sample.artist,
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
        facts.push(sampleFact('sample_of', sample, track, fetchedAt))
      }
      for (const sample of recording.sampledIn) {
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
  return tracks.filter((track) => {
    const position = track.position.trim().toLowerCase()
    return tokens.some((token) => token === position || position.startsWith(token))
  })
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

export function samplesFromFacts(facts: ResearchFact[]): ResearchFact[] {
  return facts.filter((fact) => fact.kind === 'sample_of')
}

export function sampledByFacts(facts: ResearchFact[]): ResearchFact[] {
  return facts.filter((fact) => fact.kind === 'sampled_by')
}
