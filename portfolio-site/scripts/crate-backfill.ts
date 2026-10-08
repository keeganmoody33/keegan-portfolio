/**
 * Resumable crate backfill against preview Redis keys (lf:preview:...) unless
 * VERCEL_ENV=production. Stop and re-run; cursor lives in Redis.
 *
 *   npm run crate:backfill
 *   npm run crate:backfill -- --retry
 *   npm run crate:backfill -- --ids=567894,573292 --retry
 *   npm run crate:backfill -- --budget-ms=600000 --retry
 *   npm run crate:backfill -- --ids=567894 --retry --new-series
 *
 * `--retry` without `--ids` retries dead, inspect too_slow / rate_limit / unavailable,
 * and stored pressings whose lastError is still retryable (including pending provenance).
 * `--new-series` mints a fresh forceSeriesId for each targeted id and resets deadlineStops.
 *
 * Gated HTTP (preview only unless CRON_SECRET is set):
 *   GET /api/cron/crate-backfill?ids=567894&retry=1
 *   Authorization: Bearer $CRON_SECRET
 *
 * CRON_SECRET is not in production. Do not add it without Keegan's yes.
 * Missing secret → 404. Visitor traffic never writes Redis.
 */
import {
  cliBackfillRunOptions,
  parseBackfillCliArgs,
  runBackfill,
} from '../lib/crate/backfill.ts'
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

const args = parseBackfillCliArgs(process.argv.slice(2))
if (args.invalidIds) {
  console.error('invalid --ids: expected comma-separated positive integers')
  process.exit(1)
}

const result = await runBackfill(
  { store, collection, forceRefresh: Boolean(args.retry), budgetMs: args.budgetMs },
  cliBackfillRunOptions(args)
)
console.log(JSON.stringify(result, null, 2))
