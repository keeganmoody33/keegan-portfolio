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
import { keepPriorMatch, nextBackoffMs, preservePressingOnFailure, shouldRefreshPressing } from './preserve.ts'
import { createMemoryCrateStore, INFLIGHT_TTL_SECONDS } from './store.ts'
import { queueNewAndMissing } from './sync.ts'
import { enrichPressing, processEnrichmentQueue, sentencesFrom } from './enrich.ts'
import type { MusicBrainzClient } from './musicbrainz.ts'
import { CRATE_SCHEMA_VERSION, type StoredPressing } from './types.ts'
import { mapRelease, parseDurableCollection } from '../discogs.ts'
import { DiscogsNotFoundError } from '../discogs.ts'
import { fixturePressing, parseReleaseParam, readStoredPressing } from './read.ts'
import { factRows } from './view.ts'
import { cronSecretEqual } from './cron-auth.ts'

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
    assert.equal(normalizePosition('1-1'), '1-1')
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

  it('refreshes when refreshAfter has passed', () => {
    const stale = pressingStub({
      provenance: {
        ...pressingStub().provenance,
        refreshAfter: '2026-01-01T00:00:00.000Z',
      },
    })
    assert.equal(shouldRefreshPressing(stale, Date.parse('2026-10-06T00:00:00.000Z')), true)
    assert.equal(
      shouldRefreshPressing(pressingStub(), Date.parse('2026-10-06T00:00:00.000Z')),
      false
    )
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
})

function createMusicBrainzClientForTests(): MusicBrainzClient {
  return {
    async lookupDiscogsReleaseUrl() {
      return []
    },
    async searchReleaseByBarcode() {
      return []
    },
    async searchReleaseByCatno() {
      return []
    },
    async searchReleaseByArtistTitle() {
      return []
    },
    async getRelease() {
      return null
    },
    async getRecording() {
      return null
    },
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
  it('marks a single barcode hit ambiguous without score and title', () => {
    const result = classifyReleaseMatch([{ mbid: 'mb-1', via: 'barcode', score: 40, title: 'Other' }], {
      title: 'Juicy Fruit',
      trackCount: 2,
    })
    assert.equal(result.matchStatus, 'ambiguous')
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

