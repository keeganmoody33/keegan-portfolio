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
import { preservePressingOnFailure, shouldRefreshPressing } from './preserve.ts'
import { createMemoryCrateStore } from './store.ts'
import { queueNewAndMissing } from './sync.ts'
import { enrichPressing, sentencesFrom } from './enrich.ts'
import type { MusicBrainzClient } from './musicbrainz.ts'
import { CRATE_SCHEMA_VERSION, type StoredPressing } from './types.ts'
import { mapRelease, parseDurableCollection } from '../discogs.ts'
import { fixturePressing, parseReleaseParam, readStoredPressing } from './read.ts'
import { factRows } from './view.ts'

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

  it('leaves a missing pressing missing instead of inventing one', () => {
    const preserved = preservePressingOnFailure(
      null,
      Date.parse('2026-10-06T00:00:00.000Z'),
      'rate_limit',
      'Too many requests'
    )
    assert.equal(preserved, null)
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
    async getRelease() {
      return null
    },
    async getRecording() {
      return null
    },
  }
}
