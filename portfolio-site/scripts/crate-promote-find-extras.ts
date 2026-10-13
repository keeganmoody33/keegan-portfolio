/**
 * Targeted promote of audited FIND extras onto prod lf:.
 *
 * Preview Redis never stored FIND (wrote false). A normal preview→prod promote
 * of 875352 / 2679499 / 12563641 would copy other sidecars. This clones the
 * prod pressings, overlays only the FIND extra recordings, then runs the
 * promote tool. Default is dry-run. --apply requires --prod --backup --run-id.
 *
 *   npm run crate:promote-find-extras
 *   npm run crate:promote-find-extras -- --apply --prod --backup=/tmp/lf-secrets/crate-promote-backup.json --run-id=<id>
 */
import { readFileSync } from 'node:fs'
import {
  createMusicBrainzClient,
  isMusicBrainzTimeoutError,
} from '../lib/crate/musicbrainz.ts'
import {
  FIND_EXTRAS_RELEASE_ID_SET,
  FIND_EXTRAS_RELEASE_IDS,
  countPressingMapLinks,
  createPromoteMbLookup,
  parsePromoteArgs,
  PromoteApplyError,
  runPromotePreview,
  upstashPromoteRawStore,
  withPreviewNamespace,
  withProdNamespace,
  type PromoteReport,
} from '../lib/crate/promote-preview.ts'
import { createMemoryCrateStore, createRedisCrateStore } from '../lib/crate/store.ts'
import { resolveRedisRestConfig } from '../lib/redis-env.ts'
import type { SampleLink, StoredPressing, StoredRecording } from '../lib/crate/types.ts'

const AUDITED = [
  {
    releaseId: 875352,
    extraMbid: '0fe643ce-ed8a-456f-9c90-17fd90ea3da6',
    extraTitle: '3 Card Molly',
    extraLengthMs: 235293,
    sampleOf: [
      {
        title: 'Deja Vu (Uptown Baby)',
        artist: 'Lord Tariq & Peter Gunz',
        mbid: '18c0d98a-6b07-4343-a108-8583344ca71d',
      },
      {
        title: 'Mk II Audio Tour',
        artist: 'Dan Forden',
        mbid: '057a73c0-f72c-4732-834c-521a6ef2c85c',
      },
      {
        title: 'The Windmills of Your Mind',
        artist: 'Petula Clark',
        mbid: '693b15c2-181f-4f96-87b4-14620cd0cf0c',
      },
    ],
    sampledBy: [] as Array<{ title: string; artist: string; mbid: string }>,
  },
  {
    releaseId: 2679499,
    extraMbid: 'dd326523-93b9-4712-919a-9600d00f146c',
    extraTitle: 'Luv Me, Luv Me',
    extraLengthMs: 357533,
    sampleOf: [
      {
        title: 'Impeach the President',
        artist: 'The Honey Drippers',
        mbid: '561c7255-e24e-4f29-a813-a39377163be8',
      },
    ],
    sampledBy: [] as Array<{ title: string; artist: string; mbid: string }>,
  },
  {
    releaseId: 12563641,
    extraMbid: '5663941d-aab2-41da-ab1a-ba3f5e509a64',
    extraTitle: 'Rock That Body',
    extraLengthMs: 268866,
    sampleOf: [
      {
        title: 'It Takes Two',
        artist: 'Rob Base & D.J. E‐Z Rock',
        mbid: '046dcd43-3ae6-4160-a7ba-c658fd327358',
      },
      {
        title: 'Think (About It)',
        artist: 'Lyn Collins',
        mbid: '627d6732-e616-41d8-86cd-69d97c2c4d1d',
      },
    ],
    sampledBy: [] as Array<{ title: string; artist: string; mbid: string }>,
  },
  {
    releaseId: 12563641,
    extraMbid: '72efde9b-88c8-46dd-85d2-2208513bb0fb',
    extraTitle: 'Meet Me Halfway',
    extraLengthMs: 284400,
    sampleOf: [] as Array<{ title: string; artist: string; mbid: string }>,
    sampledBy: [
      {
        title: 'Turrastory',
        artist: 'HELLOLOLA',
        mbid: 'bba1e9d5-436d-44d1-9b23-ace7f2330f63',
      },
    ],
  },
] as const

