/**
 * Resumable crate backfill against preview Redis keys (lf:preview:...) unless
 * VERCEL_ENV=production. Stop and re-run; cursor lives in Redis.
 *
 *   npm run crate:backfill
 *   npm run crate:backfill -- --retry
 *   npm run crate:backfill -- --ids=567894,573292 --retry
 *
 * `--retry` without `--ids` retries dead, inspect too_slow / rate_limit / unavailable,
 * and stored pressings whose lastError is still retryable (including pending provenance).
 *
 * Gated HTTP (preview only unless CRON_SECRET is set):
 *   GET /api/cron/crate-backfill?ids=567894&retry=1
 *   Authorization: Bearer $CRON_SECRET
 *
 * CRON_SECRET is not in production. Do not add it without Keegan's yes.
 * Missing secret → 404. Visitor traffic never writes Redis.
 */
import { parseIdList, runBackfill } from '../lib/crate/backfill.ts'
import { getDefaultCrateStore } from '../lib/crate/store.ts'
import { readCachedCollection } from '../lib/discogs.ts'

function parseArgs(argv: string[]): { retry: boolean; ids: number[]; limit?: number } {
  let retry = false
  let ids: number[] = []
  let limit: number | undefined
  for (const arg of argv) {
    if (arg === '--retry' || arg === 'retry=1' || arg === '--retry=1') retry = true
    else if (arg.startsWith('--ids=')) {
      ids = parseIdList(arg.slice('--ids='.length))
      // Explicit but invalid --ids must not fall through to a full backfill.
      if (ids.length === 0) {
        console.error('invalid --ids: expected comma-separated positive integers')
        process.exit(1)
      }
    }
    else if (arg.startsWith('--limit=')) {
      const parsed = Number.parseInt(arg.slice('--limit='.length), 10)
      if (Number.isInteger(parsed) && parsed > 0) limit = parsed
    }
  }
  return { retry, ids, limit }
}

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

const { retry, ids, limit } = parseArgs(process.argv.slice(2))
const result = await runBackfill(
  { store, collection, forceRefresh: Boolean(retry) },
  { retry, ids: ids.length > 0 ? ids : undefined, limit }
)
console.log(JSON.stringify(result, null, 2))
