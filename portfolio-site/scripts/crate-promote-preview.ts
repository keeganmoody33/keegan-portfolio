/**
 * Copy audited lf:preview: sidecar recordings onto lf: for the 23 gap records.
 *
 *   npm run crate:promote-preview
 *   npm run crate:promote-preview -- --apply --backup=/tmp/lf-secrets/crate-promote-backup.json
 *   npm run crate:promote-preview -- --rollback /tmp/lf-secrets/crate-promote-backup.json
 *
 * Default is dry-run. --apply requires --backup=<path>, holds lf:crate:enrich:lock:v1,
 * and plans after acquire. No WhoSampled. Never a visitor path.
 */
import { resolveRedisRestConfig } from '../lib/redis-env.ts'
import { createMusicBrainzClient } from '../lib/crate/musicbrainz.ts'
import {
  assertPromotePrefixes,
  createPromoteMbLookup,
  parsePromoteArgs,
  PromoteApplyError,
  runPromotePreview,
  upstashPromoteRawStore,
  withPreviewNamespace,
  withProdNamespace,
} from '../lib/crate/promote-preview.ts'
import { createRedisCrateStore } from '../lib/crate/store.ts'

const args = parsePromoteArgs(process.argv.slice(2))
const prodEnv = withProdNamespace(process.env)
const previewEnv = withPreviewNamespace(process.env)
assertPromotePrefixes(prodEnv, previewEnv)

const config = resolveRedisRestConfig(prodEnv)
if (!config) {
  console.error('no crate store (KV_REST_API_URL / KV_REST_API_TOKEN missing)')
  process.exit(1)
}

const prod = createRedisCrateStore(config, prodEnv)
const preview = createRedisCrateStore(config, previewEnv)
const raw = await upstashPromoteRawStore(config)
const mb = createMusicBrainzClient()
const verifyRecording = createPromoteMbLookup(mb)

try {
  const report = await runPromotePreview({
    prod,
    preview,
    prodEnv,
    previewEnv,
    ids: args.ids,
    apply: args.apply,
    rollbackPath: args.rollbackPath,
    backupPath: args.backupPath,
    raw,
    verifyRecording,
  })
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  if (error instanceof PromoteApplyError) {
    console.error(error.message)
    console.error(error.rollbackCommand)
  }
  throw error
}
