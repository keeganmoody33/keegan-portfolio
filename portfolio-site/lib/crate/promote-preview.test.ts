/**
 * Promote-preview copy tool: dry-run is a no-op, version/duration gates hold,
 * rollback restores the exact JSON bytes.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { INCOMPLETE_RECORDING_MESSAGE, TRACK_LEVEL_REASON } from './enrich.ts'
import { DURATION_SIDECAR_MS } from './match.ts'
import {
  GAP_RELEASE_IDS,
  JUICY_MBID,
  MB_SAMPLES_MATERIAL_REL_ID,
  MTUME_VOCAL_MBID,
  UNKNOWN_LENGTH_AUDIT_MBIDS,
  PromoteApplyError,
  assertProdPromoteKey,
  assertPromotePrefixes,
  assertPromoteProdAllowed,
  assertUpstashMultiResults,
  countPressingMapLinks,
  filterPreviewSampleLinks,
  isPromoteSidecarMatch,
  memoryPromoteRawStore,
  parsePromoteArgs,
  promoteRollbackCommand,
  recallSameSongOrVersion,
  restoreCommandsForEntry,
  runPromotePreview,
  runWatchedPromoteCommands,
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

const APPLY = { apply: true as const, allowProd: true, runId: 'qa-test-run' }

describe('promote-preview args and prefixes', () => {
  it('defaults to dry-run and parses --apply / --rollback / --backup / --prod / --run-id', () => {
    assert.deepEqual(parsePromoteArgs([]), { apply: false, prod: false })
    const applied = parsePromoteArgs([
      '--apply',
      '--prod',
      '--backup=/tmp/x.json',
      '--run-id=qa-test-run',
    ])
    assert.equal(applied.apply, true)
    assert.equal(applied.prod, true)
    assert.equal(applied.backupPath, '/tmp/x.json')
    assert.equal(applied.runId, 'qa-test-run')
    assert.equal(
      parsePromoteArgs(['--rollback', '/tmp/backup.json', '--prod', '--run-id=qa-test-run'])
        .rollbackPath,
      '/tmp/backup.json'
    )
    assert.throws(() => parsePromoteArgs(['--apply']))
    assert.throws(() => parsePromoteArgs(['--apply', '--backup=/tmp/x.json']))
    assert.throws(() => parsePromoteArgs(['--apply', '--prod', '--backup=/tmp/x.json']))
    assert.throws(() => parsePromoteArgs(['--rollback', 'x.json']))
    assert.throws(() => parsePromoteArgs(['--apply', '--rollback', 'x.json']))
  })

  it('validates --ids= against the closed 23-id list with strict integer parsing', () => {
    assert.throws(() => parsePromoteArgs(['--ids=567894oops']), /567894oops/)
    assert.throws(() => parsePromoteArgs(['--ids=567894']), /closed 23/)
    assert.throws(() => parsePromoteArgs(['--ids=378994,567894oops']), /567894oops/)
    assert.deepEqual(parsePromoteArgs(['--ids=378994']).ids, [378994])
    assert.deepEqual(parsePromoteArgs(['--ids=378994,903960']).ids, [378994, 903960])
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
      ...APPLY,
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
      ...APPLY,
      backupPath,
      raw,
    })
    assert.equal(applied.wrote, true)
    assert.equal(applied.mode, 'apply')
    assert.ok(prod.pressings[RELEASE_ID]?.recordings[sampled.mbid])
    assert.notEqual(JSON.stringify(prod.pressings[RELEASE_ID]), beforePressing)
    const snapshot = JSON.parse(readFileSync(backupPath, 'utf8')) as {
      runId: string
      prefix: string
      keys: Array<{ key: string; type: string; pttl: number; dump: string | null }>
    }
    assert.equal(snapshot.runId, APPLY.runId)
    assert.equal(snapshot.prefix, 'lf:')
    assert.ok(
      snapshot.keys.some(
        (entry) => entry.key === `lf:crate:pressing:${RELEASE_ID}:v1` && entry.dump === beforePressing
      )
    )
    const rolled = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
      rollbackPath: backupPath,
      allowProd: true,
      runId: APPLY.runId,
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
          ...APPLY,
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
          ...APPLY,
          backupPath,
          raw,
        }),
      (error: unknown) => {
        assert.equal(error instanceof PromoteApplyError, true)
        const applyError = error as PromoteApplyError
        assert.equal(applyError.backupPath, backupPath)
        assert.equal(applyError.rollbackCommand, promoteRollbackCommand(backupPath, APPLY.runId))
        return true
      }
    )
  })
})

describe('QA gate: alreadyOnMap still requires sidecar match', () => {
  it('does not copy Clubstar onto Cha-Cha 378994 Radio Edit when that MBID is already on the prod map', async () => {
    const chacha = 378994
    const clubstar = completeRecording({
      mbid: '67350ade-clubstar',
      title: 'Cha Cha Slide (Clubstar Remix)',
      artist: 'DJ Casper',
      sampledIn: [sampleLink('Later hit', 'hit-1')],
    })
    const prodPressing = pressingOf(
      { [clubstar.mbid]: clubstar },
      [{ position: 'B1', title: 'Cha-Cha Slide (Radio Edit)', durationMs: 200000 }],
      chacha
    )
    prodPressing.facts.title = 'Cha-Cha Slide'
    prodPressing.facts.artist = 'DJ Casper'
    const previewPressing = pressingOf(
      { [clubstar.mbid]: clubstar },
      [{ position: 'B1', title: 'Cha-Cha Slide (Radio Edit)', durationMs: 200000, mbid: clubstar.mbid }],
      chacha
    )
    previewPressing.facts.title = 'Cha-Cha Slide'
    previewPressing.facts.artist = 'DJ Casper'
    const prod = createMemoryCrateStore({
      pressings: { [chacha]: prodPressing },
      recordings: { [clubstar.mbid]: clubstar },
      seen: [chacha],
    })
    const preview = createMemoryCrateStore({
      pressings: { [chacha]: previewPressing },
      recordings: { [clubstar.mbid]: clubstar },
      seen: [chacha],
    })
    const before = JSON.stringify(prod.pressings[chacha])
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [chacha],
    })
    assert.equal(report.wrote, false)
    assert.equal(report.keys.length, 0)
    assert.equal(report.records[0]?.copies.length, 0)
    assert.equal(report.records[0]?.skips[0]?.reason, 'no matching prod track')
    assert.equal(
      report.keys.includes(`lf:crate:recording:${clubstar.mbid}:v1`),
      false
    )
    assert.equal(JSON.stringify(prod.pressings[chacha]), before)
  })

  it('recording keys are the planned copy MBIDs, not every preview map MBID', async () => {
    const extra = completeRecording({
      mbid: 'preview-map-extra',
      title: 'Unrelated Sidecar',
      sampledIn: [sampleLink('Later', 'later-1')],
    })
    const sampled = completeRecording({ mbid: 'planned-copy', title: 'Strutter' })
    const prod = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({}, [{ position: 'A1', title: 'Strutter', durationMs: 180000 }]),
      },
      seen: [RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf(
          { [sampled.mbid]: sampled, [extra.mbid]: extra },
          [
            { position: 'A1', title: 'Strutter', durationMs: 180000, mbid: sampled.mbid },
            { position: 'A2', title: 'Unrelated Sidecar', durationMs: 180000, mbid: extra.mbid },
          ]
        ),
      },
      recordings: { [sampled.mbid]: sampled, [extra.mbid]: extra },
      seen: [RELEASE_ID],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
    })
    assert.equal(report.keys.includes(`lf:crate:recording:${sampled.mbid}:v1`), true)
    assert.equal(report.keys.includes(`lf:crate:recording:${extra.mbid}:v1`), false)
    assert.equal(
      report.records[0]?.copies.every((copy) => copy.mbid === sampled.mbid),
      true
    )
  })
})

describe('QA gate: write-site prefix and --prod', () => {
  it('assertPrefixedRedisKey / assertProdPromoteKey reject lf:preview: on the prod write site', () => {
    assert.equal(assertProdPromoteKey('lf:crate:recording:abcd:v1'), 'lf:crate:recording:abcd:v1')
    assert.throws(() => assertProdPromoteKey('lf:preview:crate:recording:abcd:v1'), /preview/)
    assert.throws(() => assertProdPromoteKey('other:crate:recording:abcd:v1'))
    assert.throws(() => assertPromoteProdAllowed({ env: PROD_ENV }), /pass --prod/)
    assert.doesNotThrow(() => assertPromoteProdAllowed({ prod: true, env: PROD_ENV }))
  })

  it('apply and rollback refuse prod writes without --prod', async () => {
    const sampled = completeRecording({ mbid: 'prod-guard', title: 'Strutter' })
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
    const raw = memoryPromoteRawStore(prod, PROD_ENV)
    await assert.rejects(
      () =>
        runPromotePreview({
          prod,
          preview,
          prodEnv: PROD_ENV,
          previewEnv: PREVIEW_ENV,
          ids: [RELEASE_ID],
          apply: true,
          runId: 'no-prod',
          backupPath: join(mkdtempSync(join(tmpdir(), 'crate-promote-')), 'backup.json'),
          raw,
        }),
      /pass --prod/
    )
    await assert.rejects(
      () =>
        runPromotePreview({
          prod,
          preview,
          prodEnv: PROD_ENV,
          previewEnv: PREVIEW_ENV,
          rollbackPath: join(mkdtempSync(join(tmpdir(), 'crate-promote-')), 'missing.json'),
          runId: 'no-prod',
          raw,
        }),
      /pass --prod/
    )
  })

  it('rollback SET/DEL refuse lf:preview: keys even when the snapshot claims lf:', async () => {
    const sampled = completeRecording({ mbid: 'prefix-rollback', title: 'Strutter' })
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
    const raw = memoryPromoteRawStore(prod, PROD_ENV)
    const backupPath = join(mkdtempSync(join(tmpdir(), 'crate-promote-')), 'backup.json')
    writeFileSync(
      backupPath,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        runId: APPLY.runId,
        prefix: 'lf:',
        keys: [
          {
            key: 'lf:preview:crate:recording:sneak:v1',
            type: 'string',
            pttl: -1,
            dump: '{}',
          },
        ],
      })
    )
    await assert.rejects(
      () =>
        runPromotePreview({
          prod,
          preview,
          prodEnv: PROD_ENV,
          previewEnv: PREVIEW_ENV,
          rollbackPath: backupPath,
          allowProd: true,
          runId: APPLY.runId,
          raw,
        }),
      /preview/
    )
  })
})

describe('QA gate: TTL-preserving snapshot rollback', () => {
  it('rollback restores DUMP bytes and PTTL', async () => {
    const sampled = completeRecording({ mbid: 'ttl-copy', title: 'Strutter' })
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
    const raw = memoryPromoteRawStore(prod, PROD_ENV)
    const pressingKey = `lf:crate:pressing:${RELEASE_ID}:v1`
    await raw.setRaw(pressingKey, JSON.stringify(prodPressing), 60_000)
    assert.equal(await raw.typeOf(pressingKey), 'string')
    const beforeTtl = await raw.pttl(pressingKey)
    assert.ok(beforeTtl > 50_000 && beforeTtl <= 60_000)
    const beforeDump = await raw.dumpKey(pressingKey)
    const backupPath = join(mkdtempSync(join(tmpdir(), 'crate-promote-')), 'backup.json')
    await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
      ...APPLY,
      backupPath,
      raw,
    })
    assert.ok(prod.pressings[RELEASE_ID]?.recordings[sampled.mbid])
    await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      rollbackPath: backupPath,
      allowProd: true,
      runId: APPLY.runId,
      raw,
    })
    assert.equal(await raw.dumpKey(pressingKey), beforeDump)
    const restoredTtl = await raw.pttl(pressingKey)
    assert.ok(restoredTtl > 45_000 && restoredTtl <= 60_000, `restored pttl ${restoredTtl}`)
    assert.equal(prod.pressings[RELEASE_ID]?.recordings[sampled.mbid], undefined)
  })

  it('rollback requires a matching --run-id and exact lf: prefix', async () => {
    const sampled = completeRecording({ mbid: 'runid-copy', title: 'Strutter' })
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
    const raw = memoryPromoteRawStore(prod, PROD_ENV)
    const backupPath = join(mkdtempSync(join(tmpdir(), 'crate-promote-')), 'backup.json')
    await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
      ...APPLY,
      backupPath,
      raw,
    })
    await assert.rejects(
      () =>
        runPromotePreview({
          prod,
          preview,
          prodEnv: PROD_ENV,
          previewEnv: PREVIEW_ENV,
          rollbackPath: backupPath,
          allowProd: true,
          raw,
        }),
      /run-id/
    )
    await assert.rejects(
      () =>
        runPromotePreview({
          prod,
          preview,
          prodEnv: PROD_ENV,
          previewEnv: PREVIEW_ENV,
          rollbackPath: backupPath,
          allowProd: true,
          runId: 'other-run',
          raw,
        }),
      /run-id/
    )
  })
})

describe('Integrations: live/studio pairing and dest-release', () => {
  const liveHth = 'e144dd90-9720-4117-b695-9382008defa4'
  const debutDiamond = '6e4909b0-49b2-454b-89e6-8b83f1114b4a'
  const remixDiamond = '3fcae502-4191-4b3f-abb7-c6ffb8e2abf1'
  const aliveId = 3221873

  it('maps e144dd90 onto Alive! A4 and not Double Platinum B4', async () => {
    const live = completeRecording({
      mbid: liveHth,
      title: 'Hotter Than Hell',
      lengthMs: 209933,
      sampledIn: [sampleLink('Passion (radio edit)', 'passion-radio')],
    })
    const prodAlive = pressingOf(
      {},
      [{ position: 'A4', title: 'Hotter Than Hell', durationMs: 210000 }],
      aliveId
    )
    prodAlive.facts.title = 'Alive!'
    prodAlive.facts.artist = 'Kiss'
    const prodDp = pressingOf({}, [{ position: 'B4', title: 'Hotter Than Hell', durationMs: 210000 }])
    const previewAlive = pressingOf(
      { [live.mbid]: live },
      [{ position: 'A4', title: 'Hotter Than Hell', durationMs: 210000, mbid: live.mbid }],
      aliveId
    )
    previewAlive.facts.title = 'Alive!'
    previewAlive.facts.artist = 'Kiss'
    const previewDp = pressingOf(
      { [live.mbid]: live },
      [{ position: 'B4', title: 'Hotter Than Hell', durationMs: 210000, mbid: live.mbid }]
    )
    const prod = createMemoryCrateStore({
      pressings: { [aliveId]: prodAlive, [RELEASE_ID]: prodDp },
      seen: [aliveId, RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: { [aliveId]: previewAlive, [RELEASE_ID]: previewDp },
      recordings: { [live.mbid]: live },
      seen: [aliveId, RELEASE_ID],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [aliveId, RELEASE_ID],
      verifyRecording: async () => ({
        lengthMs: 209933,
        samplesFrom: new Set(),
        sampledIn: new Set(['passion-radio']),
        disambiguation: 'live, 1975',
        live: true,
        releaseTitles: ['Alive!', 'KISS Alive! 1975–2000'],
      }),
    })
    const aliveRow = report.records.find((row) => row.releaseId === aliveId)
    const dpRow = report.records.find((row) => row.releaseId === RELEASE_ID)
    assert.equal(aliveRow?.copies.some((copy) => copy.mbid === liveHth), true)
    assert.equal(
      aliveRow?.copies.find((copy) => copy.mbid === liveHth)?.matchedTracks[0]?.position,
      'A4'
    )
    assert.equal(dpRow?.copies.some((copy) => copy.mbid === liveHth), false)
    assert.equal(
      dpRow?.skips.some(
        (skip) => skip.mbid === liveHth && skip.reason === 'live recording on studio dest'
      ),
      true
    )
  })

  it('drops 6e4909b0 on Double Platinum D5 while 3fcae502 may stay', async () => {
    const debut = completeRecording({
      mbid: debutDiamond,
      title: 'Black Diamond',
      lengthMs: null,
      sampledIn: [sampleLink('Out on the Street', 'out-street')],
    })
    const remix = completeRecording({
      mbid: remixDiamond,
      title: 'Black Diamond',
      lengthMs: 255240,
      sampledIn: [sampleLink('Later', 'later-1')],
    })
    const prodPressing = pressingOf(
      { [remix.mbid]: remix },
      [{ position: 'D5', title: 'Black Diamond', durationMs: 255000 }]
    )
    const previewPressing = pressingOf(
      { [debut.mbid]: debut, [remix.mbid]: remix },
      [
        { position: 'D5', title: 'Black Diamond', durationMs: 255000, mbid: remix.mbid },
      ]
    )
    const prod = createMemoryCrateStore({
      pressings: { [RELEASE_ID]: prodPressing },
      recordings: { [remix.mbid]: remix },
      seen: [RELEASE_ID],
    })
    const preview = createMemoryCrateStore({
      pressings: { [RELEASE_ID]: previewPressing },
      recordings: { [debut.mbid]: debut, [remix.mbid]: remix },
      seen: [RELEASE_ID],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [RELEASE_ID],
      verifyRecording: async (mbid) => {
        if (mbid === debutDiamond) {
          return {
            lengthMs: 312920,
            samplesFrom: new Set(),
            sampledIn: new Set(['out-street']),
            disambiguation: '',
            live: false,
            releaseTitles: ['KISS', 'The Originals'],
          }
        }
        return {
          lengthMs: 255240,
          samplesFrom: new Set(),
          sampledIn: new Set(['later-1']),
          disambiguation: '1978 remix',
          live: false,
          releaseTitles: ['Double Platinum'],
        }
      },
    })
    assert.equal(
      report.records[0]?.skips.some(
        (skip) => skip.mbid === debutDiamond && skip.reason === 'recording not on dest release'
      ),
      true
    )
    assert.equal(report.records[0]?.copies.some((copy) => copy.mbid === debutDiamond), false)
  })

  it('does not dest-release-skip a sampled sidecar when the mapped same-song pick has no samples', async () => {
    const emptyPick = '2d2752c8-empty-pick-same-song-no-samples'
    const sampledSidecar = '9cb859c8-284d-4433-8a3a-6f083533e004'
    const pick = completeRecording({
      mbid: emptyPick,
      title: 'Props Over Here',
      artist: 'The Beatnuts',
      lengthMs: 180000,
      samplesFrom: [],
      sampledIn: [],
    })
    const sidecar = completeRecording({
      mbid: sampledSidecar,
      title: 'Props Over Here',
      artist: 'The Beatnuts',
      lengthMs: 181000,
      sampledIn: [sampleLink('Watch Out Now', 'watch-out-now')],
    })
    const prodPressing = pressingOf(
      { [pick.mbid]: pick },
      [{ position: 'A2', title: 'Props Over Here', durationMs: 180000, mbid: pick.mbid }],
      1679157
    )
    prodPressing.facts.title = 'The Beatnuts'
    prodPressing.facts.artist = 'The Beatnuts'
    const previewPressing = pressingOf(
      { [pick.mbid]: pick, [sidecar.mbid]: sidecar },
      [{ position: 'A2', title: 'Props Over Here', durationMs: 180000, mbid: pick.mbid }],
      1679157
    )
    previewPressing.facts.title = 'The Beatnuts'
    previewPressing.facts.artist = 'The Beatnuts'
    const prod = createMemoryCrateStore({
      pressings: { [1679157]: prodPressing },
      recordings: { [pick.mbid]: pick },
      seen: [1679157],
    })
    const preview = createMemoryCrateStore({
      pressings: { [1679157]: previewPressing },
      recordings: { [pick.mbid]: pick, [sidecar.mbid]: sidecar },
      seen: [1679157],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [1679157],
      verifyRecording: async (mbid) => {
        if (mbid === sampledSidecar) {
          return {
            lengthMs: 181000,
            samplesFrom: new Set(),
            sampledIn: new Set(['watch-out-now']),
            live: false,
            releaseTitles: ['The Verbal Massacre'],
          }
        }
        return {
          lengthMs: 180000,
          samplesFrom: new Set(),
          sampledIn: new Set(),
          live: false,
          releaseTitles: ['The Beatnuts'],
        }
      },
    })
    assert.equal(
      report.records[0]?.skips.some(
        (skip) => skip.mbid === sampledSidecar && skip.reason === 'recording not on dest release'
      ),
      false
    )
    assert.equal(report.records[0]?.copies.some((copy) => copy.mbid === sampledSidecar), true)
  })
})

describe('QA fold: WATCH CAS, rollback refuse, multi errors, recall', () => {
  it('assertUpstashMultiResults scans per-command errors', () => {
    assert.deepEqual(assertUpstashMultiResults({ result: ['OK', 'OK'] }), ['OK', 'OK'])
    assert.throws(
      () => assertUpstashMultiResults({ result: [{ error: 'WRONGTYPE' }] }),
      /command 0 failed: WRONGTYPE/
    )
    assert.throws(
      () => assertUpstashMultiResults({ result: [['ERR boom', null]] }),
      /command 0 failed: ERR boom/
    )
  })

  it('rollback refuses DEL of a non-string type with a null dump', () => {
    assert.throws(
      () =>
        restoreCommandsForEntry({
          key: 'lf:crate:recording:hash-key:v1',
          type: 'hash',
          pttl: -1,
          dump: null,
        }),
      /refusing rollback DEL of hash/
    )
    const gone = restoreCommandsForEntry({
      key: 'lf:crate:recording:missing:v1',
      type: 'none',
      pttl: -2,
      dump: null,
    })
    assert.deepEqual(gone, [['DEL', 'lf:crate:recording:missing:v1']])
  })

  it('WATCH-equivalent CAS aborts when a snapshot key changed', async () => {
    const sampled = completeRecording({ mbid: 'watch-copy', title: 'Strutter' })
    const prod = createMemoryCrateStore({
      pressings: {
        [RELEASE_ID]: pressingOf({}, [{ position: 'A1', title: 'Strutter', durationMs: 180000 }]),
      },
      seen: [RELEASE_ID],
    })
    const raw = memoryPromoteRawStore(prod, PROD_ENV)
    const key = `lf:crate:pressing:${RELEASE_ID}:v1`
    const expected = await raw.dumpKey(key)
    const mutated = JSON.parse(expected ?? '{}') as StoredPressing
    mutated.description = 'changed after snapshot'
    await raw.setRaw(key, JSON.stringify(mutated))
    await assert.rejects(
      () =>
        runWatchedPromoteCommands(raw, [key], [['SET', key, '{"changed":true}']], [expected]),
      /watched key changed/
    )
  })

  it('restores a recall row when the inverse samples rel is on a same-song sibling', async () => {
    assert.equal(
      recallSameSongOrVersion({ title: 'Pastime Paradise' }, { title: 'Pastime Paradise' }),
      true
    )
    const sourceMbid = 'd2637c43-cb52-419a-9a6d-3e1fa1b9be30'
    const targetMbid = '2f7a6735-2e09-4ce2-81e4-b148e6c39a55'
    const siblingMbid = 'e97bedfc-b0ee-4cb6-8343-03a714caab15'
    const releaseId = 266650
    const pastime = completeRecording({
      mbid: sourceMbid,
      title: 'Pastime Paradise',
      artist: 'Stevie Wonder',
      lengthMs: 200000,
      sampledIn: [sampleLink("Gangsta's Paradise", targetMbid)],
    })
    const prodPressing = pressingOf(
      {},
      [{ position: 'A1', title: 'Pastime Paradise', durationMs: 200000 }],
      releaseId
    )
    prodPressing.facts.title = 'Songs in the Key of Life'
    prodPressing.facts.artist = 'Stevie Wonder'
    const previewPressing = pressingOf(
      { [pastime.mbid]: pastime },
      [{ position: 'A1', title: 'Pastime Paradise', durationMs: 200000, mbid: pastime.mbid }],
      releaseId
    )
    previewPressing.facts.title = 'Songs in the Key of Life'
    previewPressing.facts.artist = 'Stevie Wonder'
    const prod = createMemoryCrateStore({
      pressings: { [releaseId]: prodPressing },
      seen: [releaseId],
    })
    const preview = createMemoryCrateStore({
      pressings: { [releaseId]: previewPressing },
      recordings: { [pastime.mbid]: pastime },
      seen: [releaseId],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [releaseId],
      verifyRecording: async (mbid) => {
        if (mbid === sourceMbid) {
          return {
            lengthMs: 200000,
            samplesFrom: new Set(),
            sampledIn: new Set(),
            live: false,
            releaseTitles: ['Magic Soul'],
          }
        }
        return {
          lengthMs: 241306,
          samplesFrom: new Set([siblingMbid]),
          sampledIn: new Set(),
          samplesFromLinks: [sampleLink('Pastime Paradise', siblingMbid)],
          relIds: new Map([[siblingMbid, MB_SAMPLES_MATERIAL_REL_ID]]),
          live: false,
          releaseTitles: ['Gangsta’s Paradise'],
        }
      },
    })
    const recalled = report.recallReview.find((row) => row.targetMbid === targetMbid)
    assert.equal(recalled?.status, 'restored')
    assert.equal(recalled?.relId, MB_SAMPLES_MATERIAL_REL_ID)
    assert.equal(recalled?.siblingMbid, siblingMbid)
    assert.equal(
      report.records[0]?.copies.some((copy) =>
        copy.addedLinks.some((link) => link.mbid === targetMbid)
      ),
      true
    )
    assert.equal(
      report.droppedLinks.some((drop) => drop.mbid === targetMbid && drop.reason === 'not on source recording'),
      false
    )
  })

  it('grafts a restored recall link onto an already-mapped same-song dest recording', async () => {
    const sourceMbid = 'd2637c43-cb52-419a-9a6d-3e1fa1b9be30'
    const targetMbid = '2f7a6735-2e09-4ce2-81e4-b148e6c39a55'
    const siblingMbid = 'e97bedfc-b0ee-4cb6-8343-03a714caab15'
    const releaseId = 266650
    const mapped = completeRecording({
      mbid: siblingMbid,
      title: 'Pastime Paradise',
      artist: 'Stevie Wonder',
      lengthMs: 207693,
    })
    const offRelease = completeRecording({
      mbid: sourceMbid,
      title: 'Pastime Paradise',
      artist: 'Stevie Wonder',
      lengthMs: null,
      sampledIn: [sampleLink("Gangsta's Paradise", targetMbid)],
    })
    const prodPressing = pressingOf(
      { [mapped.mbid]: mapped },
      [{ position: 'A1', title: 'Pastime Paradise', durationMs: 207000 }],
      releaseId
    )
    prodPressing.facts.title = 'Songs in the Key of Life'
    prodPressing.facts.artist = 'Stevie Wonder'
    const previewPressing = pressingOf(
      { [offRelease.mbid]: offRelease, [mapped.mbid]: mapped },
      [{ position: 'A1', title: 'Pastime Paradise', durationMs: 207000, mbid: mapped.mbid }],
      releaseId
    )
    previewPressing.facts.title = 'Songs in the Key of Life'
    previewPressing.facts.artist = 'Stevie Wonder'
    const prod = createMemoryCrateStore({
      pressings: { [releaseId]: prodPressing },
      recordings: { [mapped.mbid]: mapped },
      seen: [releaseId],
    })
    const preview = createMemoryCrateStore({
      pressings: { [releaseId]: previewPressing },
      recordings: { [offRelease.mbid]: offRelease, [mapped.mbid]: mapped },
      seen: [releaseId],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [releaseId],
      verifyRecording: async (mbid) => {
        if (mbid === sourceMbid) {
          return {
            lengthMs: 200000,
            samplesFrom: new Set(),
            sampledIn: new Set(),
            live: false,
            releaseTitles: ['Magic Soul'],
          }
        }
        if (mbid === siblingMbid) {
          return {
            lengthMs: 207693,
            samplesFrom: new Set(),
            sampledIn: new Set(),
            live: false,
            releaseTitles: ['Songs in the Key of Life'],
          }
        }
        return {
          lengthMs: 241306,
          samplesFrom: new Set([siblingMbid]),
          sampledIn: new Set(),
          samplesFromLinks: [sampleLink('Pastime Paradise', siblingMbid)],
          relIds: new Map([[siblingMbid, MB_SAMPLES_MATERIAL_REL_ID]]),
          live: false,
          releaseTitles: ['Gangsta’s Paradise'],
        }
      },
    })
    assert.equal(report.recallReview[0]?.status, 'restored')
    assert.equal(
      report.records[0]?.skips.some(
        (skip) => skip.mbid === sourceMbid && skip.reason === 'recording not on dest release'
      ),
      true
    )
    assert.equal(
      report.records[0]?.copies.some(
        (copy) =>
          copy.mbid === siblingMbid && copy.addedLinks.some((link) => link.mbid === targetMbid)
      ),
      true
    )
  })

  it('confirms false when the target has no same-song samples rel', async () => {
    const sourceMbid = 'd2637c43-cb52-419a-9a6d-3e1fa1b9be30'
    const targetMbid = '2f7a6735-2e09-4ce2-81e4-b148e6c39a55'
    const releaseId = 266650
    const pastime = completeRecording({
      mbid: sourceMbid,
      title: 'Pastime Paradise',
      artist: 'Stevie Wonder',
      lengthMs: 200000,
      sampledIn: [sampleLink("Gangsta's Paradise", targetMbid)],
    })
    const prodPressing = pressingOf(
      {},
      [{ position: 'A1', title: 'Pastime Paradise', durationMs: 200000 }],
      releaseId
    )
    prodPressing.facts.title = 'Songs in the Key of Life'
    prodPressing.facts.artist = 'Stevie Wonder'
    const previewPressing = pressingOf(
      { [pastime.mbid]: pastime },
      [{ position: 'A1', title: 'Pastime Paradise', durationMs: 200000, mbid: pastime.mbid }],
      releaseId
    )
    previewPressing.facts.title = 'Songs in the Key of Life'
    previewPressing.facts.artist = 'Stevie Wonder'
    const prod = createMemoryCrateStore({
      pressings: { [releaseId]: prodPressing },
      seen: [releaseId],
    })
    const preview = createMemoryCrateStore({
      pressings: { [releaseId]: previewPressing },
      recordings: { [pastime.mbid]: pastime },
      seen: [releaseId],
    })
    const report = await runPromotePreview({
      prod,
      preview,
      prodEnv: PROD_ENV,
      previewEnv: PREVIEW_ENV,
      ids: [releaseId],
      verifyRecording: async () => ({
        lengthMs: 200000,
        samplesFrom: new Set(),
        sampledIn: new Set(),
        samplesFromLinks: [],
        sampledInLinks: [],
        live: false,
        releaseTitles: ['Magic Soul'],
      }),
    })
    assert.equal(report.recallReview[0]?.status, 'confirmed_false')
    assert.equal(report.recallReview[0]?.relId, null)
    assert.equal(
      report.droppedLinks.some((drop) => drop.mbid === targetMbid && drop.reason === 'not on source recording'),
      true
    )
  })
})

function countRecordingLinksFor(recording: StoredRecording): number {
  return countPressingMapLinks(
    pressingOf({ [recording.mbid]: recording }, [{ position: 'A1', title: recording.title, durationMs: 180000 }])
  ).links
}
