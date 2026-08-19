# DSH CCSwitch Importer

Import CCSwitch Codex provider configurations into DeepSeek Harness and manage per-model reasoning depth on the same **Settings -> Models** page.

[中文 README](./README.md)

## Features

- Read-only scanning of `~/.cc-switch/cc-switch.db` for custom Codex providers; official and default profiles are skipped.
- Imports endpoints, protocol, model IDs, and API keys into DSH’s `llm-pi-ai` settings.
- Reads API keys only in the Host process and stores them through DSH credentials as an `apiKeyEnv` reference; scan and import responses are redacted.
- Prefills reasoning from the top-level Codex TOML field `model_reasoning_effort` while keeping all values editable in DSH.
- Maps `none` to disabled reasoning; known models use a conservative catalog; unknown models receive only the imported level; invalid values disable reasoning with a warning.
- Re-imports preserve existing reasoning levels, route defaults, headers, capacity fields, and models that are absent from CCSwitch.
- Keeps the native Models page, CCSwitch import controls, and reasoning editor in one Models page.

CCSwitch is a read-only import source. After import, DSH settings and the credentials service are authoritative; the plugin never writes back to the CCSwitch database.

## Installation

Install from GitHub:

```bash
dsh plugin --profile desktop add github:wtiaw/dsh-ccswitch-importer
```

Install from a local checkout:

```bash
dsh plugin --profile desktop add ./dsh-ccswitch-importer
```

After installing or updating, reload DSH Web and open **Settings -> Models**.

## Usage

1. Open **CCSwitch Import** on the Models page and click **Scan**.
2. Select the providers to import and click **Import selected**.
3. Review the import results and provider model list.
4. Confirm the prefilled reasoning levels in the reasoning section; edit wire values for a gateway when needed, then save.
5. Use the saved reasoning levels from the composer model picker.

If a settings revision conflict occurs, the import stops and restores the credential written by that attempt; an existing credential is restored to its prior value.

## Reasoning Catalog

The conservative defaults include:

- GPT-5.6 family: `off: none`, `low`, `medium`, `high`, `xhigh`, and `max`.
- OpenAI o-series (`o1`, `o3`, `o4-mini` and variants): `off: null`, `low`, `medium`, and `high`.

The catalog is only a default. Saved DSH fields remain user-controlled.

## DSH Community Market Catalog

This plugin ships a standard catalog source for DSH Community Market as described in the [catalog adapter guide (path A: standard source)](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/dsh-community-market/docs/catalog-adapter-guide.md). The repo includes:

- `scripts/build-catalog.mjs` — generates the `catalog-source` manifest and the `/v1/plugins` page from `package.json` metadata;
- `test/catalog.test.mjs` — validates the output against the official schemas and asserts metadata consistency;
- [docs/catalog.md](./docs/catalog.md) — deployment options, Content-Type requirements, and source registration.

Build and deploy:

```bash
DSH_CATALOG_ORIGIN=https://catalog.example.com npm run build:catalog
```

## Security and Limitations

- Host routes accept only loopback, same-origin requests; API keys never enter the browser, logs, summaries, or error text.
- Reading requires Node.js 22.19 or newer for the read-only SQLite API.
- The plugin handles custom CCSwitch Codex providers and the fields currently present in the database; it does not probe third-party API capabilities.
- Unknown models and invalid levels default to disabled reasoning to avoid sending unconfirmed parameters to a gateway.

## Development and Verification

Requirements: Node.js 22.19 or newer.

```bash
npm install
npm test
npm run pack:check
```

`npm run build` creates the DSH Host bundle and the Client bundle with the required `window.__ModuleLoader__.load` registration. The release package contains only `dist`, the patch, READMEs, and the license; source and tests are excluded.
