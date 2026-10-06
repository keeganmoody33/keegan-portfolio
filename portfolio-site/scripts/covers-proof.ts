/**
 * Discover covers for 10 sample records without Blob or Redis writes.
 * Writes a comparison table and 375/1280 side-by-side crops to /opt/cursor/artifacts.
 *
 *   npm run covers:proof
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DISCOGS_USER_AGENT, fetchFullCollection } from '../lib/discogs.ts'
import { fixturePressing } from '../lib/crate/read.ts'
import {
  COVER_ART_USER_AGENT,
  createCoverPacer,
  discoverCover,
} from '../lib/crate/cover.ts'
import { fetchDiscogsReleaseDetail } from '../lib/crate/discogs-release.ts'

export const PROOF_REQUIRED_IDS = [567894, 573292, 240128] as const
const ARTIFACT_DIR = '/opt/cursor/artifacts'
const CROP_IDS = [573292, 240128, 567894] as const
const TARGET_COUNT = 10

type ProofRow = {
  releaseId: number
  artist: string
  title: string
  discogsPx: string
  discogsUrl: string
  bestPx: string
  bestSource: string
  bestUrl: string
  stored: string
}

async function extraCollectionIds(required: number[]): Promise<number[]> {
  try {
    const collection = await fetchFullCollection()
    return collection.releases
      .map((release) => release.releaseId)
      .filter((id) => id > 0 && !required.includes(id))
  } catch (error) {
    console.error(`collection lookup skipped: ${error instanceof Error ? error.message : error}`)
    return []
  }
}

async function fetchImageBytes(
  url: string,
  userAgent: string
): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent },
      cache: 'no-store',
      redirect: 'follow',
    })
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    return bytes.byteLength > 0 ? bytes : null
  } catch {
    return null
  }
}

function pxLabel(width: number, height: number): string {
  return `${width}×${height}`
}

function markdownTable(rows: ProofRow[]): string {
  const header = [
    '| releaseId | artist — title | Discogs px | best px | source | stored |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  const body = rows.map((row) => {
    const name = `${row.artist} — ${row.title}`.replace(/\|/g, '/')
    return `| ${row.releaseId} | ${name} | ${row.discogsPx} | ${row.bestPx} | ${row.bestSource} | ${row.stored} |`
  })
  return [...header, ...body].join('\n')
}

async function writeCrops(
  releaseId: number,
  discogsBytes: Uint8Array | null,
  bestBytes: Uint8Array | null
): Promise<string[]> {
  const sharp = (await import('sharp')).default
  const written: string[] = []
  for (const size of [375, 1280] as const) {
    const gap = 8
    const canvas = sharp({
      create: {
        width: size * 2 + gap,
        height: size + 28,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    })
    const leftSrc = discogsBytes ?? bestBytes
    const rightSrc = bestBytes ?? discogsBytes
    if (!leftSrc || !rightSrc) continue
    const left = await sharp(leftSrc)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer()
    const right = await sharp(rightSrc)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer()
    const caption = Buffer.from(
      `<svg width="${size * 2 + gap}" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#242424"/>
        <text x="8" y="18" fill="#ececec" font-family="monospace" font-size="11">${releaseId} discogs ${size}</text>
        <text x="${size + gap + 8}" y="18" fill="#ececec" font-family="monospace" font-size="11">${releaseId} best ${size}</text>
      </svg>`
    )
    const file = path.join(ARTIFACT_DIR, `cover-${releaseId}-${size}.png`)
    await canvas
      .composite([
        { input: caption, top: 0, left: 0 },
        { input: left, top: 28, left: 0 },
        { input: right, top: 28, left: size + gap },
      ])
      .png()
      .toFile(file)
    written.push(file)
  }
  return written
}

const required = [...PROOF_REQUIRED_IDS]
const extras = await extraCollectionIds(required)
const ids = [...required, ...extras].filter((id, index, all) => all.indexOf(id) === index).slice(0, TARGET_COUNT)

if (ids.length < TARGET_COUNT) {
  console.error(`only ${ids.length} ids available (need ${TARGET_COUNT})`)
}

const discogsPacer = createCoverPacer({ userAgent: DISCOGS_USER_AGENT })
const caaPacer = createCoverPacer({ userAgent: COVER_ART_USER_AGENT })
const rows: ProofRow[] = []
const cropFiles: string[] = []

await mkdir(ARTIFACT_DIR, { recursive: true })

for (const releaseId of ids) {
  const fixture = fixturePressing(releaseId)
  const detail = await fetchDiscogsReleaseDetail(releaseId, {
    fetchImpl: discogsPacer.fetch,
  }).catch(() => null)
  const input = {
    releaseId,
    mbReleaseMbid: fixture?.mbRelease.mbid ?? null,
    discogsImage: detail?.primaryImage ?? null,
    discogsCoverUrl: detail?.cover || fixture?.facts.cover || '',
  }
  const discovered = await discoverCover(input, { pacer: caaPacer })
  const discogsPx = discovered.discogsPx
  const best = discovered.best
  rows.push({
    releaseId,
    artist: detail?.artist || fixture?.facts.artist || '',
    title: detail?.title || fixture?.facts.title || '',
    discogsPx: discogsPx ? pxLabel(discogsPx.width, discogsPx.height) : 'n/a',
    discogsUrl: discogsPx?.url ?? '',
    bestPx: best ? pxLabel(best.width, best.height) : 'n/a',
    bestSource: best?.source ?? 'none',
    bestUrl: best?.originalUrl ?? '',
    stored: 'no (blob token unset; Discogs hotlinked)',
  })

  if ((CROP_IDS as readonly number[]).includes(releaseId)) {
    const discogsBytes = discogsPx?.url
      ? await fetchImageBytes(discogsPx.url, DISCOGS_USER_AGENT)
      : null
    let bestBytes = best?.bytes ?? null
    if (!bestBytes && best?.originalUrl) {
      const ua = best.source === 'caa' ? COVER_ART_USER_AGENT : DISCOGS_USER_AGENT
      bestBytes = await fetchImageBytes(best.originalUrl, ua)
    }
    cropFiles.push(...(await writeCrops(releaseId, discogsBytes, bestBytes)))
  }
}

const table = markdownTable(rows)
const report = [
  '# Collection cover comparison (no Blob)',
  '',
  'Discogs images stay hotlinked. CAA is the only storeable source; this run did not upload.',
  '',
  table,
  '',
  '## Crops',
  '',
  'Each crop is Discogs current (left) vs best found (right) at the labeled CSS square.',
  '',
  ...cropFiles.map((file) => `- ${file}`),
  '',
].join('\n')

await writeFile(path.join(ARTIFACT_DIR, 'cover-comparison.md'), report)
await writeFile(path.join(ARTIFACT_DIR, 'cover-comparison.json'), JSON.stringify({ rows, cropFiles }, null, 2))
console.log(report)
