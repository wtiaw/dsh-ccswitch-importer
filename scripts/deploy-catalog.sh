#!/usr/bin/env bash
# Publish the standard catalog source to Cloudflare Pages.
#
# Requirements:
#   - npx wrangler login  (one-time browser authorization)
#   - DSH_CATALOG_ORIGIN set to the final pages.dev URL, e.g. https://dsh-ccswitch-importer-catalog.pages.dev
set -euo pipefail

ORIGIN="${DSH_CATALOG_ORIGIN:-}"
if [ -z "$ORIGIN" ]; then
  echo "set DSH_CATALOG_ORIGIN to the deployed origin (https://your-project.pages.dev)" >&2
  exit 2
fi

npm run build:catalog

mkdir -p catalog
printf "/v1/plugins\n  Content-Type: application/json\n" > catalog/_headers
printf "/v1/plugins  /v1/plugins.json  200\n" > catalog/_redirects

PROJECT="${DSH_CATALOG_PROJECT:-dsh-ccswitch-importer-catalog}"
npx --yes wrangler@latest pages deploy catalog --project-name "$PROJECT" --branch main

echo
echo "manifest:  $ORIGIN/catalog-source.json"
echo "endpoint:  $ORIGIN/v1/plugins"