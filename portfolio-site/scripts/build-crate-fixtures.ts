import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichPressing } from '../lib/crate/enrich.ts'
import { createMusicBrainzClient } from '../lib/crate/musicbrainz.ts'
import { createMemoryCrateStore } from '../lib/crate/store.ts'
import { fetchDiscogsReleaseDetail } from '../lib/crate/discogs-release.ts'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = join(ROOT, '../lib/crate/fixtures')
const IDS = [573292, 240128, 567894]

async function main() {
  const store = createMemoryCrateStore()
  const mb = createMusicBrainzClient()
  await mkdir(OUT, { recursive: true })
  for (const releaseId of IDS) {
    process.stderr.write(`enrich ${releaseId}\n`)
    const pressing = await enrichPressing(releaseId, {
      store,
      mb,
      fetchDiscogs: (id) => fetchDiscogsReleaseDetail(id),
    })
    const path = join(OUT, `${releaseId}.json`)
    await writeFile(path, `${JSON.stringify(pressing, null, 2)}\n`)
    process.stderr.write(
      `wrote ${path} tracks=${pressing.tracks.length} mb=${pressing.mbRelease.matchStatus} recordings=${Object.keys(pressing.recordings).length}\n`
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
