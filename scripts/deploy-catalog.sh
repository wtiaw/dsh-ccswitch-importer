#!/usr/bin/env bash
# Publish the standard catalog source to Cloudflare Pages.
#
# Requirements (one of):
#   - npx wrangler login  (one-time browser authorization), or
#   - CLOUDFLARE_API_TOKEN with Pages:Edit permission
#   - DSH_CATALOG_ORIGIN set to the final pages.dev URL, e.g. https://dsh-ccswitch-importer-catalog.pages.dev
set -euo pipefail

# Windows: wrangler may store its OAuth config under a non-default XDG path.
if [ -z "${XDG_CONFIG_HOME:-}" ] && [ -d "$APPDATA/xdg.config/.wrangler" ]; then
  export XDG_CONFIG_HOME="$APPDATA/xdg.config"
fi

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
# Create the project on first deploy; ignore the "already exists" error on later runs.
npx --yes wrangler@latest pages project create "$PROJECT" --production-branch main >/dev/null 2>&1 || true
npx --yes wrangler@latest pages deploy catalog --project-name "$PROJECT" --branch main

echo
echo "manifest:  $ORIGIN/catalog-source.json"
echo "endpoint:  $ORIGIN/v1/plugins"