const ALLOWED_EXTRA_MBIDS = new Set<string>(AUDITED.map((row) => row.extraMbid))
const ALLOWED_LINK_KEYS = new Set<string>(
  AUDITED.flatMap((row) => [
    ...row.sampleOf.map((link) => `sample_of:${link.mbid}`),
    ...row.sampledBy.map((link) => `sampled_by:${link.mbid}`),
  ])
)

function loadProdEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  try {
    for (const line of readFileSync('/tmp/lf-secrets/prod.env', 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 1) continue
      const key = trimmed.slice(0, eq)
      if (env[key]) continue
      let value = trimmed.slice(eq + 1)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch {
    // Fall through to process.env (KV already set).
  }
  return env
}

function mbLink(row: { title: string; artist: string; mbid: string }): SampleLink {
  return {
    title: row.title,
    artist: row.artist,
    mbid: row.mbid,
    sourceUrl: `https://musicbrainz.org/recording/${row.mbid}`,
    source: 'musicbrainz',
    providerId: row.mbid,
  }
}

function recordingHasAuditedLinks(prod: StoredRecording | null, extraMbid: string): boolean {
  if (!prod) return false
  const wanted = AUDITED.filter((row) => row.extraMbid === extraMbid)
  const haveFrom = new Set(prod.samplesFrom.map((link) => link.mbid))
  const haveIn = new Set(prod.sampledIn.map((link) => link.mbid))
  return wanted.every(
    (row) =>
      row.sampleOf.every((link) => haveFrom.has(link.mbid)) &&
      row.sampledBy.every((link) => haveIn.has(link.mbid))
  )
}

export function assertFindExtrasDiff(report: PromoteReport): {
  copyMbids: string[]
  addedLinkKeys: string[]
} {
  const copyMbids: string[] = []
  const addedLinkKeys: string[] = []
  for (const row of report.records) {
    if (!FIND_EXTRAS_RELEASE_ID_SET.has(row.releaseId)) {
      throw new Error(`dry-run touched non-FIND release ${row.releaseId}`)
    }
    for (const copy of row.copies) {
      if (!ALLOWED_EXTRA_MBIDS.has(copy.mbid)) {
        throw new Error(`dry-run copy beyond FIND extras: ${copy.mbid}`)
      }
      copyMbids.push(copy.mbid)
      for (const link of copy.addedLinks) {
        const key = `${link.direction}:${link.mbid}`
        if (!ALLOWED_LINK_KEYS.has(key)) {
          throw new Error(`dry-run link beyond FIND extras: ${key}`)
        }
        addedLinkKeys.push(key)
      }
    }
  }
  for (const key of report.keys) {
    const pressing = /^lf:crate:pressing:(\d+):v1$/.exec(key)
    const recording = /^lf:crate:recording:(.+):v1$/.exec(key)
    if (pressing) {
      const id = Number(pressing[1])
      if (!FIND_EXTRAS_RELEASE_ID_SET.has(id)) {
        throw new Error(`dry-run write beyond FIND pressings: ${key}`)
      }
      continue
    }
    if (recording) {
      if (!ALLOWED_EXTRA_MBIDS.has(recording[1] ?? '')) {
        throw new Error(`dry-run write beyond FIND recordings: ${key}`)
      }
      continue
    }
    throw new Error(`dry-run write beyond FIND keys: ${key}`)
  }
  return { copyMbids: [...new Set(copyMbids)], addedLinkKeys: [...new Set(addedLinkKeys)] }
}

const args = parsePromoteArgs([
  ...process.argv.slice(2),
  `--ids=${FIND_EXTRAS_RELEASE_IDS.join(',')}`,
])
const env = loadProdEnv()
const prodEnv = withProdNamespace(env)
const previewEnv = withPreviewNamespace(env)
const config = resolveRedisRestConfig(prodEnv)
if (!config) {
  console.error('no crate store (KV_REST_API_URL / KV_REST_API_TOKEN missing)')
  process.exit(1)
}

const prod = createRedisCrateStore(config, prodEnv)
const raw = await upstashPromoteRawStore(config)
const mb = createMusicBrainzClient()
const lookup = createPromoteMbLookup(mb)
async function verifyRecording(mbid: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await lookup(mbid)
    } catch (error) {
      if (!isMusicBrainzTimeoutError(error) || attempt === 3) throw error
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)))
    }
  }
  return null
}

