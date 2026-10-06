/**
 * Resumable crate backfill against preview Redis keys (lf:preview:...) unless
 * VERCEL_ENV=production. Stop and re-run; cursor lives in Redis.
 *
 *   node --experimental-strip-types scripts/crate-backfill.ts
 *   npm run crate:backfill
 */
import { runBackfill } from '../lib/crate/backfill.ts'
import { getDefaultCrateStore } from '../lib/crate/store.ts'
import { readCachedCollection } from '../lib/discogs.ts'

const store = getDefaultCrateStore()
if (!store) {
  console.error('no crate store (KV_REST_API_URL / KV_REST_API_TOKEN missing)')
  process.exit(1)
}

const collection = await readCachedCollection()
if (!collection) {
  console.error('no collection snapshot')
  process.exit(1)
}

const result = await runBackfill({ store, collection })
console.log(JSON.stringify(result, null, 2))
