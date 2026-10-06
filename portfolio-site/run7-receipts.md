# Run #7 receipts — PR #50

Produced for code SHA `b838a33f757c925d4ca3d90cf3f37b6b776b17ca` (LIVE preview below). This receipts file is committed on the same branch after those proofs.
Preview `dpl_6HtLeLv8AEhBzAyYCTfxHVp3u5yi` READY, `githubCommitSha` matches.
Host: `https://keegan-portfolio-content-9ci8a7nbl-groundskeep.vercel.app`
Share: `https://keegan-portfolio-content-9ci8a7nbl-groundskeep.vercel.app/?_vercel_share=l8skJYmus8xewEZUsSSu8xXrcZL95A9j` (expires 2026-10-07 08:31:47 UTC)
Redis prefix on inspect / backfill / cleanup: `lf:preview:`
`npm test`: 201 pass / 0 fail

Stays DRAFT. No merge, no promote, no paid-plan change.

**verifiedAt choice (item 5):** code, not lessons-only. `lifecycles.pressing.verifiedAt` moves on Discogs success. `provenance.verifiedAt` moves only on MusicBrainz success. Skip-match Discogs-ok + 0 MB keeps the prior `provenance.verifiedAt`. First-run Discogs-ok + MB throw leaves `provenance.verifiedAt` null and still stamps the pressing lifecycle.

`34ac93e` failed Vercel typecheck (`storedPrevious` possibly null). Guarded on this SHA.

---

## 1. Backfill stall

| Proof | Kind | Result | Does not prove |
| --- | --- | --- | --- |
| Unavailable id nacks to `refreshAfter` and the walk continues | UNIT | `nacks an unavailable id and continues to the next collection id` — fetches `[573292, 240128]`, 573292 lastError `unavailable`, not in `settled`, queue score = retryAt, second tick does not refetch | Does not prove a live Discogs 5xx on this tick. This live tick settled every processed id. |
| One 45s tick processed 7 collection ids | LIVE | `GET /api/cron/crate-backfill` processed `[4414853, 2291872, 5681424, 3072567, 4153757, 2023958, 2919564]`. `completedThis: 3`, `unresolvedThis: 4`, `failedThis: 0`. Queue head at inspect-before was `12823882`, not drained. `elapsedMs: 45360`, wall 46.565s (`run7-backfill-tick.json`) | Does not prove an unavailable nack on the live worker. Does not prove five stalled ticks cannot happen under a held enrich lock (`skipped: true`). |

---

## 2. Settled-id set

| Proof | Kind | Result | Does not prove |
| --- | --- | --- | --- |
| Numeric cursor migrates to `settled[]`; add/remove neither skips nor double-runs | UNIT | `uses a settled-id set so added and removed ids are neither skipped nor double-run` | Memory store only. |
| Live migrate + honest remaining | LIVE | Inspect-before: `cursor: 21`, no `settled` field, `completed: 20`. Tick after: `backfill.settled.length: 28`, `cursor: 28` (= settled length), `remaining: 248`, `remainingIsEstimate: false`. 28 + 248 = 276 unique collection ids. Grid shows 279 listings (duplicate instances). `releasesPerMin: 3.97` from completedThis only; this-tick `discogsRequests: 7`, `mbRequests: 42` (`run7-inspect-before.json`, `run7-backfill-tick.json`) | Does not prove a mid-tick Discogs collection mutation. Does not prove a full-collection finish or Hobby daily cron. Does not prove Discogs 6h freshness. |

---

## 3. Dead ids in backfill

| Proof | Kind | Result | Does not prove |
| --- | --- | --- | --- |
| Skip dead unless `{ retry: true }`; success `unmarkDead` + ack | UNIT | `skips dead ids unless retry is explicit, then unmarks and acks on success` | Memory store only. |
| Preview dead set empty around this tick | LIVE | Inspect before/after/cleanup: `dead: []`. Proof ids 8/9 were not in queue, dead, or unresolved. Cleanup still purged `[8, 9]`, `leftoverMarked: purged` (`run7-cleanup.json`) | Does not prove a live dead id was skipped by backfill on this tick (none were dead). |

---

## 4. Deadline hot loop

