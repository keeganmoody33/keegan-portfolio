/**
 * Read-only crate inspect. Uses preview Redis keys unless VERCEL_ENV=production.
 *
 *   CRON_SECRET=... node --experimental-strip-types scripts/crate-inspect.ts
 *   npm run crate:inspect
 */
import { inspectCrate } from '../lib/crate/backfill.ts'
import { getDefaultCrateStore } from '../lib/crate/store.ts'

const store = getDefaultCrateStore()
if (!store) {
  console.error('no crate store (KV_REST_API_URL / KV_REST_API_TOKEN missing)')
  process.exit(1)
}

const snapshot = await inspectCrate(store)
console.log(JSON.stringify(snapshot, null, 2))
