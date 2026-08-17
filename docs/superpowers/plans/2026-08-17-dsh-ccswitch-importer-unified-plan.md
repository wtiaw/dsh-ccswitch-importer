# dsh-ccswitch-importer Unified Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Merge CCSwitch provider import and per-model reasoning configuration into one publishable DSH plugin named `dsh-ccswitch-importer`.

**Architecture:** Keep the existing tested CCSwitch core under `lib/core`, add a bundled Host entry for loopback-protected scan/import routes, and migrate the reasoning helper domain/client into the same package. The Client shadows the native Models settings section once, renders the native page, then renders CCSwitch import and model reasoning controls in that same page. Host owns secrets and source reads; DSH settings and credentials become authoritative after import.

**Tech Stack:** Node 22+, ESM, Node `node:sqlite`, Node test runner, esbuild, React 18, DSH Cordis Host/Client slots, settings and credentials services.

---

## File Map

- Modify `package.json`: canonical metadata, build/test/pack scripts, DSH client injection, peer/dev dependencies, publish files.
- Modify `cordis.patch.yml`: use the exact ID/name `dsh-ccswitch-importer`.
- Create `scripts/build.mjs`: bundle Host, Client loader, and public reasoning domain exports.
- Create `src/host/index.mjs` and `src/host/routes.mjs`: Host lifecycle and guarded HTTP routes.
- Create `src/domain/catalog.mjs`, `src/domain/validation.mjs`, `src/domain/settings.mjs`, `src/domain/import-reasoning.mjs`: migrated reasoning domain and CCSwitch effort seed.
- Create `src/client/controller.mjs`, `src/client/registration.mjs`, `src/client/index.mjs`, `src/client/styles.mjs`, `src/client/import-controller.mjs`: unified client controllers and registration.
- Create/update `src/ui/ModelsReasoningComposite.mjs`, `src/ui/ReasoningSettingsSection.mjs`, `src/ui/CCSwitchImportSection.mjs`: one Models page.
- Modify `lib/core/toml.js`, `lib/core/extract.js`, `lib/core/mapper.js`, `lib/core/importer.js`: reasoning extraction and non-destructive merge.
- Modify/create `test/*.test.js` and `test/*.test.mjs`: core, Host, Client, build, and docs coverage.
- Create/update `README.md` and `README.en.md`: single-plugin workflow.

## Task 1: Establish the Canonical Package and Build

**Files:** `package.json`, `cordis.patch.yml`, `scripts/build.mjs`, `src/host/index.mjs`, `src/client/index.mjs`, `test/build.test.mjs`.

- [ ] **Step 1: Write the failing build test.** Import `createLoaderBundle` and assert its generated string contains one `window.__ModuleLoader__.load` call with `id: "dsh-ccswitch-importer"`. Assert package metadata exports `dist/index.mjs` and `dist/client.js`.
- [ ] **Step 2: Run `node --test test/build.test.mjs` and verify failure** because `scripts/build.mjs` and the canonical Client entry are absent.
- [ ] **Step 3: Implement the build.** Adapt the existing reasoning helper build: `PLUGIN_ID = "dsh-ccswitch-importer"`; bundle `src/host/index.mjs` as `dist/index.mjs`; bundle `src/client/index.mjs` as CJS, externalizing `react`, `react-dom`, and `@deepseek-ai/*`, then wrap it with `window.__ModuleLoader__.load`; bundle `src/domain/catalog.mjs`, `validation.mjs`, and `settings.mjs` into `dist/domain`. Set package `main` to `dist/index.mjs`, export `./client`, `./catalog`, `./validation`, and `./settings`, and add `build`, `test`, and `pack:check` scripts. Add the reasoning helper DSH peer dependencies plus `esbuild` and React dev dependencies. Set `dsh.client.inject` to the runtime, settings, primitives, slots, locale, connection, and remote packages. Start the Host entry with `export const name = "dsh-ccswitch-importer"` and `export const inject = ["webServer", "settings", "credentials"]`.
- [ ] **Step 4: Run `node --test test/build.test.mjs` and `npm run build`; expect PASS and `dist/index.mjs`/`dist/client.js` generated.
- [ ] **Step 5: Commit:** `git add package.json cordis.patch.yml scripts src/host src/client/index.mjs test/build.test.mjs && git commit -m "build: establish canonical ccswitch plugin"`.