| Proof | Kind | Result | Does not prove |
| --- | --- | --- | --- |
| Backoff nacks, `too_slow` after 3, attempts stay 0 | UNIT | `backs off deadline nacks and marks too_slow after N stops without counting attempts` — `discogsCalls: 1` (draft reuse), unresolved kind `too_slow`, `attempts: 0` | Not reproduced live (would need a mid-release deadline on the 60s worker). |
| Skip Discogs inside take floor | UNIT | `does not fetch Discogs when remaining budget is inside the take floor` | Not live. |
| Reuse staged draft | UNIT | `reuses the Discogs draft on a later tick instead of fetching again` | Not live. |

---

## 5. verifiedAt semantics

| Proof | Kind | Result | Does not prove |
| --- | --- | --- | --- |
| Skip-match Discogs-ok + 0 MB keeps `provenance.verifiedAt` | UNIT | `does not move provenance.verifiedAt on a skip-match Discogs-ok refresh with zero MusicBrainz calls` — first stamp `2026-10-01`, second Discogs check `2026-10-06T12:00:00.000Z` on `lifecycles.pressing.verifiedAt` only, `secondMb.requestCount === 0` | Does not prove a live skip-match on this tick. Cleanup showed Bootsy `provenance.verifiedAt` `2026-10-06T08:34:15.633Z` unchanged across purge, which is not a Discogs refresh. |
| First-run Discogs-ok + MB throw | UNIT | `keeps Discogs facts without moving provenance.verifiedAt when MusicBrainz throws with no prior` — `provenance.verifiedAt: null`, `lifecycles.pressing.verifiedAt` stamped, attempts climb in the exhausted-queue unit | Does not prove a live MusicBrainz outage. |

---

## 6–7. UI

| Proof | Kind | Result | Does not prove |
| --- | --- | --- | --- |
| `#house-content:focus-visible { outline: none }` | LIVE | 375 collection heading is fully visible; no 2px ink ring under the header (`run7-collection-375-hero.png`, `run7-collection-1280-top.png`) | Does not prove keyboard focus after overlay close (no focus ring to photograph). |
| Overlay dim meta full opacity | UNIT + CSS | Overlay skips `.house-fade`; `.house-meta` `opacity-100` | Axe/scanner not re-run on this SHA. |
| Bootsy Hollywood Squares → Too $hort | LIVE | TRACKS, Hollywood Squares selected, SAMPLED IN `Too $hort — I'm a Player` at 1280 and 375 | Does not prove a live MusicBrainz relationship fetch on this tick (fixture + stored research). |
| Mtume TRACKS | LIVE | MATCHED 0/2, vocal + Fruity Instrumental Mix, `pick a track for credits and samples` | Does not prove a live rematch; inspect still unmatched / both `ambiguous` / `lastError` null. |

---

## One live backfill tick (throughput)

From `run7-backfill-tick.json` (HTTP 200, prefix `lf:preview:`, `skipped: false`, `stoppedOnAuth/RateLimit: false`):

- `elapsedMs`: 45360
- `processed`: 7
- `completedThis`: 3
- `unresolvedThis`: 4
- `failedThis`: 0
- `remaining`: 248
- `remainingIsEstimate`: false
- `releasesPerMin`: 3.968
- this-tick `discogsRequests`: 7 (`discogsRequestsPerMin`: 9.26)
- this-tick `mbRequests`: 42 (`mbRequestsPerMin`: 55.56)
- `estimatedRemainingMs`: 3749760
- cumulative `backfill.completed`: 23, `unresolved`: 18, `failed`: 0, `discogsRequests`: 24, `mbRequests`: 176
- `settled.length` / `cursor`: 28

---

## Redis cleanup

`action=cleanup` then inspect: purged `[8, 9]`, `leftoverProofIds: []`, `queueHasProofIds: false`, `dead: []`. Inspect after: no 8/9 in queue / dead / unresolved. Does not empty the visitor queue or reset backfill (left running at cursor 28, remaining 248). Does not delete last-good for 573292 / 240128 / 567894.

---

## Artifact files

- `run7-backfill-tick.json`, `run7-inspect-before.json`, `run7-inspect-after.json`, `run7-inspect-after-cleanup.json`, `run7-cleanup.json`
- Screenshots: `collection-1280.png`, `collection-375.png`, `bootsy-tracks-hollywood-1280.png`, `bootsy-tracks-hollywood-375.png`, `mtume-tracks-1280.png`, `mtume-tracks-375.png` (plus `run7-*-top/hero/crop` viewport crops)
- Video: `run7_preview_collection_detail.mp4` — 13s static hold of Mtume TRACKS on the preview; not a click-through (longer RecordScreen saves timed out)
