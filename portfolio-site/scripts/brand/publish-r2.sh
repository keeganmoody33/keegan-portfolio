#!/usr/bin/env bash
# Mirrors the official logo files to Cloudflare R2 (served at assets.lecturesfrom.com).
#
#   npx wrangler login          # once
#   bash scripts/brand/publish-r2.sh
#
# Hashed files get a one-year immutable cache. Stable names and manifest.json get one hour.
set -euo pipefail
BUCKET="${R2_BUCKET:-lecturesfrom-assets}"
cd "$(dirname "$0")/../../public/brand"

type_for() {
  case "$1" in
    *.svg) echo image/svg+xml ;; *.png) echo image/png ;;
    *.ico) echo image/x-icon ;; *.json) echo application/json ;;
  esac
}

put() { # key file cache
  npx --yes wrangler r2 object put "$BUCKET/$1" --file "$2" --remote \
    --content-type "$(type_for "$2")" --cache-control "$3"
}

for f in v/*; do put "brand/$f" "$f" "public, max-age=31536000, immutable"; done
for f in logo.svg logo-white.svg logo-512.png logo-1024.png logo-white-512.png logo-white-1024.png manifest.json; do
  put "brand/$f" "$f" "public, max-age=3600, stale-while-revalidate=86400"
done
echo "done: https://assets.lecturesfrom.com/brand/logo.svg"