const overlayPressings: Record<number, StoredPressing> = {}
const overlayRecordings: Record<string, StoredRecording> = {}
const now = new Date().toISOString()
const refreshAfter = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
const alreadyOnProd: string[] = []
const overlayMbids: string[] = []

for (const releaseId of FIND_EXTRAS_RELEASE_IDS) {
  const prodPressing = await prod.getPressing(releaseId)
  if (!prodPressing) {
    console.error(`missing prod pressing ${releaseId}`)
    process.exit(1)
  }
  const extras: Record<string, StoredRecording> = {}
  for (const row of AUDITED.filter((item) => item.releaseId === releaseId)) {
    const prodDoc =
      prodPressing.recordings[row.extraMbid] ?? (await prod.getRecording(row.extraMbid))
    if (recordingHasAuditedLinks(prodDoc, row.extraMbid)) {
      alreadyOnProd.push(row.extraMbid)
      continue
    }
    const facts = await mb.getRecording(row.extraMbid)
    const recording: StoredRecording = {
      mbid: row.extraMbid,
      title: facts?.title || row.extraTitle,
      artist: facts?.artist || prodPressing.facts.artist,
      lengthMs: facts?.lengthMs ?? row.extraLengthMs,
      credits: facts?.credits ?? [],
      samplesFrom: row.sampleOf.map(mbLink),
      sampledIn: row.sampledBy.map(mbLink),
      provenance: {
        sourceUrls: [`https://musicbrainz.org/recording/${row.extraMbid}`],
        matchStatus: 'matched',
        confidence: 0.9,
        reason: 'audited FIND extras',
        checkedAt: now,
        refreshAfter,
        lastError: null,
        verifiedAt: now,
      },
    }
    extras[row.extraMbid] = recording
    overlayRecordings[row.extraMbid] = recording
    overlayMbids.push(row.extraMbid)
  }
  overlayPressings[releaseId] = { ...prodPressing, recordings: extras }
}

const preview = createMemoryCrateStore({
  pressings: overlayPressings,
  recordings: overlayRecordings,
  seen: [...FIND_EXTRAS_RELEASE_IDS],
})

try {
  const report = await runPromotePreview({
    prod,
    preview,
    prodEnv,
    previewEnv,
    ids: [...FIND_EXTRAS_RELEASE_IDS],
    apply: args.apply,
    allowProd: args.prod,
    rollbackPath: args.rollbackPath,
    backupPath: args.backupPath,
    runId: args.runId,
    raw,
    verifyRecording,
  })
  const gated = assertFindExtrasDiff(report)
  const summary = {
    ...report,
    findGate: {
      alreadyOnProd: [...new Set(alreadyOnProd)],
      overlayMbids: [...new Set(overlayMbids)],
      copyMbids: gated.copyMbids,
      addedLinkKeys: gated.addedLinkKeys,
      overlayPreview: Object.fromEntries(
        FIND_EXTRAS_RELEASE_IDS.map((id) => [id, countPressingMapLinks(overlayPressings[id])])
      ),
    },
  }
  console.log(JSON.stringify(summary, null, 2))
} catch (error) {
  if (error instanceof PromoteApplyError) {
    console.error(error.message)
    console.error(error.rollbackCommand)
  }
  throw error
}
