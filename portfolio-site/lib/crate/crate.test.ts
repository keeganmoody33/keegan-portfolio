/**
 * Crate matching, failure-preservation, and new-entry detection tests.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/crate/crate.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyReleaseMatch,
  detectNewReleaseIds,
  matchDiscogsTrackToMb,
  normalizePosition,
  normalizeTitle,
  parseDurationToMs,
} from './match.ts'
import { AUTH_RETRY_MS, isoFromMs, keepPriorMatch, nextBackoffMs, preservePressingOnFailure, shouldRefreshPressing } from './preserve.ts'
import { createMemoryCrateStore, crateRedisKeys, INFLIGHT_TTL_SECONDS, TAKE_LUA, ENQUEUE_LUA, NACK_LUA, type CrateStore } from './store.ts'
import { queueNewAndMissing } from './sync.ts'
import { enrichPressing, failRefreshFromEnv, occurrencesFromDetail, processEnrichmentQueue, sentencesFrom, classifyQueueOutcome, shouldSkipMatch, WorkerDeadlineError, isBackfillSettled, deadlineBackoffMs, DEADLINE_STOP_LIMIT, ENRICH_TAKE_FLOOR_MS } from './enrich.ts'
import { isUnusableDiscogsNotes, resolveDescription, withReadableDescription } from './description.ts'
import { COLLECTION_KEEP_PATH, scheduleKeepPing } from './keep-ping.ts'
import { runCrateEnrichCron } from './keep.ts'
import { crateProofAllowed, parseProofAction, PROOF_KILL_ID, runCrateProof } from './proof.ts'
import type { MusicBrainzClient } from './musicbrainz.ts'
import { CRATE_MAX_ATTEMPTS, CRATE_SCHEMA_VERSION, type StoredPressing } from './types.ts'
import { mapRelease, parseDurableCollection, DiscogsAuthError, DiscogsNotFoundError, createMemoryLastGoodStore } from '../discogs.ts'
import { createMemoryDurableStore } from '../discogs-store.ts'
import { fixturePressing, parseReleaseParam, readStoredPressing, unavailableHeading, unavailablePressing, visitEnqueueIfListed } from './read.ts'
import { factRows, pressingCheckedNoMatchLine } from './view.ts'
import { cronSecretEqual } from './cron-auth.ts'
import { coverageOf, isPlayableOccurrence, shouldQueuePressing } from './lifecycle.ts'
import { errorForDiscogsStatus, probeDiscogsIdentity } from './discogs-release.ts'
import { inspectCrate, remainingBackfillIds, runBackfill } from './backfill.ts'

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
    assert.equal(preserved.provenance.lastError?.attempts, 1)
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

  it('stops taking items when the time budget is short', async () => {
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
    assert.deepEqual(result.processed, [])
    assert.equal(result.skipped, false)
    assert.deepEqual(await store.getQueue(), [1, 2, 3])
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
    tracklist: [
      {
        position: 'A',
        title: 'Juicy Fruit (Vocal)',
        duration: '5:55',
        type_: 'track',
      },
      {
        position: 'B',
        title: 'Juicy Fruit ("Fruity" Instrumental Mix)',
        duration: '7:04',
        type_: 'track',
      },
    ],
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

  it('does not move provenance.verifiedAt on a skip-match Discogs-ok refresh with zero MusicBrainz calls', async () => {
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
    const secondMb = createMusicBrainzClientForTests()
    const result = await enrichPressing(573292, {
      store,
      now: () => secondNow,
      fetchDiscogs: async () => bootsyDetail(),
      mb: secondMb,
    })
    assert.equal(secondMb.requestCount, 0)
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
    const mb = createMusicBrainzClientForTests()
    mb.lookupDiscogsReleaseUrl = async () => []
    for (let i = 0; i < DEADLINE_STOP_LIMIT; i += 1) {
      const result = await processEnrichmentQueue(
        {
          store,
          now: () => clock,
          deadlineMs: i === 0 ? clock + ENRICH_TAKE_FLOOR_MS + 1 : clock + 100,
          takeFloorMs: 0,
          fetchDiscogs: async () => {
            discogsCalls += 1
            clock += ENRICH_TAKE_FLOOR_MS + 5_000
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
        takeFloorMs: 0,
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
    assert.equal(queued?.score, clock + deadlineBackoffMs(1))
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
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/oauth/identity')) {
        return new Response('{"message":"invalid token"}', { status: 401 })
      }
      return originalFetch(input)
    }) as typeof fetch
    try {
      const result = await runCrateProof(store, 'auth')
      assert.equal(result.workerStoppedOnAuth, true)
      assert.equal(result.lastErrorKind, 'auth')
      assert.equal(result.attempts, 0)
      assert.equal((result.identity as { classified?: string }).classified, 'auth')
      assert.deepEqual(await store.getQueue(), [10045228, 1026558])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('parses proof actions and rejects unknown ones', () => {
    assert.equal(parseProofAction('overlap'), 'overlap')
    assert.equal(parseProofAction('cleanup'), 'cleanup')
    assert.equal(parseProofAction('nope'), null)
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

describe('visit enqueue is listed-only, throttled, and not front', () => {
  it('does not enqueue an unlisted id', async () => {
    const store = createMemoryCrateStore()
    const result = await visitEnqueueIfListed(store, 1, false, true)
    assert.deepEqual(result, { enqueued: false, throttled: false })
    assert.deepEqual(await store.getQueue(), [])
  })

  it('enqueues a listed id at the back and throttles the next visit', async () => {
    const store = createMemoryCrateStore({ now: () => 1_000 })
    const first = await visitEnqueueIfListed(store, 573292, true, true)
    assert.equal(first.enqueued, true)
    assert.deepEqual(await store.getQueue(), [573292])
    const row = store.queue.find((item) => item.id === 573292)
    assert.ok(row && row.score !== 0)
    const second = await visitEnqueueIfListed(store, 240128, true, true)
    assert.deepEqual(second, { enqueued: false, throttled: true })
    assert.deepEqual(await store.getQueue(), [573292])
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

