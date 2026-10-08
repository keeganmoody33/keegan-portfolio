/**
 * Crate matching, failure-preservation, and new-entry detection tests.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/crate/crate.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  classifyReleaseMatch,
  detectNewReleaseIds,
  matchDiscogsTrackToMb,
  normalizePosition,
  normalizeTitle,
  parseDurationToMs,
  compareTrackLevelRecordings,
  pickTrackLevelRecordings,
  songTitle,
  artistsMatch,
  stripFeaturingCredits,
  trackLevelHitOutranksPrior,
} from './match.ts'
import { AUTH_RETRY_MS, isoFromMs, keepPriorMatch, nextBackoffMs, preservePressingOnFailure, shouldRefreshPressing, SUCCESS_REFRESH_MS, withClearedDeadlineStops } from './preserve.ts'
import { createMemoryCrateStore, crateRedisKeys, DRAFT_TTL_SECONDS, INFLIGHT_TTL_SECONDS, TAKE_LUA, ENQUEUE_LUA, NACK_LUA, RELEASE_LOCK_LUA, REFRESH_LOCK_LUA, selectEnrichLockToken, type CrateStore } from './store.ts'
import { queueNewAndMissing } from './sync.ts'
import { enrichPressing, failRefreshFromEnv, occurrencesFromDetail, processEnrichmentQueue, sentencesFrom, classifyQueueOutcome, shouldSkipMatch, shouldReuseDraft, resumeForceRefreshTrackCursor, isForceRunStampFresh, isWikidataOnlyLastError, WorkerDeadlineError, isBackfillSettled, deadlineBackoffMs, remainingBelowTakeFloor, DEADLINE_STOP_LIMIT, ENRICH_TAKE_FLOOR_MS, ENRICH_BUDGET_MS, CLI_BACKFILL_BUDGET_MS, ENRICH_LOCK_SECONDS, ENRICH_LOCK_HEARTBEAT_MS, ENRICH_LOCK_HEARTBEAT_REQUESTS, INCOMPLETE_RECORDING_MESSAGE, TRACK_LEVEL_ANNOTATE_CAP, TRACK_LEVEL_FETCH_CAP, TRACK_LEVEL_REASON, overlayTrackLevelProgress, applyDeadlineStop, persistTrackLevelDocs, shouldStopWalkOnRateLimit, createEnrichLockHeartbeat, isEnrichLockLostError } from './enrich.ts'
import { isUnusableDiscogsNotes, resolveDescription, withReadableDescription } from './description.ts'
import { COLLECTION_KEEP_PATH, scheduleKeepPing } from './keep-ping.ts'
import { runCrateEnrichCron } from './keep.ts'
import { crateProofAllowed, parseProofAction, PROOF_KILL_ID, runCrateProof } from './proof.ts'
import {
  MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
  MB_SAMPLES_MATERIAL_RELEASE_TYPE_ID,
  MUSICBRAINZ_INTERVAL_JITTER_MS,
  MUSICBRAINZ_MIN_INTERVAL_MS,
  MUSICBRAINZ_RETRY_AFTER_CAP_MS,
  MUSICBRAINZ_UNKNOWN_ARTIST_MBID,
  MusicBrainzRateLimitError,
  MusicBrainzTimeoutError,
  artistCreditName,
  createMusicBrainzClient,
  musicbrainzRetryAfterMs,
  readRetryAfterMs,
  RECORDING_SEARCH_LIMIT,
  RECORDING_SEARCH_MAX_PAGES,
  type MusicBrainzClient,
} from './musicbrainz.ts'
import { CRATE_MAX_ATTEMPTS, CRATE_SCHEMA_VERSION, type ResearchFact, type SampleLink, type StoredPressing, type StoredRecording, type TrackOccurrence } from './types.ts'
import { mapRelease, parseDurableCollection, DiscogsAuthError, DiscogsNotFoundError, DiscogsRateLimitError, DISCOGS_RATE_LIMIT_MESSAGE, createMemoryLastGoodStore } from '../discogs.ts'
import { createMemoryDurableStore } from '../discogs-store.ts'
import { fixturePressing, parseReleaseParam, readStoredPressing, unavailableHeading, unavailablePressing } from './read.ts'
import { factRows, overviewConnections, pressingCheckedNoMatchLine, trackSampleFacts } from './view.ts'
import { cronSecretEqual } from './cron-auth.ts'
import { coverageOf, hydratePressing, isPlayableOccurrence, shouldQueuePressing, trackIdentityKey } from './lifecycle.ts'
import { DISCOGS_RELEASE_TIMEOUT_MS, errorForDiscogsStatus, fetchDiscogsReleaseDetail, mapDiscogsReleaseDetail, probeDiscogsIdentity } from './discogs-release.ts'
import { creditLine, factsFromRecordings, isRecordingOrReleaseSampleLink, mergeResearchFacts, mergeSampleLinks, normalizeCreditRole, presentSampleArtist, researchFactsFromDiscogs, samplesFromFacts } from './research.ts'
import {
  createWikidataClient,
  getSharedWikidataClient,
  lookupWikidataReleaseFacts,
  pickWikidataIdentity,
  researchFactsFromWikidataBindings,
  resetSharedWikidataClient,
  WikidataTemporaryError,
  wikidataReleaseQuery,
} from './wikidata.ts'
import { inspectCrate, migrateSettledIds, parseBackfillBudgetMs, parseIdList, remainingBackfillIds, retryBackfillTargets, runBackfill } from './backfill.ts'

function pressingStub(overrides: Partial<StoredPressing> = {}): StoredPressing {
  return {
    schemaVersion: CRATE_SCHEMA_VERSION,
    releaseId: 573292,
    entryInstanceIds: [1],
    facts: {
      releaseId: 573292,
      title: 'Bootsy? Player Of The Year',
      artist: "Bootsy's Rubber Band",
      label: 'Warner Bros. Records',
      catno: 'BSK 3093',
      format: 'Vinyl, LP, Album',
      country: 'US',
      released: '1978',
      year: 1978,
      cover: 'https://img.discogs.com/bootsy.jpg',
      thumbnail: 'https://img.discogs.com/bootsy-thumb.jpg',
      discogsUrl: 'https://www.discogs.com/release/573292',
      barcode: null,
    },
    description: null,
    tracks: [
      {
        position: 'A1',
        title: "Bootsy? (What's The Name Of This Town)",
        duration: '6:59',
        durationMs: 419000,
        index: 0,
        recording: {
          matchStatus: 'matched',
          confidence: 0.9,
          reason: 'matched',
          mbid: '08b1c4e3-b0eb-4dd2-b870-740d6eebe627',
          recordingUrl: 'https://musicbrainz.org/recording/08b1c4e3-b0eb-4dd2-b870-740d6eebe627',
        },
      },
    ],
    mbRelease: {
      mbid: '72089134-a550-446e-b26d-8d3b523b05d6',
      url: 'https://musicbrainz.org/release/72089134-a550-446e-b26d-8d3b523b05d6',
      matchStatus: 'matched',
      confidence: 0.95,
      reason: 'discogs url',
    },
    recordings: {},
    provenance: {
      sourceUrls: ['https://www.discogs.com/release/573292'],
      matchStatus: 'matched',
      confidence: 0.95,
      reason: 'discogs url',
      checkedAt: '2026-10-01T00:00:00.000Z',
      refreshAfter: '2026-11-01T00:00:00.000Z',
      lastError: null,
    },
    ...overrides,
  }
}

describe('duration and title helpers', () => {
  it('parses mm:ss and rejects junk', () => {
    assert.equal(parseDurationToMs('6:59'), 419000)
    assert.equal(parseDurationToMs('1:02:03'), 3723000)
    assert.equal(parseDurationToMs(''), null)
    assert.equal(parseDurationToMs('nope'), null)
  })

  it('normalizes curly quotes and positions', () => {
    assert.equal(
      normalizeTitle("Bootsy? (What’s The Name Of This Town)"),
      normalizeTitle("Bootsy? (What's The Name Of This Town)")
    )
    assert.equal(normalizePosition('A-1'), 'a1')
    assert.equal(normalizePosition('A+1'), 'a+1')
    assert.equal(normalizePosition('1-1'), '1')
    assert.equal(normalizePosition('1-3'), '3')
    assert.equal(normalizePosition('2-1'), '2-1')
    assert.equal(normalizePosition('11'), '11')
  })

  it('strips mix suffixes for song-title matching and refuses a different artist', () => {
    assert.equal(songTitle('Juicy Fruit (Vocal)'), 'juicy fruit')
    assert.equal(songTitle('Juicy Fruit ("Fruity" Instrumental Mix)'), 'juicy fruit')
    const hits = [
      { mbid: 'wrong-artist', title: 'Juicy Fruit', artist: 'Someone Else', lengthMs: 355000, score: 99 },
      { mbid: 'far', title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 500000, score: 80 },
      { mbid: 'close', title: 'Juicy Fruit (Album Version)', artist: 'Mtume', lengthMs: 356000, score: 70 },
    ]
    const picked = pickTrackLevelRecordings(hits, {
      artist: 'Mtume',
      title: 'Juicy Fruit (Vocal)',
      durationMs: 355000,
    })
    assert.deepEqual(
      picked.map((hit) => hit.mbid),
      ['close']
    )
  })

  it('strips feat/ft/featuring from artist and title before matching', () => {
    assert.equal(stripFeaturingCredits('Mtume feat. Tawatha Agee'), 'Mtume')
    assert.equal(stripFeaturingCredits('Juicy Fruit (feat. The Notorious B.I.G.)'), 'Juicy Fruit')
    assert.equal(artistsMatch('Mtume ft. Tawatha', 'Mtume'), true)
    assert.equal(songTitle('Juicy Fruit featuring Biggie'), 'juicy fruit')
    const picked = pickTrackLevelRecordings(
      [{ mbid: 'ok', title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 355000, score: 70 }],
      { artist: 'Mtume feat. Tawatha Agee', title: 'Juicy Fruit (feat. Biggie)', durationMs: 355000 }
    )
    assert.deepEqual(picked.map((hit) => hit.mbid), ['ok'])
  })

  it('rejects recording-level hits whose duration is more than 15s off', () => {
    const picked = pickTrackLevelRecordings(
      [
        { mbid: 'far', title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 500000, score: 99 },
        { mbid: 'close', title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 360000, score: 50 },
      ],
      { artist: 'Mtume', title: 'Juicy Fruit (Vocal)', durationMs: 355000 }
    )
    assert.deepEqual(picked.map((hit) => hit.mbid), ['close'])
    assert.equal(TRACK_LEVEL_FETCH_CAP, 1)
  })

  it('picks the samples-material recording for Mtume vocal even when search order shuffles', () => {
    const juicyMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const otherMbid = '1aaf2f49-2ba3-4b34-9196-64d5cb0cc0dc'
    const discogs = {
      artist: 'Mtume',
      title: 'Juicy Fruit (Vocal)',
      durationMs: 355000,
    }
    const juicy = {
      mbid: juicyMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
      hasSamples: true,
    }
    const other = {
      mbid: otherMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
      hasSamples: false,
    }
    for (const hits of [
      [other, juicy],
      [juicy, other],
    ]) {
      const picked = pickTrackLevelRecordings(hits, discogs)
      assert.equal(picked[0]?.mbid, juicyMbid)
    }
    const kept = pickTrackLevelRecordings([other, juicy], discogs, { priorMbid: juicyMbid })
    assert.equal(kept[0]?.mbid, juicyMbid)
    const samplesBeatSaved = pickTrackLevelRecordings([other, juicy], discogs, {
      priorMbid: otherMbid,
    })
    assert.equal(samplesBeatSaved[0]?.mbid, juicyMbid)
    const upgraded = pickTrackLevelRecordings(
      [
        { ...other, score: 101 },
        { ...juicy, score: 100 },
      ],
      discogs,
      { priorMbid: juicyMbid }
    )
    assert.equal(upgraded[0]?.mbid, otherMbid)
  })

  it('breaks equal-score ties by samples, then duration closeness, then lowest mbid', () => {
    const discogs = {
      artist: 'Mtume',
      title: 'Juicy Fruit (Vocal)',
      durationMs: 355000,
    }
    const fartherLowMbid = {
      mbid: 'aaaa0000-0000-0000-0000-000000000000',
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 360000,
      score: 100,
      hasSamples: false,
    }
    const closerHighMbid = {
      mbid: 'zzzz0000-0000-0000-0000-000000000000',
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
      hasSamples: false,
    }
    assert.ok(
      compareTrackLevelRecordings(closerHighMbid, fartherLowMbid, discogs.durationMs) < 0
    )
    const byDuration = pickTrackLevelRecordings([fartherLowMbid, closerHighMbid], discogs)
    assert.equal(byDuration[0]?.mbid, closerHighMbid.mbid)
    const samplesBeatDuration = pickTrackLevelRecordings(
      [
        { ...closerHighMbid, hasSamples: false },
        { ...fartherLowMbid, hasSamples: true },
      ],
      discogs
    )
    assert.equal(samplesBeatDuration[0]?.mbid, fartherLowMbid.mbid)
    const sticky = pickTrackLevelRecordings([fartherLowMbid, closerHighMbid], discogs, {
      priorMbid: fartherLowMbid.mbid,
    })
    assert.equal(sticky[0]?.mbid, fartherLowMbid.mbid)
    assert.equal(
      trackLevelHitOutranksPrior(closerHighMbid, fartherLowMbid),
      false
    )
  })

  it('ranks missing duration after any known duration in every input order', () => {
    const discogs = {
      artist: 'Mtume',
      title: 'Juicy Fruit (Vocal)',
      durationMs: 355000,
    }
    const knownClose = {
      mbid: 'bbbb0000-0000-0000-0000-000000000000',
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
      hasSamples: false,
    }
    const knownFar = {
      mbid: 'cccc0000-0000-0000-0000-000000000000',
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 360000,
      score: 100,
      hasSamples: false,
    }
    const missing = {
      mbid: 'aaaa0000-0000-0000-0000-000000000000',
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: null,
      score: 100,
      hasSamples: false,
    }
    const orders = [
      [missing, knownFar, knownClose],
      [knownClose, missing, knownFar],
      [knownFar, knownClose, missing],
      [missing, knownClose, knownFar],
      [knownClose, knownFar, missing],
      [knownFar, missing, knownClose],
    ]
    for (const order of orders) {
      const picked = pickTrackLevelRecordings(order, discogs)
      assert.equal(picked[0]?.mbid, knownClose.mbid)
      assert.equal(picked[1]?.mbid, knownFar.mbid)
      assert.equal(picked[2]?.mbid, missing.mbid)
    }
    assert.ok(compareTrackLevelRecordings(knownClose, missing, discogs.durationMs) < 0)
    assert.ok(compareTrackLevelRecordings(knownFar, missing, discogs.durationMs) < 0)
    assert.ok(compareTrackLevelRecordings(knownClose, knownFar, discogs.durationMs) < 0)
    assert.ok(compareTrackLevelRecordings(knownClose, missing, discogs.durationMs) < 0)
    assert.ok(
      compareTrackLevelRecordings(knownClose, knownFar, discogs.durationMs) < 0 &&
        compareTrackLevelRecordings(knownFar, missing, discogs.durationMs) < 0
    )
  })

  it('does not pick a recording when the song title does not match', () => {
    const picked = pickTrackLevelRecordings(
      [
        {
          mbid: 'juicy-not-fruit',
          title: 'Juicy',
          artist: 'Mtume',
          lengthMs: 355000,
          score: 100,
        },
      ],
      {
        artist: 'Mtume',
        title: 'Juicy Fruit (Vocal)',
        durationMs: 355000,
      }
    )
    assert.deepEqual(picked, [])
  })
})

describe('track matching', () => {
  const mbTracks = [
    {
      index: 0,
      number: 'A1',
      title: "Bootsy? (What's the Name of This Town)",
      lengthMs: 423333,
      recordingId: 'rec-a1',
      recordingTitle: "Bootsy? (What's the Name of This Town)",
      disambiguation: '',
    },
    {
      index: 1,
      number: 'A2',
      title: 'May the Force Be With You',
      lengthMs: 366706,
      recordingId: 'rec-a2',
      recordingTitle: 'May the Force Be With You',
      disambiguation: '',
    },
  ]

  it('accepts a unique position + title + duration match', () => {
    const result = matchDiscogsTrackToMb({
      discogs: {
        position: 'A1',
        title: "Bootsy? (What's The Name Of This Town)",
        durationMs: 419000,
        index: 0,
      },
      mbTracks,
    })
    assert.equal(result.matchStatus, 'matched')
    assert.equal(result.recordingId, 'rec-a1')
  })

  it('marks vocal/instrumental siblings ambiguous instead of guessing', () => {
    const siblings = [
      {
        index: 0,
        number: '1',
        title: 'Juicy Fruit',
        lengthMs: 355000,
        recordingId: 'rec-vocal',
        recordingTitle: 'Juicy Fruit',
        disambiguation: '',
      },
      {
        index: 1,
        number: '2',
        title: 'Juicy Fruit',
        lengthMs: 424000,
        recordingId: 'rec-inst',
        recordingTitle: 'Juicy Fruit',
        disambiguation: '',
      },
    ]
    const result = matchDiscogsTrackToMb({
      discogs: {
        position: 'A',
        title: 'Juicy Fruit',
        durationMs: 355000,
        index: 0,
      },
      mbTracks: siblings,
    })
    assert.equal(result.matchStatus, 'ambiguous')
    assert.equal(result.recordingId, null)
  })

  it('does not auto-accept a title-only weak match', () => {
    const result = matchDiscogsTrackToMb({
      discogs: {
        position: 'D3',
        title: 'Something Else Entirely',
        durationMs: 180000,
        index: 9,
      },
      mbTracks,
    })
    assert.equal(result.matchStatus, 'unmatched')
    assert.equal(result.recordingId, null)
  })

  it('keeps Goodie Mob vinyl positions matched via index + title when numbers differ', () => {
    const result = matchDiscogsTrackToMb({
      discogs: {
        position: 'A1',
        title: 'The Experience',
        durationMs: 142000,
        index: 0,
      },
      mbTracks: [
        {
          index: 0,
          number: '1',
          title: 'The Experience',
          lengthMs: 142000,
          recordingId: 'rec-exp',
          recordingTitle: 'The Experience',
          disambiguation: '',
        },
      ],
    })
    assert.equal(result.matchStatus, 'matched')
    assert.equal(result.recordingId, 'rec-exp')
  })
})

describe('release matching', () => {
  it('accepts a unique discogs url hit', () => {
    const result = classifyReleaseMatch([
      { mbid: 'mb-1', via: 'discogs_url' },
    ])
    assert.equal(result.matchStatus, 'matched')
    assert.equal(result.mbid, 'mb-1')
  })

  it('marks a missing pressing unmatched so tracks are not guessed', () => {
    const result = classifyReleaseMatch([])
    assert.equal(result.matchStatus, 'unmatched')
    assert.equal(result.mbid, null)
  })
})

describe('new-entry detection', () => {
  it('queues only ids that were not in the previous snapshot', () => {
    assert.deepEqual(detectNewReleaseIds([573292, 240128], [573292, 240128, 567894]), [
      567894,
    ])
    assert.deepEqual(detectNewReleaseIds([], [573292, 240128]), [573292, 240128])
    assert.deepEqual(detectNewReleaseIds([573292], [573292]), [])
  })

  it('enqueues new collection ids through the existing sync hook', async () => {
    const store = createMemoryCrateStore({ seen: [573292] })
    const collection = parseDurableCollection({
      releases: [
        mapRelease({
          instance_id: 1,
          basic_information: {
            id: 573292,
            title: 'Bootsy? Player Of The Year',
            year: 1978,
            artists: [{ name: "Bootsy's Rubber Band" }],
            labels: [{ name: 'Warner Bros. Records', catno: 'BSK 3093' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
        mapRelease({
          instance_id: 2,
          basic_information: {
            id: 567894,
            title: 'Juicy Fruit',
            year: 1983,
            artists: [{ name: 'Mtume' }],
            labels: [{ name: 'Epic', catno: '49-03834' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
      ],
      pagination: { page: 1, pages: 1, items: 2, perPage: 100 },
    })
    assert.ok(collection)
    const result = await queueNewAndMissing(store, [573292], collection, Date.parse('2026-10-06T00:00:00Z'))
    assert.deepEqual(result.newIds, [567894])
    assert.ok(result.queued.includes(567894))
    assert.deepEqual(await store.getSeen(), [573292, 567894])
    assert.ok((await store.getQueue()).includes(567894))
  })
})

describe('failure preservation', () => {
  it('keeps successful tracks when a refresh fails and records backoff', () => {
    const previous = pressingStub()
    const preserved = preservePressingOnFailure(
      previous,
      Date.parse('2026-10-06T00:00:00.000Z'),
      'unavailable',
      'Failed to enrich pressing'
    )
    assert.ok(preserved)
    assert.equal(preserved.tracks[0]?.recording.mbid, previous.tracks[0]?.recording.mbid)
    assert.equal(preserved.facts.title, previous.facts.title)
    assert.equal(preserved.provenance.lastError?.kind, 'unavailable')
    assert.ok(preserved.provenance.refreshAfter > preserved.provenance.checkedAt)
  })

  it('keeps trackSampleCursor when a refresh fails or deadline stops clear', () => {
    const previous = pressingStub({
      checkpoint: { stage: 'research', researchCursor: 2, trackSampleCursor: 4, deadlineStops: 2 },
    })
    const preserved = preservePressingOnFailure(
      previous,
      Date.parse('2026-10-06T00:00:00.000Z'),
      'unavailable',
      'musicbrainz down'
    )
    assert.equal(preserved.checkpoint?.trackSampleCursor, 4)
    assert.equal(preserved.checkpoint?.researchCursor, 2)
    const withForce = pressingStub({
      checkpoint: {
        stage: 'research',
        researchCursor: 2,
        trackSampleCursor: 4,
        deadlineStops: 2,
        forceRun: true,
        forceRunAt: '2026-10-07T16:00:00.000Z',
      },
    })
    const preservedForce = preservePressingOnFailure(
      withForce,
      Date.parse('2026-10-06T00:00:00.000Z'),
      'rate_limit',
      'MusicBrainz rate limited'
    )
    assert.equal(preservedForce.checkpoint?.forceRun, true)
    assert.equal(preservedForce.checkpoint?.forceRunAt, '2026-10-07T16:00:00.000Z')
    assert.equal(preservedForce.checkpoint?.deadlineStops, 0)
    const cleared = withClearedDeadlineStops(withForce)
    assert.equal(cleared.checkpoint?.trackSampleCursor, 4)
    assert.equal(cleared.checkpoint?.researchCursor, 2)
    assert.equal(cleared.checkpoint?.deadlineStops, 0)
    assert.equal(cleared.checkpoint?.forceRun, undefined)
  })

  it('keeps trackSampleCursor when applyDeadlineStop checkpoints a live pressing', async () => {
    const previous = pressingStub({
      checkpoint: { stage: 'research', researchCursor: 2, trackSampleCursor: 4, deadlineStops: 0 },
    })
    const store = createMemoryCrateStore({ pressings: { 573292: previous } })
    await applyDeadlineStop(store, 573292, Date.parse('2026-10-06T00:00:00.000Z'))
    const draft = await store.getDraftPressing(573292)
    assert.equal(draft?.checkpoint?.trackSampleCursor, 4)
    assert.equal(draft?.checkpoint?.researchCursor, 2)
    assert.equal(draft?.checkpoint?.deadlineStops, 1)
  })

  it('does not overwrite a stored pressing with empty data on enrich failure', async () => {
    const previous = pressingStub()
    const store = createMemoryCrateStore({ pressings: { 573292: previous } })
    const result = await enrichPressing(573292, {
      store,
      now: () => Date.parse('2026-10-06T00:00:00.000Z'),
      fetchDiscogs: async () => {
        throw new Error('discogs down')
      },
      mb: createMusicBrainzClientForTests(),
    })
    assert.equal(result.tracks.length, 1)
    assert.equal(result.tracks[0]?.recording.mbid, previous.tracks[0]?.recording.mbid)
    assert.equal(result.provenance.lastError?.kind, 'unavailable')
    const stored = await store.getPressing(573292)
    assert.equal(stored?.tracks[0]?.recording.mbid, previous.tracks[0]?.recording.mbid)
  })

  it('writes an error record with backoff when nothing was stored yet', () => {
    const preserved = preservePressingOnFailure(
      null,
      Date.parse('2026-10-06T00:00:00.000Z'),
      'rate_limit',
      'Too many requests',
      { releaseId: 567894 }
    )
    assert.equal(preserved.releaseId, 567894)
    assert.equal(preserved.provenance.lastError?.kind, 'rate_limit')
    assert.equal(preserved.provenance.lastError?.attempts, 0)
    assert.ok(preserved.provenance.refreshAfter > preserved.provenance.checkedAt)
    assert.equal(preserved.provenance.matchStatus, 'pending')
  })

  it('does not re-research a successful pressing just because refreshAfter passed', () => {
    const stale = pressingStub({
      provenance: {
        ...pressingStub().provenance,
        refreshAfter: '2026-01-01T00:00:00.000Z',
        lastError: null,
      },
    })
    assert.equal(shouldRefreshPressing(stale, Date.parse('2026-10-06T00:00:00.000Z')), false)
    assert.equal(
      shouldRefreshPressing(pressingStub(), Date.parse('2026-10-06T00:00:00.000Z')),
      false
    )
  })

  it('re-queues a successful pressing after refreshAfter when research refresh is on', () => {
    const stale = pressingStub({
      provenance: {
        ...pressingStub().provenance,
        refreshAfter: '2026-01-01T00:00:00.000Z',
        lastError: null,
      },
    })
    const nowMs = Date.parse('2026-10-06T00:00:00.000Z')
    assert.equal(shouldQueuePressing(stale, nowMs, {}), false)
    assert.equal(shouldQueuePressing(stale, nowMs, { CRATE_RESEARCH_REFRESH: '1' }), true)
    assert.equal(
      shouldQueuePressing(pressingStub(), nowMs, { CRATE_RESEARCH_REFRESH: '1' }),
      false
    )
  })

  it('re-queues a failure only after refreshAfter', () => {
    const failed = preservePressingOnFailure(
      pressingStub(),
      Date.parse('2026-10-01T00:00:00.000Z'),
      'unavailable',
      'Failed to enrich pressing'
    )
    assert.equal(shouldQueuePressing(failed, Date.parse('2026-10-01T00:00:00.000Z')), false)
    assert.equal(shouldQueuePressing(failed, Date.parse(failed.provenance.refreshAfter)), true)
  })
})

describe('record detail helpers', () => {
  it('parses release ids and rejects padded or non-numeric values', () => {
    assert.equal(parseReleaseParam('573292'), 573292)
    assert.equal(parseReleaseParam('0573292'), null)
    assert.equal(parseReleaseParam('nope'), null)
  })

  it('does not 404 a crate id when the collection snapshot is missing or empty', async () => {
    const missing = await readStoredPressing(9107339, { store: null, collection: null })
    assert.equal(missing.status, 'unavailable')
    const empty = await readStoredPressing(9107339, { store: null, collection: [] })
    assert.equal(empty.status, 'unavailable')
  })

  it('fills unavailable heading from catno or id and keeps listed catno when redis throws', async () => {
    assert.equal(unavailableHeading(9107339), '9107339')
    assert.equal(unavailableHeading(26098312, { catno: 'BS-1025' }), 'BS-1025')
    const byId = unavailablePressing(9107339)
    assert.equal(byId.facts.title, '9107339')
    assert.equal(byId.facts.catno, '9107339')
    const listed = unavailablePressing(26098312, {
      title: 'Marshall Flippo',
      artist: 'Marshall Flippo',
      year: 0,
      thumbnail: '',
      cover: '',
      format: 'Vinyl',
      label: 'Square Dance',
      catno: 'BS-1025',
      discogsUrl: 'https://www.discogs.com/release/26098312',
      releaseId: 26098312,
      instanceId: 1,
    })
    assert.equal(listed.facts.title, 'BS-1025')
    assert.equal(listed.facts.catno, 'BS-1025')
    const throwing: Pick<CrateStore, 'getPressing'> = {
      getPressing: async () => {
        throw new Error('redis down')
      },
    }
    const down = await readStoredPressing(9107339, {
      store: throwing as CrateStore,
      collection: [
        {
          title: 'One Is A Lonesome Number',
          artist: 'Joe Williams',
          year: 1963,
          thumbnail: '',
          cover: '',
          format: 'Vinyl, LP',
          label: 'Roulette',
          catno: 'R 52102',
          discogsUrl: 'https://www.discogs.com/release/9107339',
          releaseId: 9107339,
          instanceId: 1,
        },
      ],
    })
    assert.equal(down.status, 'unavailable')
    if (down.status === 'unavailable') {
      assert.equal(down.listed?.catno, 'R 52102')
    }
  })

  it('404s only after a populated collection snapshot omits the id', async () => {
    const listed = await readStoredPressing(9107339, {
      store: null,
      collection: [
        {
          title: 'One Is A Lonesome Number',
          artist: 'Joe Williams',
          year: 1963,
          thumbnail: 'https://example.com/t.jpg',
          cover: 'https://example.com/c.jpg',
          format: 'Vinyl, LP',
          label: 'Roulette',
          catno: 'R 52102',
          discogsUrl: 'https://www.discogs.com/release/9107339',
          releaseId: 9107339,
          instanceId: 1,
        },
      ],
    })
    assert.equal(listed.status, 'ok')
    if (listed.status === 'ok') {
      assert.equal(listed.from, 'collection')
      assert.equal(listed.pressing.tracks.length, 0)
    }
    const omitted = await readStoredPressing(9, {
      store: null,
      collection: [
        {
          title: 'One Is A Lonesome Number',
          artist: 'Joe Williams',
          year: 1963,
          thumbnail: '',
          cover: '',
          format: 'Vinyl, LP',
          label: 'Roulette',
          catno: 'R 52102',
          discogsUrl: 'https://www.discogs.com/release/9107339',
          releaseId: 9107339,
          instanceId: 1,
        },
      ],
    })
    assert.equal(omitted.status, 'not_found')
  })

  it('drops missing fact rows instead of inventing placeholders', () => {
    const rows = factRows(
      pressingStub({
        facts: {
          ...pressingStub().facts,
          country: null,
          catno: null,
        },
      })
    )
    assert.deepEqual(
      rows.map((row) => row.label),
      ['label', 'format', 'released']
    )
    assert.equal(
      rows.some((row) => row.value === 'N/A' || row.value === 'Unknown' || row.value === '—'),
      false
    )
  })

  it('renders sample rows without an empty artist slot', () => {
    const pressing = hydratePressing(
      pressingStub({
        researchFacts: [
          {
            kind: 'sampled_by',
            trackKey: '',
            track: { position: 'A1', title: 'Juicy Fruit' },
            role: 'sampled in',
            person: '',
            relatedTitle: 'Juicy',
            relatedArtist: '',
            source: 'musicbrainz',
            sourceId: 'biggie',
            sourceUrl: 'https://musicbrainz.org/recording/biggie',
            fetchedAt: '2026-10-06T00:00:00.000Z',
          },
        ],
      })
    )
    const row = overviewConnections(pressing).find((item) => item.href.includes('biggie'))
    assert.equal(row?.title, 'Juicy')
    assert.equal(row?.title.includes('—'), false)
  })

  it('keeps sourced description to four sentences', () => {
    const text = sentencesFrom(
      'One sentence is long enough here. Two is also long enough here. Three is still long enough here. Four is also long enough here. Five must not appear here at all.'
    )
    assert.ok(text)
    assert.equal(text.includes('Five'), false)
    assert.equal(text.includes('Four is also long enough here.'), true)
  })

  it('keeps the mtume vocal and instrumental tracks ambiguous', () => {
    const pressing = fixturePressing(567894)
    assert.ok(pressing)
    assert.equal(pressing.mbRelease.matchStatus, 'unmatched')
    assert.ok(pressing.tracks.length >= 2)
    assert.ok(pressing.tracks.every((track) => track.recording.matchStatus === 'ambiguous'))
    assert.ok(
      pressing.tracks.every((track) => track.recording.reason.toLowerCase().includes('vocal'))
    )
  })

  it('falls through empty redis error stubs to the committed fixture', async () => {
    const stub = preservePressingOnFailure(
      null,
      Date.parse('2026-10-06T03:17:28.473Z'),
      'rate_limit',
      'Too many requests',
      { releaseId: 567894 }
    )
    const store = createMemoryCrateStore({ pressings: { 567894: stub } })
    const result = await readStoredPressing(567894, { store, collection: null })
    assert.equal(result.status, 'ok')
    if (result.status === 'ok') {
      assert.equal(result.from, 'fixture')
      assert.equal(result.pressing.facts.title, 'Juicy Fruit')
      assert.equal(result.pressing.tracks.length, 2)
      assert.ok(result.pressing.tracks.every((track) => track.recording.matchStatus === 'ambiguous'))
    }
  })
})

function createMusicBrainzClientForTests(): MusicBrainzClient {
  const client = {
    requestCount: 0,
    async lookupDiscogsReleaseUrl() {
      client.requestCount += 1
      return []
    },
    async searchReleaseByBarcode() {
      client.requestCount += 1
      return []
    },
    async searchReleaseByCatno() {
      client.requestCount += 1
      return []
    },
    async searchReleaseByArtistTitle() {
      client.requestCount += 1
      return []
    },
    async searchRecordingsByArtistTitle() {
      client.requestCount += 1
      return []
    },
    async getRelease() {
      client.requestCount += 1
      return null
    },
    async getRecording() {
      client.requestCount += 1
      return null
    },
  }
  return client
}

function throwingMb(message = 'musicbrainz down'): MusicBrainzClient {
  const boom = async () => {
    throw new Error(message)
  }
  return {
    ...createMusicBrainzClientForTests(),
    lookupDiscogsReleaseUrl: boom,
    searchReleaseByBarcode: boom,
    searchReleaseByCatno: boom,
    searchReleaseByArtistTitle: boom,
    searchRecordingsByArtistTitle: boom,
    getRelease: boom,
    getRecording: boom,
  }
}

describe('never-enriched failures persist and back off (P1.2)', () => {
  it('stores an error pressing instead of re-queuing immediately', async () => {
    const store = createMemoryCrateStore({ queue: [567894] })
    const result = await processEnrichmentQueue(
      {
        store,
        now: () => Date.parse('2026-10-06T00:00:00.000Z'),
        fetchDiscogs: async () => {
          throw new Error('discogs down')
        },
        mb: createMusicBrainzClientForTests(),
        budgetMs: 45_000,
        takeFloorMs: 0,
      },
      1
    )
    assert.deepEqual(result.processed, [567894])
    const stored = await store.getPressing(567894)
    assert.ok(stored)
    assert.equal(stored.provenance.lastError?.kind, 'unavailable')
    assert.equal(stored.provenance.lastError?.attempts, 1)
    assert.ok(stored.provenance.refreshAfter > stored.provenance.checkedAt)
    const queue = await store.getQueue()
    assert.ok(queue.includes(567894))
    const due = await store.takeDue(1, Date.parse('2026-10-06T00:00:00.000Z'), INFLIGHT_TTL_SECONDS)
    assert.deepEqual(due, [])
  })

  it('treats Discogs 4xx as terminal unmatched and drops the id', async () => {
    const store = createMemoryCrateStore({ queue: [1] })
    await processEnrichmentQueue(
      {
        store,
        now: () => Date.parse('2026-10-06T00:00:00.000Z'),
        fetchDiscogs: async () => {
          throw new DiscogsNotFoundError()
        },
        mb: createMusicBrainzClientForTests(),
        takeFloorMs: 0,
      },
      1
    )
    const stored = await store.getPressing(1)
    assert.equal(stored?.provenance.matchStatus, 'unmatched')
    assert.equal(stored?.provenance.lastError?.kind, 'not_found')
    assert.deepEqual(await store.getQueue(), [])
  })

  it('uses attempt count for backoff', () => {
    assert.equal(nextBackoffMs(1), 60 * 60 * 1000)
    assert.equal(nextBackoffMs(2), 6 * 60 * 60 * 1000)
    assert.equal(nextBackoffMs(3), 24 * 60 * 60 * 1000)
    assert.equal(nextBackoffMs(8), 7 * 24 * 60 * 60 * 1000)
  })
})

describe('overlap-safe queue (P1.3)', () => {
  it('keeps the id in the queue until ack, so a second take cannot steal it', async () => {
    const store = createMemoryCrateStore({ queue: [573292, 240128] })
    const first = await store.takeDue(1, 1, 60)
    assert.deepEqual(first, [573292])
    assert.ok((await store.getQueue()).includes(573292))
    const second = await store.takeDue(2, 1, 60)
    assert.deepEqual(second, [240128])
    await store.nack(573292, 1)
    const again = await store.takeDue(1, 1, 60)
    assert.deepEqual(again, [573292])
    await store.ack(573292)
    assert.equal((await store.getQueue()).includes(573292), false)
  })

  it('dedupes enqueue and sends new ids to the front', async () => {
    const store = createMemoryCrateStore()
    await store.enqueue([240128], { front: false, nowMs: 50 })
    await store.enqueue([573292], { front: true, nowMs: 90 })
    assert.deepEqual(await store.getQueue(), [573292, 240128])
    await store.enqueue([573292], { front: true, nowMs: 90 })
    assert.deepEqual(await store.getQueue(), [573292, 240128])
  })

  it('does not reset a backed-off score when enqueue front is set', async () => {
    const store = createMemoryCrateStore()
    await store.enqueue([573292], { score: 9_000 })
    await store.enqueue([240128], { score: 0 })
    await store.enqueue([573292], { front: true, nowMs: 0 })
    assert.deepEqual(await store.getQueue(), [240128, 573292])
  })
})

describe('enrich lock token (P1.4)', () => {
  it('compare-and-deletes only with the owner token', async () => {
    const store = createMemoryCrateStore({ now: () => 1_000 })
    assert.equal(await store.acquireEnrichLock(60, 'owner'), true)
    assert.equal(await store.acquireEnrichLock(60, 'other'), false)
    assert.equal(await store.releaseEnrichLock('other'), false)
    assert.equal(await store.acquireEnrichLock(60, 'other'), false)
    assert.equal(await store.releaseEnrichLock('owner'), true)
    assert.equal(await store.acquireEnrichLock(60, 'other'), true)
  })

  it('lets the owner re-acquire and refresh the enrich lock', async () => {
    let nowMs = 1_000
    const store = createMemoryCrateStore({ now: () => nowMs })
    assert.equal(await store.acquireEnrichLock(60, 'owner'), true)
    nowMs = 30_000
    assert.equal(await store.acquireEnrichLock(60, 'owner'), true)
    assert.equal(await store.acquireEnrichLock(60, 'other'), false)
    nowMs = 90_001
    assert.equal(await store.acquireEnrichLock(60, 'other'), true)
  })

  it('uses Lua compare-and-delete and compare-and-extend with no GET fallback', () => {
    const src = readFileSync(fileURLToPath(new URL('./store.ts', import.meta.url)), 'utf8')
    const acquire = src.slice(src.indexOf('async acquireEnrichLock'), src.indexOf('async releaseEnrichLock'))
    const release = src.slice(src.indexOf('async releaseEnrichLock'), src.indexOf('async acquireVisitThrottle'))
    assert.match(acquire, /REFRESH_LOCK_LUA/)
    assert.match(acquire, /nx:\s*true/)
    assert.doesNotMatch(acquire, /writeRedis\.get/)
    assert.match(release, /RELEASE_LOCK_LUA/)
    assert.doesNotMatch(release, /writeRedis\.get/)
    assert.doesNotMatch(release, /writeRedis\.del/)
    assert.match(RELEASE_LOCK_LUA, /redis\.call\('GET'/)
    assert.match(RELEASE_LOCK_LUA, /redis\.call\('DEL'/)
    assert.doesNotMatch(RELEASE_LOCK_LUA, /string\.sub/)
    assert.doesNotMatch(REFRESH_LOCK_LUA, /string\.sub/)
    assert.match(REFRESH_LOCK_LUA, /redis\.call\('GET'/)
    assert.match(REFRESH_LOCK_LUA, /'EX'/)
    const cli = readFileSync(fileURLToPath(new URL('../../scripts/crate-backfill.ts', import.meta.url)), 'utf8')
    assert.doesNotMatch(src, /getEnrichLockToken/)
    assert.doesNotMatch(src, /setEnrichLockToken/)
    assert.doesNotMatch(src, /enrichMeta/)
    assert.doesNotMatch(cli, /getEnrichLockToken/)
    assert.doesNotMatch(cli, /setEnrichLockToken/)
    const enrich = readFileSync(fileURLToPath(new URL('./enrich.ts', import.meta.url)), 'utf8')
    const queueFn = enrich.slice(enrich.indexOf('export async function processEnrichmentQueue'))
    assert.match(queueFn, /selectEnrichLockToken/)
    assert.doesNotMatch(queueFn, /getEnrichLockToken/)
    assert.doesNotMatch(queueFn, /setEnrichLockToken/)
    const backfill = readFileSync(fileURLToPath(new URL('./backfill.ts', import.meta.url)), 'utf8')
    assert.match(backfill, /selectEnrichLockToken/)
    assert.doesNotMatch(backfill, /getEnrichLockToken/)
    assert.doesNotMatch(backfill, /setEnrichLockToken/)
    const proof = readFileSync(fileURLToPath(new URL('./proof.ts', import.meta.url)), 'utf8')
    assert.doesNotMatch(proof, /lockToken:\s*randomLockToken/)
    assert.ok(DISCOGS_RELEASE_TIMEOUT_MS < ENRICH_LOCK_SECONDS * 1000)
  })

  it('second worker on the real token path skips and cannot release the first lock', async () => {
    const store = createMemoryCrateStore()
    await store.enqueue([240128], { nowMs: 0 })
    const first = selectEnrichLockToken()
    const second = selectEnrichLockToken()
    assert.notEqual(first, second)
    assert.equal(selectEnrichLockToken('stale-shared-uuid'), 'stale-shared-uuid')

    let aHolds = false
    let releaseA!: () => void
    const holdA = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    const workerA = processEnrichmentQueue(
      {
        store,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => {
          aHolds = true
          await holdA
          throw new Error('A still working')
        },
        mb: createMusicBrainzClientForTests(),
      },
      1
    )
    const waitStart = Date.now()
    while (!aHolds) {
      if (Date.now() - waitStart > 2_000) throw new Error('worker A never took the lock')
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    const workerB = await processEnrichmentQueue(
      {
        store,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => {
          throw new Error('B must not fetch')
        },
        mb: createMusicBrainzClientForTests(),
      },
      1
    )
    assert.equal(workerB.skipped, true)
    assert.deepEqual(workerB.processed, [])
    assert.equal(await store.releaseEnrichLock('stale-shared-uuid'), false)
    assert.equal(await store.acquireEnrichLock(60, 'intruder'), false)
    releaseA()
    const aResult = await workerA
    assert.equal(aResult.skipped, false)
  })

  it('aborts a stalled Discogs response body', async () => {
    const discogsSrc = readFileSync(fileURLToPath(new URL('./discogs-release.ts', import.meta.url)), 'utf8')
    const start = discogsSrc.indexOf('export async function fetchDiscogsReleaseDetail')
    const body = discogsSrc.slice(start, start + 2_000)
    const jsonAt = body.indexOf('response.json()')
    const clearAt = body.lastIndexOf('clearTimeout')
    assert.ok(jsonAt >= 0 && clearAt > jsonAt)
    await assert.rejects(
      () =>
        fetchDiscogsReleaseDetail(573292, {
          timeoutMs: 20,
          fetchImpl: async (_url, init) => {
            const stream = new ReadableStream({
              start(controller) {
                const abort = () => {
                  try {
                    const error = new Error('aborted')
                    error.name = 'AbortError'
                    controller.error(error)
                  } catch {
                    // already closed
                  }
                }
                if (init?.signal?.aborted) abort()
                else init?.signal?.addEventListener('abort', abort, { once: true })
              },
            })
            return new Response(stream, {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          },
        }),
      (error: unknown) => {
        assert.equal((error as { name?: string }).name, 'DiscogsUnavailableError')
        return true
      }
    )
  })

  it('aborts a hanging Discogs release fetch well under the lock TTL', async () => {
    await assert.rejects(
      () =>
        fetchDiscogsReleaseDetail(573292, {
          timeoutMs: 20,
          fetchImpl: async (_url, init) =>
            new Promise((_, reject) => {
              init?.signal?.addEventListener('abort', () => {
                const error = new Error('aborted')
                error.name = 'AbortError'
                reject(error)
              })
            }),
        }),
      (error: unknown) => {
        assert.equal((error as { name?: string }).name, 'DiscogsUnavailableError')
        return true
      }
    )
  })

  it('stops taking items when the time budget is short', async () => {
    const now = 0
    const store = createMemoryCrateStore({ queue: [1, 2, 3], now: () => now })
    const result = await processEnrichmentQueue(
      {
        store,
        now: () => now,
        budgetMs: 99,
        takeFloorMs: 100,
        lockTtlSeconds: 60,
        fetchDiscogs: async () => {
          throw new Error('nope')
        },
        mb: createMusicBrainzClientForTests(),
      },
      10
    )
    assert.deepEqual(result.processed, [])
    assert.equal(result.skipped, false)
    assert.deepEqual(await store.getQueue(), [1, 2, 3])
  })

  it('still takes when remaining equals the take floor', async () => {
    const now = 0
    const store = createMemoryCrateStore({ queue: [1, 2, 3], now: () => now })
    const result = await processEnrichmentQueue(
      {
        store,
        now: () => now,
        budgetMs: 100,
        takeFloorMs: 100,
        lockTtlSeconds: 60,
        fetchDiscogs: async () => {
          throw new Error('nope')
        },
        mb: createMusicBrainzClientForTests(),
      },
      10
    )
    assert.deepEqual(result.processed, [1])
    assert.deepEqual(result.failed, [1])
    assert.equal(remainingBelowTakeFloor(100, 100), false)
  })
})

describe('weaker refresh keeps a stronger match (P2.11)', () => {
  it('keeps the prior matched release and records lastError', () => {
    const previous = pressingStub()
    const weaker = pressingStub({
      mbRelease: {
        mbid: null,
        url: null,
        matchStatus: 'unmatched',
        confidence: 0,
        reason: 'no musicbrainz release for this pressing after discogs url, barcode, catalog number, and artist + title search',
        releaseGroupMbid: null,
      },
      provenance: {
        ...pressingStub().provenance,
        matchStatus: 'unmatched',
        confidence: 0,
        reason: 'no musicbrainz release for this pressing after discogs url, barcode, catalog number, and artist + title search',
        lastError: null,
      },
      tracks: pressingStub().tracks.map((track) => ({
        ...track,
        recording: {
          matchStatus: 'unmatched',
          confidence: 0,
          reason: 'no matched recording yet',
          mbid: null,
          recordingUrl: null,
        },
      })),
    })
    const kept = keepPriorMatch(previous, weaker)
    assert.equal(kept.mbRelease.matchStatus, 'matched')
    assert.equal(kept.mbRelease.mbid, previous.mbRelease.mbid)
    assert.equal(kept.tracks[0]?.recording.mbid, previous.tracks[0]?.recording.mbid)
    assert.equal(kept.provenance.lastError?.kind, 'partial')
    assert.equal(classifyQueueOutcome(kept), 'completed')
    assert.equal(kept.mbRelease.releaseGroupMbid, undefined)
  })

  it('inherits a release group from next only when the retained release ids agree', () => {
    const previous = pressingStub({
      mbRelease: {
        ...pressingStub().mbRelease,
        releaseGroupMbid: undefined,
      },
    })
    const sameId = keepPriorMatch(
      previous,
      pressingStub({
        mbRelease: {
          ...pressingStub().mbRelease,
          matchStatus: 'unmatched',
          confidence: 0,
          reason: 'no musicbrainz release',
          releaseGroupMbid: 'rg-same',
        },
      })
    )
    assert.equal(sameId.mbRelease.mbid, previous.mbRelease.mbid)
    assert.equal(sameId.mbRelease.releaseGroupMbid, 'rg-same')
    const differentId = keepPriorMatch(
      previous,
      pressingStub({
        mbRelease: {
          mbid: 'other-release',
          url: 'https://musicbrainz.org/release/other-release',
          matchStatus: 'unmatched',
          confidence: 0,
          reason: 'no musicbrainz release',
          releaseGroupMbid: 'rg-other',
        },
      })
    )
    assert.equal(differentId.mbRelease.mbid, previous.mbRelease.mbid)
    assert.equal(differentId.mbRelease.releaseGroupMbid, undefined)
  })

  it('keeps a Wikidata research lastError when the prior MusicBrainz match wins', () => {
    const previous = hydratePressing(pressingStub())
    const weaker = hydratePressing(
      pressingStub({
        mbRelease: {
          mbid: null,
          url: null,
          matchStatus: 'unmatched',
          confidence: 0,
          reason: 'no musicbrainz release',
        },
        lifecycles: {
          pressing: previous.lifecycles!.pressing,
          match: previous.lifecycles!.match,
          research: {
            verifiedAt: '2026-01-01T00:00:00.000Z',
            lastAttemptAt: '2026-10-06T06:00:00.000Z',
            lastError: {
              at: '2026-10-06T06:00:00.000Z',
              kind: 'rate_limit',
              message: 'Wikidata rate limited',
              attempts: 0,
            },
            attempts: 0,
          },
        },
      })
    )
    const kept = keepPriorMatch(previous, weaker)
    assert.equal(kept.mbRelease.matchStatus, 'matched')
    assert.equal(kept.lifecycles?.research.verifiedAt, previous.lifecycles?.research.verifiedAt)
    assert.equal(kept.lifecycles?.research.lastError?.kind, 'rate_limit')
  })

  it('replaces a prior match when a unique discogs url is counter-evidence', () => {
    const previous = pressingStub()
    const urlHit = pressingStub({
      mbRelease: {
        mbid: 'new-mbid',
        url: 'https://musicbrainz.org/release/new-mbid',
        matchStatus: 'matched',
        confidence: 0.95,
        reason: 'musicbrainz release linked by discogs url relationship',
      },
    })
    const kept = keepPriorMatch(previous, urlHit)
    assert.equal(kept.mbRelease.mbid, 'new-mbid')
  })
})

describe('version tokens and positions (P2.13)', () => {
  it('does not treat inst inside instinct or edit inside credit as version tokens', () => {
    const result = matchDiscogsTrackToMb({
      discogs: {
        position: 'A1',
        title: 'Radiohead Instinct Credit',
        durationMs: 180000,
        index: 0,
      },
      mbTracks: [
        {
          index: 0,
          number: 'A1',
          title: 'Radiohead Instinct Credit',
          lengthMs: 180000,
          recordingId: 'rec-ok',
          recordingTitle: 'Radiohead Instinct Credit',
          disambiguation: '',
        },
      ],
    })
    assert.equal(result.matchStatus, 'matched')
    assert.equal(result.recordingId, 'rec-ok')
  })

  it('does not map fruity onto instrumental', () => {
    const result = matchDiscogsTrackToMb({
      discogs: {
        position: 'B',
        title: 'Juicy Fruit ("Fruity" Mix)',
        durationMs: 424000,
        index: 1,
      },
      mbTracks: [
        {
          index: 0,
          number: 'A',
          title: 'Juicy Fruit (Vocal)',
          lengthMs: 355000,
          recordingId: 'rec-vocal',
          recordingTitle: 'Juicy Fruit (Vocal)',
          disambiguation: '',
        },
        {
          index: 1,
          number: 'B',
          title: 'Juicy Fruit (Instrumental)',
          lengthMs: 424000,
          recordingId: 'rec-inst',
          recordingTitle: 'Juicy Fruit (Instrumental)',
          disambiguation: '',
        },
      ],
    })
    assert.equal(result.matchStatus, 'ambiguous')
    assert.equal(result.recordingId, null)
  })

  it('keeps disc numbers distinct for 1-1 vs 11', () => {
    assert.notEqual(normalizePosition('1-1'), normalizePosition('11'))
  })
})

describe('barcode and catno unique hits need confirmation', () => {
  it('skips a weak barcode hit so later match paths can run', () => {
    const result = classifyReleaseMatch([{ mbid: 'mb-1', via: 'barcode', score: 40, title: 'Other' }], {
      title: 'Juicy Fruit',
      trackCount: 2,
    })
    assert.equal(result.matchStatus, 'unmatched')
    assert.equal(result.mbid, null)
  })

  it('accepts a barcode hit at score 95 with a similar title', () => {
    const result = classifyReleaseMatch(
      [{ mbid: 'mb-1', via: 'barcode', score: 100, title: 'Juicy Fruit', trackCount: 2 }],
      { title: 'Juicy Fruit', trackCount: 2 }
    )
    assert.equal(result.matchStatus, 'matched')
    assert.equal(result.mbid, 'mb-1')
  })

  it('filters catno hits by score before uniqueness so one strong hit can resolve', () => {
    const result = classifyReleaseMatch(
      [
        { mbid: 'mb-weak', via: 'catno', score: 40, title: 'Other Pressing', trackCount: 12 },
        { mbid: 'mb-strong', via: 'catno', score: 100, title: 'Juicy Fruit', trackCount: 2 },
      ],
      { title: 'Juicy Fruit', trackCount: 2 }
    )
    assert.equal(result.matchStatus, 'matched')
    assert.equal(result.mbid, 'mb-strong')
  })

  it('keeps mtume unmatched when artist+title has several high-score editions', () => {
    const result = classifyReleaseMatch(
      [
        { mbid: 'ed-1', via: 'artist_title', score: 100, title: 'Juicy Fruit', trackCount: 2 },
        { mbid: 'ed-2', via: 'artist_title', score: 99, title: 'Juicy Fruit', trackCount: 2 },
      ],
      { title: 'Juicy Fruit', trackCount: 2 }
    )
    assert.equal(result.matchStatus, 'unmatched')
    assert.equal(result.mbid, null)
  })
})

describe('unique discogs url stops further searches', () => {
  it('does not search barcode or catno after a unique url hit', async () => {
    const store = createMemoryCrateStore()
    let barcodeCalls = 0
    let catnoCalls = 0
    const mb: MusicBrainzClient = {
      ...createMusicBrainzClientForTests(),
      async lookupDiscogsReleaseUrl() {
        return ['mb-url']
      },
      async searchReleaseByBarcode() {
        barcodeCalls += 1
        return []
      },
      async searchReleaseByCatno() {
        catnoCalls += 1
        return []
      },
      async getRelease() {
        return {
          id: 'mb-url',
          title: 'Bootsy? Player Of The Year',
          date: '1978',
          country: 'US',
          releaseGroupId: null,
          tracks: [
            {
              index: 0,
              number: 'A1',
              title: "Bootsy? (What's The Name Of This Town)",
              lengthMs: 419000,
              recordingId: 'rec-a1',
              recordingTitle: "Bootsy? (What's The Name Of This Town)",
              disambiguation: '',
            },
          ],
        }
      },
    }
    const result = await enrichPressing(573292, {
      store,
      mb,
      fetchDiscogs: async () => ({
        id: 573292,
        title: 'Bootsy? Player Of The Year',
        artist: "Bootsy's Rubber Band",
        year: 1978,
        released: '1978',
        country: 'US',
        thumb: '',
        cover: '',
        format: 'Vinyl, LP, Album',
        label: 'Warner Bros. Records',
        catno: 'BSK 3093',
        barcode: '012345',
        notes: null,
        discogsUrl: 'https://www.discogs.com/release/573292',
        masterId: 14594,
        tracklist: [
          {
            position: 'A1',
            title: "Bootsy? (What's The Name Of This Town)",
            duration: '6:59',
            type_: 'track',
          },
        ],
      }),
    })
    assert.equal(barcodeCalls, 0)
    assert.equal(catnoCalls, 0)
    assert.equal(result.mbRelease.mbid, 'mb-url')
  })
})

describe('musicbrainz rate limit stops the batch', () => {
  it('nacks the current id and does not take the next', async () => {
    const { MusicBrainzRateLimitError } = await import('./musicbrainz.ts')
    const store = createMemoryCrateStore({ queue: [1, 2] })
    const result = await processEnrichmentQueue(
      {
        store,
        now: () => 1,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => {
          throw new MusicBrainzRateLimitError(30_000)
        },
        mb: createMusicBrainzClientForTests(),
      },
      10
    )
    assert.equal(result.stoppedOnRateLimit, true)
    assert.deepEqual(result.processed, [1])
    assert.ok((await store.getQueue()).includes(2))
  })
})

function bootsyDetail() {
  return {
    id: 573292,
    title: 'Bootsy? Player Of The Year',
    artist: "Bootsy's Rubber Band",
    year: 1978,
    released: '1978',
    country: 'US',
    thumb: '',
    cover: '',
    format: 'Vinyl, LP, Album',
    label: 'Warner Bros. Records',
    catno: 'BSK 3093',
    barcode: '012345',
    notes: null,
    discogsUrl: 'https://www.discogs.com/release/573292',
    masterId: 14594,
    tracklist: [
      {
        position: 'Side A',
        title: 'The Player',
        duration: '',
        type_: 'heading',
      },
      {
        position: 'A1',
        title: "Bootsy? (What's The Name Of This Town)",
        duration: '6:59',
        type_: 'track',
      },
      {
        position: 'A2',
        title: 'Hollywood Squares',
        duration: '6:15',
        type_: 'track',
      },
    ],
  }
}

function lonelyDetail() {
  return {
    id: 9107339,
    title: 'One Is A Lonesome Number',
    artist: 'Lecturer',
    year: 1977,
    released: '1977',
    country: 'US',
    thumb: '',
    cover: '',
    format: 'Vinyl, LP',
    label: 'lf',
    catno: 'lf-9107339',
    barcode: null,
    notes: null,
    discogsUrl: 'https://www.discogs.com/release/9107339',
    masterId: null,
    tracklist: [
      {
        position: 'A1',
        title: 'One',
        duration: '3:00',
        type_: 'track',
      },
    ],
  }
}

function mtumeDetail() {
  return {
    id: 567894,
    title: 'Juicy Fruit',
    artist: 'Mtume',
    year: 1983,
    released: '1983',
    country: 'US',
    thumb: '',
    cover: '',
    format: 'Vinyl, 12", 45 RPM, Stereo',
    label: 'Epic',
    catno: '49-03834',
    barcode: null,
    notes: null,
    discogsUrl: 'https://www.discogs.com/release/567894',
    masterId: 284145,
    extraartists: [
      { name: 'Larkin Arnold', role: 'Executive-Producer', id: 255778, tracks: null },
      { name: 'Herb Powers Jr.', role: 'Mastered By', id: 264125, tracks: null },
      { name: 'James Mtume', role: 'Producer, Written-By', id: 36715, tracks: null },
    ],
    tracklist: [
      {
        position: 'A',
        title: 'Juicy Fruit (Vocal)',
        duration: '5:55',
        type_: 'track',
        extraartists: [
          { name: 'James Mtume', role: 'Remix', id: 36715, tracks: null },
          { name: 'Reggie Thompson', role: 'Remix', id: 264480, tracks: null },
          { name: 'Scott Folks', role: 'Remix', id: 264481, tracks: null },
        ],
      },
      {
        position: 'B',
        title: 'Juicy Fruit ("Fruity" Instrumental Mix)',
        duration: '7:04',
        type_: 'track',
        extraartists: [
          { name: 'Reggie Thompson', role: 'Remix', id: 264480, tracks: null },
          { name: 'Scott Folks', role: 'Remix', id: 264481, tracks: null },
          { name: 'Tony Humphries', role: 'Remix', id: 3873, tracks: null },
        ],
      },
    ],
  }
}

function nTrackDetail(
  releaseId: number,
  count: number,
  artist = 'Lecturer',
  title = 'Heavy'
) {
  return {
    id: releaseId,
    title,
    artist,
    year: 1977,
    released: '1977',
    country: 'US',
    thumb: '',
    cover: '',
    format: 'Vinyl, LP',
    label: 'lf',
    catno: `lf-${releaseId}`,
    barcode: null,
    notes: null,
    discogsUrl: `https://www.discogs.com/release/${releaseId}`,
    masterId: null,
    tracklist: Array.from({ length: count }, (_, index) => ({
      position: String(index + 1),
      title: `Song ${index + 1}`,
      duration: '3:00',
      type_: 'track' as const,
    })),
  }
}

function twelveTrackDetail(releaseId: number, artist = 'Lecturer', title = 'Twelve') {
  return {
    id: releaseId,
    title,
    artist,
    year: 1977,
    released: '1977',
    country: 'US',
    thumb: '',
    cover: '',
    format: 'Vinyl, LP',
    label: 'lf',
    catno: `lf-${releaseId}`,
    barcode: null,
    notes: null,
    discogsUrl: `https://www.discogs.com/release/${releaseId}`,
    masterId: null,
    tracklist: Array.from({ length: 12 }, (_, index) => ({
      position: String(index + 1),
      title: `Song ${index + 1}`,
      duration: '3:00',
      type_: 'track' as const,
    })),
  }
}

function countingMb(overrides: Partial<MusicBrainzClient> = {}): MusicBrainzClient {
  const base = createMusicBrainzClientForTests()
  const client: MusicBrainzClient = {
    ...base,
    ...overrides,
  }
  return client
}

function collectionOf(
  rows: Array<{ id: number; title: string; year: number; artist: string; label: string; catno: string }>
) {
  const collection = parseDurableCollection({
    releases: rows.map((row, index) =>
      mapRelease({
        instance_id: index + 1,
        basic_information: {
          id: row.id,
          title: row.title,
          year: row.year,
          artists: [{ name: row.artist }],
          labels: [{ name: row.label, catno: row.catno }],
          formats: [{ name: 'Vinyl' }],
        },
      })
    ),
    pagination: { page: 1, pages: 1, items: rows.length, perPage: 100 },
  })
  assert.ok(collection)
  return collection
}

const BOOTSY_ROW = {
  id: 573292,
  title: 'Bootsy? Player Of The Year',
  year: 1978,
  artist: "Bootsy's Rubber Band",
  label: 'Warner Bros. Records',
  catno: 'BSK 3093',
}
const GOODIE_ROW = {
  id: 240128,
  title: 'Soul Food',
  year: 1995,
  artist: 'Goodie Mob',
  label: 'LaFace Records',
  catno: '73008-26017-1',
}
const LONELY_ROW = {
  id: 9107339,
  title: 'One Is A Lonesome Number',
  year: 1972,
  artist: 'Lonely',
  label: 'Unknown',
  catno: 'X',
}

describe('independent lifecycles (direction change)', () => {
  it('keeps headings as distinct non-playable occurrences', () => {
    const tracks = occurrencesFromDetail(bootsyDetail())
    assert.equal(tracks[0]?.type_, 'heading')
    assert.equal(isPlayableOccurrence(tracks[0]!), false)
    assert.equal(tracks[1]?.type_, 'track')
    const coverage = coverageOf({ tracks, recordings: {} })
    assert.equal(coverage.tracks, 2)
    assert.equal(coverage.matched, 0)
  })

  it('makes zero MusicBrainz requests when revisiting an enriched pressing', async () => {
    const store = createMemoryCrateStore()
    const mb = countingMb({
      async lookupDiscogsReleaseUrl() {
        return ['mb-url']
      },
      async getRelease() {
        return {
          id: 'mb-url',
          title: 'Bootsy? Player Of The Year',
          date: '1978',
          country: 'US',
          releaseGroupId: null,
          tracks: [
            {
              index: 0,
              number: 'A1',
              title: "Bootsy? (What's The Name Of This Town)",
              lengthMs: 419000,
              recordingId: 'rec-a1',
              recordingTitle: "Bootsy? (What's The Name Of This Town)",
              disambiguation: '',
            },
            {
              index: 1,
              number: 'A2',
              title: 'Hollywood Squares',
              lengthMs: 375000,
              recordingId: 'rec-hs',
              recordingTitle: 'Hollywood Squares',
              disambiguation: '',
            },
          ],
        }
      },
      async getRecording(mbid: string) {
        return {
          mbid,
          title: mbid === 'rec-hs' ? 'Hollywood Squares' : "Bootsy?",
          artist: "Bootsy's Rubber Band",
          credits: [],
          samplesFrom: [],
          sampledIn:
            mbid === 'rec-hs'
              ? [
                  {
                    title: "I'm a Player",
                    artist: 'Too $hort',
                    mbid: 'fb9a3b45-5559-44e4-8bcc-6476cce7a0ba',
                    sourceUrl: 'https://musicbrainz.org/recording/fb9a3b45-5559-44e4-8bcc-6476cce7a0ba',
                    source: 'musicbrainz' as const,
                    providerId: 'fb9a3b45-5559-44e4-8bcc-6476cce7a0ba',
                  },
                ]
              : [],
        }
      },
    })
    let requestCount = 0
    let lookups = 0
    let releases = 0
    let recordings = 0
    const mbCounted: MusicBrainzClient = {
      get requestCount() {
        return requestCount
      },
      async lookupDiscogsReleaseUrl(url) {
        lookups += 1
        requestCount += 1
        return mb.lookupDiscogsReleaseUrl(url)
      },
      async searchReleaseByBarcode(barcode) {
        requestCount += 1
        return mb.searchReleaseByBarcode(barcode)
      },
      async searchReleaseByCatno(catno, artist) {
        requestCount += 1
        return mb.searchReleaseByCatno(catno, artist)
      },
      async searchReleaseByArtistTitle(input) {
        requestCount += 1
        return mb.searchReleaseByArtistTitle(input)
      },
      async searchRecordingsByArtistTitle(input) {
        requestCount += 1
        return mb.searchRecordingsByArtistTitle(input)
      },
      async getRelease(id) {
        releases += 1
        requestCount += 1
        return mb.getRelease(id)
      },
      async getRecording(id) {
        recordings += 1
        requestCount += 1
        return mb.getRecording(id)
      },
    }
    await enrichPressing(573292, {
      store,
      mb: mbCounted,
      fetchDiscogs: async () => bootsyDetail(),
    })
    assert.ok(lookups > 0)
    assert.ok(releases > 0)
    assert.ok(recordings > 0)
    assert.ok(requestCount > 0)
    requestCount = 0
    lookups = 0
    releases = 0
    recordings = 0
    await enrichPressing(573292, {
      store,
      mb: mbCounted,
      fetchDiscogs: async () => bootsyDetail(),
    })
    assert.equal(requestCount, 0)
    assert.equal(lookups, 0)
    assert.equal(releases, 0)
    assert.equal(recordings, 0)
    const stored = await store.getPressing(573292)
    assert.ok(stored)
    assert.equal(stored.tracks.some((track) => track.type_ === 'heading'), true)
    assert.equal(
      stored.recordings['rec-hs']?.sampledIn.some((row) => row.artist.includes('Too')),
      true
    )
  })

  it('reuses research when a collection update re-syncs an unchanged pressing', async () => {
    const previous = pressingStub()
    const store = createMemoryCrateStore({ pressings: { 573292: previous }, seen: [573292] })
    const collection = parseDurableCollection({
      releases: [
        mapRelease({
          instance_id: 1,
          basic_information: {
            id: 573292,
            title: 'Bootsy? Player Of The Year',
            year: 1978,
            artists: [{ name: "Bootsy's Rubber Band" }],
            labels: [{ name: 'Warner Bros. Records', catno: 'BSK 3093' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 100 },
    })
    assert.ok(collection)
    const result = await queueNewAndMissing(
      store,
      [573292],
      collection,
      Date.parse('2026-10-06T00:00:00Z')
    )
    assert.deepEqual(result.newIds, [])
    assert.deepEqual(result.queued, [])
  })

  it('preserves original verifiedAt when a later source fetch fails', async () => {
    const previous = pressingStub({
      provenance: {
        ...pressingStub().provenance,
        verifiedAt: '2026-09-01T00:00:00.000Z',
        lastAttemptAt: '2026-09-01T00:00:00.000Z',
      },
    })
    const store = createMemoryCrateStore({ pressings: { 573292: previous } })
    const result = await enrichPressing(573292, {
      store,
      now: () => Date.parse('2026-10-06T00:00:00.000Z'),
      fetchDiscogs: async () => {
        throw new Error('discogs down')
      },
      mb: createMusicBrainzClientForTests(),
    })
    assert.equal(result.provenance.verifiedAt, '2026-09-01T00:00:00.000Z')
    assert.equal(result.provenance.lastAttemptAt, '2026-10-06T00:00:00.000Z')
    assert.equal(result.tracks[0]?.recording.mbid, previous.tracks[0]?.recording.mbid)
  })

  it('reuses fixture facts when redis only has an empty error stub', async () => {
    const stub = preservePressingOnFailure(
      null,
      Date.parse('2026-10-06T03:17:28.473Z'),
      'rate_limit',
      'Too many requests',
      { releaseId: 567894 }
    )
    const store = createMemoryCrateStore({ pressings: { 567894: stub } })
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T04:00:00.000Z'),
      failRefresh: () => true,
      mb: createMusicBrainzClientForTests(),
    })
    assert.equal(result.facts.title, 'Juicy Fruit')
    assert.equal(result.tracks.length, 2)
    assert.equal(result.provenance.verifiedAt, '2026-10-06T01:22:26.660Z')
    assert.equal(result.provenance.lastAttemptAt, '2026-10-06T04:00:00.000Z')
    assert.equal(result.provenance.lastError?.kind, 'unavailable')
    const stored = await store.getPressing(567894)
    assert.equal(stored?.facts.title, 'Juicy Fruit')
    assert.equal(stored?.tracks.length, 2)
  })

  it('keeps last-good on the live key while a rematch writes staging', async () => {
    const previous = pressingStub()
    const store = createMemoryCrateStore({ pressings: { 573292: previous } })
    let sawEmptyLive = false
    const base = createMusicBrainzClientForTests()
    const mb: MusicBrainzClient = {
      ...base,
      async lookupDiscogsReleaseUrl() {
        const live = await store.getPressing(573292)
        if (!live || live.tracks.length === 0) sawEmptyLive = true
        return ['mb-url']
      },
    }
    await enrichPressing(573292, {
      store,
      mb,
      forceRefresh: true,
      fetchDiscogs: async () => bootsyDetail(),
    })
    assert.equal(sawEmptyLive, false)
    assert.equal(store.drafts[573292], undefined)
    const live = await store.getPressing(573292)
    assert.ok((live?.tracks.length ?? 0) > 0)
  })

  it('keeps Discogs facts without moving provenance.verifiedAt when MusicBrainz throws with no prior', async () => {
    const store = createMemoryCrateStore()
    const nowMs = Date.parse('2026-10-06T05:00:00.000Z')
    const result = await enrichPressing(9107339, {
      store,
      now: () => nowMs,
      fetchDiscogs: async () => lonelyDetail(),
      mb: throwingMb(),
    })
    assert.equal(result.facts.title, 'One Is A Lonesome Number')
    assert.ok(result.tracks.length > 0)
    assert.equal(result.provenance.verifiedAt, null)
    assert.equal(result.lifecycles?.pressing.verifiedAt, '2026-10-06T05:00:00.000Z')
    assert.equal(result.provenance.lastError?.kind, 'unavailable')
    assert.equal(result.provenance.lastAttemptAt, '2026-10-06T05:00:00.000Z')
    const stored = await store.getPressing(9107339)
    assert.equal(stored?.facts.title, 'One Is A Lonesome Number')
    assert.equal(stored?.provenance.verifiedAt, null)
    assert.equal(stored?.lifecycles?.pressing.verifiedAt, '2026-10-06T05:00:00.000Z')
    assert.ok((stored?.tracks.length ?? 0) > 0)
    assert.equal(store.drafts[9107339], undefined)
  })

  it('does not rematch or move provenance.verifiedAt on a skip-match Discogs-ok refresh', async () => {
    const store = createMemoryCrateStore()
    const firstNow = Date.parse('2026-10-01T00:00:00.000Z')
    const firstMb = createMusicBrainzClientForTests()
    await enrichPressing(573292, {
      store,
      now: () => firstNow,
      fetchDiscogs: async () => bootsyDetail(),
      mb: firstMb,
    })
    const first = await store.getPressing(573292)
    assert.ok(first)
    assert.ok(firstMb.requestCount > 0)
    assert.equal(first.provenance.verifiedAt, '2026-10-01T00:00:00.000Z')
    assert.equal(first.lifecycles?.pressing.verifiedAt, '2026-10-01T00:00:00.000Z')
    assert.notEqual(first.mbRelease.matchStatus, 'pending')

    const secondNow = Date.parse('2026-10-06T12:00:00.000Z')
    let rematchCalls = 0
    let releaseLookups = 0
    const secondMb = createMusicBrainzClientForTests()
    secondMb.lookupDiscogsReleaseUrl = async () => {
      rematchCalls += 1
      return []
    }
    secondMb.searchReleaseByBarcode = async () => {
      rematchCalls += 1
      return []
    }
    secondMb.searchReleaseByCatno = async () => {
      rematchCalls += 1
      return []
    }
    secondMb.searchReleaseByArtistTitle = async () => {
      rematchCalls += 1
      return []
    }
    secondMb.getRelease = async () => {
      releaseLookups += 1
      return null
    }
    const result = await enrichPressing(573292, {
      store,
      now: () => secondNow,
      fetchDiscogs: async () => bootsyDetail(),
      mb: secondMb,
    })
    assert.equal(rematchCalls, 0)
    assert.ok(releaseLookups <= 1)
    assert.equal(result.provenance.verifiedAt, '2026-10-01T00:00:00.000Z')
    assert.equal(result.provenance.checkedAt, '2026-10-06T12:00:00.000Z')
    assert.equal(result.lifecycles?.pressing.verifiedAt, '2026-10-06T12:00:00.000Z')
    assert.equal(result.lifecycles?.match.verifiedAt, first.lifecycles?.match.verifiedAt)
  })

  it('keeps prior verifiedAt and matched facts when MusicBrainz throws on an already-enriched pressing', async () => {
    const verifiedAt = '2026-09-01T00:00:00.000Z'
    const previous = pressingStub({
      provenance: {
        sourceUrls: ['https://www.discogs.com/release/573292'],
        matchStatus: 'matched',
        confidence: 0.95,
        reason: 'discogs url',
        checkedAt: verifiedAt,
        refreshAfter: '2026-11-01T00:00:00.000Z',
        lastError: null,
        verifiedAt,
      },
    })
    const store = createMemoryCrateStore({ pressings: { 573292: previous } })
    const nowMs = Date.parse('2026-10-06T05:00:00.000Z')
    const result = await enrichPressing(573292, {
      store,
      now: () => nowMs,
      forceRefresh: true,
      fetchDiscogs: async () => bootsyDetail(),
      mb: throwingMb(),
    })
    assert.equal(result.provenance.verifiedAt, verifiedAt)
    assert.equal(result.mbRelease.matchStatus, 'matched')
    assert.equal(result.tracks[0]?.recording.matchStatus, 'matched')
    assert.equal(result.facts.title, previous.facts.title)
    assert.equal(result.provenance.lastError?.kind, 'unavailable')
    assert.equal(result.provenance.lastAttemptAt, '2026-10-06T05:00:00.000Z')
    assert.equal(result.provenance.lastError?.attempts, 1)
    const stored = await store.getPressing(573292)
    assert.equal(stored?.provenance.verifiedAt, verifiedAt)
    assert.equal(stored?.mbRelease.matchStatus, 'matched')
    assert.equal(store.drafts[573292], undefined)
  })

  it('stops match work when the worker deadline elapses inside a release', async () => {
    const store = createMemoryCrateStore()
    let nowMs = Date.parse('2026-10-06T05:00:00.000Z')
    let mbCalled = false
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => {
      mbCalled = true
      return []
    }
    await assert.rejects(
      () =>
        enrichPressing(9107339, {
          store,
          now: () => nowMs,
          deadlineMs: nowMs + ENRICH_TAKE_FLOOR_MS + 1,
          fetchDiscogs: async () => {
            nowMs += ENRICH_TAKE_FLOOR_MS + 5_000
            return lonelyDetail()
          },
          mb,
        }),
      (error: unknown) => error instanceof WorkerDeadlineError
    )
    assert.equal(mbCalled, false)
    assert.equal(await store.getPressing(9107339), null)
    assert.equal(store.drafts[9107339]?.facts.title, 'One Is A Lonesome Number')
  })

  it('backs off deadline nacks and marks too_slow after N stops without counting attempts', async () => {
    const store = createMemoryCrateStore({ queue: [9107339] })
    let clock = Date.parse('2026-10-06T05:00:00.000Z')
    let discogsCalls = 0
    const burn = () => {
      clock += ENRICH_TAKE_FLOOR_MS + 5_000
    }
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => {
      burn()
      return []
    }
    for (let i = 0; i < DEADLINE_STOP_LIMIT; i += 1) {
      const result = await processEnrichmentQueue(
        {
          store,
          now: () => clock,
          deadlineMs: clock + ENRICH_TAKE_FLOOR_MS + 1,
          takeFloorMs: 0,
          fetchDiscogs: async () => {
            discogsCalls += 1
            burn()
            return lonelyDetail()
          },
          mb,
        },
        1
      )
      assert.deepEqual(result.processed, [])
      assert.deepEqual(result.failed, [])
      const live = await store.getPressing(9107339)
      assert.equal(live, null)
      if (i < DEADLINE_STOP_LIMIT - 1) {
        const queued = store.queue.find((row) => row.id === 9107339)
        assert.ok(queued)
        assert.ok(queued.score > clock)
        clock = queued.score
      }
    }
    assert.equal(discogsCalls, 1)
    assert.deepEqual(await store.getDead(), [])
    assert.ok((await store.getUnresolved()).includes(9107339))
    assert.equal(
      (await store.getInspect()).some(
        (row) =>
          row.releaseId === 9107339 &&
          row.kind === 'too_slow' &&
          row.message === 'too slow' &&
          row.attempts === 0
      ),
      true
    )
    assert.equal((await store.getQueue()).includes(9107339), false)
    assert.equal(await store.getDraftPressing(9107339), null)
  })

  it('forced retry reuses its draft so deadlineStops still reach too_slow', async () => {
    const store = createMemoryCrateStore({ queue: [9107339] })
    let clock = Date.parse('2026-10-06T05:00:00.000Z')
    let discogsCalls = 0
    const burn = () => {
      clock += ENRICH_TAKE_FLOOR_MS + 5_000
    }
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => {
      burn()
      return []
    }
    for (let i = 0; i < DEADLINE_STOP_LIMIT; i += 1) {
      const result = await processEnrichmentQueue(
        {
          store,
          now: () => clock,
          deadlineMs: clock + ENRICH_TAKE_FLOOR_MS + 1,
          takeFloorMs: 0,
          forceRefresh: true,
          fetchDiscogs: async () => {
            discogsCalls += 1
            burn()
            return lonelyDetail()
          },
          mb,
        },
        1
      )
      assert.deepEqual(result.processed, [])
      if (i < DEADLINE_STOP_LIMIT - 1) {
        const queued = store.queue.find((row) => row.id === 9107339)
        assert.ok(queued)
        clock = queued.score
      }
    }
    assert.equal(discogsCalls, 1)
    assert.ok((await store.getUnresolved()).includes(9107339))
    assert.equal(
      (await store.getInspect()).some(
        (row) => row.releaseId === 9107339 && row.kind === 'too_slow' && row.attempts === 0
      ),
      true
    )
  })

  it('resets deadlineStops on a non-deadline failure so the next stop is not too_slow', async () => {
    const store = createMemoryCrateStore({ queue: [9107339] })
    let clock = Date.parse('2026-10-06T05:00:00.000Z')
    const burn = () => {
      clock += ENRICH_TAKE_FLOOR_MS + 5_000
    }
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => {
      burn()
      return []
    }
    for (let i = 0; i < 2; i += 1) {
      const result = await processEnrichmentQueue(
        {
          store,
          now: () => clock,
          deadlineMs: clock + ENRICH_TAKE_FLOOR_MS + 1,
          takeFloorMs: 0,
          fetchDiscogs: async () => {
            burn()
            return lonelyDetail()
          },
          mb,
        },
        1
      )
      assert.deepEqual(result.processed, [])
      const queued = store.queue.find((row) => row.id === 9107339)
      assert.ok(queued)
      clock = queued.score
    }
    const afterMb = await enrichPressing(9107339, {
      store,
      now: () => clock,
      fetchDiscogs: async () => lonelyDetail(),
      mb: throwingMb(),
    })
    assert.notEqual(afterMb.provenance.lastError?.kind, 'too_slow')
    assert.equal(afterMb.checkpoint?.deadlineStops ?? 0, 0)
    const third = await processEnrichmentQueue(
      {
        store,
        now: () => clock,
        deadlineMs: clock + ENRICH_TAKE_FLOOR_MS + 1,
        takeFloorMs: 0,
        fetchDiscogs: async () => {
          burn()
          return lonelyDetail()
        },
        mb,
      },
      1
    )
    assert.deepEqual(third.processed, [])
    assert.equal((await store.getUnresolved()).includes(9107339), false)
    assert.equal(
      (await store.getInspect()).some((row) => row.releaseId === 9107339 && row.kind === 'too_slow'),
      false
    )
    const draft = await store.getDraftPressing(9107339)
    const live = await store.getPressing(9107339)
    assert.equal((draft ?? live)?.checkpoint?.deadlineStops, 1)
    assert.ok((await store.getQueue()).includes(9107339))
  })

  it('does not fetch Discogs when remaining budget is inside the take floor', async () => {
    const store = createMemoryCrateStore({ queue: [9107339] })
    const clock = Date.parse('2026-10-06T05:00:00.000Z')
    let discogsCalls = 0
    const result = await processEnrichmentQueue(
      {
        store,
        now: () => clock,
        deadlineMs: clock + 100,
        fetchDiscogs: async () => {
          discogsCalls += 1
          return lonelyDetail()
        },
        mb: createMusicBrainzClientForTests(),
      },
      1
    )
    assert.equal(discogsCalls, 0)
    assert.deepEqual(result.processed, [])
    const queued = store.queue.find((row) => row.id === 9107339)
    assert.ok(queued)
    assert.equal(queued.score, 0)
    assert.deepEqual(await store.getQueue(), [9107339])
    assert.equal(remainingBelowTakeFloor(100, ENRICH_TAKE_FLOOR_MS), true)
    assert.equal(remainingBelowTakeFloor(ENRICH_TAKE_FLOOR_MS, ENRICH_TAKE_FLOOR_MS), false)
    assert.equal(remainingBelowTakeFloor(0, 0), true)
    assert.equal(remainingBelowTakeFloor(ENRICH_BUDGET_MS, ENRICH_TAKE_FLOOR_MS), false)
  })

  it('reuses the Discogs draft on a later tick instead of fetching again', async () => {
    const store = createMemoryCrateStore({ queue: [9107339] })
    let clock = Date.parse('2026-10-06T05:00:00.000Z')
    let discogsCalls = 0
    await processEnrichmentQueue(
      {
        store,
        now: () => clock,
        deadlineMs: clock + ENRICH_TAKE_FLOOR_MS + 1,
        takeFloorMs: 0,
        fetchDiscogs: async () => {
          discogsCalls += 1
          clock += ENRICH_TAKE_FLOOR_MS + 5_000
          return lonelyDetail()
        },
        mb: createMusicBrainzClientForTests(),
      },
      1
    )
    assert.equal(discogsCalls, 1)
    assert.equal(store.drafts[9107339]?.facts.title, 'One Is A Lonesome Number')
    const retryAt = store.queue.find((row) => row.id === 9107339)?.score
    assert.ok(retryAt)
    clock = retryAt
    await processEnrichmentQueue(
      {
        store,
        now: () => clock,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => {
          discogsCalls += 1
          return lonelyDetail()
        },
        mb: createMusicBrainzClientForTests(),
      },
      1
    )
    assert.equal(discogsCalls, 1)
    const stored = await store.getPressing(9107339)
    assert.equal(stored?.facts.title, 'One Is A Lonesome Number')
    assert.equal(stored?.provenance.lastError, null)
  })

  it('recovers a taken item after inflight expires without duplicating work', async () => {
    const store = createMemoryCrateStore({ queue: [573292] })
    const first = await store.takeDue(1, 1_000, 1)
    assert.deepEqual(first, [573292])
    const overlapping = await store.takeDue(1, 1_000, 1)
    assert.deepEqual(overlapping, [])
    const recovered = await store.takeDue(1, 3_000, 1)
    assert.deepEqual(recovered, [573292])
    await store.ack(573292)
    assert.deepEqual(await store.getQueue(), [])
  })

  it('lets only one worker hold the enrich lock', async () => {
    const store = createMemoryCrateStore({ queue: [573292], now: () => 1_000 })
    assert.equal(await store.acquireEnrichLock(60, 'owner'), true)
    const second = await processEnrichmentQueue(
      {
        store,
        now: () => 1_000,
        lockToken: 'other',
        takeFloorMs: 0,
        fetchDiscogs: async () => bootsyDetail(),
        mb: createMusicBrainzClientForTests(),
      },
      1
    )
    assert.equal(second.skipped, true)
    assert.deepEqual(second.processed, [])
    assert.equal(await store.releaseEnrichLock('owner'), true)
  })

  it('retries MusicBrainz on an exhausted id when retry is explicit', async () => {
    const store = createMemoryCrateStore({ queue: [9107339] })
    let t = Date.parse('2026-10-06T05:00:00.000Z')
    for (let i = 0; i < CRATE_MAX_ATTEMPTS; i += 1) {
      await processEnrichmentQueue(
        {
          store,
          now: () => t,
          takeFloorMs: 0,
          budgetMs: 45_000,
          fetchDiscogs: async () => lonelyDetail(),
          mb: throwingMb(),
        },
        1
      )
      const stored = await store.getPressing(9107339)
      t = Date.parse(stored?.provenance.refreshAfter ?? '') || t + 86_400_000
    }
    const dead = await store.getPressing(9107339)
    assert.equal(dead?.provenance.lastError?.kind, 'exhausted')
    const verifiedAt = dead?.provenance.verifiedAt
    assert.equal(verifiedAt, null)
    assert.equal(dead?.lifecycles?.pressing.verifiedAt, isoFromMs(Date.parse('2026-10-06T05:00:00.000Z')))
    assert.deepEqual(await store.enqueue([9107339], { nowMs: t, retry: true }), [9107339])

    let mbCalled = 0
    const countingThrow: MusicBrainzClient = {
      ...throwingMb(),
      lookupDiscogsReleaseUrl: async () => {
        mbCalled += 1
        throw new Error('musicbrainz down')
      },
      searchReleaseByBarcode: async () => {
        mbCalled += 1
        throw new Error('musicbrainz down')
      },
      searchReleaseByCatno: async () => {
        mbCalled += 1
        throw new Error('musicbrainz down')
      },
      searchReleaseByArtistTitle: async () => {
        mbCalled += 1
        throw new Error('musicbrainz down')
      },
    }
    await processEnrichmentQueue(
      {
        store,
        now: () => t + 1,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => lonelyDetail(),
        mb: countingThrow,
      },
      1
    )
    assert.ok(mbCalled > 0)
    const afterFail = await store.getPressing(9107339)
    assert.equal(afterFail?.provenance.verifiedAt, verifiedAt)
    assert.equal(afterFail?.provenance.lastError?.kind, 'exhausted')

    await store.enqueue([9107339], { nowMs: t + 2, retry: true })
    const successNow = t + 3
    await processEnrichmentQueue(
      {
        store,
        now: () => successNow,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => lonelyDetail(),
        mb: createMusicBrainzClientForTests(),
      },
      1
    )
    const afterOk = await store.getPressing(9107339)
    assert.equal(afterOk?.provenance.lastError, null)
    assert.equal(afterOk?.provenance.verifiedAt, isoFromMs(successNow))
  })

  it('resumeForceRefreshTrackCursor only continues the same forced run', () => {
    const previous = hydratePressing(
      pressingStub({
        checkpoint: {
          stage: 'research',
          researchCursor: 0,
          trackSampleCursor: 4,
          forceRun: true,
          forceRunAt: '2026-10-07T16:00:00.000Z',
        },
        provenance: {
          ...pressingStub().provenance,
          lastError: {
            kind: 'rate_limit',
            message: 'MusicBrainz rate limited',
            attempts: 0,
            at: '2026-10-07T16:00:00.000Z',
          },
        },
      })
    )
    const stampMs = Date.parse('2026-10-07T16:00:00.000Z')
    assert.equal(resumeForceRefreshTrackCursor(previous, true, false, stampMs), 4)
    assert.equal(resumeForceRefreshTrackCursor(previous, true, true, stampMs), 0)
    assert.equal(resumeForceRefreshTrackCursor(previous, false, false, stampMs), 0)
    assert.equal(isForceRunStampFresh('2026-10-07T16:00:00.000Z', stampMs), true)
    assert.equal(
      isForceRunStampFresh('2026-10-07T16:00:00.000Z', stampMs + DRAFT_TTL_SECONDS * 1000 + 1),
      false
    )
    assert.equal(
      resumeForceRefreshTrackCursor(previous, true, false, stampMs + DRAFT_TTL_SECONDS * 1000 + 1),
      0
    )
    assert.equal(
      resumeForceRefreshTrackCursor(
        hydratePressing(
          pressingStub({
            checkpoint: { stage: 'research', researchCursor: 0, trackSampleCursor: 4 },
            provenance: {
              ...pressingStub().provenance,
              lastError: {
                kind: 'rate_limit',
                message: 'MusicBrainz rate limited',
                attempts: 0,
                at: '2026-10-07T16:00:00.000Z',
              },
            },
          })
        ),
        true,
        false,
        stampMs
      ),
      0
    )
    const wikiOnly = hydratePressing(
      pressingStub({
        checkpoint: {
          stage: 'research',
          researchCursor: 0,
          trackSampleCursor: 4,
          forceRun: true,
          forceRunAt: '2026-10-07T16:00:00.000Z',
        },
        provenance: {
          ...pressingStub().provenance,
          lastError: {
            kind: 'unavailable',
            message: 'wikidata skipped: worker budget below floor',
            attempts: 0,
            at: '2026-10-07T16:00:00.000Z',
          },
        },
      })
    )
    assert.equal(isWikidataOnlyLastError(wikiOnly.provenance.lastError), true)
    assert.equal(resumeForceRefreshTrackCursor(wikiOnly, true, false, stampMs), 0)
  })

  it('keeps Mtume unmatched without rematching when lastError is null', async () => {
    const previous = fixturePressing(567894)
    assert.ok(previous)
    assert.equal(shouldSkipMatch(previous, false, false), true)
    const store = createMemoryCrateStore({ pressings: { 567894: previous } })
    let mbCalled = 0
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => {
      mbCalled += 1
      return []
    }
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T06:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.equal(mbCalled, 0)
    assert.equal(result.mbRelease.matchStatus, 'unmatched')
    assert.ok(result.tracks.every((track) => track.recording.matchStatus === 'ambiguous'))
    assert.equal(result.provenance.lastError, null)
    assert.equal(result.provenance.verifiedAt, previous.provenance.verifiedAt ?? previous.provenance.checkedAt)
  })

  it('moves exhausted retries into the inspectable dead set', async () => {
    const store = createMemoryCrateStore({ queue: [9] })
    let t = 1_000
    for (let attempt = 0; attempt < CRATE_MAX_ATTEMPTS; attempt += 1) {
      await processEnrichmentQueue(
        {
          store,
          now: () => t,
          takeFloorMs: 0,
          budgetMs: 45_000,
          fetchDiscogs: async () => {
            throw new Error('discogs down')
          },
          mb: createMusicBrainzClientForTests(),
        },
        1
      )
      const stored = await store.getPressing(9)
      t = Date.parse(stored?.provenance.refreshAfter ?? '') || t + 86_400_000
    }
    const stored = await store.getPressing(9)
    assert.equal(stored?.provenance.lastError?.kind, 'exhausted')
    assert.deepEqual(await store.getDead(), [9])
    assert.deepEqual(await store.getQueue(), [])
    const snapshot = await inspectCrate(store)
    assert.equal(snapshot.inspect.some((row) => row.releaseId === 9 && row.kind === 'exhausted'), true)
  })

  it('Discogs-ok MusicBrainz-throw climbs attempts, keeps verifiedAt, and dies at CRATE_MAX_ATTEMPTS', async () => {
    const store = createMemoryCrateStore({ queue: [9107339] })
    let t = Date.parse('2026-10-06T05:00:00.000Z')
    const attempts: number[] = []
    let firstVerified: string | null | undefined
    for (let i = 0; i < 7; i += 1) {
      await processEnrichmentQueue(
        {
          store,
          now: () => t,
          takeFloorMs: 0,
          budgetMs: 45_000,
          fetchDiscogs: async () => lonelyDetail(),
          mb: throwingMb(),
        },
        1
      )
      const stored = await store.getPressing(9107339)
      if (i === 0) firstVerified = stored?.provenance.verifiedAt
      attempts.push(stored?.provenance.lastError?.attempts ?? 0)
      assert.equal(stored?.facts.title, 'One Is A Lonesome Number')
      assert.ok((stored?.tracks.length ?? 0) > 0)
      assert.equal(stored?.provenance.verifiedAt, firstVerified)
      if (!(await store.getDead()).includes(9107339)) {
        t = Date.parse(stored?.provenance.refreshAfter ?? '') || t + 86_400_000
      }
    }
    assert.deepEqual(attempts, [1, 2, 3, 4, 5, 5, 5])
    assert.equal(firstVerified, null)
    assert.deepEqual(await store.getDead(), [9107339])
    const stored = await store.getPressing(9107339)
    assert.equal(stored?.provenance.lastError?.kind, 'exhausted')
  })

  it('never marks an id dead after 5+ consecutive MusicBrainz 429s', async () => {
    const store = createMemoryCrateStore({ queue: [9107339] })
    let t = Date.parse('2026-10-06T05:00:00.000Z')
    const limited: MusicBrainzClient = {
      ...createMusicBrainzClientForTests(),
      lookupDiscogsReleaseUrl: async () => {
        throw new MusicBrainzRateLimitError(1)
      },
      searchReleaseByBarcode: async () => {
        throw new MusicBrainzRateLimitError(1)
      },
      searchReleaseByCatno: async () => {
        throw new MusicBrainzRateLimitError(1)
      },
      searchReleaseByArtistTitle: async () => {
        throw new MusicBrainzRateLimitError(1)
      },
    }
    for (let i = 0; i < 8; i += 1) {
      await processEnrichmentQueue(
        {
          store,
          now: () => t,
          takeFloorMs: 0,
          budgetMs: 45_000,
          fetchDiscogs: async () => lonelyDetail(),
          mb: limited,
        },
        1
      )
      const stored = await store.getPressing(9107339)
      assert.notEqual(stored?.provenance.lastError?.kind, 'exhausted')
      t = Date.parse(stored?.provenance.refreshAfter ?? '') || t + 1
    }
    assert.deepEqual(await store.getDead(), [])
    const stored = await store.getPressing(9107339)
    assert.equal(stored?.provenance.lastError?.kind, 'rate_limit')
    assert.equal(stored?.provenance.lastError?.attempts, 0)
  })

  it('stops the run on auth failure without burning retries', async () => {
    const store = createMemoryCrateStore({ queue: [1, 2] })
    const result = await processEnrichmentQueue(
      {
        store,
        now: () => 1_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => {
          throw new DiscogsAuthError(401)
        },
        mb: createMusicBrainzClientForTests(),
      },
      10
    )
    assert.equal(result.stoppedOnAuth, true)
    assert.deepEqual(result.processed, [1])
    const stored = await store.getPressing(1)
    assert.equal(stored?.provenance.lastError?.kind, 'auth')
    assert.equal(stored?.provenance.lastError?.attempts, 0)
    assert.ok((await store.getUnresolved()).includes(1))
    assert.ok((await store.getQueue()).includes(2))
    assert.ok((await store.getQueue()).includes(1))
    const authItem = store.queue.find((row) => row.id === 1)
    assert.equal(authItem?.score, 1_000 + AUTH_RETRY_MS)
    assert.ok(AUTH_RETRY_MS < 60 * 60 * 1000)
  })
})

describe('hollywood squares sample relationship', () => {
  it('keeps Too $hort I\'m a Player from MusicBrainz, not a hardcode', () => {
    const pressing = fixturePressing(573292)
    assert.ok(pressing)
    const hollywood = Object.values(pressing.recordings).find(
      (recording) => recording.title === 'Hollywood Squares'
    )
    assert.ok(hollywood)
    const tooShort = hollywood.sampledIn.find(
      (row) => /too/i.test(row.artist) && /player/i.test(row.title)
    )
    assert.ok(tooShort)
    assert.equal(tooShort.source, 'musicbrainz')
    assert.match(tooShort.sourceUrl, /musicbrainz\.org\/recording\//)
    const sampled = (pressing.researchFacts ?? []).find(
      (fact) =>
        fact.kind === 'sampled_by' &&
        /too/i.test(fact.relatedArtist) &&
        /player/i.test(fact.relatedTitle)
    )
    assert.ok(sampled)
    assert.equal(sampled.source, 'musicbrainz')
  })
})

describe('resumable backfill checkpoints', () => {
  it('walks remaining collection ids and records throughput', async () => {
    const store = createMemoryCrateStore()
    const collection = parseDurableCollection({
      releases: [
        mapRelease({
          instance_id: 1,
          basic_information: {
            id: 573292,
            title: 'Bootsy? Player Of The Year',
            year: 1978,
            artists: [{ name: "Bootsy's Rubber Band" }],
            labels: [{ name: 'Warner Bros. Records', catno: 'BSK 3093' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 100 },
    })
    assert.ok(collection)
    const result = await runBackfill(
      {
        store,
        collection,
        now: () => 60_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => bootsyDetail(),
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 1 }
    )
    assert.equal(result.completed, 1)
    assert.equal(result.backfill.cursor, 1)
    assert.equal(result.remainingIsEstimate, false)
    assert.equal(result.discogsRequests, 1)
    assert.ok(result.releasesPerMin >= 0)
  })

  it('reports this-tick Discogs counts and advances cursor by outcome', async () => {
    const store = createMemoryCrateStore()
    const collection = parseDurableCollection({
      releases: [
        mapRelease({
          instance_id: 1,
          basic_information: {
            id: 573292,
            title: 'Bootsy? Player Of The Year',
            year: 1978,
            artists: [{ name: "Bootsy's Rubber Band" }],
            labels: [{ name: 'Warner Bros. Records', catno: 'BSK 3093' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
        mapRelease({
          instance_id: 2,
          basic_information: {
            id: 240128,
            title: 'Soul Food',
            year: 1995,
            artists: [{ name: 'Goodie Mob' }],
            labels: [{ name: 'LaFace Records', catno: '73008-26017-1' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
      ],
      pagination: { page: 1, pages: 1, items: 2, perPage: 100 },
    })
    assert.ok(collection)
    const first = await runBackfill(
      {
        store,
        collection,
        now: () => 60_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) =>
          releaseId === 573292
            ? bootsyDetail()
            : {
                ...lonelyDetail(),
                id: releaseId,
                discogsUrl: `https://www.discogs.com/release/${releaseId}`,
              },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 1 }
    )
    assert.equal(first.discogsRequests, 1)
    assert.equal(first.backfill.discogsRequests, 1)
    assert.equal(first.remaining, 1)
    assert.equal(first.remainingIsEstimate, false)
    assert.equal(first.backfill.cursor, 1)
    const second = await runBackfill(
      {
        store,
        collection,
        now: () => 120_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) =>
          releaseId === 573292
            ? bootsyDetail()
            : {
                ...lonelyDetail(),
                id: releaseId,
                discogsUrl: `https://www.discogs.com/release/${releaseId}`,
              },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 1 }
    )
    assert.equal(second.discogsRequests, 1)
    assert.equal(second.backfill.discogsRequests, 2)
    assert.equal(second.mbRequests, second.backfill.mbRequests - first.backfill.mbRequests)
    assert.equal(second.remaining, 0)
    assert.equal(second.remainingIsEstimate, false)
    assert.equal(second.backfill.cursor, 2)
  })

  it('drains the next collection id, not the visitor queue head', async () => {
    const store = createMemoryCrateStore({ queue: [240128] })
    const collection = parseDurableCollection({
      releases: [
        mapRelease({
          instance_id: 1,
          basic_information: {
            id: 573292,
            title: 'Bootsy? Player Of The Year',
            year: 1978,
            artists: [{ name: "Bootsy's Rubber Band" }],
            labels: [{ name: 'Warner Bros. Records', catno: 'BSK 3093' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
        mapRelease({
          instance_id: 2,
          basic_information: {
            id: 240128,
            title: 'Soul Food',
            year: 1995,
            artists: [{ name: 'Goodie Mob' }],
            labels: [{ name: 'LaFace Records', catno: '73008-26017-1' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
      ],
      pagination: { page: 1, pages: 1, items: 2, perPage: 100 },
    })
    assert.ok(collection)
    const result = await runBackfill(
      {
        store,
        collection,
        now: () => 60_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) =>
          releaseId === 573292
            ? bootsyDetail()
            : {
                ...lonelyDetail(),
                id: releaseId,
                discogsUrl: `https://www.discogs.com/release/${releaseId}`,
              },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 1 }
    )
    assert.deepEqual(result.processed, [573292])
    assert.equal(result.backfill.cursor, 1)
    assert.equal(result.remaining, 1)
    assert.equal(result.remainingIsEstimate, false)
    assert.deepEqual(await store.getQueue(), [240128])
  })

  it('nacks an unavailable id and continues to the next collection id', async () => {
    const store = createMemoryCrateStore()
    const collection = collectionOf([BOOTSY_ROW, GOODIE_ROW])
    let fetches: number[] = []
    const result = await runBackfill(
      {
        store,
        collection,
        now: () => 60_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) => {
          fetches.push(releaseId)
          if (releaseId === 573292) throw new Error('discogs down')
          return {
            ...lonelyDetail(),
            id: releaseId,
            discogsUrl: `https://www.discogs.com/release/${releaseId}`,
          }
        },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 2 }
    )
    const stored = await store.getPressing(573292)
    assert.equal(stored?.provenance.lastError?.kind, 'unavailable')
    assert.equal(isBackfillSettled(stored!), false)
    assert.deepEqual(fetches, [573292, 240128])
    assert.ok(result.backfill.settled?.includes(240128))
    assert.equal(result.backfill.settled?.includes(573292), false)
    assert.equal(result.remaining, 1)
    assert.equal(result.remainingIsEstimate, false)
    assert.equal(result.completedThis, 1)
    const retryAt = Date.parse(stored?.provenance.refreshAfter ?? '')
    assert.ok(Number.isFinite(retryAt) && retryAt > 60_000)
    const queued = store.queue.find((row) => row.id === 573292)
    assert.equal(queued?.score, retryAt)

    const second = await runBackfill(
      {
        store,
        collection,
        now: () => 60_001,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) => {
          fetches.push(releaseId)
          throw new Error('should not refetch backed-off id')
        },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 2 }
    )
    assert.equal(fetches.includes(573292) && fetches.filter((id) => id === 573292).length, 1)
    assert.equal(second.processed.includes(573292), false)
    assert.equal(second.remaining, 1)
  })

  it('stops on a cooling rate_limit instead of walking the next collection id', async () => {
    const nowMs = Date.parse('2026-10-06T08:00:00.000Z')
    const cooling = preservePressingOnFailure(null, nowMs, 'rate_limit', 'MusicBrainz rate limited', {
      releaseId: 573292,
    })
    const store = createMemoryCrateStore({ pressings: { 573292: cooling } })
    const fetches: number[] = []
    const result = await runBackfill(
      {
        store,
        collection: collectionOf([BOOTSY_ROW, GOODIE_ROW]),
        now: () => nowMs + 1_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) => {
          fetches.push(releaseId)
          return bootsyDetail()
        },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 2 }
    )
    assert.equal(result.stoppedOnRateLimit, true)
    assert.deepEqual(fetches, [])
    assert.deepEqual(result.processed, [])
    assert.equal(result.remaining, 2)
  })

  it('honors Retry-After between --retry invocations', async () => {
    const nowMs = Date.parse('2026-10-06T08:00:00.000Z')
    const cooling = preservePressingOnFailure(null, nowMs, 'rate_limit', 'MusicBrainz rate limited', {
      releaseId: 573292,
    })
    const store = createMemoryCrateStore({ pressings: { 573292: cooling } })
    const fetches: number[] = []
    const result = await runBackfill(
      {
        store,
        collection: collectionOf([BOOTSY_ROW]),
        now: () => nowMs + 1_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) => {
          fetches.push(releaseId)
          return bootsyDetail()
        },
        mb: createMusicBrainzClientForTests(),
      },
      { retry: true, ids: [573292] }
    )
    assert.equal(result.stoppedOnRateLimit, true)
    assert.deepEqual(fetches, [])
    assert.deepEqual(result.processed, [])
  })

  it('keeps walking after a Wikidata 429', async () => {
    const fetches: number[] = []
    const result = await runBackfill(
      {
        store: createMemoryCrateStore(),
        collection: collectionOf([BOOTSY_ROW, GOODIE_ROW]),
        now: () => Date.parse('2026-10-06T08:00:00.000Z'),
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) => {
          fetches.push(releaseId)
          return bootsyDetail()
        },
        fetchWikidata: async () => {
          throw new WikidataTemporaryError(429, 2_000)
        },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 2 }
    )
    assert.equal(result.stoppedOnRateLimit, false)
    assert.deepEqual(fetches, [573292, 240128])
    assert.equal(result.processed.length, 2)
  })

  it('stops the walk on a Discogs 429 like a MusicBrainz 429', async () => {
    const fetches: number[] = []
    const result = await runBackfill(
      {
        store: createMemoryCrateStore(),
        collection: collectionOf([BOOTSY_ROW, GOODIE_ROW]),
        now: () => Date.parse('2026-10-06T08:00:00.000Z'),
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) => {
          fetches.push(releaseId)
          throw new DiscogsRateLimitError(30)
        },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 2 }
    )
    assert.equal(result.stoppedOnRateLimit, true)
    assert.deepEqual(fetches, [573292])
    assert.deepEqual(result.processed, [573292])
    const cooling = preservePressingOnFailure(null, Date.parse('2026-10-06T08:00:00.000Z'), 'rate_limit', DISCOGS_RATE_LIMIT_MESSAGE, {
      releaseId: 573292,
    })
    assert.equal(shouldStopWalkOnRateLimit(cooling), true)
  })

  it('uses a settled-id set so added and removed ids are neither skipped nor double-run', async () => {
    const store = createMemoryCrateStore()
    const first = await runBackfill(
      {
        store,
        collection: collectionOf([BOOTSY_ROW, GOODIE_ROW]),
        now: () => 60_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => bootsyDetail(),
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 1 }
    )
    assert.deepEqual(first.backfill.settled, [573292])
    assert.equal(first.remaining, 1)
    assert.equal(first.remainingIsEstimate, false)
    const ran: number[] = []
    const second = await runBackfill(
      {
        store,
        collection: collectionOf([LONELY_ROW, BOOTSY_ROW]),
        now: () => 120_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) => {
          ran.push(releaseId)
          return {
            ...lonelyDetail(),
            id: releaseId,
            discogsUrl: `https://www.discogs.com/release/${releaseId}`,
          }
        },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 1 }
    )
    assert.deepEqual(ran, [9107339])
    assert.equal(second.backfill.settled?.includes(573292), true)
    assert.equal(second.backfill.settled?.includes(9107339), true)
    assert.equal(second.remaining, 0)
    assert.equal(second.remainingIsEstimate, false)
    assert.deepEqual(
      remainingBackfillIds([9107339, 573292], second.backfill.settled ?? [], []),
      []
    )
  })

  it('skips dead ids unless retry is explicit, then unmarks and acks on success', async () => {
    const store = createMemoryCrateStore()
    await store.enqueue([573292], { nowMs: 1_000 })
    await store.markDead({
      releaseId: 573292,
      kind: 'exhausted',
      message: 'dead',
      attempts: 5,
      at: isoFromMs(1_000),
      stage: 'match',
    })
    const skipped = await runBackfill(
      {
        store,
        collection: collectionOf([BOOTSY_ROW, GOODIE_ROW]),
        now: () => 60_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (releaseId) => {
          if (releaseId === 573292) throw new Error('dead id should not enrich')
          return {
            ...lonelyDetail(),
            id: releaseId,
            discogsUrl: `https://www.discogs.com/release/${releaseId}`,
          }
        },
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 2 }
    )
    assert.equal(skipped.processed.includes(573292), false)
    assert.ok(skipped.processed.includes(240128))
    assert.deepEqual(await store.getDead(), [573292])
    assert.ok((await store.getQueue()).includes(573292))
    assert.equal(skipped.remaining, 0)
    assert.equal(skipped.remainingIsEstimate, false)

    const retried = await runBackfill(
      {
        store,
        collection: collectionOf([BOOTSY_ROW, GOODIE_ROW]),
        now: () => 120_000,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => bootsyDetail(),
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 1, retry: true }
    )
    assert.deepEqual(retried.processed, [573292])
    assert.deepEqual(await store.getDead(), [])
    assert.equal((await store.getQueue()).includes(573292), false)
  })

  it('unmarks and acks a dead retry that settles unmatched', async () => {
    const store = createMemoryCrateStore()
    await store.enqueue([11], { nowMs: 1_000 })
    await store.markDead({
      releaseId: 11,
      kind: 'exhausted',
      message: 'dead',
      attempts: 5,
      at: isoFromMs(1_000),
      stage: 'match',
    })
    const nowMs = 120_000
    const result = await runBackfill(
      {
        store,
        collection: collectionOf([
          {
            id: 11,
            title: 'Eleven',
            year: 1977,
            artist: 'X',
            label: 'lf',
            catno: '11',
          },
        ]),
        now: () => nowMs,
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async () => ({
          ...lonelyDetail(),
          id: 11,
          title: 'Eleven',
          discogsUrl: 'https://www.discogs.com/release/11',
        }),
        mb: createMusicBrainzClientForTests(),
      },
      { limit: 1, retry: true }
    )
    const stored = await store.getPressing(11)
    assert.ok(stored)
    assert.equal(stored.provenance.matchStatus, 'unmatched')
    assert.equal(stored.provenance.lastError, null)
    assert.equal(isBackfillSettled(stored), true)
    assert.deepEqual(result.processed, [11])
    assert.deepEqual(await store.getDead(), [])
    assert.equal((await store.getQueue()).includes(11), false)
    assert.equal(result.backfill.settled?.includes(11), true)
  })
})

describe('checked-no-match copy after a MusicBrainz check', () => {
  it('uses the reason · checked line for Mtume, not nothing on file yet', () => {
    const pressing = fixturePressing(567894)
    assert.ok(pressing)
    const line = pressingCheckedNoMatchLine(pressing)
    assert.ok(line)
    assert.match(line, /no musicbrainz release for this pressing/)
    assert.match(line, /checked 2026-10-06/)
    assert.doesNotMatch(line, /nothing on file yet/)
  })
})

describe('readable discogs description', () => {
  it('rejects matrix dumps and company-address notes, then uses the fixture paraphrase', () => {
    const matrix =
      'Runout, etched: BSK-1-3093 WW1. Matrix / Runout (Side B): BSK-2-3093 WW1 #2 — ◁.'
    const address =
      'Manufactured by Warner Bros. Records Inc., 3300 Warner Blvd., Burbank, CA 91510. A Warner Communications Company.'
    assert.equal(sentencesFrom(matrix), null)
    assert.equal(isUnusableDiscogsNotes(matrix), true)
    assert.equal(sentencesFrom(address), null)
    assert.equal(isUnusableDiscogsNotes(address), true)
    const resolved = resolveDescription({
      notes: address,
      url: 'https://www.discogs.com/release/573292',
      releaseId: 573292,
    })
    assert.ok(resolved)
    assert.match(resolved.text, /Winchester/)
    assert.match(resolved.text, /sunglasses/)
    const dumped = pressingStub({
      description: {
        text: address,
        source: 'discogs',
        sourceUrl: 'https://www.discogs.com/release/573292',
      },
    })
    const readable = withReadableDescription(dumped)
    assert.match(readable.description?.text ?? '', /gatefold/)
  })
})

describe('isr-safe collection keep ping', () => {
  it('pings the force-dynamic keep route with a 300s revalidate', async () => {
    const calls: Array<{ url: string; init?: RequestInit & { next?: { revalidate: number } } }> = []
    const ok = scheduleKeepPing(
      {
        CRON_SECRET: 'a'.repeat(32),
        VERCEL_URL: 'example.vercel.app',
      },
      async (url, init) => {
        calls.push({ url, init })
        return new Response('{}', { status: 200 })
      }
    )
    await Promise.resolve()
    assert.equal(ok, true)
    assert.equal(calls[0]?.url, `https://example.vercel.app${COLLECTION_KEEP_PATH}`)
    assert.equal(calls[0]?.init?.next?.revalidate, 300)
    assert.match(String(calls[0]?.init?.headers && 'Authorization' in (calls[0].init.headers as object)
      ? (calls[0].init.headers as Record<string, string>).Authorization
      : ''), /^Bearer /)
  })

  it('does not ping when CRON_SECRET is missing', () => {
    const ok = scheduleKeepPing({ VERCEL_URL: 'example.vercel.app' }, async () => {
      throw new Error('must not fetch')
    })
    assert.equal(ok, false)
  })
})

describe('live-proof helpers', () => {
  it('uses the same inflight key in TAKE_LUA and clearInflight', () => {
    const keys = crateRedisKeys({ VERCEL_ENV: 'preview' })
    assert.equal(keys.inflight(8), `${keys.inflightPrefix}8:v1`)
    assert.match(TAKE_LUA, /prefix \.\. id \.\. ':v1'/)
    assert.match(TAKE_LUA, /SET', prefix \.\. id \.\. ':v1', '1', 'NX', 'EX'/)
  })
  it('recovers the same id after the inflight TTL lapses', async () => {
    const store = createMemoryCrateStore()
    const kill = await runCrateProof(store, 'kill')
    assert.deepEqual(kill.taken, [PROOF_KILL_ID])
    assert.equal(kill.sameIdNotRetaken, true)
    assert.equal(kill.clearedKillInflight, false)
    const recover = await runCrateProof(store, 'recover')
    assert.deepEqual(recover.recovered, [PROOF_KILL_ID])
    assert.equal(recover.recoveredSameId, true)
    assert.equal(recover.clearedInflightByHand, false)
  })

  it('does not retake the killed id from a crowded queue', async () => {
    const store = createMemoryCrateStore({ queue: [10045228, 1026558] })
    const kill = await runCrateProof(store, 'kill')
    assert.deepEqual(kill.taken, [PROOF_KILL_ID])
    assert.equal(kill.sameIdNotRetaken, true)
    const recover = await runCrateProof(store, 'recover')
    assert.equal(recover.recoveredSameId, true)
    assert.deepEqual(recover.recovered, [PROOF_KILL_ID])
    assert.deepEqual(await store.getQueue(), [10045228, 1026558])
  })

  it('exhausts retries on id 9 without draining the live queue', async () => {
    const store = createMemoryCrateStore({ queue: [10045228, 1026558] })
    const result = await runCrateProof(store, 'exhausted')
    assert.equal(result.id, 9)
    assert.deepEqual(result.dead, [9])
    assert.equal((result.lastError as { kind?: string } | null)?.kind, 'exhausted')
    assert.equal(result.factsTitle, 'preview proof stub')
    assert.equal(result.verifiedAtUnchanged, true)
    assert.deepEqual(await store.getQueue(), [10045228, 1026558])
  })

  it('classifies identity 401 through discogs-release.ts', async () => {
    const error = errorForDiscogsStatus(new Response('{"message":"invalid token"}', { status: 401 }))
    assert.equal(error instanceof DiscogsAuthError, true)
    const probed = await probeDiscogsIdentity({
      token: 'preview-proof-invalid-token',
      fetchImpl: async () => new Response('{"message":"invalid token"}', { status: 401 }),
    })
    assert.equal(probed.classified, 'auth')
    assert.equal(probed.status, 401)
  })

  it('classifies a bad Discogs token as auth without touching the live queue', async () => {
    const store = createMemoryCrateStore({ queue: [10045228, 1026558] })
    const result = await runCrateProof(store, 'auth', {
      env: { VERCEL_ENV: 'preview' },
      fetchImpl: async () => new Response('{"message":"invalid token"}', { status: 401 }),
    })
    assert.equal(result.workerStoppedOnAuth, true)
    assert.equal(result.lastErrorKind, 'auth')
    assert.equal(result.attempts, 0)
    assert.equal((result.identity as { classified?: string }).classified, 'auth')
    assert.deepEqual(await store.getQueue(), [10045228, 1026558])
  })

  it('parses proof actions and rejects unknown ones', () => {
    assert.equal(parseProofAction('overlap'), 'overlap')
    assert.equal(parseProofAction('cleanup'), 'cleanup')
    assert.equal(parseProofAction('nope'), null)
  })

  it('uses the enrich budget, not the take floor, on proof drains', () => {
    const src = readFileSync(fileURLToPath(new URL('./proof.ts', import.meta.url)), 'utf8')
    assert.match(src, /budgetMs: ENRICH_BUDGET_MS/)
    assert.doesNotMatch(src, /budgetMs: 8_000/)
    assert.ok(ENRICH_BUDGET_MS > ENRICH_TAKE_FLOOR_MS)
  })

  it('refuses crate proofs in production', async () => {
    assert.equal(crateProofAllowed({ VERCEL_ENV: 'production' }), false)
    assert.equal(crateProofAllowed({ VERCEL_ENV: 'preview' }), true)
    const store = createMemoryCrateStore()
    const refused = await runCrateProof(store, 'inspect', {
      env: { VERCEL_ENV: 'production' },
    })
    assert.equal(refused.refused, true)
  })
})

describe('visit reads never write redis', () => {
  it('does not enqueue when a visitor reads a listed miss or fixture', async () => {
    const store = createMemoryCrateStore()
    const listed = await readStoredPressing(573292, {
      store,
      collection: [
        mapRelease({
          instance_id: 1,
          basic_information: {
            id: 573292,
            title: 'Bootsy? Player Of The Year',
            year: 1978,
            artists: [{ name: "Bootsy's Rubber Band" }],
            labels: [{ name: 'Warner Bros. Records', catno: 'BSK 3093' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
      ],
    })
    assert.equal(listed.status, 'ok')
    assert.deepEqual(await store.getQueue(), [])
    const pending = await readStoredPressing(9107339, {
      store,
      collection: [
        mapRelease({
          instance_id: 2,
          basic_information: {
            id: 9107339,
            title: 'One',
            year: 1977,
            artists: [{ name: 'Lecturer' }],
            labels: [{ name: 'lf', catno: 'lf-1' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
      ],
    })
    assert.equal(pending.status, 'ok')
    if (pending.status === 'ok') assert.equal(pending.from, 'collection')
    assert.deepEqual(await store.getQueue(), [])
  })

  it('does not re-queue a too_slow pressing on visit', async () => {
    const store = createMemoryCrateStore()
    await store.markUnresolved({
      releaseId: 9107339,
      kind: 'too_slow',
      message: 'too slow',
      attempts: 0,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'queue',
    })
    const pending = await readStoredPressing(9107339, {
      store,
      collection: [
        mapRelease({
          instance_id: 2,
          basic_information: {
            id: 9107339,
            title: 'One',
            year: 1977,
            artists: [{ name: 'Lecturer' }],
            labels: [{ name: 'lf', catno: 'lf-1' }],
            formats: [{ name: 'Vinyl' }],
          },
        }),
      ],
    })
    assert.equal(pending.status, 'ok')
    assert.deepEqual(await store.getQueue(), [])
    assert.equal(store.drafts[9107339], undefined)
  })
})

describe('research facts: fallbacks, schema, and coverage', () => {
  function creditFact(
    source: ResearchFact['source'],
    person: string,
    fetchedAt = '2026-10-06T00:00:00.000Z'
  ): ResearchFact {
    return {
      kind: 'credit',
      trackKey: '',
      track: null,
      role: 'producer',
      person,
      relatedTitle: '',
      relatedArtist: '',
      source,
      sourceId: person,
      sourceUrl: `https://example.test/${source}`,
      fetchedAt,
    }
  }

  it('keeps MusicBrainz over Discogs over Wikidata when the fact is the same', () => {
    const merged = mergeResearchFacts(
      [creditFact('wikidata', 'James Mtume')],
      [creditFact('discogs', 'James Mtume')],
      [creditFact('musicbrainz', 'James Mtume')]
    )
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.source, 'musicbrainz')
  })

  it('persists attributed credits as creditLine so assistant engineer is not collapsed to engineer', () => {
    const credit = {
      name: 'Mike Iacopelli',
      role: 'engineer',
      attributes: ['assistant'],
      level: 'recording' as const,
      source: 'discogs' as const,
      sourceUrl: 'https://www.discogs.com/release/573292',
      providerId: 'mike',
    }
    assert.equal(creditLine(credit), 'assistant engineer')
    const facts = factsFromRecordings({
      tracks: [
        {
          position: 'A2',
          title: 'Hollywood Squares',
          duration: '6:15',
          durationMs: 375000,
          index: 1,
          identityKey: 'a2-hollywood-squares',
          recording: {
            matchStatus: 'matched',
            confidence: 0.99,
            reason: 'matched',
            mbid: 'rec-hs',
            recordingUrl: 'https://musicbrainz.org/recording/rec-hs',
          },
        },
      ],
      recordings: {
        'rec-hs': {
          mbid: 'rec-hs',
          title: 'Hollywood Squares',
          artist: "Bootsy's Rubber Band",
          credits: [
            credit,
            {
              name: 'Jim Vitti',
              role: 'engineer',
              attributes: [],
              level: 'recording',
              source: 'discogs',
              sourceUrl: 'https://www.discogs.com/release/573292',
              providerId: 'jim',
            },
          ],
          samplesFrom: [],
          sampledIn: [],
          provenance: {
            sourceUrls: ['https://www.discogs.com/release/573292'],
            matchStatus: 'matched',
            confidence: 0.99,
            reason: 'matched',
            checkedAt: '2026-10-06T00:00:00.000Z',
            refreshAfter: '2027-04-04T00:00:00.000Z',
            lastError: null,
          },
        },
      },
    })
    const assistant = facts.find((fact) => fact.person === 'Mike Iacopelli')
    const engineer = facts.find((fact) => fact.person === 'Jim Vitti')
    assert.equal(assistant?.role, 'assistant engineer')
    assert.equal(engineer?.role, 'engineer')
    const samePersonBothRoles = mergeResearchFacts(facts, [
      {
        kind: 'credit',
        trackKey: 'a2-hollywood-squares',
        track: { position: 'A2', title: 'Hollywood Squares' },
        role: 'engineer',
        person: 'Mike Iacopelli',
        relatedTitle: '',
        relatedArtist: '',
        source: 'discogs',
        sourceId: 'mike-engineer',
        sourceUrl: 'https://www.discogs.com/release/573292',
        fetchedAt: '2026-10-06T00:00:00.000Z',
      },
    ])
    const mike = samePersonBothRoles.filter((fact) => fact.person === 'Mike Iacopelli')
    assert.equal(mike.length, 2)
    assert.deepEqual(
      mike.map((fact) => fact.role).sort(),
      ['assistant engineer', 'engineer']
    )
  })

  it('reads Discogs extraartists from the mapped release payload', () => {
    const mapped = mapDiscogsReleaseDetail({
      id: 567894,
      title: 'Juicy Fruit',
      artists: [{ name: 'Mtume' }],
      extraartists: [
        { name: 'Larkin Arnold', role: 'Executive-Producer', id: 255778 },
      ],
      tracklist: [
        {
          position: 'A',
          title: 'Juicy Fruit (Vocal)',
          extraartists: [{ name: 'James Mtume', role: 'Remix', id: 36715 }],
        },
      ],
    })
    assert.ok(mapped)
    assert.equal(mapped.extraartists?.[0]?.name, 'Larkin Arnold')
    assert.equal(mapped.tracklist[0]?.extraartists?.[0]?.name, 'James Mtume')
  })

  it('recovers Discogs credits for Mtume 567894 and looks up Wikidata by master P1954', async () => {
    const store = createMemoryCrateStore()
    const nowIso = '2026-10-06T06:00:00.000Z'
    const tracks = occurrencesFromDetail(mtumeDetail())
    const discogs = researchFactsFromDiscogs(mtumeDetail(), tracks, nowIso)
    const people = [...new Set(discogs.filter((fact) => fact.kind === 'credit').map((fact) => fact.person))]
    assert.ok(people.includes('Larkin Arnold'))
    assert.ok(people.includes('Herb Powers Jr.'))
    assert.ok(people.includes('James Mtume'))
    assert.ok(people.includes('Reggie Thompson'))
    assert.ok(people.includes('Scott Folks'))
    assert.ok(people.includes('Tony Humphries'))
    assert.ok(discogs.every((fact) => fact.source === 'discogs'))
    const query = wikidataReleaseQuery({ discogsReleaseId: 567894, masterId: 284145 })
    assert.match(query, /P1954/)
    assert.match(query, /P2206/)
    assert.match(query, /P5707/)
    assert.doesNotMatch(query, /P736/)
    assert.doesNotMatch(query, /P144/)
    assert.doesNotMatch(query, /P4969/)
    const wiki = researchFactsFromWikidataBindings([], 567894, nowIso)
    assert.deepEqual(wiki, [])
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse(nowIso),
      fetchDiscogs: async () => mtumeDetail(),
      fetchWikidata: async () => wiki,
      mb: createMusicBrainzClientForTests(),
    })
    assert.equal(result.mbRelease.matchStatus, 'unmatched')
    const sources = new Set((result.researchFacts ?? []).map((fact) => fact.source))
    assert.equal(sources.has('discogs'), true)
    assert.equal(sources.has('wikidata'), false)
    assert.equal(result.coverage?.matched, 0)
    assert.equal(result.coverage?.withReleaseCredits, true)
    assert.ok((result.coverage?.withCredits ?? 0) >= 2)
    assert.notEqual(result.coverage?.matched, result.coverage?.withCredits)
  })

  it('does not count release-level credits as every-track coverage', () => {
    const tracks = occurrencesFromDetail(mtumeDetail())
    const nowIso = '2026-10-06T06:00:00.000Z'
    const releaseOnly: ResearchFact = {
      kind: 'credit',
      trackKey: '',
      track: null,
      role: 'producer',
      person: 'James Mtume',
      relatedTitle: '',
      relatedArtist: '',
      source: 'wikidata',
      sourceId: 'Q1',
      sourceUrl: 'https://www.wikidata.org/wiki/Q6305224',
      fetchedAt: nowIso,
    }
    const coverage = coverageOf({ tracks, recordings: {}, researchFacts: [releaseOnly] })
    assert.equal(coverage.withCredits, 0)
    assert.equal(coverage.withReleaseCredits, true)
    assert.equal(coverage.withSamples, 0)
    assert.equal(coverage.withReleaseSamples, false)
  })

  it('maps Wikidata SPARQL credits to the claim-bearing item and P5707 samples', () => {
    const fetchedAt = '2026-10-06T06:00:00.000Z'
    const facts = researchFactsFromWikidataBindings(
      [
        {
          item: { value: 'http://www.wikidata.org/entity/Q6305224' },
          itemLabel: { value: 'Juicy Fruit' },
          matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
          prop: { value: 'http://www.wikidata.org/entity/P162' },
          value: { value: 'http://www.wikidata.org/entity/Q2' },
          valueLabel: { value: 'Example Producer' },
          direction: { value: 'out' },
        },
        {
          item: { value: 'http://www.wikidata.org/entity/Q6305224' },
          itemLabel: { value: 'Juicy Fruit' },
          matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
          prop: { value: 'http://www.wikidata.org/entity/P5707' },
          value: { value: 'http://www.wikidata.org/entity/Q9' },
          valueLabel: { value: 'Sampled Work' },
          direction: { value: 'out' },
        },
        {
          item: { value: 'http://www.wikidata.org/entity/Q6305224' },
          itemLabel: { value: 'Juicy Fruit' },
          matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
          prop: { value: 'http://www.wikidata.org/entity/P5707' },
          value: { value: 'http://www.wikidata.org/entity/Q8' },
          valueLabel: { value: 'Later Record' },
          direction: { value: 'in' },
        },
      ],
      567894,
      fetchedAt
    )
    assert.equal(facts.length, 3)
    const producer = facts.find((fact) => fact.kind === 'credit')
    assert.equal(producer?.source, 'wikidata')
    assert.equal(producer?.role, 'producer')
    assert.equal(producer?.person, 'Example Producer')
    assert.equal(producer?.sourceUrl, 'https://www.wikidata.org/wiki/Q6305224')
    const sampleOf = facts.find((fact) => fact.kind === 'sample_of')
    assert.equal(sampleOf?.relatedTitle, 'Sampled Work')
    assert.equal(sampleOf?.sourceUrl, 'https://www.wikidata.org/wiki/Q6305224')
    const sampledBy = facts.find((fact) => fact.kind === 'sampled_by')
    assert.equal(sampledBy?.relatedTitle, 'Later Record')
    assert.equal(sampledBy?.sourceUrl, 'https://www.wikidata.org/wiki/Q8')
  })

  it('classifies more than one Wikidata item as ambiguous and does not merge', () => {
    const identity = pickWikidataIdentity([
      {
        item: { value: 'http://www.wikidata.org/entity/Q1' },
        matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
      },
      {
        item: { value: 'http://www.wikidata.org/entity/Q2' },
        matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
      },
    ])
    assert.equal(identity.status, 'ambiguous')
    const facts = researchFactsFromWikidataBindings(
      [
        {
          item: { value: 'http://www.wikidata.org/entity/Q1' },
          matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
          prop: { value: 'http://www.wikidata.org/entity/P162' },
          valueLabel: { value: 'One' },
        },
        {
          item: { value: 'http://www.wikidata.org/entity/Q2' },
          matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
          prop: { value: 'http://www.wikidata.org/entity/P162' },
          valueLabel: { value: 'Two' },
        },
      ],
      1,
      '2026-10-06T06:00:00.000Z'
    )
    assert.deepEqual(facts, [])
  })

  it('prefers P1954 over P436 over P2206/P5813', () => {
    const identity = pickWikidataIdentity([
      {
        item: { value: 'http://www.wikidata.org/entity/Q7617150' },
        matchProp: { value: 'http://www.wikidata.org/entity/P436' },
      },
      {
        item: { value: 'http://www.wikidata.org/entity/Q4944093' },
        matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
      },
    ])
    assert.equal(identity.status, 'ok')
    assert.equal(identity.itemQid, 'Q4944093')
    assert.equal(identity.matchProp, 'P1954')
  })

  it('normalizes role synonyms and drops a release-level duplicate of a track credit', () => {
    assert.equal(normalizeCreditRole('Executive-Producer'), 'executive producer')
    assert.equal(normalizeCreditRole('Composer'), 'written by')
    assert.equal(normalizeCreditRole('Composed By'), 'written by')
    assert.equal(normalizeCreditRole('Written-By'), 'written by')
    const trackKey = 'a\u001fjuicy fruit\u001f\u001f\u001ftrack'
    const merged = mergeResearchFacts(
      [
        {
          kind: 'credit',
          trackKey: '',
          track: null,
          role: 'Producer',
          person: 'James Mtume',
          relatedTitle: '',
          relatedArtist: '',
          source: 'discogs',
          sourceId: '36715',
          sourceUrl: 'https://www.discogs.com/release/567894',
          fetchedAt: '2026-10-06T06:00:00.000Z',
        },
        {
          kind: 'credit',
          trackKey,
          track: { position: 'A', title: 'Juicy Fruit (Vocal)' },
          role: 'produced by',
          person: 'James Mtume',
          relatedTitle: '',
          relatedArtist: '',
          source: 'discogs',
          sourceId: '36715',
          sourceUrl: 'https://www.discogs.com/release/567894',
          fetchedAt: '2026-10-06T06:00:00.000Z',
        },
      ]
    )
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.trackKey, trackKey)
  })

  it('keeps prior Wikidata facts when SPARQL is temporarily unavailable', async () => {
    const nowIso = '2026-10-06T06:00:00.000Z'
    const wikiFact: ResearchFact = {
      kind: 'credit',
      trackKey: '',
      track: null,
      role: 'producer',
      person: 'Wikidata Only',
      relatedTitle: '',
      relatedArtist: '',
      source: 'wikidata',
      sourceId: 'Q2',
      sourceUrl: 'https://www.wikidata.org/wiki/Q6305224',
      fetchedAt: '2026-01-01T00:00:00.000Z',
    }
    const previous = hydratePressing(
      pressingStub({
        releaseId: 567894,
        facts: {
          releaseId: 567894,
          title: 'Juicy Fruit',
          artist: 'Mtume',
          label: 'Epic',
          catno: '49-03834',
          format: 'Vinyl, 12", 45 RPM, Stereo',
          country: 'US',
          released: '1983',
          year: 1983,
          cover: '',
          thumbnail: '',
          discogsUrl: 'https://www.discogs.com/release/567894',
          barcode: null,
          masterId: 284145,
        },
        tracks: occurrencesFromDetail(mtumeDetail()),
        mbRelease: {
          mbid: null,
          url: null,
          matchStatus: 'unmatched',
          confidence: 0,
          reason: 'no musicbrainz release',
          releaseGroupMbid: null,
        },
        researchFacts: [wikiFact],
        provenance: {
          sourceUrls: ['https://www.discogs.com/release/567894'],
          matchStatus: 'unmatched',
          confidence: 0,
          reason: 'no musicbrainz release',
          checkedAt: nowIso,
          refreshAfter: '2026-11-01T00:00:00.000Z',
          lastError: null,
          verifiedAt: '2026-01-01T00:00:00.000Z',
        },
        lifecycles: {
          pressing: {
            verifiedAt: nowIso,
            lastAttemptAt: nowIso,
            lastError: null,
            attempts: 0,
          },
          match: {
            verifiedAt: nowIso,
            lastAttemptAt: nowIso,
            lastError: null,
            attempts: 0,
          },
          research: {
            verifiedAt: '2026-01-01T00:00:00.000Z',
            lastAttemptAt: '2026-01-01T00:00:00.000Z',
            lastError: null,
            attempts: 0,
          },
        },
      })
    )
    const store = createMemoryCrateStore({ pressings: { 567894: previous } })
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse(nowIso),
      fetchDiscogs: async () => mtumeDetail(),
      fetchWikidata: async () => {
        throw new WikidataTemporaryError(429, 1200)
      },
      mb: createMusicBrainzClientForTests(),
      forceRefresh: true,
    })
    const kept = (result.researchFacts ?? []).filter((fact) => fact.source === 'wikidata')
    assert.equal(kept.length, 1)
    assert.equal(kept[0]?.person, 'Wikidata Only')
    assert.equal(result.lifecycles?.research.verifiedAt, '2026-01-01T00:00:00.000Z')
    assert.equal(result.lifecycles?.research.lastError?.kind, 'rate_limit')
  })

  it('does not wait out a Retry-After longer than the request timeout', async () => {
    const sleeps: number[] = []
    let clock = 10_000
    let calls = 0
    const client = createWikidataClient({
      minIntervalMs: 0,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms)
        clock += ms
      },
      timeoutMs: 5_000,
      fetchImpl: async () => {
        calls += 1
        return new Response('', { status: 429, headers: { 'Retry-After': '30' } })
      },
    })
    const result = await client.lookupRelease(
      { discogsReleaseId: 567894, masterId: 284145 },
      '2026-10-06T06:00:00.000Z'
    )
    assert.equal(result.status, 'temporary')
    assert.ok(result.status === 'temporary' && result.error instanceof WikidataTemporaryError)
    assert.equal(calls, 1)
    assert.ok(sleeps.every((ms) => ms < 5_000))
  })

  it('caps the SPARQL abort timer at remaining deadline', async () => {
    let calls = 0
    const client = createWikidataClient({
      minIntervalMs: 0,
      now: () => 10_000,
      timeoutMs: 5_000,
      fetchImpl: async () => {
        calls += 1
        throw new Error('should not fetch when the deadline has already elapsed')
      },
    })
    const result = await client.lookupRelease(
      { discogsReleaseId: 567894, masterId: 284145 },
      '2026-10-06T06:00:00.000Z',
      { deadlineMs: 10_000 }
    )
    assert.equal(result.status, 'temporary')
    if (result.status === 'temporary') {
      assert.equal(result.error.status, 'timeout')
    }
    assert.equal(calls, 0)
  })

  it('keeps the SPARQL abort timer through body consumption', async () => {
    const client = createWikidataClient({
      minIntervalMs: 0,
      timeoutMs: 30,
      fetchImpl: async () =>
        ({
          ok: true,
          status: 200,
          json: () => new Promise(() => {}),
        }) as Response,
    })
    const result = await client.lookupRelease(
      { discogsReleaseId: 567894, masterId: 284145 },
      '2026-10-06T06:00:00.000Z'
    )
    assert.equal(result.status, 'temporary')
    if (result.status === 'temporary') {
      assert.equal(result.error.status, 'timeout')
    }
  })

  it('keeps unresolvable track-scoped Discogs credits off the release, and expands ranges', () => {
    const base = mtumeDetail()
    const detail = {
      ...base,
      extraartists: [
        { name: 'Range Person', role: 'Bass', id: 1, tracks: 'A to B' },
        { name: 'Unknown Position', role: 'Drums', id: 2, tracks: 'C3' },
        { name: 'Release Wide', role: 'Producer', id: 3, tracks: null },
      ],
      tracklist: base.tracklist.map((track) => ({ ...track, extraartists: [] })),
    }
    const tracks = occurrencesFromDetail(detail)
    const facts = researchFactsFromDiscogs(detail, tracks, '2026-10-06T06:00:00.000Z')
    const byPerson = (person: string) => facts.filter((fact) => fact.person === person)
    assert.deepEqual(
      byPerson('Range Person').map((fact) => fact.track?.position),
      ['A', 'B']
    )
    assert.equal(byPerson('Unknown Position').length, 0)
    assert.deepEqual(byPerson('Release Wide').map((fact) => fact.track), [null])
  })

  it('does not let numeric range endpoints prefix-match longer track numbers', () => {
    const base = mtumeDetail()
    const tracklist = Array.from({ length: 20 }, (_, i) => ({
      position: String(i + 1),
      title: `Track ${i + 1}`,
      duration: '3:00',
      type_: 'track',
      extraartists: [],
    }))
    const detail = {
      ...base,
      extraartists: [
        { name: 'Range Person', role: 'Bass', id: 1, tracks: '1 to 2' },
        { name: 'Single Person', role: 'Drums', id: 2, tracks: '2' },
      ],
      tracklist,
    }
    const tracks = occurrencesFromDetail(detail)
    const facts = researchFactsFromDiscogs(detail, tracks, '2026-10-06T06:00:00.000Z')
    const positions = (person: string) =>
      facts.filter((fact) => fact.person === person).map((fact) => fact.track?.position)
    assert.deepEqual(positions('Range Person'), ['1', '2'])
    assert.deepEqual(positions('Single Person'), ['2'])
  })

  it('keeps a release unsettled and retryable when Wikidata is skipped for budget', async () => {
    const store = createMemoryCrateStore()
    let clock = Date.parse('2026-10-06T06:00:00.000Z')
    const deadlineMs = clock + ENRICH_TAKE_FLOOR_MS + 1_000
    let wikidataCalls = 0
    const result = await enrichPressing(567894, {
      store,
      now: () => clock,
      deadlineMs,
      fetchDiscogs: async () => {
        // Discogs eats the budget: still inside the deadline, below the floor.
        clock += 5_000
        return mtumeDetail()
      },
      fetchWikidata: async () => {
        wikidataCalls += 1
        return []
      },
      mb: createMusicBrainzClientForTests(),
    })
    assert.equal(wikidataCalls, 0)
    assert.equal(result.provenance.lastError?.kind, 'unavailable')
    assert.equal(isBackfillSettled(result), false)
    assert.ok(Date.parse(result.provenance.refreshAfter) - clock <= 60_000)
    assert.equal(result.lifecycles?.research.lastError?.kind, 'unavailable')
    assert.equal(result.lifecycles?.research.attempts, 0)
  })

  it('shares one Wikidata client so the 1.1s interval is enforced and honors Retry-After', async () => {
    const sleeps: number[] = []
    let clock = 10_000
    let calls = 0
    const client = createWikidataClient({
      minIntervalMs: 1100,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms)
        clock += ms
      },
      timeoutMs: 5_000,
      fetchImpl: async (_input, init) => {
        calls += 1
        if (calls === 1) {
          return new Response('', {
            status: 429,
            headers: { 'Retry-After': '2' },
          })
        }
        assert.equal(init?.method, 'POST')
        return Response.json({
          results: {
            bindings: [
              {
                item: { value: 'http://www.wikidata.org/entity/Q6305224' },
                matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
              },
            ],
          },
        })
      },
    })
    const first = await client.lookupRelease(
      { discogsReleaseId: 567894, masterId: 284145 },
      '2026-10-06T06:00:00.000Z'
    )
    const second = await client.lookupRelease(
      { discogsReleaseId: 573292, masterId: 14594 },
      '2026-10-06T06:00:00.000Z'
    )
    assert.equal(first.status, 'ok')
    assert.equal(second.status, 'ok')
    assert.ok(sleeps.includes(2000))
    assert.ok(sleeps.some((ms) => ms >= 1000))
    assert.equal(client.requestCount, 3)
  })

  it('lookupWikidataReleaseFacts reuses one client and sleeps ≥1100ms between SPARQL requests', async () => {
    const sleeps: number[] = []
    const sparqlAt: number[] = []
    let clock = 10_000
    const fetchedAt = '2026-10-06T06:00:00.000Z'
    const options = {
      now: () => clock,
      sleep: async (ms: number) => {
        sleeps.push(ms)
        clock += ms
      },
      fetchImpl: async () => {
        sparqlAt.push(clock)
        return Response.json({
          results: {
            bindings: [
              {
                item: { value: 'http://www.wikidata.org/entity/Q6305224' },
                matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
              },
            ],
          },
        })
      },
    }
    resetSharedWikidataClient(options)
    try {
      const first = await lookupWikidataReleaseFacts(
        { discogsReleaseId: 567894, masterId: 284145 },
        fetchedAt
      )
      const second = await lookupWikidataReleaseFacts(
        { discogsReleaseId: 573292, masterId: 14594 },
        fetchedAt
      )
      assert.equal(first.status, 'ok')
      assert.equal(second.status, 'ok')
      assert.equal(sparqlAt.length, 2)
      assert.ok(
        (sparqlAt[1] ?? 0) - (sparqlAt[0] ?? 0) >= 1100,
        `expected ≥1100ms between SPARQL requests, got ${JSON.stringify(sparqlAt)} sleeps=${JSON.stringify(sleeps)}`
      )
      assert.ok(
        sleeps.some((ms) => ms >= 1100),
        `expected a sleep of ≥1100ms, got ${JSON.stringify(sleeps)}`
      )
      assert.equal(getSharedWikidataClient().requestCount, 2)
    } finally {
      resetSharedWikidataClient()
    }
  })

  it('lookupWikidataReleaseFacts does not build a new client per call', () => {
    const src = readFileSync(fileURLToPath(new URL('./wikidata.ts', import.meta.url)), 'utf8')
    const start = src.indexOf('export async function lookupWikidataReleaseFacts')
    const nextExport = src.indexOf('\nexport ', start + 1)
    const body = src.slice(start, nextExport === -1 ? undefined : nextExport)
    assert.match(body, /getSharedWikidataClient/)
    assert.doesNotMatch(body, /wikidataClientFor/)
    assert.doesNotMatch(body, /createWikidataClient/)
  })

  it('binds P5813 to the MusicBrainz release id, not catalog number', () => {
    const query = wikidataReleaseQuery({
      discogsReleaseId: 567894,
      masterId: 284145,
      mbReleaseId: '72089134-a550-446e-b26d-8d3b523b05d6',
      mbReleaseGroupId: 'rg-1',
    })
    assert.match(query, /P5813 "72089134-a550-446e-b26d-8d3b523b05d6"/)
    assert.doesNotMatch(query, /49-03834/)
    assert.doesNotMatch(wikidataReleaseQuery({ discogsReleaseId: 567894 }), /P5813/)
  })

  it('does not sleep a Retry-After that exceeds the remaining deadline', async () => {
    const sleeps: number[] = []
    let clock = 10_000
    const client = createWikidataClient({
      minIntervalMs: 0,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms)
        clock += ms
      },
      timeoutMs: 5_000,
      fetchImpl: async () =>
        new Response('', {
          status: 429,
          headers: { 'Retry-After': '5' },
        }),
    })
    const result = await client.lookupRelease(
      { discogsReleaseId: 567894, masterId: 284145 },
      '2026-10-06T06:00:00.000Z',
      { deadlineMs: 10_100 }
    )
    assert.equal(result.status, 'temporary')
    if (result.status === 'temporary') {
      assert.equal(result.error.kind, 'rate_limit')
    }
    assert.equal(
      sleeps.some((ms) => ms >= 5000),
      false,
      `Retry-After must not sleep past the deadline, got ${JSON.stringify(sleeps)}`
    )
  })

  it('uses an injected Wikidata client even when NODE_TEST_CONTEXT is set', async () => {
    assert.ok(process.env.NODE_TEST_CONTEXT)
    const client = createWikidataClient({
      minIntervalMs: 0,
      fetchImpl: async () =>
        Response.json({
          results: {
            bindings: [
              {
                item: { value: 'http://www.wikidata.org/entity/Q6305224' },
                matchProp: { value: 'http://www.wikidata.org/entity/P1954' },
                prop: { value: 'http://www.wikidata.org/entity/P162' },
                valueLabel: { value: 'Injected Wiki' },
              },
            ],
          },
        }),
    })
    const store = createMemoryCrateStore()
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T06:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: createMusicBrainzClientForTests(),
      wikidataClient: client,
    })
    const wiki = (result.researchFacts ?? []).filter((fact) => fact.source === 'wikidata')
    assert.ok(wiki.some((fact) => fact.person === 'Injected Wiki'))
  })

  it('passes the MusicBrainz release mbid as P5813, not catno', async () => {
    let captured: { mbReleaseId?: string | null; discogsReleaseId?: number } | null = null
    const store = createMemoryCrateStore()
    await enrichPressing(573292, {
      store,
      now: () => Date.parse('2026-10-06T06:00:00.000Z'),
      fetchDiscogs: async () => bootsyDetail(),
      mb: {
        ...createMusicBrainzClientForTests(),
        async lookupDiscogsReleaseUrl() {
          return ['72089134-a550-446e-b26d-8d3b523b05d6']
        },
        async getRelease() {
          return {
            id: '72089134-a550-446e-b26d-8d3b523b05d6',
            title: 'Bootsy? Player Of The Year',
            date: '1978',
            country: 'US',
            releaseGroupId: 'rg-bootsy',
            tracks: [],
          }
        },
      },
      fetchWikidata: async (input) => {
        captured = input
        return []
      },
    })
    assert.equal(captured?.mbReleaseId, '72089134-a550-446e-b26d-8d3b523b05d6')
    assert.notEqual(captured?.mbReleaseId, 'BSK 3093')
  })
})

describe('draft reuse, TTL, and cycle guard', () => {
  it('expires memory drafts after DRAFT_TTL_SECONDS', async () => {
    let nowMs = Date.parse('2026-10-06T05:00:00.000Z')
    const store = createMemoryCrateStore({ now: () => nowMs })
    const draft = hydratePressing(pressingStub())
    await store.setDraftPressing(draft)
    assert.ok(await store.getDraftPressing(573292))
    nowMs += DRAFT_TTL_SECONDS * 1000 + 1
    assert.equal(await store.getDraftPressing(573292), null)
  })

  it('sets Redis draft keys with EX equal to DRAFT_TTL_SECONDS', () => {
    const src = readFileSync(fileURLToPath(new URL('./store.ts', import.meta.url)), 'utf8')
    assert.match(src, /ex: DRAFT_TTL_SECONDS/)
    assert.equal(DRAFT_TTL_SECONDS, 900)
  })

  it('reuses a current-cycle draft and rejects stale or committed-over drafts', () => {
    const nowMs = Date.parse('2026-10-06T06:00:00.000Z')
    const draft = hydratePressing(
      pressingStub({
        provenance: {
          ...pressingStub().provenance,
          lastAttemptAt: '2026-10-06T05:59:00.000Z',
          checkedAt: '2026-10-06T05:59:00.000Z',
        },
      })
    )
    const committed = hydratePressing(
      pressingStub({
        provenance: {
          ...pressingStub().provenance,
          lastAttemptAt: '2026-10-06T06:00:00.000Z',
          checkedAt: '2026-10-06T06:00:00.000Z',
        },
      })
    )
    assert.equal(shouldReuseDraft(draft, null, nowMs), true)
    assert.equal(shouldReuseDraft(draft, committed, nowMs), false)
    assert.equal(shouldReuseDraft(draft, null, nowMs, true), false)
    const forceDraft = hydratePressing(
      pressingStub({
        checkpoint: {
          stage: 'research',
          researchCursor: 0,
          trackSampleCursor: 3,
          forceRun: true,
          forceRunAt: '2026-10-06T05:59:00.000Z',
          deadlineStops: 1,
        },
        provenance: {
          ...pressingStub().provenance,
          lastAttemptAt: '2026-10-06T05:59:00.000Z',
          checkedAt: '2026-10-06T05:59:00.000Z',
        },
      })
    )
    assert.equal(shouldReuseDraft(forceDraft, committed, nowMs, true), true)
    assert.equal(shouldReuseDraft(forceDraft, null, nowMs, true), true)
    const staleAttemptFreshStamp = hydratePressing(
      pressingStub({
        checkpoint: {
          stage: 'research',
          researchCursor: 0,
          trackSampleCursor: 7,
          forceRun: true,
          forceRunAt: '2026-10-06T05:59:00.000Z',
          deadlineStops: 2,
        },
        provenance: {
          ...pressingStub().provenance,
          lastAttemptAt: '2026-10-06T04:00:00.000Z',
          checkedAt: '2026-10-06T04:00:00.000Z',
        },
      })
    )
    assert.equal(shouldReuseDraft(staleAttemptFreshStamp, committed, nowMs, true), true)
    const staleStamp = hydratePressing(
      pressingStub({
        checkpoint: {
          stage: 'research',
          researchCursor: 0,
          trackSampleCursor: 3,
          forceRun: true,
          forceRunAt: '2026-10-06T05:44:59.000Z',
          deadlineStops: 1,
        },
        provenance: {
          ...pressingStub().provenance,
          lastAttemptAt: '2026-10-06T05:59:00.000Z',
          checkedAt: '2026-10-06T05:59:00.000Z',
        },
      })
    )
    assert.equal(shouldReuseDraft(staleStamp, committed, nowMs, true), false)
    const stale = hydratePressing(
      pressingStub({
        provenance: {
          ...pressingStub().provenance,
          lastAttemptAt: '2026-10-06T04:00:00.000Z',
          checkedAt: '2026-10-06T04:00:00.000Z',
        },
      })
    )
    assert.equal(shouldReuseDraft(stale, null, nowMs), false)
  })
})

describe('backfill cursor migration and targeted retry', () => {
  it('does not treat a numeric cursor as an index into the current id list', () => {
    const previous = {
      cursor: 2,
      startedAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
      completed: 2,
      unresolved: 0,
      failed: 0,
      discogsRequests: 0,
      mbRequests: 0,
      status: 'running' as const,
    }
    assert.deepEqual(migrateSettledIds(previous, [9107339, 573292, 240128]), [])
    assert.deepEqual(
      migrateSettledIds({ ...previous, settled: [573292, 573292, 0] }, [9107339, 573292]),
      [573292]
    )
  })

  it('parses id lists for the manual trigger', () => {
    assert.deepEqual(parseIdList('567894,573292,567894'), [567894, 573292])
    assert.deepEqual(parseIdList(''), [])
    assert.deepEqual(parseIdList(null), [])
  })

  it('rejects malformed ids instead of truncating them', () => {
    assert.deepEqual(parseIdList('567894oops,567894.5,1e3,-4,0,07'), [])
    assert.deepEqual(parseIdList(' 567894 , 573292x, 573292'), [567894, 573292])
  })

  it('retries only dead and too_slow ids when retry has no ids', async () => {
    assert.deepEqual(
      remainingBackfillIds([567894, 573292, 240128], [567894, 573292], [240128], true, [240128]),
      [240128]
    )
    assert.deepEqual(
      remainingBackfillIds([567894, 573292], [567894, 573292], [567894], true, [567894]),
      [567894]
    )
    assert.deepEqual(
      remainingBackfillIds([567894, 573292], [567894], [], true),
      [567894, 573292]
    )
    const store = createMemoryCrateStore()
    await store.markDead({
      releaseId: 567894,
      kind: 'exhausted',
      message: 'gave up',
      attempts: 5,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'pressing',
    })
    await store.markUnresolved({
      releaseId: 240128,
      kind: 'too_slow',
      message: 'too slow',
      attempts: 0,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'match',
    })
    const targets = await retryBackfillTargets(store)
    assert.deepEqual([...targets].sort((left, right) => left - right), [240128, 567894])
    await store.setBackfill({
      cursor: 0,
      settled: [567894, 573292, 240128],
      startedAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
      completed: 3,
      unresolved: 1,
      failed: 1,
      discogsRequests: 0,
      mbRequests: 0,
      status: 'idle',
    })
    const fetches: number[] = []
    await runBackfill(
      {
        store,
        collection: collectionOf([
          {
            id: 567894,
            title: 'Juicy Fruit',
            year: 1983,
            artist: 'Mtume',
            label: 'Epic',
            catno: '49-03834',
          },
          BOOTSY_ROW,
          GOODIE_ROW,
        ]),
        now: () => Date.parse('2026-10-06T07:00:00.000Z'),
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (id) => {
          fetches.push(id)
          return id === 567894 ? mtumeDetail() : bootsyDetail()
        },
        mb: createMusicBrainzClientForTests(),
      },
      { retry: true }
    )
    assert.deepEqual([...fetches].sort((left, right) => left - right), [240128, 567894])
  })

  it('retries dead plus too_slow, rate_limit, and unavailable inspect ids', async () => {
    const store = createMemoryCrateStore()
    await store.markDead({
      releaseId: 1,
      kind: 'exhausted',
      message: 'gave up',
      attempts: 5,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'pressing',
    })
    await store.markUnresolved({
      releaseId: 2,
      kind: 'too_slow',
      message: 'too slow',
      attempts: 0,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'match',
    })
    await store.markUnresolved({
      releaseId: 3,
      kind: 'rate_limit',
      message: 'Wikidata rate limited',
      attempts: 0,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'research',
    })
    await store.markUnresolved({
      releaseId: 4,
      kind: 'unavailable',
      message: 'Wikidata timed out',
      attempts: 0,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'research',
    })
    await store.markUnresolved({
      releaseId: 5,
      kind: 'ambiguous',
      message: 'leave me',
      attempts: 0,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'match',
    })
    const targets = await retryBackfillTargets(store)
    assert.deepEqual([...targets].sort((left, right) => left - right), [1, 2, 3, 4])
  })

  it('retries pending-provenance rate_limit pressings missing from inspect', async () => {
    const pending = hydratePressing(
      pressingStub({
        releaseId: 1323531,
        provenance: {
          ...pressingStub().provenance,
          matchStatus: 'pending',
          refreshAfter: '2026-10-07T08:00:00.000Z',
          lastError: {
            at: '2026-10-07T08:00:00.000Z',
            kind: 'rate_limit',
            message: 'MusicBrainz rate limited',
            attempts: 1,
          },
        },
      })
    )
    const store = createMemoryCrateStore({ pressings: { 1323531: pending } })
    const targets = await retryBackfillTargets(store, [1323531, 573292])
    assert.deepEqual(targets, [1323531])
    const fetches: number[] = []
    await runBackfill(
      {
        store,
        collection: collectionOf([
          {
            id: 1323531,
            title: 'Night-Rider!',
            year: 1979,
            artist: 'Tim Weisberg',
            label: 'United Artists',
            catno: 'UA-LA-1',
          },
          BOOTSY_ROW,
        ]),
        now: () => Date.parse('2026-10-07T09:00:00.000Z'),
        takeFloorMs: 0,
        budgetMs: 45_000,
        fetchDiscogs: async (id) => {
          fetches.push(id)
          return bootsyDetail()
        },
        mb: createMusicBrainzClientForTests(),
      },
      { retry: true }
    )
    assert.deepEqual(fetches, [1323531])
  })

  it('re-checks the take floor after reading a stored pressing', () => {
    const src = readFileSync(fileURLToPath(new URL('./backfill.ts', import.meta.url)), 'utf8')
    const start = src.indexOf('export async function runBackfill')
    const body = src.slice(start)
    const readAt = body.indexOf('const stored = await store.getPressing')
    const recheckAt = body.indexOf('remainingBelowTakeFloor', readAt)
    assert.ok(readAt >= 0)
    assert.ok(recheckAt > readAt)
  })

  it('runs specific ids with retry and forceRefresh', async () => {
    const previous = fixturePressing(567894)
    assert.ok(previous)
    const store = createMemoryCrateStore({ pressings: { 567894: previous } })
    let mbCalled = 0
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => {
      mbCalled += 1
      return []
    }
    const result = await runBackfill(
      {
        store,
        collection: collectionOf([
          {
            id: 567894,
            title: 'Juicy Fruit',
            year: 1983,
            artist: 'Mtume',
            label: 'Epic',
            catno: '49-03834',
          },
        ]),
        now: () => Date.parse('2026-10-06T07:00:00.000Z'),
        takeFloorMs: 0,
        budgetMs: 45_000,
        forceRefresh: true,
        fetchDiscogs: async () => mtumeDetail(),
        mb,
      },
      { retry: true, ids: [567894], limit: 1 }
    )
    assert.deepEqual(result.processed, [567894])
    assert.ok(mbCalled > 0)
  })

  it('parses CLI --budget-ms and keeps worker ticks at 45s', () => {
    assert.equal(ENRICH_BUDGET_MS, 45_000)
    assert.equal(CLI_BACKFILL_BUDGET_MS, 600_000)
    assert.equal(ENRICH_LOCK_HEARTBEAT_MS, 30_000)
    assert.equal(parseBackfillBudgetMs(undefined), CLI_BACKFILL_BUDGET_MS)
    assert.equal(parseBackfillBudgetMs('120000'), 120_000)
    assert.equal(parseBackfillBudgetMs('0'), CLI_BACKFILL_BUDGET_MS)
    const src = readFileSync(fileURLToPath(new URL('../../scripts/crate-backfill.ts', import.meta.url)), 'utf8')
    assert.match(src, /--budget-ms=/)
    assert.match(src, /budgetMs/)
    assert.doesNotMatch(src, /budgetMs: ENRICH_BUDGET_MS/)
  })
})

describe('release-group backfill, unresolved clear, and track-level samples', () => {
  function stubDetail() {
    return {
      id: 573292,
      title: 'Bootsy? Player Of The Year',
      artist: "Bootsy's Rubber Band",
      year: 1978,
      released: '1978',
      country: 'US',
      thumb: '',
      cover: '',
      format: 'Vinyl, LP, Album',
      label: 'Warner Bros. Records',
      catno: 'BSK 3093',
      barcode: '012345',
      notes: null,
      discogsUrl: 'https://www.discogs.com/release/573292',
      masterId: 14594,
      extraartists: [],
      tracklist: [
        {
          position: 'A1',
          title: "Bootsy? (What's The Name Of This Town)",
          duration: '6:59',
          type_: 'track',
        },
      ],
    }
  }

  it('backfills a missing MusicBrainz release group without rematching', async () => {
    const previous = hydratePressing(
      pressingStub({
        checkpoint: { stage: 'research', researchCursor: 1, trackSampleCursor: 1 },
      })
    )
    assert.equal(previous.mbRelease.releaseGroupMbid, undefined)
    const store = createMemoryCrateStore({ pressings: { 573292: previous } })
    let urlLookups = 0
    let releaseLookups = 0
    let recordingSearches = 0
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => {
      urlLookups += 1
      return []
    }
    mb.getRelease = async (id) => {
      releaseLookups += 1
      return {
        id,
        title: 'Bootsy? Player Of The Year',
        date: '1978',
        country: 'US',
        releaseGroupId: 'rg-backfill',
        tracks: [],
      }
    }
    mb.searchRecordingsByArtistTitle = async () => {
      recordingSearches += 1
      return []
    }
    const result = await enrichPressing(573292, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => stubDetail(),
      mb,
    })
    assert.equal(urlLookups, 0)
    assert.equal(releaseLookups, 1)
    assert.equal(recordingSearches, 0)
    assert.equal(result.mbRelease.releaseGroupMbid, 'rg-backfill')
  })

  it('does not rematch or refetch a release group that was already looked up as null', async () => {
    const previous = hydratePressing(
      pressingStub({
        mbRelease: {
          ...pressingStub().mbRelease,
          releaseGroupMbid: null,
        },
        checkpoint: { stage: 'research', researchCursor: 1, trackSampleCursor: 1 },
      })
    )
    const store = createMemoryCrateStore({ pressings: { 573292: previous } })
    let urlLookups = 0
    let releaseLookups = 0
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => {
      urlLookups += 1
      return []
    }
    mb.getRelease = async () => {
      releaseLookups += 1
      return null
    }
    await enrichPressing(573292, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => stubDetail(),
      mb,
    })
    assert.equal(urlLookups, 0)
    assert.equal(releaseLookups, 0)
  })

  it('clears too_slow inspect after a later success', async () => {
    const store = createMemoryCrateStore()
    await store.markUnresolved({
      releaseId: 573292,
      kind: 'too_slow',
      message: 'too slow',
      attempts: 0,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'match',
    })
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => ['72089134-a550-446e-b26d-8d3b523b05d6']
    mb.getRelease = async () => ({
      id: '72089134-a550-446e-b26d-8d3b523b05d6',
      title: 'Bootsy? Player Of The Year',
      date: '1978',
      country: 'US',
      releaseGroupId: 'rg-bootsy',
      tracks: [
        {
          index: 0,
          number: 'A1',
          title: "Bootsy? (What's The Name Of This Town)",
          lengthMs: 419000,
          recordingId: 'rec-a1',
          recordingTitle: "Bootsy? (What's The Name Of This Town)",
          disambiguation: '',
        },
        {
          index: 1,
          number: 'A2',
          title: 'Hollywood Squares',
          lengthMs: 375000,
          recordingId: 'rec-hs',
          recordingTitle: 'Hollywood Squares',
          disambiguation: '',
        },
      ],
    })
    const result = await enrichPressing(573292, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => bootsyDetail(),
      mb,
    })
    assert.equal(result.mbRelease.matchStatus, 'matched')
    assert.deepEqual(await store.getUnresolved(), [])
    assert.equal((await store.getInspect()).length, 0)
  })

  it('attaches Mtume Juicy Fruit sampled-in Biggie Juicy from a recording-level match', async () => {
    const juicyMbid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const biggieMbid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async (input) => {
      if (!/mtume/i.test(input.artist) || !/juicy fruit/i.test(input.title)) return []
      return [
        {
          mbid: juicyMbid,
          title: 'Juicy Fruit',
          artist: 'Mtume',
          lengthMs: 355000,
          score: 100,
        },
      ]
    }
    mb.getRecording = async (id) => {
      if (id !== juicyMbid) return null
      return {
        mbid: juicyMbid,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn: [
          {
            title: 'Juicy',
            artist: 'The Notorious B.I.G.',
            mbid: biggieMbid,
            sourceUrl: `https://musicbrainz.org/recording/${biggieMbid}`,
            source: 'musicbrainz',
            providerId: biggieMbid,
          },
        ],
      }
    }
    const store = createMemoryCrateStore()
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    const juicy = (result.researchFacts ?? []).find(
      (fact) =>
        fact.kind === 'sampled_by' &&
        /juicy/i.test(fact.relatedTitle) &&
        /notorious/i.test(fact.relatedArtist)
    )
    assert.ok(juicy)
    assert.equal(juicy?.source, 'musicbrainz')
    assert.equal(juicy?.relatedTitle, 'Juicy')
    assert.ok(result.tracks.some((track) => track.recording.mbid === juicyMbid))
    assert.ok(result.tracks.some((track) => track.recording.reason === TRACK_LEVEL_REASON))
    assert.equal(result.recordings[juicyMbid]?.sampledIn[0]?.artist, 'The Notorious B.I.G.')
    assert.equal(juicy?.sourceUrl, `https://musicbrainz.org/recording/${biggieMbid}`)
    assert.equal(result.recordings[juicyMbid]?.provenance.reason, TRACK_LEVEL_REASON)
    const stored = await store.getRecording(juicyMbid)
    assert.equal(stored?.sampledIn[0]?.artist, 'The Notorious B.I.G.')
  })

  it('fetches the higher-score duration-ok recording-level hit', async () => {
    const fetched: string[] = []
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async () => [
      { mbid: 'farther', title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 360000, score: 99 },
      { mbid: 'closest', title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 355000, score: 50 },
    ]
    mb.getRecording = async (id) => {
      fetched.push(id)
      return {
        mbid: id,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      }
    }
    const store = createMemoryCrateStore()
    await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.equal(fetched[0], 'farther')
    assert.equal(
      fetched.filter((id) => id === 'farther').length >= 1,
      true
    )
  })

  it('keeps the Juicy Fruit vocal recording when MusicBrainz search order shuffles', async () => {
    const juicyMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const otherMbid = '1aaf2f49-2ba3-4b34-9196-64d5cb0cc0dc'
    const biggieMbid = '181c0a32-6e3f-4680-8a7d-1daf0b42e43b'
    const juicyDoc = {
      mbid: juicyMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [
        {
          title: 'Juicy',
          artist: 'The Notorious B.I.G.',
          mbid: biggieMbid,
          sourceUrl: `https://musicbrainz.org/recording/${biggieMbid}`,
          source: 'musicbrainz' as const,
          providerId: biggieMbid,
        },
      ],
    }
    const otherDoc = {
      mbid: otherMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [],
    }
    const hit = (mbid: string) => ({
      mbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
    })
    for (const order of [
      [hit(otherMbid), hit(juicyMbid)],
      [hit(juicyMbid), hit(otherMbid)],
    ]) {
      const mb = createMusicBrainzClientForTests()
      mb.searchRecordingsByArtistTitle = async () => order
      mb.getRecording = async (id) => {
        if (id === juicyMbid) return { ...juicyDoc, sampledIn: [...juicyDoc.sampledIn] }
        if (id === otherMbid) return { ...otherDoc }
        return null
      }
      const store = createMemoryCrateStore()
      const result = await enrichPressing(567894, {
        store,
        now: () => Date.parse('2026-10-06T08:00:00.000Z'),
        fetchDiscogs: async () => mtumeDetail(),
        mb,
      })
      const vocal = result.tracks.find((track) => /vocal/i.test(track.title))
      assert.equal(vocal?.recording.mbid, juicyMbid)
    }
  })

  it('ignores a saved equal-score match on forceRefresh and prefers samples-material', async () => {
    const juicyMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const otherMbid = '1aaf2f49-2ba3-4b34-9196-64d5cb0cc0dc'
    const biggieMbid = '181c0a32-6e3f-4680-8a7d-1daf0b42e43b'
    const hit = (mbid: string) => ({
      mbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
    })
    const juicyDoc = {
      mbid: juicyMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [
        {
          title: 'Juicy',
          artist: 'The Notorious B.I.G.',
          mbid: biggieMbid,
          sourceUrl: `https://musicbrainz.org/recording/${biggieMbid}`,
          source: 'musicbrainz' as const,
          providerId: biggieMbid,
        },
      ],
    }
    const otherDoc = {
      mbid: otherMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [],
    }
    const store = createMemoryCrateStore()
    const firstMb = createMusicBrainzClientForTests()
    firstMb.searchRecordingsByArtistTitle = async () => [hit(otherMbid)]
    firstMb.getRecording = async (id) => (id === otherMbid ? { ...otherDoc } : null)
    const first = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: firstMb,
    })
    const firstVocal = first.tracks.find((track) => /vocal/i.test(track.title))
    assert.equal(firstVocal?.recording.mbid, otherMbid)

    const retryMb = createMusicBrainzClientForTests()
    retryMb.searchRecordingsByArtistTitle = async () => [hit(otherMbid), hit(juicyMbid)]
    retryMb.getRecording = async (id) => {
      if (id === juicyMbid) return { ...juicyDoc, sampledIn: [...juicyDoc.sampledIn] }
      if (id === otherMbid) return { ...otherDoc }
      return null
    }
    const retried = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T09:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: retryMb,
      forceRefresh: true,
    })
    const vocal = retried.tracks.find((track) => /vocal/i.test(track.title))
    assert.equal(vocal?.recording.mbid, juicyMbid)
  })

  it('forceRefresh after rate_limit resumes trackSampleCursor', async () => {
    const vocalMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const instMbid = 'bbbbbbbb-2ba3-4b34-9196-64d5cb0cc0dc'
    const hit = (mbid: string) => ({
      mbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
    })
    const doc = (mbid: string) => ({
      mbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [],
    })
    const store = createMemoryCrateStore()
    const firstMb = createMusicBrainzClientForTests()
    let firstSearches = 0
    firstMb.searchRecordingsByArtistTitle = async () => {
      firstSearches += 1
      if (firstSearches === 1) return [hit(vocalMbid)]
      throw new MusicBrainzRateLimitError(60_000)
    }
    firstMb.getRecording = async (id) => (id === vocalMbid ? doc(vocalMbid) : null)
    const first = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: firstMb,
      forceRefresh: true,
    })
    assert.equal(first.checkpoint?.trackSampleCursor, 1)
    assert.equal(first.checkpoint?.forceRun, true)
    assert.equal(first.provenance.lastError?.kind, 'rate_limit')
    const firstVocal = first.tracks.find((track) => /vocal/i.test(track.title))
    assert.equal(firstVocal?.recording.mbid, vocalMbid)

    const titles: string[] = []
    const retryMb = createMusicBrainzClientForTests()
    retryMb.searchRecordingsByArtistTitle = async ({ title }) => {
      titles.push(title)
      return [{ ...hit(instMbid), lengthMs: 424000 }]
    }
    retryMb.getRecording = async (id) =>
      id === instMbid ? doc(instMbid) : id === vocalMbid ? doc(vocalMbid) : null
    const retried = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:05:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: retryMb,
      forceRefresh: true,
    })
    assert.equal(titles.length, 1)
    const vocal = retried.tracks.find((track) => /vocal/i.test(track.title))
    const inst = retried.tracks.find((track) => /instrumental/i.test(track.title))
    assert.equal(vocal?.recording.mbid, vocalMbid)
    assert.equal(inst?.recording.mbid, instMbid)
  })

  it('caps track-level annotation at 3 hits and persists only the picked recording', async () => {
    assert.equal(TRACK_LEVEL_ANNOTATE_CAP, 3)
    const fetched: string[] = []
    const sampledMbid = 'a0000000-0000-0000-0000-000000000002'
    const hits = Array.from({ length: 10 }, (_, index) => ({
      mbid: `a0000000-0000-0000-0000-00000000000${index}`,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
    }))
    const mb = createMusicBrainzClientForTests()
    let searches = 0
    mb.searchRecordingsByArtistTitle = async () => {
      searches += 1
      if (searches > 1) return []
      return hits
    }
    mb.getRecording = async (id) => {
      fetched.push(id)
      return {
        mbid: id,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn:
          id === sampledMbid
            ? [
                {
                  title: 'Juicy',
                  artist: 'The Notorious B.I.G.',
                  mbid: '181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                  sourceUrl: 'https://musicbrainz.org/recording/181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                  source: 'musicbrainz' as const,
                  providerId: '181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                },
              ]
            : [],
      }
    }
    const store = createMemoryCrateStore()
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.ok(fetched.length <= TRACK_LEVEL_ANNOTATE_CAP)
    assert.equal(fetched.length, TRACK_LEVEL_ANNOTATE_CAP)
    const vocal = result.tracks.find((track) => /vocal/i.test(track.title))
    assert.equal(vocal?.recording.mbid, sampledMbid)
    assert.deepEqual(Object.keys(store.recordings), [sampledMbid])
    assert.deepEqual(Object.keys(result.recordings), [sampledMbid])
  })

  it('annotates a duration-closer samples hit that ranks 4th by MBID', async () => {
    const fetched: string[] = []
    const sampledMbid = 'a0000000-0000-0000-0000-000000000003'
    const hits = Array.from({ length: 10 }, (_, index) => ({
      mbid: `a0000000-0000-0000-0000-00000000000${index}`,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: index === 3 ? 355000 : 360000,
      score: 100,
    }))
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async () => hits
    mb.getRecording = async (id) => {
      fetched.push(id)
      return {
        mbid: id,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn:
          id === sampledMbid
            ? [
                {
                  title: 'Juicy',
                  artist: 'The Notorious B.I.G.',
                  mbid: '181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                  sourceUrl: 'https://musicbrainz.org/recording/181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                  source: 'musicbrainz' as const,
                  providerId: '181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                },
              ]
            : [],
      }
    }
    const store = createMemoryCrateStore()
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.ok(fetched.includes(sampledMbid))
    assert.ok(fetched.length <= TRACK_LEVEL_ANNOTATE_CAP)
    const vocal = result.tracks.find((track) => /vocal/i.test(track.title))
    assert.equal(vocal?.recording.mbid, sampledMbid)
  })

  it('probes equal-score unknown-sample rivals so Juicy outranks a saved miss', async () => {
    const savedMbid = '1aaf2f49-2ba3-4b34-9196-64d5cb0cc0dc'
    const juicyMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const hit = (mbid: string, lengthMs = 355000) => ({
      mbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs,
      score: 100,
    })
    const savedDoc = {
      mbid: savedMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [],
    }
    const store = createMemoryCrateStore()
    const firstMb = createMusicBrainzClientForTests()
    firstMb.searchRecordingsByArtistTitle = async () => [hit(savedMbid)]
    firstMb.getRecording = async (id) => (id === savedMbid ? { ...savedDoc } : null)
    const first = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: firstMb,
    })
    const firstVocal = first.tracks.find((track) => /vocal/i.test(track.title))
    assert.equal(firstVocal?.recording.mbid, savedMbid)
    const stored = await store.getPressing(567894)
    assert.ok(stored)
    await store.setPressing(
      hydratePressing({
        ...stored,
        checkpoint: {
          stage: stored.checkpoint?.stage ?? 'research',
          researchCursor: stored.checkpoint?.researchCursor ?? 0,
          trackSampleCursor: 0,
          deadlineStops: stored.checkpoint?.deadlineStops,
        },
      })
    )

    const fetched: string[] = []
    const retryMb = createMusicBrainzClientForTests()
    retryMb.searchRecordingsByArtistTitle = async () => [
      hit(savedMbid),
      hit(juicyMbid, 355000),
      ...Array.from({ length: 8 }, (_, index) =>
        hit(`b0000000-0000-0000-0000-00000000000${index}`, 360000)
      ),
    ]
    retryMb.getRecording = async (id) => {
      fetched.push(id)
      return {
        mbid: id,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn:
          id === juicyMbid
            ? [
                {
                  title: 'Juicy',
                  artist: 'The Notorious B.I.G.',
                  mbid: '181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                  sourceUrl: 'https://musicbrainz.org/recording/181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                  source: 'musicbrainz' as const,
                  providerId: '181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                },
              ]
            : [],
      }
    }
    const retried = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T09:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: retryMb,
    })
    assert.ok(fetched.includes(juicyMbid))
    const vocal = retried.tracks.find((track) => /vocal/i.test(track.title))
    assert.equal(vocal?.recording.mbid, juicyMbid)
    const juicy = (retried.researchFacts ?? []).find(
      (fact) => fact.kind === 'sampled_by' && /juicy/i.test(fact.relatedTitle)
    )
    assert.equal(juicy?.sourceId, '181c0a32-6e3f-4680-8a7d-1daf0b42e43b')
  })

  it('skips probes when every equal-score rival is known hasSamples=false', async () => {
    const savedMbid = '1aaf2f49-2ba3-4b34-9196-64d5cb0cc0dc'
    const rivalMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const emptyDoc = (mbid: string) => ({
      mbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [] as StoredRecording['samplesFrom'],
      sampledIn: [] as StoredRecording['sampledIn'],
    })
    const store = createMemoryCrateStore()
    const firstMb = createMusicBrainzClientForTests()
    firstMb.searchRecordingsByArtistTitle = async () => [
      { mbid: savedMbid, title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 355000, score: 100 },
    ]
    firstMb.getRecording = async (id) => (id === savedMbid ? emptyDoc(id) : null)
    const first = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: firstMb,
    })
    const firstVocal = first.tracks.find((track) => /vocal/i.test(track.title))
    assert.equal(firstVocal?.recording.mbid, savedMbid)
    const stored = await store.getPressing(567894)
    assert.ok(stored)
    await store.setRecording({
      ...emptyDoc(rivalMbid),
      provenance: {
        sourceUrls: [`https://musicbrainz.org/recording/${rivalMbid}`],
        matchStatus: 'matched',
        confidence: 0.7,
        reason: TRACK_LEVEL_REASON,
        checkedAt: '2026-10-06T08:00:00.000Z',
        refreshAfter: '2026-11-05T08:00:00.000Z',
        lastError: null,
        verifiedAt: '2026-10-06T08:00:00.000Z',
        lastAttemptAt: '2026-10-06T08:00:00.000Z',
      },
    })
    await store.setPressing(
      hydratePressing({
        ...stored,
        checkpoint: {
          stage: stored.checkpoint?.stage ?? 'research',
          researchCursor: stored.checkpoint?.researchCursor ?? 0,
          trackSampleCursor: 0,
          deadlineStops: stored.checkpoint?.deadlineStops,
        },
      })
    )

    const fetched: string[] = []
    const retryMb = createMusicBrainzClientForTests()
    retryMb.searchRecordingsByArtistTitle = async () => [
      { mbid: savedMbid, title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 355000, score: 100 },
      { mbid: rivalMbid, title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 355000, score: 100 },
    ]
    retryMb.getRecording = async (id) => {
      fetched.push(id)
      return emptyDoc(id)
    }
    const retried = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T09:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: retryMb,
    })
    assert.deepEqual(fetched, [])
    const vocal = retried.tracks.find((track) => /vocal/i.test(track.title))
    assert.equal(vocal?.recording.mbid, savedMbid)
  })

  it('refetches annotation under forceRefresh and still persists the stored samples', async () => {
    const savedMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const hit = {
      mbid: savedMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
    }
    const savedDoc = {
      mbid: savedMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [
        {
          title: 'Juicy',
          artist: 'The Notorious B.I.G.',
          mbid: '181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
          sourceUrl: 'https://musicbrainz.org/recording/181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
          source: 'musicbrainz' as const,
          providerId: '181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
        },
      ],
    }
    const store = createMemoryCrateStore()
    const firstMb = createMusicBrainzClientForTests()
    firstMb.searchRecordingsByArtistTitle = async () => [hit]
    firstMb.getRecording = async (id) => (id === savedMbid ? { ...savedDoc, sampledIn: [...savedDoc.sampledIn] } : null)
    await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: firstMb,
    })

    const fetched: string[] = []
    const retryMb = createMusicBrainzClientForTests()
    retryMb.searchRecordingsByArtistTitle = async () => [hit]
    retryMb.getRecording = async (id) => {
      fetched.push(id)
      return { ...savedDoc, sampledIn: [...savedDoc.sampledIn] }
    }
    const retried = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T09:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb: retryMb,
      forceRefresh: true,
    })
    assert.ok(fetched.length <= TRACK_LEVEL_ANNOTATE_CAP)
    assert.ok(fetched.includes(savedMbid))
    const juicy = (retried.researchFacts ?? []).find(
      (fact) => fact.kind === 'sampled_by' && /juicy/i.test(fact.relatedTitle)
    )
    assert.ok(juicy)
  })

  it('does not reuse store.getRecording for a forced pick missing from memory', async () => {
    const savedMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const store = createMemoryCrateStore()
    await store.setRecording({
      mbid: savedMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [],
      provenance: {
        sourceUrls: [`https://musicbrainz.org/recording/${savedMbid}`],
        matchStatus: 'matched',
        confidence: 0.7,
        reason: TRACK_LEVEL_REASON,
        checkedAt: '2026-10-06T07:00:00.000Z',
        refreshAfter: '2026-11-05T07:00:00.000Z',
        lastError: null,
        verifiedAt: '2026-10-06T07:00:00.000Z',
        lastAttemptAt: '2026-10-06T07:00:00.000Z',
      },
    })
    let storeGets = 0
    const innerGet = store.getRecording.bind(store)
    store.getRecording = async (mbid: string) => {
      storeGets += 1
      return innerGet(mbid)
    }
    let mbGets = 0
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async () => [
      {
        mbid: savedMbid,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        lengthMs: 355000,
        score: 100,
        hasSamples: false,
      },
    ]
    mb.getRecording = async (id) => {
      mbGets += 1
      return {
        mbid: id,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      }
    }
    await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
      forceRefresh: true,
    })
    assert.equal(storeGets, 0)
    assert.ok(mbGets > 0)
  })

  it('caps Redis recording lookups at TRACK_LEVEL_ANNOTATE_CAP and aborts on deadline', async () => {
    const hits = Array.from({ length: 20 }, (_, index) => ({
      mbid: `d0000000-0000-0000-0000-0000000000${String(index).padStart(2, '0')}`,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
    }))
    const store = createMemoryCrateStore()
    let storeLookups = 0
    const innerGet = store.getRecording.bind(store)
    store.getRecording = async (mbid: string) => {
      storeLookups += 1
      return innerGet(mbid)
    }
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async () => hits
    mb.getRecording = async (id) => ({
      mbid: id,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [],
    })
    await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.ok(storeLookups <= TRACK_LEVEL_ANNOTATE_CAP)

    const start = Date.parse('2026-10-06T09:00:00.000Z')
    let now = start
    let lateLookups = 0
    const lateStore = createMemoryCrateStore()
    const lateInner = lateStore.getRecording.bind(lateStore)
    lateStore.getRecording = async (mbid: string) => {
      lateLookups += 1
      now += ENRICH_TAKE_FLOOR_MS + 1
      return lateInner(mbid)
    }
    const lateMb = createMusicBrainzClientForTests()
    lateMb.searchRecordingsByArtistTitle = async () => hits
    lateMb.getRecording = async (id) => ({
      mbid: id,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [],
    })
    await assert.rejects(
      () =>
        enrichPressing(567894, {
          store: lateStore,
          now: () => now,
          deadlineMs: start + ENRICH_TAKE_FLOOR_MS,
          fetchDiscogs: async () => mtumeDetail(),
          mb: lateMb,
        }),
      (error: unknown) => error instanceof WorkerDeadlineError
    )
    assert.ok(lateLookups <= TRACK_LEVEL_ANNOTATE_CAP)
  })

  it('stops annotation probes at the take-floor deadline', async () => {
    const start = Date.parse('2026-10-06T08:00:00.000Z')
    let now = start
    const fetched: string[] = []
    const hits = Array.from({ length: 10 }, (_, index) => ({
      mbid: `c0000000-0000-0000-0000-00000000000${index}`,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      lengthMs: 355000,
      score: 100,
    }))
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async () => {
      now += 1
      return hits
    }
    mb.getRecording = async (id) => {
      fetched.push(id)
      return {
        mbid: id,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      }
    }
    await enrichPressing(567894, {
      store: createMemoryCrateStore(),
      now: () => now,
      deadlineMs: start + ENRICH_TAKE_FLOOR_MS,
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.deepEqual(fetched, [])
  })

  it('keeps recording-level samples when MusicBrainz 429s after a fetch', async () => {
    const juicyMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const biggieMbid = '181c0a32-6e3f-4680-8a7d-1daf0b42e43b'
    const mb = createMusicBrainzClientForTests()
    let searches = 0
    mb.searchRecordingsByArtistTitle = async () => {
      searches += 1
      if (searches > 1) throw new MusicBrainzRateLimitError(60_000)
      return [
        { mbid: juicyMbid, title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 355000, score: 100 },
      ]
    }
    mb.getRecording = async (id) => {
      if (id !== juicyMbid) return null
      return {
        mbid: juicyMbid,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn: [
          {
            title: 'Juicy',
            artist: 'The Notorious B.I.G.',
            mbid: biggieMbid,
            sourceUrl: `https://musicbrainz.org/recording/${biggieMbid}`,
            source: 'musicbrainz',
            providerId: biggieMbid,
          },
        ],
      }
    }
    const store = createMemoryCrateStore()
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.equal(result.provenance.lastError?.kind, 'rate_limit')
    assert.equal(result.provenance.refreshAfter, '2026-10-06T08:01:00.000Z')
    const juicy = (result.researchFacts ?? []).find(
      (fact) =>
        fact.kind === 'sampled_by' &&
        /juicy/i.test(fact.relatedTitle) &&
        /notorious/i.test(fact.relatedArtist)
    )
    assert.ok(juicy)
    assert.equal(juicy?.source, 'musicbrainz')
    assert.equal(result.tracks.some((track) => track.recording.mbid === juicyMbid), true)
    assert.equal(result.recordings[juicyMbid]?.provenance.reason, TRACK_LEVEL_REASON)
  })

  it('stores a partial 429 probe as incomplete instead of a 180-day success', async () => {
    const juicyMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const nowMs = Date.parse('2026-10-06T08:00:00.000Z')
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async () => [
      {
        mbid: juicyMbid,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        lengthMs: 355000,
        score: 100,
        hasSamples: false,
      },
    ]
    mb.getRecording = async () => {
      const error = new MusicBrainzRateLimitError(1_000)
      error.partialRecording = {
        mbid: juicyMbid,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      }
      throw error
    }
    const store = createMemoryCrateStore()
    await enrichPressing(567894, {
      store,
      now: () => nowMs,
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    const stored = await store.getRecording(juicyMbid)
    assert.ok(stored)
    assert.equal(stored.provenance.verifiedAt, null)
    assert.equal(stored.provenance.lastError?.kind, 'unavailable')
    assert.match(stored.provenance.lastError?.message ?? '', /incomplete/)
    assert.equal(stored.provenance.refreshAfter, isoFromMs(nowMs + AUTH_RETRY_MS))
    assert.notEqual(stored.provenance.refreshAfter, isoFromMs(nowMs + SUCCESS_REFRESH_MS))
  })

  it('commits a timeout pick as an incomplete pressing, not a 180-day success', async () => {
    const juicyMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const nowMs = Date.parse('2026-10-06T08:00:00.000Z')
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async () => [
      {
        mbid: juicyMbid,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        lengthMs: 355000,
        score: 100,
        hasSamples: false,
      },
    ]
    mb.getRecording = async () => {
      const error = new MusicBrainzTimeoutError(false)
      error.partialRecording = {
        mbid: juicyMbid,
        title: 'Juicy Fruit',
        artist: 'Mtume',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      }
      throw error
    }
    const store = createMemoryCrateStore()
    const result = await enrichPressing(567894, {
      store,
      now: () => nowMs,
      fetchDiscogs: async () => mtumeDetail(),
      fetchWikidata: async () => [],
      mb,
    })
    assert.equal(result.provenance.lastError?.kind, 'unavailable')
    assert.equal(result.provenance.lastError?.message, INCOMPLETE_RECORDING_MESSAGE)
    assert.equal(result.provenance.verifiedAt, null)
    assert.equal(result.provenance.refreshAfter, isoFromMs(nowMs + AUTH_RETRY_MS))
    assert.notEqual(result.provenance.refreshAfter, isoFromMs(nowMs + SUCCESS_REFRESH_MS))
    const stored = await store.getRecording(juicyMbid)
    assert.ok(stored)
    assert.equal(stored.provenance.verifiedAt, null)
    assert.equal(stored.provenance.lastError?.message, INCOMPLETE_RECORDING_MESSAGE)
  })

  it('second forced --retry resumes a 12-track unmatched LP instead of restarting at track 0', async () => {
    const releaseId = 9107412
    const store = createMemoryCrateStore()
    let clock = Date.parse('2026-10-08T00:00:00.000Z')
    const searchedByTick: string[][] = []
    const collection = collectionOf([
      {
        id: releaseId,
        title: 'Twelve',
        year: 1977,
        artist: 'Lecturer',
        label: 'lf',
        catno: `lf-${releaseId}`,
      },
    ])
    let settled = false
    let tooSlow = false
    for (let tick = 0; tick < 6 && !settled && !tooSlow; tick += 1) {
      const titles: string[] = []
      const mb = createMusicBrainzClientForTests()
      mb.searchRecordingsByArtistTitle = async ({ title }) => {
        clock += 10_000
        titles.push(title)
        return [
          {
            mbid: `rec-${title.replace(/\s+/g, '-').toLowerCase()}`,
            title,
            artist: 'Lecturer',
            lengthMs: 180000,
            score: 100,
          },
        ]
      }
      mb.getRecording = async (id) => ({
        mbid: id,
        title: id,
        artist: 'Lecturer',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      })
      await runBackfill(
        {
          store,
          collection,
          now: () => clock,
          takeFloorMs: 0,
          budgetMs: ENRICH_BUDGET_MS,
          fetchDiscogs: async () => twelveTrackDetail(releaseId),
          fetchWikidata: async () => [],
          mb,
        },
        { retry: true, ids: [releaseId], limit: 1 }
      )
      searchedByTick.push(titles)
      if (tick === 0) {
        const draft = (await store.getDraftPressing(releaseId)) ?? (await store.getPressing(releaseId))
        assert.equal(draft?.checkpoint?.forceRun, true)
        assert.ok((draft?.checkpoint?.trackSampleCursor ?? 0) > 0)
        assert.equal(await store.getPressing(releaseId), null)
      }
      if (tick === 1) {
        assert.equal(titles.includes('Song 1'), false)
        assert.ok(titles[0] !== 'Song 1')
      }
      tooSlow = (await store.getInspect()).some(
        (row) => row.releaseId === releaseId && row.kind === 'too_slow'
      )
      const live = await store.getPressing(releaseId)
      settled = Boolean(live && live.provenance.lastError == null)
    }
    assert.ok(tooSlow || settled)
  })

  it('forced 12-track matched heavy reaches done or too_slow', async () => {
    const releaseId = 9107413
    const store = createMemoryCrateStore()
    let clock = Date.parse('2026-10-08T01:00:00.000Z')
    const collection = collectionOf([
      {
        id: releaseId,
        title: 'Twelve',
        year: 1977,
        artist: 'Lecturer',
        label: 'lf',
        catno: `lf-${releaseId}`,
      },
    ])
    let settled = false
    let tooSlow = false
    for (let tick = 0; tick < 6 && !settled && !tooSlow; tick += 1) {
      const mb = createMusicBrainzClientForTests()
      mb.lookupDiscogsReleaseUrl = async () => ['rel-twelve']
      mb.getRelease = async () => ({
        id: 'rel-twelve',
        title: 'Twelve',
        date: '1977',
        country: 'US',
        releaseGroupId: 'rg-twelve',
        tracks: Array.from({ length: 12 }, (_, index) => ({
          index,
          number: String(index + 1),
          title: `Song ${index + 1}`,
          lengthMs: 180000,
          recordingId: `rec-${index + 1}`,
          recordingTitle: `Song ${index + 1}`,
          disambiguation: '',
        })),
      })
      mb.searchRecordingsByArtistTitle = async ({ title }) => {
        clock += 10_000
        return [
          {
            mbid: `rec-${title.replace(/\s+/g, '-').toLowerCase()}`,
            title,
            artist: 'Lecturer',
            lengthMs: 180000,
            score: 100,
          },
        ]
      }
      mb.getRecording = async (id) => ({
        mbid: id,
        title: id,
        artist: 'Lecturer',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      })
      await runBackfill(
        {
          store,
          collection,
          now: () => clock,
          takeFloorMs: 0,
          budgetMs: ENRICH_BUDGET_MS,
          fetchDiscogs: async () => twelveTrackDetail(releaseId),
          fetchWikidata: async () => [],
          mb,
        },
        { retry: true, ids: [releaseId], limit: 1 }
      )
      tooSlow = (await store.getInspect()).some(
        (row) => row.releaseId === releaseId && row.kind === 'too_slow'
      )
      const live = await store.getPressing(releaseId)
      settled = Boolean(live && live.provenance.lastError == null)
    }
    assert.ok(tooSlow || settled)
  })

  it('forced single track that needs more than one 45s tick reaches done or too_slow', async () => {
    const store = createMemoryCrateStore()
    let clock = Date.parse('2026-10-08T02:00:00.000Z')
    const collection = collectionOf([
      {
        id: 9107339,
        title: 'One Is A Lonesome Number',
        year: 1977,
        artist: 'Lecturer',
        label: 'lf',
        catno: 'lf-9107339',
      },
    ])
    let settled = false
    let tooSlow = false
    for (let tick = 0; tick < DEADLINE_STOP_LIMIT + 1 && !settled && !tooSlow; tick += 1) {
      const mb = createMusicBrainzClientForTests()
      mb.searchRecordingsByArtistTitle = async () => {
        clock += ENRICH_BUDGET_MS + 1
        return [
          {
            mbid: 'rec-one',
            title: 'One',
            artist: 'Lecturer',
            lengthMs: 180000,
            score: 100,
          },
        ]
      }
      mb.getRecording = async (id) => ({
        mbid: id,
        title: 'One',
        artist: 'Lecturer',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      })
      await runBackfill(
        {
          store,
          collection,
          now: () => clock,
          takeFloorMs: 0,
          budgetMs: ENRICH_BUDGET_MS,
          fetchDiscogs: async () => lonelyDetail(),
          fetchWikidata: async () => [],
          mb,
        },
        { retry: true, ids: [9107339], limit: 1 }
      )
      tooSlow = (await store.getInspect()).some(
        (row) => row.releaseId === 9107339 && row.kind === 'too_slow'
      )
      const live = await store.getPressing(9107339)
      settled = Boolean(live && live.provenance.lastError == null)
    }
    assert.equal(tooSlow, true)
  })

  it('forced 20-track CLI budget with a 6-minute gap reaches done or too_slow', async () => {
    const releaseId = 9107420
    const store = createMemoryCrateStore()
    let clock = Date.parse('2026-10-08T03:00:00.000Z')
    const collection = collectionOf([
      {
        id: releaseId,
        title: 'Heavy Twenty',
        year: 1977,
        artist: 'Lecturer',
        label: 'lf',
        catno: `lf-${releaseId}`,
      },
    ])
    let settled = false
    let tooSlow = false
    for (let tick = 0; tick < 8 && !settled && !tooSlow; tick += 1) {
      if (tick > 0) clock += 6 * 60 * 1000
      const mb = createMusicBrainzClientForTests()
      mb.searchRecordingsByArtistTitle = async ({ title }) => {
        clock += 50_000
        return [
          {
            mbid: `rec-${title.replace(/\s+/g, '-').toLowerCase()}`,
            title,
            artist: 'Lecturer',
            lengthMs: 180000,
            score: 100,
          },
        ]
      }
      mb.getRecording = async (id) => ({
        mbid: id,
        title: id,
        artist: 'Lecturer',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      })
      await runBackfill(
        {
          store,
          collection,
          now: () => clock,
          takeFloorMs: 0,
          budgetMs: CLI_BACKFILL_BUDGET_MS,
          fetchDiscogs: async () => nTrackDetail(releaseId, 20),
          fetchWikidata: async () => [],
          mb,
        },
        { retry: true, ids: [releaseId], limit: 1 }
      )
      tooSlow = (await store.getInspect()).some(
        (row) => row.releaseId === releaseId && row.kind === 'too_slow'
      )
      const live = await store.getPressing(releaseId)
      settled = Boolean(live && live.provenance.lastError == null)
    }
    assert.ok(tooSlow || settled)
  })

  it('forced 30-track CLI budget needing 3+ invocations reaches done or too_slow', async () => {
    const releaseId = 9107430
    const store = createMemoryCrateStore()
    let clock = Date.parse('2026-10-08T03:30:00.000Z')
    const collection = collectionOf([
      {
        id: releaseId,
        title: 'Heavy Thirty',
        year: 1977,
        artist: 'Lecturer',
        label: 'lf',
        catno: `lf-${releaseId}`,
      },
    ])
    let settled = false
    let tooSlow = false
    let ticks = 0
    for (; ticks < 12 && !settled && !tooSlow; ticks += 1) {
      if (ticks > 0) clock += 1_000
      const mb = createMusicBrainzClientForTests()
      mb.searchRecordingsByArtistTitle = async ({ title }) => {
        clock += 50_000
        return [
          {
            mbid: `rec-${title.replace(/\s+/g, '-').toLowerCase()}`,
            title,
            artist: 'Lecturer',
            lengthMs: 180000,
            score: 100,
          },
        ]
      }
      mb.getRecording = async (id) => ({
        mbid: id,
        title: id,
        artist: 'Lecturer',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      })
      await runBackfill(
        {
          store,
          collection,
          now: () => clock,
          takeFloorMs: 0,
          budgetMs: CLI_BACKFILL_BUDGET_MS,
          fetchDiscogs: async () => nTrackDetail(releaseId, 30),
          fetchWikidata: async () => [],
          mb,
        },
        { retry: true, ids: [releaseId], limit: 1 }
      )
      tooSlow = (await store.getInspect()).some(
        (row) => row.releaseId === releaseId && row.kind === 'too_slow'
      )
      const live = await store.getPressing(releaseId)
      settled = Boolean(live && live.provenance.lastError == null)
    }
    assert.ok(ticks >= 3)
    assert.ok(tooSlow || settled)
  })

  it('forced 40-track CLI budget with a 6-minute gap reaches done or too_slow', async () => {
    const releaseId = 9107440
    const store = createMemoryCrateStore()
    let clock = Date.parse('2026-10-08T04:00:00.000Z')
    const collection = collectionOf([
      {
        id: releaseId,
        title: 'Heavy Forty',
        year: 1977,
        artist: 'Lecturer',
        label: 'lf',
        catno: `lf-${releaseId}`,
      },
    ])
    let settled = false
    let tooSlow = false
    for (let tick = 0; tick < 8 && !settled && !tooSlow; tick += 1) {
      if (tick > 0) clock += 6 * 60 * 1000
      const mb = createMusicBrainzClientForTests()
      mb.searchRecordingsByArtistTitle = async () => {
        clock += CLI_BACKFILL_BUDGET_MS + 1
        return [
          {
            mbid: 'rec-one',
            title: 'Song 1',
            artist: 'Lecturer',
            lengthMs: 180000,
            score: 100,
          },
        ]
      }
      mb.getRecording = async (id) => ({
        mbid: id,
        title: id,
        artist: 'Lecturer',
        credits: [],
        samplesFrom: [],
        sampledIn: [],
      })
      await runBackfill(
        {
          store,
          collection,
          now: () => clock,
          takeFloorMs: 0,
          budgetMs: CLI_BACKFILL_BUDGET_MS,
          fetchDiscogs: async () => nTrackDetail(releaseId, 40),
          fetchWikidata: async () => [],
          mb,
        },
        { retry: true, ids: [releaseId], limit: 1 }
      )
      tooSlow = (await store.getInspect()).some(
        (row) => row.releaseId === releaseId && row.kind === 'too_slow'
      )
      const live = await store.getPressing(releaseId)
      settled = Boolean(live && live.provenance.lastError == null)
    }
    assert.equal(tooSlow, true)
    assert.equal(settled, false)
  })

  it('stops immediately when a lock heartbeat returns false and keeps draft progress', async () => {
    const releaseId = 9107412
    const store = createMemoryCrateStore()
    let acquires = 0
    const innerAcquire = store.acquireEnrichLock.bind(store)
    store.acquireEnrichLock = async (ttlSeconds, token) => {
      acquires += 1
      if (acquires >= 3) return false
      return innerAcquire(ttlSeconds, token)
    }
    let clock = Date.parse('2026-10-08T05:00:00.000Z')
    const searched: string[] = []
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async ({ title }) => {
      searched.push(title)
      return [
        {
          mbid: `rec-${title.replace(/\s+/g, '-').toLowerCase()}`,
          title,
          artist: 'Lecturer',
          lengthMs: 180000,
          score: 100,
        },
      ]
    }
    mb.getRecording = async (id) => ({
      mbid: id,
      title: id,
      artist: 'Lecturer',
      credits: [],
      samplesFrom: [],
      sampledIn: [],
    })
    const result = await runBackfill(
      {
        store,
        collection: collectionOf([
          {
            id: releaseId,
            title: 'Twelve',
            year: 1977,
            artist: 'Lecturer',
            label: 'lf',
            catno: `lf-${releaseId}`,
          },
        ]),
        now: () => clock,
        takeFloorMs: 0,
        budgetMs: CLI_BACKFILL_BUDGET_MS,
        fetchDiscogs: async () => twelveTrackDetail(releaseId),
        fetchWikidata: async () => [],
        mb,
      },
      { retry: true, ids: [releaseId], limit: 1 }
    )
    assert.equal(result.skipped, false)
    assert.ok(searched.length < 12)
    const draft = await store.getDraftPressing(releaseId)
    const live = await store.getPressing(releaseId)
    assert.ok(draft || live)
    if (draft) {
      assert.ok((draft.checkpoint?.trackSampleCursor ?? 0) >= 0)
    }
  })

  it('heartbeats inside a long MusicBrainz track and stops fetches after lock loss', async () => {
    let clock = Date.parse('2026-10-08T06:00:00.000Z')
    const store = createMemoryCrateStore({ now: () => clock })
    await store.acquireEnrichLock(ENRICH_LOCK_SECONDS, 'owner')
    let lockCalls = 0
    const innerAcquire = store.acquireEnrichLock.bind(store)
    store.acquireEnrichLock = async (ttlSeconds, token) => {
      lockCalls += 1
      if (lockCalls > 2) return false
      return innerAcquire(ttlSeconds, token)
    }
    const heartbeat = createEnrichLockHeartbeat(
      store,
      'owner',
      ENRICH_LOCK_SECONDS,
      () => clock
    )
    let fetches = 0
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      now: () => clock,
      sleep: async () => {},
      onRequest: heartbeat,
      fetchImpl: async () => {
        fetches += 1
        clock += 5_000
        return new Response(
          JSON.stringify({
            id: 'rec-1',
            title: 'One',
            'artist-credit': [{ name: 'Lecturer', artist: { id: 'a', name: 'Lecturer' } }],
          }),
          { status: 200 }
        )
      },
    })
    let lost = false
    for (let i = 0; i < 20; i += 1) {
      try {
        await client.getRecording('rec-1')
      } catch (error) {
        assert.equal(isEnrichLockLostError(error), true)
        lost = true
        break
      }
    }
    assert.equal(lost, true)
    assert.ok(fetches > 0)
    assert.ok(fetches < 20)
    assert.ok(ENRICH_LOCK_HEARTBEAT_REQUESTS < ENRICH_LOCK_SECONDS)
    assert.ok(ENRICH_LOCK_HEARTBEAT_MS < ENRICH_LOCK_SECONDS * 1000)
  })

  it('reuses a stored recording-level match instead of refetching after 429', async () => {
    const juicyMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const biggieMbid = '181c0a32-6e3f-4680-8a7d-1daf0b42e43b'
    const previous = fixturePressing(567894)
    assert.ok(previous)
    const recording = {
      mbid: juicyMbid,
      title: 'Juicy Fruit',
      artist: 'Mtume',
      credits: [],
      samplesFrom: [],
      sampledIn: [
        {
          title: 'Juicy',
          artist: 'The Notorious B.I.G.',
          mbid: biggieMbid,
          sourceUrl: `https://musicbrainz.org/recording/${biggieMbid}`,
          source: 'musicbrainz' as const,
          providerId: biggieMbid,
        },
      ],
      provenance: {
        sourceUrls: [`https://musicbrainz.org/recording/${juicyMbid}`],
        matchStatus: 'matched' as const,
        confidence: 0.7,
        reason: TRACK_LEVEL_REASON,
        checkedAt: '2026-10-06T08:00:00.000Z',
        refreshAfter: '2026-11-05T08:00:00.000Z',
        lastError: null,
        verifiedAt: '2026-10-06T08:00:00.000Z',
        lastAttemptAt: '2026-10-06T08:00:00.000Z',
      },
    }
    const store = createMemoryCrateStore({
      pressings: {
        567894: hydratePressing({
          ...previous,
          provenance: {
            ...previous.provenance,
            verifiedAt: '2026-10-06T08:00:00.000Z',
            lastError: {
              at: '2026-10-06T08:00:00.000Z',
              kind: 'rate_limit',
              message: 'Too many requests',
              attempts: 1,
            },
          },
        }),
      },
      recordings: { [juicyMbid]: recording },
    })
    const mb = createMusicBrainzClientForTests()
    let fetched = 0
    mb.searchRecordingsByArtistTitle = async () => [
      { mbid: juicyMbid, title: 'Juicy Fruit', artist: 'Mtume', lengthMs: 355000, score: 100 },
    ]
    mb.getRecording = async () => {
      fetched += 1
      return null
    }
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:01:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.equal(fetched, 0)
    const juicy = (result.researchFacts ?? []).find(
      (fact) =>
        fact.kind === 'sampled_by' &&
        /juicy/i.test(fact.relatedTitle) &&
        /notorious/i.test(fact.relatedArtist)
    )
    assert.ok(juicy)
    assert.equal(juicy?.source, 'musicbrainz')
    assert.equal(result.provenance.lastError, null)
  })

  it('overlays recording-level progress onto a preserved verified pressing', () => {
    const previous = fixturePressing(567894)
    assert.ok(previous)
    const preserved = preservePressingOnFailure(
      previous,
      Date.parse('2026-10-06T08:00:00.000Z'),
      'rate_limit',
      'Too many requests'
    )
    const juicyMbid = '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc'
    const overlaid = overlayTrackLevelProgress(preserved, {
      tracks: previous.tracks.map((track, index) =>
        index === 0
          ? {
              ...track,
              recording: {
                matchStatus: 'matched',
                confidence: 0.7,
                reason: TRACK_LEVEL_REASON,
                mbid: juicyMbid,
                recordingUrl: `https://musicbrainz.org/recording/${juicyMbid}`,
              },
            }
          : track
      ),
      recordings: {
        [juicyMbid]: {
          mbid: juicyMbid,
          title: 'Juicy Fruit',
          artist: 'Mtume',
          credits: [],
          samplesFrom: [],
          sampledIn: [
            {
              title: 'Juicy',
              artist: 'The Notorious B.I.G.',
              mbid: 'biggie',
              sourceUrl: 'https://musicbrainz.org/recording/biggie',
              source: 'musicbrainz',
              providerId: 'biggie',
            },
          ],
          provenance: {
            sourceUrls: [`https://musicbrainz.org/recording/${juicyMbid}`],
            matchStatus: 'matched',
            confidence: 0.7,
            reason: TRACK_LEVEL_REASON,
            checkedAt: '2026-10-06T08:00:00.000Z',
            refreshAfter: '2026-11-05T08:00:00.000Z',
            lastError: null,
            verifiedAt: '2026-10-06T08:00:00.000Z',
            lastAttemptAt: '2026-10-06T08:00:00.000Z',
          },
        },
      },
    })
    assert.equal(overlaid.provenance.lastError?.kind, 'rate_limit')
    assert.equal(
      (overlaid.researchFacts ?? []).some(
        (fact) => fact.kind === 'sampled_by' && /notorious/i.test(fact.relatedArtist)
      ),
      true
    )
  })

  it('dedupes blank-artist sample facts when a 429 overlay fills the artist', () => {
    const recordingMbid = 'sir-duke-vocal'
    const footprintsId = 'atcq-footprints'
    const toutId = 'tout-le-monde'
    const track = {
      position: 'A1',
      title: 'Sir Duke',
      duration: '3:54',
      durationMs: 234000,
      index: 0,
      type_: 'track',
      recording: {
        matchStatus: 'matched' as const,
        confidence: 0.7,
        reason: TRACK_LEVEL_REASON,
        mbid: recordingMbid,
        recordingUrl: `https://musicbrainz.org/recording/${recordingMbid}`,
      },
    }
    const trackKey = trackIdentityKey(track)
    const provenance = {
      sourceUrls: [`https://musicbrainz.org/recording/${recordingMbid}`],
      matchStatus: 'matched' as const,
      confidence: 0.7,
      reason: TRACK_LEVEL_REASON,
      checkedAt: '2026-10-06T08:00:00.000Z',
      refreshAfter: '2026-11-05T08:00:00.000Z',
      lastError: null,
      verifiedAt: '2026-10-06T08:00:00.000Z',
      lastAttemptAt: '2026-10-06T08:00:00.000Z',
    }
    const blankFact = (title: string, sourceId: string, artist = ''): ResearchFact => ({
      kind: 'sampled_by',
      trackKey,
      track: { position: 'A1', title: 'Sir Duke' },
      role: 'sampled in',
      person: '',
      relatedTitle: title,
      relatedArtist: artist,
      source: 'musicbrainz',
      sourceId,
      sourceUrl: `https://musicbrainz.org/recording/${sourceId}`,
      fetchedAt: '2026-10-06T08:00:00.000Z',
    })
    const previous = hydratePressing(
      pressingStub({
        releaseId: 266650,
        tracks: [track],
        recordings: {
          [recordingMbid]: {
            mbid: recordingMbid,
            title: 'Sir Duke',
            artist: 'Stevie Wonder',
            credits: [],
            samplesFrom: [],
            sampledIn: [
              {
                title: 'Footprints',
                artist: '',
                mbid: footprintsId,
                sourceUrl: `https://musicbrainz.org/recording/${footprintsId}`,
                source: 'musicbrainz',
                providerId: footprintsId,
              },
              {
                title: 'Tout le monde en parle : Sir Duke',
                artist: '[unknown]',
                mbid: toutId,
                sourceUrl: `https://musicbrainz.org/recording/${toutId}`,
                source: 'musicbrainz',
                providerId: toutId,
              },
            ],
            provenance,
          },
        },
        researchFacts: [
          blankFact('Footprints', footprintsId),
          blankFact('Tout le monde en parle : Sir Duke', toutId, '[unknown]'),
        ],
      })
    )
    const preserved = preservePressingOnFailure(
      previous,
      Date.parse('2026-10-06T08:01:00.000Z'),
      'rate_limit',
      'MusicBrainz rate limited'
    )
    const overlaid = overlayTrackLevelProgress(preserved, {
      tracks: [{ ...track, identityKey: trackKey }],
      recordings: {
        [recordingMbid]: {
          mbid: recordingMbid,
          title: 'Sir Duke',
          artist: 'Stevie Wonder',
          credits: [],
          samplesFrom: [],
          sampledIn: [
            {
              title: 'Footprints',
              artist: 'A Tribe Called Quest',
              mbid: footprintsId,
              sourceUrl: `https://musicbrainz.org/recording/${footprintsId}`,
              source: 'musicbrainz',
              providerId: footprintsId,
            },
            {
              title: 'Tout le monde en parle : Sir Duke',
              artist: '[unknown]',
              mbid: toutId,
              sourceUrl: `https://musicbrainz.org/recording/${toutId}`,
              source: 'musicbrainz',
              providerId: toutId,
            },
          ],
          provenance,
        },
      },
    })
    const samples = (overlaid.researchFacts ?? []).filter((fact) => fact.kind === 'sampled_by')
    const footprints = samples.filter((fact) => fact.sourceId === footprintsId)
    const tout = samples.filter((fact) => fact.sourceId === toutId)
    assert.equal(footprints.length, 1)
    assert.equal(footprints[0]?.relatedArtist, 'A Tribe Called Quest')
    assert.equal(footprints[0]?.relatedTitle, 'Footprints')
    assert.equal(tout.length, 1)
    assert.equal(tout[0]?.relatedArtist, '')
    assert.equal(tout[0]?.relatedTitle, 'Tout le monde en parle : Sir Duke')
    assert.equal(overlaid.provenance.lastError?.kind, 'rate_limit')
    const links = mergeSampleLinks(
      [
        {
          title: 'Footprints',
          artist: '',
          mbid: footprintsId,
          sourceUrl: `https://musicbrainz.org/recording/${footprintsId}`,
          source: 'musicbrainz',
        },
      ],
      [
        {
          title: 'Footprints',
          artist: 'A Tribe Called Quest',
          mbid: footprintsId,
          sourceUrl: `https://musicbrainz.org/recording/${footprintsId}`,
          source: 'musicbrainz',
        },
      ]
    )
    assert.equal(links.length, 1)
    assert.equal(links[0]?.artist, 'A Tribe Called Quest')
  })

  it('keeps the committed track association unless the overlay has that recording doc', () => {
    const previous = hydratePressing(pressingStub())
    const committedMbid = previous.tracks[0]?.recording.mbid
    assert.ok(committedMbid)
    const overlayMbid = 'unfetched-overlay'
    const overlaid = overlayTrackLevelProgress(previous, {
      tracks: previous.tracks.map((track, index) =>
        index === 0
          ? {
              ...track,
              recording: {
                matchStatus: 'matched',
                confidence: 0.5,
                reason: 'draft',
                mbid: overlayMbid,
                recordingUrl: `https://musicbrainz.org/recording/${overlayMbid}`,
              },
            }
          : track
      ),
      recordings: {},
    })
    assert.equal(overlaid.tracks[0]?.recording.mbid, committedMbid)
  })

  it('uses the overlay cursor from this cycle instead of max with a prior completed cursor', () => {
    const previous = hydratePressing({
      ...pressingStub(),
      checkpoint: { stage: 'research', researchCursor: 0, trackSampleCursor: 12 },
    })
    const overlaid = overlayTrackLevelProgress(previous, {
      tracks: [],
      recordings: {},
      checkpoint: { stage: 'research', researchCursor: 0, trackSampleCursor: 3 },
    })
    assert.equal(overlaid.checkpoint?.trackSampleCursor, 3)
    assert.equal(overlaid.tracks[0]?.recording.mbid, previous.tracks[0]?.recording.mbid)
    const forced = overlayTrackLevelProgress(
      hydratePressing({
        ...pressingStub(),
        checkpoint: {
          stage: 'research',
          researchCursor: 0,
          trackSampleCursor: 12,
          forceRun: true,
          forceRunAt: '2026-10-07T16:00:00.000Z',
          deadlineStops: 1,
        },
      }),
      {
        tracks: [],
        recordings: {},
        checkpoint: { stage: 'research', researchCursor: 0, trackSampleCursor: 3 },
      }
    )
    assert.equal(forced.checkpoint?.forceRun, true)
    assert.equal(forced.checkpoint?.deadlineStops, 1)
    assert.equal(forced.checkpoint?.trackSampleCursor, 3)
  })

  it('parses HTTP-date Retry-After', () => {
    const nowMs = Date.parse('Wed, 21 Oct 2015 07:28:00 GMT')
    const later = new Date(nowMs + 45_000).toUTCString()
    const response = new Response('', { headers: { 'Retry-After': later } })
    assert.equal(readRetryAfterMs(response, 60_000, nowMs), 45_000)
    const seconds = new Response('', { headers: { 'Retry-After': '12' } })
    assert.equal(readRetryAfterMs(seconds, 60_000, nowMs), 12_000)
  })

  it('caps MusicBrainz Retry-After at 120s', async () => {
    assert.equal(MUSICBRAINZ_RETRY_AFTER_CAP_MS, 120_000)
    const hour = new Response('', { headers: { 'Retry-After': '3600' } })
    assert.equal(musicbrainzRetryAfterMs(hour), 120_000)
    const short = new Response('', { headers: { 'Retry-After': '12' } })
    assert.equal(musicbrainzRetryAfterMs(short), 12_000)
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async () => new Response('', { status: 429, headers: { 'Retry-After': '3600' } }),
    })
    await assert.rejects(
      () => client.getRecording('rec-1'),
      (error: unknown) => {
        assert.equal(error instanceof MusicBrainzRateLimitError, true)
        assert.equal((error as MusicBrainzRateLimitError).retryAfterMs, 120_000)
        return true
      }
    )
  })

  it('persists merged sample links after attach, not before', async () => {
    const linkFromA: SampleLink = {
      title: 'Source A',
      artist: 'Artist A',
      mbid: 'from-a',
      sourceUrl: 'https://musicbrainz.org/recording/from-a',
      source: 'musicbrainz',
      providerId: 'from-a',
    }
    const linkFromB: SampleLink = {
      title: 'Source B',
      artist: 'Artist B',
      mbid: 'from-b',
      sourceUrl: 'https://musicbrainz.org/recording/from-b',
      source: 'musicbrainz',
      providerId: 'from-b',
    }
    const linkIn: SampleLink = {
      title: 'Rap Track',
      artist: 'Rapper',
      mbid: 'sampled-in',
      sourceUrl: 'https://musicbrainz.org/recording/sampled-in',
      source: 'musicbrainz',
      providerId: 'sampled-in',
    }
    const provenance: StoredRecording['provenance'] = {
      sourceUrls: ['https://musicbrainz.org/recording/primary'],
      matchStatus: 'matched',
      confidence: 0.7,
      reason: TRACK_LEVEL_REASON,
      checkedAt: '2026-10-06T08:00:00.000Z',
      refreshAfter: '2026-11-05T08:00:00.000Z',
      lastError: null,
      verifiedAt: '2026-10-06T08:00:00.000Z',
      lastAttemptAt: '2026-10-06T08:00:00.000Z',
    }
    const docs: StoredRecording[] = [
      {
        mbid: 'primary',
        title: 'Song',
        artist: 'Artist',
        credits: [],
        samplesFrom: [linkFromA],
        sampledIn: [],
        provenance,
      },
      {
        mbid: 'other',
        title: 'Song',
        artist: 'Artist',
        credits: [],
        samplesFrom: [linkFromB],
        sampledIn: [linkIn],
        provenance: {
          ...provenance,
          sourceUrls: ['https://musicbrainz.org/recording/other'],
        },
      },
    ]
    const recordings: Record<string, StoredRecording> = {
      primary: docs[0]!,
      other: docs[1]!,
    }
    const track: TrackOccurrence = {
      position: 'A',
      title: 'Song',
      duration: '3:00',
      durationMs: 180_000,
      index: 0,
      recording: {
        matchStatus: 'pending',
        confidence: 0,
        reason: '',
        mbid: null,
        recordingUrl: null,
      },
    }
    const store = createMemoryCrateStore()
    await persistTrackLevelDocs(store, track, recordings, docs)
    const stored = await store.getRecording('primary')
    assert.deepEqual(
      stored?.samplesFrom.map((link) => link.mbid),
      ['from-a', 'from-b']
    )
    assert.equal(stored?.sampledIn[0]?.mbid, 'sampled-in')
    assert.equal(track.recording.mbid, 'primary')
  })

  it('aborts MusicBrainz requests at min(timeout, deadline remaining)', async () => {
    let calls = 0
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      now: () => 10_000,
      timeoutMs: 5_000,
      deadlineMs: 10_000,
      fetchImpl: async () => {
        calls += 1
        throw new Error('should not fetch when the deadline has already elapsed')
      },
    })
    await assert.rejects(
      () => client.searchReleaseByCatno('ABC-1', 'Artist'),
      (error: unknown) => {
        assert.equal(error instanceof MusicBrainzTimeoutError, true)
        assert.equal((error as MusicBrainzTimeoutError).deadlineExceeded, true)
        return true
      }
    )
    assert.equal(calls, 0)
  })

  it('does not treat based-on work rels as samples', async () => {
    const urls: string[] = []
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        urls.push(String(url))
        if (String(url).includes('/recording/')) {
          return Response.json({
            id: 'rec-1',
            title: 'Song',
            'artist-credit': [{ name: 'Artist' }],
            relations: [
              { 'target-type': 'work', type: 'performance', work: { id: 'work-1', title: 'Song' } },
              {
                'target-type': 'recording',
                type: 'based on',
                direction: 'forward',
                recording: {
                  id: 'adaptation',
                  title: 'Adaptation',
                  'artist-credit': [{ name: 'Other' }],
                },
              },
            ],
          })
        }
        return Response.json({
          id: 'work-1',
          relations: [
            {
              type: 'based on',
              direction: 'forward',
              recording: {
                id: 'other',
                title: 'Other Song',
                'artist-credit': [{ name: 'Other' }],
              },
            },
            {
              type: 'samples material',
              'type-id': MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
              direction: 'backward',
              recording: {
                id: 'sampled',
                title: 'Sampled',
                'artist-credit': [{ name: 'Rapper' }],
              },
            },
          ],
        })
      },
    })
    const doc = await client.getRecording('rec-1')
    assert.equal(urls.some((url) => url.includes('/work/')), false)
    assert.equal(doc?.samplesFrom.length, 0)
    assert.equal(doc?.sampledIn.length, 0)
  })

  it('produces zero sample facts from work rels and never stores a /work/ sourceUrl', async () => {
    const urls: string[] = []
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        urls.push(String(url))
        return Response.json({
          id: 'bridge',
          title: 'Bridge Over Troubled Water',
          'artist-credit': [{ name: 'Simon & Garfunkel' }],
          relations: [
            {
              'target-type': 'work',
              type: 'performance',
              work: { id: 'work-bridge', title: 'Bridge Over Troubled Water' },
            },
            {
              'target-type': 'work',
              type: 'based on',
              direction: 'backward',
              work: { id: 'work-mashup', title: 'A Bridge Over You' },
            },
            {
              'target-type': 'work',
              type: 'samples material',
              direction: 'forward',
              work: { id: 'work-other', title: 'Should Not Appear' },
            },
          ],
        })
      },
    })
    const doc = await client.getRecording('bridge')
    assert.equal(urls.some((url) => url.includes('/work/')), false)
    assert.equal(doc?.samplesFrom.length, 0)
    assert.equal(doc?.sampledIn.length, 0)
    const stored = [...(doc?.samplesFrom ?? []), ...(doc?.sampledIn ?? [])]
    assert.equal(stored.some((link) => link.sourceUrl.includes('/work/')), false)
  })

  it('does not treat Bridge Over Troubled Water as sampling A Bridge Over You', async () => {
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async () =>
        Response.json({
          id: 'botw',
          title: 'Bridge Over Troubled Water',
          'artist-credit': [{ name: 'Simon & Garfunkel' }],
          relations: [
            {
              'target-type': 'work',
              type: 'performance',
              work: { id: 'work-botw', title: 'Bridge Over Troubled Water' },
            },
            {
              'target-type': 'work',
              type: 'based on',
              direction: 'backward',
              work: { id: 'work-mashup', title: 'A Bridge Over You' },
            },
          ],
        }),
    })
    const doc = await client.getRecording('botw')
    assert.equal(
      [...(doc?.samplesFrom ?? []), ...(doc?.sampledIn ?? [])].some((link) =>
        /bridge over you/i.test(link.title)
      ),
      false
    )
  })

  it('does not treat Village Ghetto Land / Ghetto Village work rels as samples', async () => {
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async () =>
        Response.json({
          id: 'vgl',
          title: 'Village Ghetto Land',
          'artist-credit': [{ name: 'Stevie Wonder' }],
          relations: [
            {
              'target-type': 'work',
              type: 'performance',
              work: { id: 'work-vgl', title: 'Village Ghetto Land' },
            },
            {
              'target-type': 'work',
              type: 'other version',
              direction: 'backward',
              work: { id: 'work-gv', title: 'Ghetto Village' },
            },
          ],
        }),
    })
    const doc = await client.getRecording('vgl')
    assert.equal(doc?.samplesFrom.length, 0)
    assert.equal(doc?.sampledIn.length, 0)
  })

  it('maps samples material forward to sample_of and backward to sampled_by', async () => {
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async () =>
        Response.json({
          id: 'rec-1',
          title: 'Song',
          'artist-credit': [{ name: 'Artist' }],
          relations: [
            {
              'target-type': 'recording',
              type: 'samples material',
              'type-id': MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
              direction: 'forward',
              recording: {
                id: 'source',
                title: 'Source',
                'artist-credit': [{ name: 'Original' }],
              },
            },
            {
              'target-type': 'recording',
              type: 'samples material',
              'type-id': MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
              direction: 'backward',
              recording: {
                id: 'later',
                title: 'Later',
                'artist-credit': [{ name: 'Rapper' }],
              },
            },
          ],
        }),
    })
    const doc = await client.getRecording('rec-1')
    assert.equal(doc?.samplesFrom.length, 1)
    assert.equal(doc?.samplesFrom[0]?.title, 'Source')
    assert.equal(doc?.samplesFrom[0]?.sourceUrl, 'https://musicbrainz.org/recording/source')
    assert.equal(doc?.sampledIn.length, 1)
    assert.equal(doc?.sampledIn[0]?.title, 'Later')
    assert.equal(doc?.sampledIn[0]?.sourceUrl, 'https://musicbrainz.org/recording/later')
  })

  it('does not invert a bare sampled-by label', async () => {
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async () =>
        Response.json({
          id: 'rec-1',
          title: 'Song',
          'artist-credit': [{ name: 'Artist' }],
          relations: [
            {
              'target-type': 'recording',
              type: 'sampled by',
              direction: 'backward',
              recording: {
                id: 'sampled',
                title: 'Sampled',
                'artist-credit': [{ name: 'Rapper' }],
              },
            },
            {
              'target-type': 'recording',
              type: 'sampled by',
              'type-id': MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
              direction: 'forward',
              recording: {
                id: 'source',
                title: 'Source',
                'artist-credit': [{ name: 'Original' }],
              },
            },
          ],
        }),
    })
    const doc = await client.getRecording('rec-1')
    assert.equal(doc?.sampledIn.length, 0)
    assert.equal(doc?.samplesFrom.length, 1)
    assert.equal(doc?.samplesFrom[0]?.title, 'Source')
  })

  it('accepts a getRecording samples-material backward recording target', async () => {
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async () =>
        Response.json({
          id: '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc',
          title: 'Juicy Fruit',
          'artist-credit': [{ name: 'Mtume' }],
          relations: [
            {
              'target-type': 'recording',
              type: 'samples material',
              'type-id': MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
              direction: 'backward',
              recording: {
                id: '181c0a32-6e3f-4680-8a7d-1daf0b42e43b',
                title: 'Juicy',
                'artist-credit': [{ name: 'The Notorious B.I.G.' }],
              },
            },
          ],
        }),
    })
    const doc = await client.getRecording('1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc')
    assert.equal(doc?.samplesFrom.length, 0)
    assert.equal(doc?.sampledIn.length, 1)
    assert.equal(doc?.sampledIn[0]?.title, 'Juicy')
    assert.equal(doc?.sampledIn[0]?.artist, 'The Notorious B.I.G.')
    assert.equal(
      doc?.sampledIn[0]?.sourceUrl,
      'https://musicbrainz.org/recording/181c0a32-6e3f-4680-8a7d-1daf0b42e43b'
    )
  })

  it('keeps recording-to-release samples material from release-rels', async () => {
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async () =>
        Response.json({
          id: 'rec-1',
          title: 'Song',
          'artist-credit': [{ name: 'Artist' }],
          relations: [
            {
              'target-type': 'release',
              type: 'samples material',
              'type-id': MB_SAMPLES_MATERIAL_RELEASE_TYPE_ID,
              direction: 'forward',
              release: { id: 'rel-1', title: 'Sampled Album' },
            },
          ],
        }),
    })
    const doc = await client.getRecording('rec-1')
    assert.equal(doc?.samplesFrom[0]?.title, 'Sampled Album')
    assert.equal(doc?.samplesFrom[0]?.sourceUrl, 'https://musicbrainz.org/release/rel-1')
    assert.equal(doc?.sampledIn.length, 0)
  })

  it('drops stored work-target sample links at read time', () => {
    const mbid = '08b1c4e3-b0eb-4dd2-b870-740d6eebe627'
    const pressing = hydratePressing(
      pressingStub({
        recordings: {
          [mbid]: {
            mbid,
            title: 'Song',
            artist: 'Artist',
            credits: [],
            samplesFrom: [
              {
                title: 'A Bridge Over You',
                artist: '',
                mbid: 'work-mashup',
                sourceUrl: 'https://musicbrainz.org/work/work-mashup',
                source: 'musicbrainz',
                providerId: 'work-mashup',
              },
              {
                title: 'Source',
                artist: 'Original',
                mbid: 'source',
                sourceUrl: 'https://musicbrainz.org/recording/source',
                source: 'musicbrainz',
                providerId: 'source',
              },
            ],
            sampledIn: [],
            provenance: {
              sourceUrls: [],
              matchStatus: 'matched',
              confidence: 0.9,
              reason: TRACK_LEVEL_REASON,
              checkedAt: '2026-10-06T00:00:00.000Z',
              refreshAfter: '2026-11-05T00:00:00.000Z',
              lastError: null,
              verifiedAt: '2026-10-06T00:00:00.000Z',
              lastAttemptAt: '2026-10-06T00:00:00.000Z',
            },
          },
        },
      })
    )
    const facts = factsFromRecordings(pressing)
    assert.equal(facts.some((fact) => fact.sourceUrl.includes('/work/')), false)
    assert.equal(facts.filter((fact) => fact.kind === 'sample_of').length, 1)
    assert.equal(facts.find((fact) => fact.kind === 'sample_of')?.relatedTitle, 'Source')
    assert.equal(isRecordingOrReleaseSampleLink({ sourceUrl: 'https://musicbrainz.org/work/x' }), false)
  })

  it('keeps Wikidata P5707 sample facts through hydrate, persist, coverage, and render', async () => {
    const researchSrc = readFileSync(fileURLToPath(new URL('./research.ts', import.meta.url)), 'utf8')
    const helper = researchSrc.slice(
      researchSrc.indexOf('export function isRecordingOrReleaseSampleLink'),
      researchSrc.indexOf('export function samplesFromFacts')
    )
    const fromRecordings = researchSrc.slice(
      researchSrc.indexOf('export function factsFromRecordings'),
      researchSrc.indexOf('export function ensureResearchFacts')
    )
    assert.match(helper, /musicbrainz\\.org\\\/work/)
    assert.doesNotMatch(helper, /\/recording\//)
    assert.doesNotMatch(helper, /\/release\//)
    assert.match(fromRecordings, /isRecordingOrReleaseSampleLink/)
    assert.equal(
      isRecordingOrReleaseSampleLink({ sourceUrl: 'https://www.wikidata.org/wiki/Q6305224' }),
      true
    )
    assert.equal(
      isRecordingOrReleaseSampleLink({ sourceUrl: 'https://musicbrainz.org/work/work-mashup' }),
      false
    )
    const fetchedAt = '2026-10-07T13:00:00.000Z'
    const wikiUrl = 'https://www.wikidata.org/wiki/Q6305224'
    const mbid = '08b1c4e3-b0eb-4dd2-b870-740d6eebe627'
    const wikiFact: ResearchFact = {
      kind: 'sample_of',
      trackKey: '',
      track: null,
      role: 'samples',
      person: '',
      relatedTitle: 'Sampled Work',
      relatedArtist: '',
      source: 'wikidata',
      sourceId: 'Q9',
      sourceUrl: wikiUrl,
      fetchedAt,
    }
    const merged = mergeResearchFacts([wikiFact])
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.sourceUrl, wikiUrl)

    const hydrated = hydratePressing(
      pressingStub({
        researchFacts: [wikiFact],
        recordings: {
          [mbid]: {
            mbid,
            title: 'Song',
            artist: 'Artist',
            credits: [],
            samplesFrom: [
              {
                title: 'Track Wiki Sample',
                artist: '',
                mbid: 'Q8',
                sourceUrl: 'https://www.wikidata.org/wiki/Q8',
                source: 'wikidata',
                providerId: 'Q8',
              },
              {
                title: 'A Bridge Over You',
                artist: '',
                mbid: 'work-mashup',
                sourceUrl: 'https://musicbrainz.org/work/work-mashup',
                source: 'musicbrainz',
                providerId: 'work-mashup',
              },
            ],
            sampledIn: [],
            provenance: {
              sourceUrls: [],
              matchStatus: 'matched',
              confidence: 0.9,
              reason: TRACK_LEVEL_REASON,
              checkedAt: fetchedAt,
              refreshAfter: '2026-11-05T00:00:00.000Z',
              lastError: null,
              verifiedAt: fetchedAt,
              lastAttemptAt: fetchedAt,
            },
          },
        },
      })
    )
    const fromRecording = factsFromRecordings(hydrated)
    assert.equal(
      fromRecording.some((fact) => fact.sourceUrl === 'https://www.wikidata.org/wiki/Q8'),
      true
    )
    assert.equal(
      fromRecording.some((fact) => fact.sourceUrl.includes('musicbrainz.org/work/')),
      false
    )
    assert.equal(
      (hydrated.researchFacts ?? []).some((fact) => fact.sourceUrl === wikiUrl),
      true
    )
    assert.equal(
      (hydrated.researchFacts ?? []).some((fact) => fact.sourceUrl.includes('musicbrainz.org/work/')),
      false
    )
    assert.equal(hydrated.coverage?.withReleaseSamples, true)
    assert.ok((hydrated.coverage?.withSamples ?? 0) >= 1)
    const overview = overviewConnections(hydrated)
    assert.equal(overview.some((row) => row.href === wikiUrl), true)
    assert.equal(samplesFromFacts(hydrated.researchFacts ?? []).some((fact) => fact.sourceUrl === wikiUrl), true)
    assert.equal(
      trackSampleFacts(hydrated, hydrated.tracks[0] ?? null).some((fact) => fact.sourceUrl === wikiUrl),
      true
    )

    const store = createMemoryCrateStore()
    await store.setPressing(hydrated)
    const persisted = hydratePressing((await store.getPressing(hydrated.releaseId))!)
    assert.equal(
      (persisted.researchFacts ?? []).some((fact) => fact.sourceUrl === wikiUrl && fact.kind === 'sample_of'),
      true
    )
    assert.equal(persisted.coverage?.withReleaseSamples, true)
    assert.equal(overviewConnections(persisted).some((row) => row.href === wikiUrl), true)
  })

  it('fills a sample artist from the related recording when the relation omits artist-credit', async () => {
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        if (String(url).includes('/recording/rec-1')) {
          return Response.json({
            id: 'rec-1',
            title: 'Song',
            'artist-credit': [{ name: 'Artist' }],
            relations: [
              {
                'target-type': 'recording',
                type: 'samples material',
                'type-id': MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
                direction: 'backward',
                recording: { id: 'sampled', title: 'Sampled' },
              },
            ],
          })
        }
        if (String(url).includes('/recording/sampled')) {
          return Response.json({
            id: 'sampled',
            title: 'Sampled',
            'artist-credit': [{ name: 'Rapper' }],
          })
        }
        return Response.json({ id: 'unused', relations: [] })
      },
    })
    const doc = await client.getRecording('rec-1')
    assert.equal(doc?.sampledIn[0]?.artist, 'Rapper')
    assert.equal(doc?.sampledIn[0]?.title, 'Sampled')
  })

  it('treats MusicBrainz [unknown] sample artists as empty', async () => {
    assert.equal(
      artistCreditName([
        {
          name: '[unknown]',
          artist: { id: MUSICBRAINZ_UNKNOWN_ARTIST_MBID, name: '[unknown]' },
        },
      ]),
      ''
    )
    assert.equal(
      artistCreditName([
        {
          name: 'Alpha',
          joinphrase: ' & ',
          artist: { id: 'alpha', name: 'Alpha' },
        },
        {
          name: '[unknown]',
          artist: { id: MUSICBRAINZ_UNKNOWN_ARTIST_MBID, name: '[unknown]' },
        },
      ]),
      'Alpha'
    )
    assert.equal(presentSampleArtist('[unknown]'), '')
    assert.equal(presentSampleArtist('MC Real & [unknown]'), 'MC Real')
    assert.equal(presentSampleArtist('Alpha & [unknown]'), 'Alpha')
    assert.equal(presentSampleArtist('Alpha &'), 'Alpha')
    assert.equal(presentSampleArtist('Alpha,'), 'Alpha')
    assert.equal(presentSampleArtist('Malcolm X'), 'Malcolm X')
    assert.equal(presentSampleArtist('Little Feat'), 'Little Feat')
    assert.equal(presentSampleArtist('Lowell George & Little Feat'), 'Lowell George & Little Feat')
    assert.equal(presentSampleArtist('Generation X'), 'Generation X')
    assert.equal(presentSampleArtist('Brand X'), 'Brand X')
    assert.equal(presentSampleArtist('Mr. X'), 'Mr. X')
    assert.equal(presentSampleArtist('Earth, Wind & Fire'), 'Earth, Wind & Fire')
    assert.equal(presentSampleArtist('Tyler, The Creator'), 'Tyler, The Creator')
    assert.equal(presentSampleArtist('Simon & Garfunkel'), 'Simon & Garfunkel')
    assert.equal(presentSampleArtist('A Tribe Called Quest'), 'A Tribe Called Quest')
    assert.equal(presentSampleArtist('Alpha &&'), 'Alpha')
    assert.equal(presentSampleArtist('Alpha & &'), 'Alpha')
    assert.equal(presentSampleArtist('Alpha,,'), 'Alpha')
    assert.equal(presentSampleArtist('[unknown] & Alpha'), 'Alpha')
    assert.equal(presentSampleArtist('Alpha, [unknown] & Beta'), 'Alpha & Beta')
    assert.equal(presentSampleArtist('Alpha feat.'), 'Alpha')
    assert.equal(presentSampleArtist('Alpha ft.'), 'Alpha')
    assert.equal(presentSampleArtist('Alpha feat'), 'Alpha feat')
    assert.equal(presentSampleArtist('&ME'), '&ME')
    assert.equal(presentSampleArtist('& ME'), '& ME')
    assert.equal(presentSampleArtist('Brand x'), 'Brand x')
    assert.equal(presentSampleArtist('Mr. [unknown]'), '')
    assert.equal(presentSampleArtist('Mr. [unknown] & Foo'), 'Mr. Foo')
    assert.notEqual(presentSampleArtist('Mr. [unknown] & Foo'), 'Mr. & Foo')
    assert.equal(presentSampleArtist('Dr. [unknown] x Foo'), 'Dr. Foo')
    assert.equal(presentSampleArtist('Mrs. [unknown], Foo'), 'Mrs. Foo')
    assert.equal(presentSampleArtist('[unknown] x Beta'), 'Beta')
    assert.equal(presentSampleArtist('Alpha [Unknown] Beta'), 'Alpha Beta')
    assert.equal(presentSampleArtist('Alpha x [unknown]'), 'Alpha')
    assert.equal(
      artistCreditName([
        { name: 'Simon', joinphrase: ' & ', artist: { id: 'simon', name: 'Simon' } },
        { name: 'Garfunkel', artist: { id: 'garfunkel', name: 'Garfunkel' } },
      ]),
      'Simon & Garfunkel'
    )
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        if (String(url).includes('/recording/rec-1')) {
          return Response.json({
            id: 'rec-1',
            title: 'Sir Duke',
            'artist-credit': [{ name: 'Stevie Wonder' }],
            relations: [
              {
                'target-type': 'recording',
                type: 'samples material',
                'type-id': MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
                direction: 'backward',
                recording: {
                  id: 'tout',
                  title: 'Tout le monde en parle : Sir Duke',
                  'artist-credit': [
                    {
                      name: '[unknown]',
                      artist: { id: MUSICBRAINZ_UNKNOWN_ARTIST_MBID, name: '[unknown]' },
                    },
                  ],
                },
              },
              {
                'target-type': 'recording',
                type: 'samples material',
                'type-id': MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
                direction: 'backward',
                recording: { id: 'omitted', title: 'Omitted Credit' },
              },
            ],
          })
        }
        if (String(url).includes('/recording/omitted')) {
          return Response.json({
            id: 'omitted',
            title: 'Omitted Credit',
            'artist-credit': [
              {
                name: '[unknown]',
                artist: { id: MUSICBRAINZ_UNKNOWN_ARTIST_MBID, name: '[unknown]' },
              },
            ],
          })
        }
        return Response.json({ id: 'unused', relations: [] })
      },
    })
    const doc = await client.getRecording('rec-1')
    assert.equal(doc?.sampledIn[0]?.title, 'Tout le monde en parle : Sir Duke')
    assert.equal(doc?.sampledIn[0]?.artist, '')
    assert.equal(doc?.sampledIn[1]?.title, 'Omitted Credit')
    assert.equal(doc?.sampledIn[1]?.artist, '')
  })

  it('returns the base recording when a related-recording artist lookup 429s', async () => {
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        if (String(url).includes('/recording/rec-1')) {
          return Response.json({
            id: 'rec-1',
            title: 'Song',
            'artist-credit': [{ name: 'Artist' }],
            relations: [
              {
                'target-type': 'recording',
                type: 'samples material',
                'type-id': MB_SAMPLES_MATERIAL_RECORDING_TYPE_ID,
                direction: 'backward',
                recording: {
                  id: 'sampled',
                  title: 'Sampled',
                },
              },
            ],
          })
        }
        return new Response('', { status: 429, headers: { 'Retry-After': '1' } })
      },
    })
    await assert.rejects(
      () => client.getRecording('rec-1'),
      (error: unknown) => {
        assert.equal(error instanceof MusicBrainzRateLimitError, true)
        const partial = (error as MusicBrainzRateLimitError).partialRecording
        assert.equal(partial?.sampledIn[0]?.title, 'Sampled')
        return true
      }
    )
  })

  it('pages recording search while top-score ties fill the page', async () => {
    assert.equal(RECORDING_SEARCH_LIMIT, 100)
    assert.equal(RECORDING_SEARCH_MAX_PAGES, 3)
    const urls: string[] = []
    const recordingsAt = (offset: number, count: number, topCount: number, restScore = 80) =>
      Array.from({ length: count }, (_, index) => ({
        id: `rec-${offset + index}`,
        title: 'Juicy Fruit',
        score: index < topCount ? 100 : restScore,
        length: 355000,
        'artist-credit': [{ name: 'Mtume' }],
      }))
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        urls.push(String(url))
        const parsed = new URL(String(url))
        assert.equal(parsed.searchParams.get('limit'), '100')
        const offset = Number(parsed.searchParams.get('offset') || '0')
        if (offset === 0) {
          return Response.json({ recordings: recordingsAt(0, 100, 100) })
        }
        if (offset === 100) {
          return Response.json({ recordings: recordingsAt(100, 40, 31) })
        }
        throw new Error(`unexpected recording search offset ${offset}`)
      },
    })
    const hits = await client.searchRecordingsByArtistTitle({
      artist: 'Mtume',
      title: 'Juicy Fruit',
    })
    assert.equal(urls.length, 2)
    assert.match(urls[1] ?? '', /offset=100/)
    assert.equal(hits.length, 140)
    assert.equal(hits.filter((hit) => hit.score === 100).length, 131)
  })

  it('stops paging recording search after the max page bound', async () => {
    let pages = 0
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        const parsed = new URL(String(url))
        const offset = Number(parsed.searchParams.get('offset') || '0')
        pages += 1
        assert.ok(pages <= RECORDING_SEARCH_MAX_PAGES)
        return Response.json({
          recordings: Array.from({ length: RECORDING_SEARCH_LIMIT }, (_, index) => ({
            id: `rec-${offset + index}`,
            title: 'Juicy Fruit',
            score: 100,
            length: 355000,
            'artist-credit': [{ name: 'Mtume' }],
          })),
        })
      },
    })
    const hits = await client.searchRecordingsByArtistTitle({
      artist: 'Mtume',
      title: 'Juicy Fruit',
    })
    assert.equal(pages, RECORDING_SEARCH_MAX_PAGES)
    assert.equal(hits.length, RECORDING_SEARCH_LIMIT * RECORDING_SEARCH_MAX_PAGES)
  })

  it('does not page recording search when the first page is not an all-top-score tie', async () => {
    const urls: string[] = []
    const client = createMusicBrainzClient({
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        urls.push(String(url))
        const parsed = new URL(String(url))
        const offset = Number(parsed.searchParams.get('offset') || '0')
        if (offset !== 0) throw new Error(`unexpected recording search offset ${offset}`)
        return Response.json({
          recordings: Array.from({ length: RECORDING_SEARCH_LIMIT }, (_, index) => ({
            id: `rec-${index}`,
            title: 'Juicy Fruit',
            score: index === RECORDING_SEARCH_LIMIT - 1 ? 99 : 100,
            length: 355000,
            'artist-credit': [{ name: 'Mtume' }],
          })),
        })
      },
    })
    const hits = await client.searchRecordingsByArtistTitle({
      artist: 'Mtume',
      title: 'Juicy Fruit',
    })
    assert.equal(urls.length, 1)
    assert.equal(hits.length, RECORDING_SEARCH_LIMIT)
  })

  it('spaces MusicBrainz requests at 1/s plus jitter', async () => {
    assert.equal(MUSICBRAINZ_MIN_INTERVAL_MS, 1100)
    assert.equal(MUSICBRAINZ_INTERVAL_JITTER_MS, 200)
    let now = 1_000_000
    const sleeps: number[] = []
    const client = createMusicBrainzClient({
      minIntervalMs: MUSICBRAINZ_MIN_INTERVAL_MS,
      jitterMs: MUSICBRAINZ_INTERVAL_JITTER_MS,
      random: () => 0.5,
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms)
        now += ms
      },
      fetchImpl: async () =>
        Response.json({
          id: 'rec-1',
          title: 'Song',
          'artist-credit': [{ name: 'Artist' }],
          relations: [],
        }),
    })
    await client.getRecording('rec-1')
    await client.getRecording('rec-1')
    assert.equal(sleeps.length, 1)
    assert.equal(sleeps[0], MUSICBRAINZ_MIN_INTERVAL_MS + 100)
  })

  it('does not fetch MusicBrainz works from getRecording', () => {
    const src = readFileSync(fileURLToPath(new URL('./musicbrainz.ts', import.meta.url)), 'utf8')
    const start = src.indexOf('async getRecording')
    const body = src.slice(start, src.indexOf('export type MusicBrainzClient', start))
    assert.match(body, /recording-rels\+release-rels/)
    assert.doesNotMatch(body, /\/work\//)
    assert.doesNotMatch(body, /work-rels/)
  })

  it('gives overview connection titles a 24px hit target', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../components/house/RecordDetail.tsx', import.meta.url)),
      'utf8'
    )
    const start = src.indexOf('aria-label="connections"')
    const body = src.slice(start, src.indexOf('role="tabpanel"', start))
    assert.match(
      body,
      /mt-1 inline-flex min-h-6 items-center \[overflow-wrap:anywhere\] min-w-0 max-w-full/
    )
    assert.doesNotMatch(body, /inline-block/)
  })

  it('wraps long sample titles and credit lines', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../components/house/RecordDetail.tsx', import.meta.url)),
      'utf8'
    )
    const extras = src.slice(src.indexOf('function TrackExtras'), src.indexOf('function FactSampleList'))
    const samples = src.slice(src.indexOf('function FactSampleList'))
    assert.match(extras, /min-w-0 text-sm \[overflow-wrap:anywhere\]/)
    assert.match(samples, /inline-flex min-h-6 min-w-0 items-center text-sm \[overflow-wrap:anywhere\]/)
  })

  it('records an ambiguous recording-level miss and merges no samples', async () => {
    const mb = createMusicBrainzClientForTests()
    let fetched = 0
    mb.searchRecordingsByArtistTitle = async () => [
      {
        mbid: 'wrong-artist',
        title: 'Juicy Fruit',
        artist: 'Someone Else',
        lengthMs: 355000,
        score: 99,
      },
      {
        mbid: 'other-song',
        title: 'Juicy',
        artist: 'Mtume',
        lengthMs: 355000,
        score: 90,
      },
    ]
    mb.getRecording = async () => {
      fetched += 1
      return {
        mbid: 'wrong-artist',
        title: 'Juicy Fruit',
        artist: 'Someone Else',
        credits: [],
        samplesFrom: [],
        sampledIn: [
          {
            title: 'Juicy',
            artist: 'The Notorious B.I.G.',
            mbid: 'biggie',
            sourceUrl: 'https://musicbrainz.org/recording/biggie',
            source: 'musicbrainz',
            providerId: 'biggie',
          },
        ],
      }
    }
    const store = createMemoryCrateStore()
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.equal(fetched, 0)
    assert.equal(
      (result.researchFacts ?? []).some(
        (fact) =>
          fact.kind === 'sampled_by' &&
          /notorious/i.test(fact.relatedArtist) &&
          fact.source === 'musicbrainz'
      ),
      false
    )
    assert.equal(result.tracks.some((track) => track.recording.mbid), false)
  })

  it('checkpoints a completed no-hit recording search', async () => {
    const mb = createMusicBrainzClientForTests()
    let searches = 0
    mb.searchRecordingsByArtistTitle = async () => {
      searches += 1
      if (searches === 1) return []
      throw new MusicBrainzRateLimitError(60_000)
    }
    const store = createMemoryCrateStore()
    const result = await enrichPressing(567894, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => mtumeDetail(),
      mb,
    })
    assert.equal(result.checkpoint?.trackSampleCursor, 1)
  })

  it('searches recording-level samples with the Discogs track artist on Various pressings', async () => {
    const searched: string[] = []
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async ({ artist, title }) => {
      searched.push(`${artist}::${title}`)
      return []
    }
    const store = createMemoryCrateStore()
    const detail = {
      ...mtumeDetail(),
      id: 99,
      artist: 'Various',
      title: 'Compilation',
      tracklist: [
        {
          position: 'A1',
          title: 'Song One',
          duration: '3:00',
          type_: 'track',
          artists: [{ name: 'Steel Pulse', id: 1 }],
          extraartists: [],
        },
      ],
    }
    await enrichPressing(99, {
      store,
      now: () => Date.parse('2026-10-06T08:00:00.000Z'),
      fetchDiscogs: async () => detail,
      mb,
    })
    assert.ok(searched.some((row) => row.startsWith('Steel Pulse::')))
    assert.equal(
      searched.some((row) => row.startsWith('Various::')),
      false
    )
  })

  it('applies Retry-After from the response clock, not enrich entry', async () => {
    let clock = Date.parse('2026-10-06T08:00:00.000Z')
    const mb = createMusicBrainzClientForTests()
    mb.searchRecordingsByArtistTitle = async () => {
      clock += 20_000
      throw new MusicBrainzRateLimitError(10_000)
    }
    const store = createMemoryCrateStore()
    const result = await enrichPressing(567894, {
      store,
      now: () => clock,
      fetchDiscogs: async () => {
        clock += 1_000
        return mtumeDetail()
      },
      mb,
    })
    assert.equal(result.provenance.refreshAfter, isoFromMs(clock + 10_000))
  })
})

describe('queue lua and fail-id gates', () => {
  it('re-adds nacked ids to the queued set and never front-resets in ENQUEUE_LUA', () => {
    assert.match(NACK_LUA, /SADD/)
    assert.doesNotMatch(ENQUEUE_LUA, /front == '1'/)
    assert.doesNotMatch(ENQUEUE_LUA, /ZADD', KEYS\[1\], 0/)
    assert.match(ENQUEUE_LUA, /SISMEMBER', KEYS\[3\]/)
  })

  it('does not enqueue a dead id unless retry is explicit', async () => {
    const store = createMemoryCrateStore()
    await store.markDead({
      releaseId: 9,
      kind: 'exhausted',
      message: 'gave up',
      attempts: 5,
      at: '2026-10-06T00:00:00.000Z',
      stage: 'pressing',
    })
    assert.deepEqual(await store.enqueue([9], { nowMs: 1 }), [])
    assert.deepEqual(await store.getQueue(), [])
    assert.deepEqual(await store.enqueue([9], { nowMs: 1, retry: true }), [9])
    assert.deepEqual(await store.getQueue(), [9])
    assert.deepEqual(await store.getDead(), [])
  })

  it('ignores CRATE_ENRICH_FAIL_IDS in production, in tests, and for *', () => {
    assert.equal(
      failRefreshFromEnv(573292, { VERCEL_ENV: 'preview', CRATE_ENRICH_FAIL_IDS: '573292' }),
      true
    )
    assert.equal(
      failRefreshFromEnv(573292, { VERCEL_ENV: 'production', CRATE_ENRICH_FAIL_IDS: '573292' }),
      false
    )
    assert.equal(
      failRefreshFromEnv(573292, { VERCEL_ENV: 'preview', CRATE_ENRICH_FAIL_IDS: '*' }),
      false
    )
    assert.equal(
      failRefreshFromEnv(573292, {
        VERCEL_ENV: 'preview',
        NODE_TEST_CONTEXT: '1',
        CRATE_ENRICH_FAIL_IDS: '573292',
      }),
      false
    )
  })
})

describe('collection crawl auth stops crate-enrich before enrichment', () => {
  async function runAuthStop(status: 401 | 403) {
    const store = createMemoryCrateStore({ queue: [573292] })
    const durable = createMemoryDurableStore()
    const lastGood = createMemoryLastGoodStore()
    const collectionCalls: string[] = []
    let releaseCalls = 0
    const result = await runCrateEnrichCron({
      store,
      durable,
      now: () => Date.parse('2026-10-06T05:00:00.000Z'),
      deadlineMs: Date.parse('2026-10-06T05:00:45.000Z'),
      discogs: {
        lastGood,
        durable,
        fetchImpl: async (url) => {
          collectionCalls.push(url)
          return new Response('{"message":"invalid token"}', { status })
        },
      },
      fetchDiscogs: async () => {
        releaseCalls += 1
        throw new Error('release fetch should not run')
      },
    })
    return { store, durable, collectionCalls, releaseCalls, result }
  }

  it('maps collection 401 to auth, makes no further Discogs calls, and marks nothing failed or dead', async () => {
    const { store, durable, collectionCalls, releaseCalls, result } = await runAuthStop(401)
    assert.equal(result.stoppedOnAuth, true)
    assert.deepEqual(result.processed, [])
    assert.equal(collectionCalls.length, 1)
    assert.equal(releaseCalls, 0)
    assert.deepEqual(await store.getDead(), [])
    assert.equal(await store.getPressing(573292), null)
    assert.deepEqual(await store.getQueue(), [573292])
    assert.equal(durable.meta?.lastError?.kind, 'auth')
  })

  it('maps collection 403 to auth, makes no further Discogs calls, and marks nothing failed or dead', async () => {
    const { store, durable, collectionCalls, releaseCalls, result } = await runAuthStop(403)
    assert.equal(result.stoppedOnAuth, true)
    assert.deepEqual(result.processed, [])
    assert.equal(collectionCalls.length, 1)
    assert.equal(releaseCalls, 0)
    assert.deepEqual(await store.getDead(), [])
    assert.equal(await store.getPressing(573292), null)
    assert.deepEqual(await store.getQueue(), [573292])
    assert.equal(durable.meta?.lastError?.kind, 'auth')
  })
})

