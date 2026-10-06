/**
 * Fetch, optionally store CAA covers on Vercel Blob, and write Redis manifests.
 * Preview Redis (`lf:preview:`) unless --prod. Refuses production keys without --prod.
 * Without BLOB_READ_WRITE_TOKEN, discovery still runs and Discogs URLs stay hotlinked.
 *
 *   npm run covers:sync -- --ids=573292,240128 --limit=10 --force
 *   npm run covers:sync -- --dry-run --limit=10
 */
import { parseCoverSyncArgs, assertCoverSyncAllowed, syncCovers } from '../lib/crate/cover-sync.ts'
import { getDefaultCoverStore } from '../lib/crate/cover-store.ts'
import { getDefaultCrateStore } from '../lib/crate/store.ts'
import { fetchFullCollection } from '../lib/discogs.ts'

const args = parseCoverSyncArgs(process.argv.slice(2))
assertCoverSyncAllowed({ prod: args.prod })

let ids = args.ids ?? []
if (ids.length === 0) {
  const collection = await fetchFullCollection()
  ids = collection.releases
    .map((release) => release.releaseId)
    .filter((id) => id > 0)
}
if (args.limit) ids = ids.slice(0, args.limit)
if (ids.length === 0) {
  console.error('no release ids')
  process.exit(1)
}

const rows = await syncCovers({
  ids,
  force: args.force,
  dryRun: args.dryRun,
  coverStore: args.dryRun ? null : getDefaultCoverStore(),
  crateStore: getDefaultCrateStore(),
})

console.log(JSON.stringify({ prod: Boolean(args.prod), dryRun: Boolean(args.dryRun), rows }, null, 2))
