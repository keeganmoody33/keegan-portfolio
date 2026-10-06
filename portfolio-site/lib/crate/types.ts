export const CRATE_EMPTY_LINE = 'nothing on file yet'
export const CRATE_PICK_TRACK = 'pick a track for credits and samples'
export const CRATE_UNAVAILABLE_LINE = "couldn't reach discogs"
export const CRATE_NO_RECORDING = 'no matched recording yet'
export const MUSICBRAINZ_USER_AGENT = 'lecturesfrom/1.0 ( 33@lecturesfrom.com )'
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1100
export const CRATE_SCHEMA_VERSION = 1

export type MatchStatus = 'matched' | 'ambiguous' | 'unmatched' | 'pending'

export type SourceName = 'discogs' | 'musicbrainz'

export type DurableErrorKind = 'rate_limit' | 'unavailable' | 'partial' | 'not_found'

export type ProvenanceError = {
  at: string
  kind: DurableErrorKind
  message: string
  attempts: number
}

export type Provenance = {
  sourceUrls: string[]
  matchStatus: MatchStatus
  confidence: number
  reason: string
  checkedAt: string
  refreshAfter: string
  lastError: ProvenanceError | null
}

export type CollectionEntry = {
  instanceId: number
  releaseId: number
}

export type SourcedText = {
  text: string
  source: SourceName
  sourceUrl: string
}

export type PressingFacts = {
  releaseId: number
  title: string
  artist: string
  label: string | null
  catno: string | null
  format: string | null
  country: string | null
  released: string | null
  year: number | null
  cover: string
  thumbnail: string
  discogsUrl: string
  barcode: string | null
}

export type TrackRecordingRef = {
  matchStatus: MatchStatus
  confidence: number
  reason: string
  mbid: string | null
  recordingUrl: string | null
}

export type TrackOccurrence = {
  position: string
  title: string
  duration: string | null
  durationMs: number | null
  index: number
  recording: TrackRecordingRef
}

export type Credit = {
  name: string
  role: string
  attributes: string[]
  level: 'recording' | 'release' | 'work'
  source: 'musicbrainz'
  sourceUrl: string
}

export type SampleLink = {
  title: string
  artist: string
  mbid: string
  sourceUrl: string
  source: 'musicbrainz'
}

export type StoredRecording = {
  mbid: string
  title: string
  artist: string
  credits: Credit[]
  samplesFrom: SampleLink[]
  sampledIn: SampleLink[]
  provenance: Provenance
}

export type MbReleaseMatch = {
  mbid: string | null
  url: string | null
  matchStatus: MatchStatus
  confidence: number
  reason: string
}

export type StoredPressing = {
  schemaVersion: number
  releaseId: number
  entryInstanceIds: number[]
  facts: PressingFacts
  description: SourcedText | null
  tracks: TrackOccurrence[]
  mbRelease: MbReleaseMatch
  recordings: Record<string, StoredRecording>
  provenance: Provenance
}

export type DiscogsTracklistItem = {
  position: string
  title: string
  duration: string
  type_: string
}

export type MbReleaseTrack = {
  id: string
  number: string
  title: string
  length: number | null
  recording: {
    id: string
    title: string
    length: number | null
    disambiguation: string
  }
}

export type TrackMatchInput = {
  discogs: {
    position: string
    title: string
    durationMs: number | null
    index: number
  }
  mbTracks: Array<{
    index: number
    number: string
    title: string
    lengthMs: number | null
    recordingId: string
    recordingTitle: string
    disambiguation: string
  }>
}

export type TrackMatchResult = {
  matchStatus: MatchStatus
  confidence: number
  reason: string
  recordingId: string | null
}
