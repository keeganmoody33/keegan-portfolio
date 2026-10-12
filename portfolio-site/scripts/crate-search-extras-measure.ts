/**
 * Read-only projection of extras-admissible sample links on the preview prefix.
 * Refuses --prod / production Redis. Does not write. Does not call MusicBrainz.
 *
 *   npm run crate:search-extras-measure
 */
import {
  countPressingMapLinks,
  projectExtrasTotals,
  sumTotals,
} from '../lib/crate/search-extras.ts'
import { crateRedisKeys, getDefaultCrateStore } from '../lib/crate/store.ts'
import {
  createUpstashRedis,
  isProductionRedisNamespace,
  REDIS_READ_CACHE,
  resolveRedisRestConfig,
} from '../lib/discogs-store.ts'
import type { StoredPressing } from '../lib/crate/types.ts'

if (process.argv.includes('--prod') || process.argv.includes('--apply')) {
  console.error('crate-search-extras-measure is preview-prefix read-only; refused --prod/--apply')
  process.exit(1)
}
if (process.argv.includes('--new-series')) {
  console.error('refused --new-series')
  process.exit(1)
}

const env = process.env
if (isProductionRedisNamespace(env)) {
  console.error('refused production Redis namespace')
  process.exit(1)
}

const keys = crateRedisKeys(env)
if (keys.prefix !== 'lf:preview:') {
  console.error(`expected lf:preview: prefix, got ${keys.prefix}`)
  process.exit(1)
}

const store = getDefaultCrateStore(env)
const config = resolveRedisRestConfig(env)
if (!store || !config) {
  console.error('no crate store (KV_REST_API_URL / KV_REST_API_TOKEN missing)')
  process.exit(1)
}

const redis = createUpstashRedis(config, { cache: REDIS_READ_CACHE })
const match = keys.pressing(1).replace('1', '*')
const ids = new Set<number>()
let cursor = '0'
do {
  const scanned = await redis.scan(cursor, { match, count: 200 })
  const next = Array.isArray(scanned) ? scanned[0] : 0
  const batch = Array.isArray(scanned) ? scanned[1] ?? [] : []
  cursor = String(next)
  for (const key of batch) {
    if (typeof key !== 'string') continue
    if (key.includes(':draft:')) continue
    const found = /crate:pressing:(\d+):v1$/.exec(key)
    if (!found) continue
    const id = Number.parseInt(found[1] ?? '', 10)
    if (Number.isInteger(id) && id > 0) ids.add(id)
  }
} while (cursor !== '0')

const pressings: StoredPressing[] = []
for (const id of [...ids].sort((a, b) => a - b)) {
  const pressing = await store.getPressing(id)
  if (pressing) pressings.push(pressing)
}

const current = sumTotals(pressings.map(countPressingMapLinks))
const extras = projectExtrasTotals(pressings)
const workBrowse = projectExtrasTotals(pressings, { requireKnownLength: true })

const report = {
  wrote: false,
  prefix: keys.prefix,
  pressings: pressings.length,
  currentPreview: current,
  extrasAdmissible: extras,
  workBrowseAdmissible: workBrowse,
  vs360: extras.links - 360,
  vs389: extras.links - 389,
}

console.log(JSON.stringify(report, null, 2))