## Task 2: Parse and Seed CCSwitch Reasoning Effort

**Files:** `lib/core/toml.js`, `lib/core/extract.js`, `src/domain/catalog.mjs`, `src/domain/validation.mjs`, `src/domain/import-reasoning.mjs`, `test/toml.test.js`, `test/extract.test.js`, `test/import-reasoning.test.mjs`.

- [ ] **Step 1: Write failing tests.** Extend TOML fixtures with `model_reasoning_effort = "xhigh"` and assert `parseCodexToml` returns `reasoningEffort: "xhigh"`, including the empty-input shape `{ model: undefined, reasoningEffort: undefined, provider: null }`. Add seed assertions for unknown/high (`{ off: null, high: "high" }`), unknown/none (`false`, default `off`), and an invalid value (false plus a warning).
- [ ] **Step 2: Run `node --test test/toml.test.js test/import-reasoning.test.mjs`; expect failure** because the parser field and seed module do not exist.
- [ ] **Step 3: Implement.** Parse the top-level key in `parseCodexToml`, carry it as Host-only `modelReasoningEffort` from `extractProfile`, and never include the API key in blocked profiles. Migrate the conservative reasoning catalog and validation constants. Add `normalizeImportedEffort` accepting `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, mapping `none` to `off`; invalid values return undefined. Add `seedReasoning(modelId, rawEffort)` with these exact rules: `off` returns `efforts: false` and default `off`; an unknown model with a legal non-off value returns `{ off: null, [value]: value }` and that default; a known model uses its catalog only when the source value exists in that catalog; missing values use the known catalog or false; unsupported/invalid values return false with a warning.
- [ ] **Step 4: Run `node --test test/toml.test.js test/extract.test.js test/import-reasoning.test.mjs`; expect PASS and no fixture secret in serialized blocked output.
- [ ] **Step 5: Commit:** `git add lib/core/toml.js lib/core/extract.js src/domain test/toml.test.js test/extract.test.js test/import-reasoning.test.mjs && git commit -m "feat(core): import ccswitch reasoning effort"`.

## Task 3: Make Provider Import Non-Destructive

**Files:** `lib/core/mapper.js`, `lib/core/importer.js`, `test/mapper.test.js`, `test/importer.test.js`.

- [ ] **Step 1: Write failing tests.** Pass an existing provider with route `reasoning: "low"`, custom headers, and model `reasoningEfforts: { low: "low" }`; assert `toProviderProfile(profile, existing)` preserves those fields and `maxTokens`, while source endpoint/protocol/model ID still update. Add a settings-conflict test with `credentials.resolve(ref)` returning an existing secret; assert the old secret is restored, while a new secret is unset after failure.
- [ ] **Step 2: Run `node --test test/mapper.test.js test/importer.test.js`; expect failure** because the current mapper replaces manual fields and importer unsets an existing credential on settings failure.
- [ ] **Step 3: Implement.** Change `toProviderProfile(profile, existing)` to preserve non-source provider fields, merge source models by ID, preserve matching model reasoning/capacity/extra fields, preserve models absent from the source, and seed reasoning only when `existingModel.reasoningEfforts` is undefined. Preserve an existing route `reasoning`; set it only when missing and a seed has a valid default. Keep `apiKeyEnv` derived from the stable base provider identity even for collision variant settings keys. Extend redacted summaries with normalized source reasoning effort. Make classification and import compare/write the merged provider. Before credential set, use Host-only `credentials.describe(ref)`/`credentials.resolve(ref)` when available; on settings failure restore the previous value with `set`, or `unset` only if no previous value existed. Never place a secret in results or errors.
- [ ] **Step 4: Run `node --test test/mapper.test.js test/importer.test.js`; expect PASS, including manual reasoning preservation and credential rollback.
- [ ] **Step 5: Commit:** `git add lib/core/mapper.js lib/core/importer.js test/mapper.test.js test/importer.test.js && git commit -m "feat(core): preserve local model reasoning on reimport"`.

## Task 4: Add Host Routes and Secret-Safe Integration

**Files:** `src/host/routes.mjs`, `src/host/index.mjs`, `test/routes.test.mjs`.

- [ ] **Step 1: Write failing route tests** for redacted GET scan, POST import forwarding only `profileIds`/`expectedRevision`, loopback and same-origin fencing, wrong methods, malformed JSON, 64 KiB body cap, and secret-redacting errors.
- [ ] **Step 2: Run `node --test test/routes.test.mjs`; expect module-not-found failure.**
- [ ] **Step 3: Implement.** Add `API_BASE = "/api/dsh-ccswitch"`, `isLoopbackRequest`, `readJsonBody` with a 64 KiB cap, `safeError`, and `makeRoutes`. The scan handler calls `classifyProfiles(await scan(), await getProviders())` and serializes summaries only. The import handler accepts `{ profileIds: string[], expectedRevision?: number }`, re-scans Host-side profiles, and calls `importProfiles` with DSH settings and credentials. Reject non-loopback, cross-site, mismatched-origin, wrong-method, malformed, and oversized requests before invoking dependencies. Register routes through `ctx.webServer.register` inside `ctx.effect`, dispose all handles on teardown, and pass `ctx.settings.get("llm-pi-ai")`, `ctx.settings`, and `ctx.credentials` only on the Host.
- [ ] **Step 4: Run `node --test test/routes.test.mjs test/*.test.js test/*.test.mjs`; expect PASS with no secret-shaped response values.
- [ ] **Step 5: Commit:** `git add src/host test/routes.test.mjs && git commit -m "feat(host): expose secret-safe ccswitch import routes"`.

## Task 5: Migrate and Combine the Models Client UI

**Files:** `src/client/controller.mjs`, `src/client/registration.mjs`, `src/client/index.mjs`, `src/client/import-controller.mjs`, `src/client/styles.mjs`, `src/ui/ModelsReasoningComposite.mjs`, `src/ui/ReasoningSettingsSection.mjs`, `src/ui/CCSwitchImportSection.mjs`, `test/client.test.mjs`, `test/import-controller.test.mjs`.

- [ ] **Step 1: Write failing client tests.** Test `createCCSwitchImportController` with an injected fetch that returns one redacted summary from `/api/dsh-ccswitch/scan`; assert state stores only the summary. Test registration for one Models section at priority `-1` and four listeners: settings document, adapter updates, credentials updates, and connection reset.
- [ ] **Step 2: Run `node --test test/client.test.mjs test/import-controller.test.mjs`; expect missing-module failure.**
- [ ] **Step 3: Migrate the reasoning client.** Copy the existing reasoning controller, registration, styles, `ReasoningSettingsSection`, and `ModelsReasoningComposite`; rename every locale namespace, style ID, lifecycle label, loader ID, and visible standalone name to `dsh-ccswitch-importer`. Keep the raw slot lookup excluding the composite and call `builtIn.inject()` before rendering the native Models page.
- [ ] **Step 4: Implement the import controller.** Store only `phase`, redacted `profiles`, selected IDs, redacted `results`, and `error`. `scan()` GETs `/api/dsh-ccswitch/scan`; `importSelected()` POSTs `{ profileIds, expectedRevision }`; non-2xx or `{ error }` responses become UI errors. Invoke `onImported` to refresh reasoning after a successful import.
- [ ] **Step 5: Implement `CCSwitchImportSection`.** Render scan, select-all, redacted profile rows, disabled blocked rows, warnings, import action, and per-profile result statuses. Do not render API keys, raw TOML, database paths, or raw response objects. In `ModelsReasoningComposite`, render native Models first, the import section second, and `ReasoningSettingsSection` third. Update styles with stable import-row/status/warning classes while preserving the empty duplicate navigation-cell rule.
- [ ] **Step 6: Update Client entry.** Create the reasoning controller from `connection.api`; create the import controller with `globalThis.fetch.bind(globalThis)`, `getRevision: () => reasoning.getSnapshot().revision`, and `onImported: () => reasoning.refresh()`; register the one Models section and clean up styles/listeners in `ctx.effect`.
- [ ] **Step 7: Run client tests and `npm run build`; expect PASS and exactly one canonical ModuleLoader registration in `dist/client.js`.**
- [ ] **Step 8: Commit:** `git add src/client src/ui test/client.test.mjs test/import-controller.test.mjs scripts/build.mjs && git commit -m "feat(client): combine ccswitch import and model reasoning"`.

## Task 6: Documentation, Profile Migration, and Package Boundary

**Files:** `README.md`, `README.en.md`, active `~/.dsh/profiles` manifest, and installed plugin source registration.

- [ ] **Step 1: Add documentation assertions** that both READMEs mention Settings → Models, CCSwitch scan/import, editable reasoning depth, and no standalone reasoning page.
- [ ] **Step 2: Document** the single install name, read-only CCSwitch source, DSH credential storage, supported levels, unknown-model fallback, non-destructive re-import, official OAuth skip, and secret boundary in Chinese and English.
- [ ] **Step 3: Inspect the active profile before editing.** Remove only the old `dsh-model-reasoning-helper` package/row and add the built `dsh-ccswitch-importer` row; leave unrelated plugins/settings untouched and keep the old source directory until GUI verification.
- [ ] **Step 4: Run `npm test`, `npm run pack:check`, and `git diff --check`; expect all pass and dry-run to contain only the canonical runtime plus both READMEs.
- [ ] **Step 5: Commit docs separately:** `git add README.md README.en.md && git commit -m "docs: document unified ccswitch importer"`. Commit profile changes separately after the GUI loads the new bundle.

## Task 7: End-to-End Verification

**Files:** generated `dist/index.mjs`, `dist/client.js`, DSH GUI `http://127.0.0.1:5624`, active profile.

- [ ] **Step 1: Run `npm test && npm run pack:check && git diff --check`; capture actual output before claiming success.**
- [ ] **Step 2: Assert generated invariants:** one `window.__ModuleLoader__.load` for `dsh-ccswitch-importer`, no old loader ID, and no fixture secret in route/UI outputs.
- [ ] **Step 3: Refresh the GUI, open Settings → Models, verify native provider/model editing, scan/select/import one profile, verify the new model appears in the same page, save a reasoning level, and choose it in the model selector. Use desktop and narrow viewport screenshots to check layout and overlap.
- [ ] **Step 4: Leave the old source directory uninstalled; do not delete it without a separate cleanup request.**
- [ ] **Step 5: Report changed files, commit IDs, test output, pack contents, GUI evidence, and residual risks.**

## Plan Self-Review

- Spec coverage is explicit: naming/publication (Tasks 1 and 6), reasoning parsing and fallback (Task 2), non-destructive re-import and rollback (Task 3), secret-safe Host boundary (Task 4), same-page UI (Task 5), docs/profile (Task 6), and GUI evidence (Task 7).
- No task depends on an unspecified helper or later design choice; exact paths, commands, fields, and merge rules are stated.
- `modelReasoningEffort` is Host-only, `reasoningEffort` is the redacted summary, `reasoningEfforts` is the model capability map, and `reasoning` is the route default.
