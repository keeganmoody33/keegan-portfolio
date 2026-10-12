/**
 * Promote-preview copy tool: dry-run is a no-op, version/duration gates hold,
 * rollback restores the exact JSON bytes.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { INCOMPLETE_RECORDING_MESSAGE, TRACK_LEVEL_REASON } from './enrich.ts'
import { DURATION_SIDECAR_MS } from './match.ts'
import {
  GAP_RELEASE_IDS,
  JUICY_MBID,
  MTUME_VOCAL_MBID,
  UNKNOWN_LENGTH_AUDIT_MBIDS,
  PromoteApplyError,
  assertPromotePrefixes,
  countPressingMapLinks,
  filterPreviewSampleLinks,
  isPromoteSidecarMatch,
  memoryPromoteRawStore,
  parsePromoteArgs,
  promoteRollbackCommand,
  runPromotePreview,
  withPreviewNamespace,
  withProdNamespace,
} from './promote-preview.ts'
import { createMemoryCrateStore } from './store.ts'
import { CRATE_SCHEMA_VERSION, type SampleLink, type StoredPressing, type StoredRecording } from './types.ts'

const PROD_ENV = withProdNamespace({})
const PREVIEW_ENV = withPreviewNamespace({})
const RELEASE_ID = 903960

function sampleLink(title: string, mbid: string): SampleLink {
  return {
    title,
    artist: 'Later',
    mbid,
    sourceUrl: `https://musicbrainz.org/recording/${mbid}`,
    source: 'musicbrainz',
    providerId: mbid,
  }
}

function completeRecording(overrides: Partial<StoredRecording> & Pick<StoredRecording, 'mbid' | 'title'>): StoredRecording {
  return {
    artist: 'Kiss',
    credits: [],
    samplesFrom: [],
    sampledIn: [sampleLink('The Hit', 'hit-1')],
    lengthMs: 180000,
    provenance: {
      sourceUrls: [`https://musicbrainz.org/recording/${overrides.mbid}`],
      matchStatus: 'matched',
      confidence: 0.9,
      reason: TRACK_LEVEL_REASON,
      checkedAt: '2026-10-06T00:00:00.000Z',
      refreshAfter: '2027-04-06T00:00:00.000Z',
      lastError: null,
      verifiedAt: '2026-10-06T00:00:00.000Z',
    },
    ...overrides,
  }
}

function pressingOf(
  recordings: Record<string, StoredRecording>,
  tracks: Array<{ position: string; title: string; durationMs: number | null; mbid?: string | null }>,
  releaseId = RELEASE_ID
): StoredPressing {
  return {
    schemaVersion: CRATE_SCHEMA_VERSION,
    releaseId,
    entryInstanceIds: [1],
    facts: {
      releaseId,
      title: 'Double Platinum',
      artist: 'Kiss',
      label: 'Casablanca',
      catno: 'NBLP 7100',
      format: 'Vinyl, LP, Album',
      country: 'US',
      released: '1978',
      year: 1978,
      cover: '',
      thumbnail: '',
      discogsUrl: `https://www.discogs.com/release/${releaseId}`,
      barcode: null,
    },
    description: null,
    tracks: tracks.map((track, index) => ({
      position: track.position,
      title: track.title,
      duration: null,
      durationMs: track.durationMs,
      index,
      recording: {
        matchStatus: 'matched',
        confidence: 0.9,
        reason: TRACK_LEVEL_REASON,
        mbid: track.mbid ?? null,
        recordingUrl: track.mbid ? `https://musicbrainz.org/recording/${track.mbid}` : null,
      },
    })),
    mbRelease: {
      mbid: 'mb-release',
      url: 'https://musicbrainz.org/release/mb-release',
      matchStatus: 'matched',
      confidence: 0.9,
      reason: 'discogs url',
    },
    recordings,
    provenance: {
      sourceUrls: [`https://www.discogs.com/release/${releaseId}`],
      matchStatus: 'matched',
      confidence: 0.9,
      reason: 'discogs url',
      checkedAt: '2026-10-06T00:00:00.000Z',
      refreshAfter: '2027-04-06T00:00:00.000Z',
      lastError: null,
    },
  }
}

describe('promote-preview args and prefixes', () => {
  it('defaults to dry-run and parses --apply / --rollback / --backup', () => {
    assert.deepEqual(parsePromoteArgs([]), { apply: false })
    assert.equal(parsePromoteArgs(['--apply', '--backup=/tmp/x.json']).apply, true)
    assert.equal(parsePromoteArgs(['--apply', '--backup=/tmp/x.json']).backupPath, '/tmp/x.json')
    assert.equal(parsePromoteArgs(['--rollback', '/tmp/backup.json']).rollbackPath, '/tmp/backup.json')
    assert.throws(() => parsePromoteArgs(['--apply']))
    assert.throws(() => parsePromoteArgs(['--apply', '--rollback', 'x.json']))
  })

  it('asserts lf: and lf:preview:', () => {
    const prefixes = assertPromotePrefixes(PROD_ENV, PREVIEW_ENV)
    assert.equal(prefixes.prodPrefix, 'lf:')
    assert.equal(prefixes.previewPrefix, 'lf:preview:')
    assert.throws(() => assertPromotePrefixes(PREVIEW_ENV, PREVIEW_ENV))
    assert.throws(() => assertPromotePrefixes(PROD_ENV, PROD_ENV))
  })

  it('hardcodes the 23 gap records', () => {
    assert.equal(GAP_RELEASE_IDS.length, 23)
    assert.equal(new Set(GAP_RELEASE_IDS).size, 23)
    assert.equal(GAP_RELEASE_IDS.includes(567894), false)
  })

  it('audits ten unknown-length recording MBIDs', () => {
    assert.equal(UNKNOWN_LENGTH_AUDIT_MBIDS.length, 10)
    assert.equal(new Set(UNKNOWN_LENGTH_AUDIT_MBIDS).size, 10)
  })

  it('uses the live Redis Mtume vocal and Juicy recording MBIDs', () => {
    assert.equal(MTUME_VOCAL_MBID, '1d890c2b-2ba3-4b34-9196-64d5cb0cc0dc')
    assert.equal(JUICY_MBID, '181c0a32-6e3f-4680-8a7d-1daf0b42e43b')
  })
})

describe('promote sidecar match (version + duration)', () => {
  const unmarked = { artist: 'N.E.R.D.', title: "Grindin'", durationMs: 180000 }
  const remixTrack = { artist: 'N.E.R.D.', title: "Grindin' (Remix)", durationMs: 180000 }
  const radioTrack = { artist: 'DJ Casper', title: 'Cha-Cha Slide (Radio Edit)', durationMs: 200000 }

  it('lets an unmarked track take only an unmarked recording', () => {
    assert.equal(
      isPromoteSidecarMatch(unmarked, { title: "Grindin'", artist: 'N.E.R.D.', lengthMs: 180000 }),
      true
    )
    assert.equal(
      isPromoteSidecarMatch(unmarked, {
        title: "Grindin' (Remix)",
        artist: 'N.E.R.D.',
        lengthMs: 180000,
      }),
      false
    )
  })

  it('lets a marked track take the same marker or fall back to the unmarked original', () => {
    assert.equal(
      isPromoteSidecarMatch(remixTrack, {
        title: "Grindin' (Remix)",
        artist: 'N.E.R.D.',
        lengthMs: 180000,
      }),
      true
    )
    assert.equal(
      isPromoteSidecarMatch(remixTrack, { title: "Grindin'", artist: 'N.E.R.D.', lengthMs: 180000 }),
      true
    )
    assert.equal(
      isPromoteSidecarMatch(radioTrack, {
        title: 'Cha Cha Slide (Clubstar Remix)',
        artist: 'DJ Casper',
        lengthMs: 200000,
      }),
      false
    )
    assert.equal(
      isPromoteSidecarMatch(
        { artist: 'Kiss', title: 'Hotter Than Hell (Live)', durationMs: 180000 },
        { title: 'Hotter Than Hell', artist: 'Kiss', lengthMs: 180000 }
      ),
      false
    )
  })

  it('rejects a duration delta over 5s when both lengths are known, and allows unknown', () => {
    assert.equal(
      isPromoteSidecarMatch(unmarked, {
        title: "Grindin'",
        artist: 'N.E.R.D.',
        lengthMs: unmarked.durationMs + DURATION_SIDECAR_MS,
      }),
      true
    )
    assert.equal(
      isPromoteSidecarMatch(unmarked, {
        title: "Grindin'",
        artist: 'N.E.R.D.',
        lengthMs: unmarked.durationMs + DURATION_SIDECAR_MS + 1,
      }),
      false
    )
    assert.equal(
      isPromoteSidecarMatch(unmarked, { title: "Grindin'", artist: 'N.E.R.D.', lengthMs: null }),
      true
    )
  })
})

describe('promote copy plan', () => {
  it('dry-run is a no-op on prod', async () => {
    const sampled = completeRecording({ mbid: 'aaaa-preview', title: 'Strutter' })
    const prodPressing = pressingOf(
      {},
      [{ position: 'A1', title: 'Strutter', durationMs: 180000, mbid: 'prod-pick' }]
    )
    const previewPressing = pressingOf(
      { [sampled.mbid]: sampled },
      [{ position: 'A1', title: 'Strutter', durationMs: 180000, mbid: sampled.mbid }]
    )
    const prod = createMemoryCrateStore({
      pressings: { [RELEASE_ID]: prodPressing },
      seen: [RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: { [RELEASE_ID]: previewPressing },
      recordings: { [sampled.mbid]: sampled },
      seen: [RELEASE_ID],
    })
    const beforePressings = JSON.stringify(prod.pressings)
    const beforeRecordings = JSON.stringify(prod.recordings)
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
    })
    assert.equal(report.mode, 'dry-run')
    assert.equal(report.wrote, false)
    assert.equal(report.keys.includes(`lf:crate:pressing:${RELEASE_ID}:v1`), true)
    assert.equal(report.keys.includes(`lf:crate:recording:${sampled.mbid}:v1`), true)
    assert.equal(report.records[0]?.copies.length, 1)
    assert.equal(JSON.stringify(prod.pressings), beforePressings)
    assert.equal(JSON.stringify(prod.recordings), beforeRecordings)
  })

  it('skips incomplete preview recordings', async () => {
    const incomplete = completeRecording({
      mbid: 'zzzz-incomplete',
      title: 'Strutter',
      provenance: {
        ...completeRecording({ mbid: 'zzzz-incomplete', title: 'Strutter' }).provenance,
        verifiedAt: null,
        lastError: {
          kind: 'unavailable',
          message: INCOMPLETE_RECORDING_MESSAGE,
          attempts: 1,
          at: '2026-10-06T00:00:00.000Z',
        },
      },
    })
    const prod = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({}, [{ position: 'A1', title: 'Strutter', durationMs: 180000 }]),
      },
      seen: [RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({ [incomplete.mbid]: incomplete }, [
          { position: 'A1', title: 'Strutter', durationMs: 180000, mbid: incomplete.mbid },
        ]),
      },
      recordings: { [incomplete.mbid]: incomplete },
      seen: [RELEASE_ID],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
    })
    assert.equal(report.keys.length, 0)
    assert.equal(report.records[0]?.skips[0]?.reason, 'incomplete recording')
  })

  it('never overwrites a complete prod doc that has more sample rels, and merges the map', async () => {
    const keepMbid = 'keep-on-prod'
    const extraSidecar = completeRecording({ mbid: keepMbid, title: 'Detroit Rock City' })
    const shared = completeRecording({
      mbid: 'shared-song',
      title: 'Strutter',
      samplesFrom: [sampleLink('One', 'one'), sampleLink('Two', 'two'), sampleLink('Three', 'three')],
      sampledIn: [],
    })
    const thinnerPreview = completeRecording({
      mbid: 'shared-song',
      title: 'Strutter',
      samplesFrom: [sampleLink('One', 'one')],
      sampledIn: [],
    })
    const prodPressing = pressingOf(
      { [keepMbid]: extraSidecar, [shared.mbid]: shared },
      [{ position: 'A1', title: 'Strutter', durationMs: 180000, mbid: shared.mbid }]
    )
    const previewPressing = pressingOf(
      { [shared.mbid]: thinnerPreview },
      [{ position: 'A1', title: 'Strutter', durationMs: 180000, mbid: shared.mbid }]
    )
    const prod = createMemoryCrateStore({
      pressings: { [RELEASE_ID]: prodPressing },
      recordings: { [keepMbid]: extraSidecar, [shared.mbid]: shared },
      seen: [RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: { [RELEASE_ID]: previewPressing },
      recordings: { [shared.mbid]: thinnerPreview },
      seen: [RELEASE_ID],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
      apply: true,
      backupPath: join(mkdtempSync(join(tmpdir(), 'crate-promote-')), 'backup.json'),
      raw: memoryPromoteRawStore(prod, PROD_ENV),
    })
    assert.equal(report.records[0]?.skips.some((skip) => skip.reason === 'complete prod doc has more sample rels'), true)
    assert.equal(prod.pressings[RELEASE_ID]?.recordings[keepMbid]?.mbid, keepMbid)
    assert.equal(countRecordingLinksFor(prod.pressings[RELEASE_ID]!.recordings[shared.mbid]!), 3)
  })

  it('apply writes then rollback restores the exact bytes', async () => {
    const sampled = completeRecording({
      mbid: 'bbbb-copy',
      title: 'Strutter',
      sampledIn: [sampleLink('Covered', 'cover-1'), sampleLink('Covered 2', 'cover-2')],
    })
    const prodPressing = pressingOf(
      {},
      [{ position: 'A1', title: 'Strutter', durationMs: 180000, mbid: 'prod-pick' }]
    )
    const prod = createMemoryCrateStore({
      pressings: { [RELEASE_ID]: prodPressing },
      seen: [RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({ [sampled.mbid]: sampled }, [
          { position: 'A1', title: 'Strutter', durationMs: 180000, mbid: sampled.mbid },
        ]),
      },
      recordings: { [sampled.mbid]: sampled },
      seen: [RELEASE_ID],
    })
    const beforePressing = JSON.stringify(prod.pressings[RELEASE_ID])
    const beforeRecordings = JSON.stringify(prod.recordings)
    const backupPath = join(mkdtempSync(join(tmpdir(), 'crate-promote-')), 'backup.json')
    const raw = memoryPromoteRawStore(prod, PROD_ENV)
    const applied = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
      apply: true,
      backupPath,
      raw,
    })
    assert.equal(applied.wrote, true)
    assert.equal(applied.mode, 'apply')
    assert.ok(prod.pressings[RELEASE_ID]?.recordings[sampled.mbid])
    assert.notEqual(JSON.stringify(prod.pressings[RELEASE_ID]), beforePressing)
    const snapshot = JSON.parse(readFileSync(backupPath, 'utf8')) as { keys: Array<{ key: string; value: string | null }> }
    assert.ok(snapshot.keys.some((entry) => entry.key === `lf:crate:pressing:${RELEASE_ID}:v1` && entry.value === beforePressing))
    const rolled = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
      rollbackPath: backupPath,
      raw,
    })
    assert.equal(rolled.mode, 'rollback')
    assert.equal(JSON.stringify(prod.pressings[RELEASE_ID]), beforePressing)
    assert.equal(JSON.stringify(prod.recordings), beforeRecordings)
  })

  it('drops sample links that are not on the source recording', async () => {
    const hotter = completeRecording({
      mbid: '33bcd7f3-hth',
      title: 'Hotter Than Hell',
      sampledIn: [
        sampleLink('Passion (radio edit)', 'passion-radio'),
        sampleLink('The Hit', 'hit-1'),
      ],
    })
    const prod = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({}, [{ position: 'B4', title: 'Hotter Than Hell', durationMs: 180000 }]),
      },
      seen: [RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({ [hotter.mbid]: hotter }, [
          { position: 'B4', title: 'Hotter Than Hell', durationMs: 180000, mbid: hotter.mbid },
        ]),
      },
      recordings: { [hotter.mbid]: hotter },
      seen: [RELEASE_ID],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
      verifyRecording: async () => ({
        lengthMs: 180000,
        samplesFrom: new Set(),
        sampledIn: new Set(['hit-1']),
      }),
    })
    const added = report.records[0]?.copies.flatMap((copy) => copy.addedLinks) ?? []
    assert.equal(added.some((link) => link.mbid === 'passion-radio'), false)
    assert.equal(added.some((link) => link.mbid === 'hit-1'), true)
    assert.equal(report.droppedLinks.some((drop) => drop.mbid === 'passion-radio'), true)
  })

  it('does not map a studio recording onto a live destination', async () => {
    const studio = completeRecording({ mbid: 'studio-hth', title: 'Hotter Than Hell' })
    const liveId = 3221873
    const prod = createMemoryCrateStore({
      pressings: {
        [liveId]: pressingOf(
          {},
          [{ position: 'A1', title: 'Hotter Than Hell', durationMs: 180000 }],
          liveId
        ),
      },
      seen: [liveId],
    })
    prod.pressings[liveId]!.facts.title = 'Alive!'
    prod.pressings[liveId]!.facts.artist = 'Kiss'
    const preview = createMemoryCrateStore({
      pressings: {
        [liveId]: pressingOf(
          { [studio.mbid]: studio },
          [{ position: 'A1', title: 'Hotter Than Hell', durationMs: 180000, mbid: studio.mbid }],
          liveId
        ),
      },
      recordings: { [studio.mbid]: studio },
      seen: [liveId],
    })
    preview.pressings[liveId]!.facts.title = 'Alive!'
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [liveId],
    })
    assert.equal(report.keys.length, 0)
    assert.equal(report.records[0]?.skips[0]?.reason, 'studio recording on live dest')
  })

  it('dedupes sample links by mbid', () => {
    const recording = completeRecording({
      mbid: 'dup-src',
      title: 'Strutter',
      sampledIn: [sampleLink('The Hit', 'hit-1'), sampleLink('The Hit again', 'hit-1')],
    })
    const filtered = filterPreviewSampleLinks(recording, undefined, false)
    assert.equal(filtered.recording.sampledIn.length, 1)
  })

  it('apply refuses when the enrich lock is held', async () => {
    const sampled = completeRecording({ mbid: 'lock-copy', title: 'Strutter' })
    const prod = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({}, [{ position: 'A1', title: 'Strutter', durationMs: 180000 }]),
      },
      seen: [RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({ [sampled.mbid]: sampled }, [
          { position: 'A1', title: 'Strutter', durationMs: 180000, mbid: sampled.mbid },
        ]),
      },
      recordings: { [sampled.mbid]: sampled },
      seen: [RELEASE_ID],
    })
    assert.equal(await prod.acquireEnrichLock(90, 'intruder'), true)
    await assert.rejects(
      () =>
        runPromotePreview({
          prod,
          preview,
          prodEnv: PROD_ENV,
          previewEnv: PREVIEW_ENV,
          ids: [RELEASE_ID],
          apply: true,
          backupPath: join(mkdtempSync(join(tmpdir(), 'crate-promote-')), 'backup.json'),
          raw: memoryPromoteRawStore(prod, PROD_ENV),
        }),
      /enrich lock held/
    )
    assert.equal(prod.pressings[RELEASE_ID]?.recordings[sampled.mbid], undefined)
  })

  it('prints backup path and rollback command when a SET fails', async () => {
    const sampled = completeRecording({ mbid: 'fail-copy', title: 'Strutter' })
    const prod = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({}, [{ position: 'A1', title: 'Strutter', durationMs: 180000 }]),
      },
      seen: [RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({ [sampled.mbid]: sampled }, [
          { position: 'A1', title: 'Strutter', durationMs: 180000, mbid: sampled.mbid },
        ]),
      },
      recordings: { [sampled.mbid]: sampled },
      seen: [RELEASE_ID],
    })
    const backupPath = join(mkdtempSync(join(tmpdir(), 'crate-promote-')), 'backup.json')
    const raw = memoryPromoteRawStore(prod, PROD_ENV)
    const inner = raw.setRaw.bind(raw)
    raw.setRaw = async (key, value) => {
      if (key.includes('crate:recording:')) throw new Error('boom')
      return inner(key, value)
    }
    await assert.rejects(
      () =>
        runPromotePreview({
          prod,
          preview,
          prodEnv: PROD_ENV,
          previewEnv: PREVIEW_ENV,
          ids: [RELEASE_ID],
          apply: true,
          backupPath,
          raw,
        }),
      (error: unknown) => {
        assert.equal(error instanceof PromoteApplyError, true)
        const applyError = error as PromoteApplyError
        assert.equal(applyError.backupPath, backupPath)
        assert.equal(applyError.rollbackCommand, promoteRollbackCommand(backupPath))
        return true
      }
    )
  })
})

function countRecordingLinksFor(recording: StoredRecording): number {
  return countPressingMapLinks(
    pressingOf({ [recording.mbid]: recording }, [{ position: 'A1', title: recording.title, durationMs: 180000 }])
  ).links
}
