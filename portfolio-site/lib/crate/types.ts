export const CRATE_EMPTY_LINE = 'nothing on file yet'
export const CRATE_PICK_TRACK = 'pick a track for credits and samples'
export const CRATE_UNAVAILABLE_LINE = "couldn't reach discogs"
export const CRATE_NO_RECORDING = 'no matched recording yet'
export const MUSICBRAINZ_USER_AGENT = 'lecturesfrom/1.0 ( 33@lecturesfrom.com )'
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1100
export const CRATE_SCHEMA_VERSION = 2
export const CRATE_MAX_ATTEMPTS = 5
export const CRATE_RESEARCH_REFRESH_MS = 180 * 24 * 60 * 60 * 1000

export type MatchStatus = 'matched' | 'ambiguous' | 'unmatched' | 'pending'

export type SourceName = 'discogs' | 'musicbrainz'

export type DurableErrorKind =
  | 'rate_limit'
  | 'unavailable'
  | 'partial'
  | 'not_found'
  | 'auth'
  | 'ambiguous'
  | 'exhausted'

export type LifecycleName = 'pressing' | 'match' | 'research'

export type ProvenanceError = {
  at: string
  kind: DurableErrorKind
  message: string
  attempts: number
}

export type FetchState = {
  verifiedAt: string | null
  lastAttemptAt: string | null
  lastError: ProvenanceError | null
  attempts: number
}

export type Lifecycles = {
  pressing: FetchState
  match: FetchState
  research: FetchState
}

export type Coverage = {
  tracks: number
  matched: number
  withCredits: number
  withSamples: number
}

export type CrateCheckpoint = {
  stage: LifecycleName
  researchCursor: number
}

export type SourcedRef = {
  source: SourceName
  sourceUrl: string
  providerId: string
}

export type Provenance = {
  sourceUrls: string[]
  matchStatus: MatchStatus
  confidence: number
  reason: string
  checkedAt: string
  refreshAfter: string
  lastError: ProvenanceError | null
  verifiedAt?: string | null
  lastAttemptAt?: string | null
}

export type DeadLetter = {
  releaseId: number
  kind: DurableErrorKind
  message: string
  attempts: number
  at: string
  stage: LifecycleName | 'queue'
}

export type BackfillState = {
  cursor: number
  startedAt: string
  updatedAt: string
  completed: number
  unresolved: number
  failed: number
  discogsRequests: number
  mbRequests: number
  status: 'running' | 'idle' | 'auth_stop' | 'rate_limit'
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
  type_?: string
  identityKey?: string
  recording: TrackRecordingRef
}

export type Credit = {
  name: string
  role: string
  attributes: string[]
  level: 'recording' | 'release' | 'work'
  source: 'musicbrainz'
  sourceUrl: string
  providerId?: string
}

export type SampleLink = {
  title: string
  artist: string
  mbid: string
  sourceUrl: string
  source: 'musicbrainz'
  providerId?: string
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
  factsSource?: SourcedRef
  description: SourcedText | null
  tracks: TrackOccurrence[]
  mbRelease: MbReleaseMatch
  recordings: Record<string, StoredRecording>
  provenance: Provenance
  lifecycles?: Lifecycles
  coverage?: Coverage
  checkpoint?: CrateCheckpoint | null
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
