# Reasoning Editor Refresh Conflict Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Protect per-model reasoning drafts from silent remote refresh overwrites, expose saving progress to assistive technology, and publish the fix as v0.1.2 without changing Host or settings-schema contracts.

**Architecture:** Add a pure editor-state module that converts models to drafts, canonicalizes draft signatures, and reconciles remote snapshots against a local draft baseline. Extend the existing Client controller save method with an optional baseline revision and return the refreshed snapshot. Keep draft, baseline, revision, and remote-update state in ModelEditor; clean drafts follow remote data, dirty drafts remain visible until the user explicitly reloads.

**Tech Stack:** React 18 createElement hooks, Node.js ESM test runner, esbuild bundle generation, DSH semantic CSS tokens, DSH Desktop CDP smoke checks.

---

## Scope and File Map

- Create: src/ui/reasoning-editor-state.mjs, pure model-to-draft and reconciliation helpers.
- Create: test/reasoning-editor-state.test.mjs, helper behavior tests.
- Modify: src/client/controller.mjs, optional expected revision and returned refreshed snapshot.
- Create: test/reasoning-controller.test.mjs, controller request/response tests.
- Modify: src/ui/ReasoningSettingsSection.mjs, draft reconciliation, reload action, and live status.
- Modify: src/client/styles.mjs, semantic styles for saving and reload states.
- Modify: test/client-ui.test.mjs, source contract assertions.
- Modify late: package.json and package-lock.json, bump 0.1.1 to 0.1.2.
- Generated late: dist/client.js, rebuilt after Client changes.

No Host files, settings schema, import flow, validation semantics, or reasoningEfforts === false behavior are in scope.

### Task 1: Add pure draft reconciliation with failing tests

**Files:** Create test/reasoning-editor-state.test.mjs first; create src/ui/reasoning-editor-state.mjs after the focused tests are red.

- [ ] Step 1: Write four failing tests covering clean remote adoption, dirty draft preservation, effort-key insertion-order independence, and explicit reload. Import draftForModel, draftSignature, reconcileDraft, and reloadDraft from the not-yet-created module.
- [ ] Step 2: Run node --test test/reasoning-editor-state.test.mjs. Expected failure: the helper module is missing. Correct test typos if needed until the failure is specifically the missing helper.
- [ ] Step 3: Implement the helper with these exact contracts:

  - draftForModel(model): false -> { mode: 'disabled', efforts: {} }; object -> copied enabled efforts; otherwise use reasoningStateForModel(model.id).
  - draftSignature(draft): JSON.stringify([draft.mode, sorted Object.entries(draft.efforts ?? {})]).
  - reconcileDraft({ draft, baseline, baselineRevision, remoteModel, remoteRevision, remoteChanged }): derive remoteDraft. If remote signature equals baseline signature, keep the local draft and update baselineRevision. If the local draft signature equals baseline signature, adopt remoteDraft as draft and baseline and clear remoteChanged. Otherwise preserve draft/baseline/revision and set remoteChanged true.
  - reloadDraft({ remoteModel, remoteRevision }): return remote model draft as both draft and baseline, with the remote revision and remoteChanged false.

- [ ] Step 4: Run node --test test/reasoning-editor-state.test.mjs and node --check src/ui/reasoning-editor-state.mjs. Expected: 4 passing tests.
- [ ] Step 5: Commit only the helper and its tests with fix(ui): protect reasoning drafts from refresh.

### Task 2: Make controller saves revision-aware

**Files:** Create test/reasoning-controller.test.mjs; modify src/client/controller.mjs.

- [ ] Step 1: Write a test with two queued describe responses: revision 3 before save and revision 4 after save. Call controller.save('route', 'model', 'enabled', { low: 'custom-low' }, 2), assert mutate received expectedRevision 2, assert the returned snapshot has revision 4 and the refreshed wire value.
- [ ] Step 2: Run node --test test/reasoning-controller.test.mjs. Expected failure: save ignores the fifth argument and returns undefined.
- [ ] Step 3: Change the controller signature to save(route, modelId, mode, efforts, expectedRevision = snapshot.revision), pass expectedRevision to api.settings.mutate, refresh, then return controller.getSnapshot(). Preserve the existing default behavior for callers that pass four arguments.
- [ ] Step 4: Run node --test test/reasoning-controller.test.mjs test/client.test.mjs. Expected: focused controller and registration tests pass.
- [ ] Step 5: Commit only controller and controller tests with fix(controller): preserve reasoning save revisions.

### Task 3: Add failing UI contracts

**Files:** Modify test/client-ui.test.mjs.

- [ ] Step 1: Add assertions for aria-live="polite", dsh-reasoning-status--saving, 远端已更新, 重新载入, reloadDraft, draftSignature, and the five-argument controller.save call using draft.mode, draft.efforts, and baselineRevision.
- [ ] Step 2: Run node --test test/client-ui.test.mjs. Expected: the new assertions fail because the current component has no live saving state or remote reload action.

### Task 4: Integrate reconciliation into ModelEditor

**Files:** Modify src/ui/ReasoningSettingsSection.mjs.

- [ ] Step 1: Import useRef and the four helpers. Replace the duplicated model initialization with draftForModel(model).
- [ ] Step 2: Track draft, baseline, baselineRevision, remoteChanged, status, and customOpen. Initialize baselineRevision from controller.getSnapshot().revision and keep a draftRef synchronized with the current draft.
- [ ] Step 3: Add an effect that calls reconcileDraft when model.id, model.reasoningEfforts, or controller revision changes. Compare draft signatures before setDraft to avoid effect loops. A clean draft adopts remote data; a dirty draft remains intact and sets remoteChanged.
- [ ] Step 4: Update mode buttons, effort checkboxes, custom inputs, selectedCount, and enabled-body conditions to read draft.mode and draft.efforts. Keep false as an editable disabled mode.
- [ ] Step 5: Add reload(): read the newest matching model from controller.getSnapshot(), call reloadDraft, replace draft/baseline/revision, clear remoteChanged, and clear status. Render a reload button labeled 重新载入 only when remoteChanged, with a remote-update notice labeled 远端已更新.
- [ ] Step 6: Keep one persistent footer live region with role=status and aria-live=polite. Give saving the dsh-reasoning-status--saving class and text 保存中…, success text 已保存, and errors the existing message. Do not omit the region while saving; keep Save disabled while saving.
- [ ] Step 7: Save using controller.save(route, model.id, draft.mode, draft.efforts, baselineRevision). On success, adopt the returned snapshot as the new baseline only if the current draft signature still equals the signature saved. On failure, keep the draft and expose the error through the live region.
- [ ] Step 8: Run node --test test/reasoning-editor-state.test.mjs test/reasoning-controller.test.mjs test/client-ui.test.mjs and node --check src/ui/ReasoningSettingsSection.mjs. Expected: all focused tests pass.
- [ ] Step 9: Commit the component and UI tests with fix(ui): reconcile reasoning drafts on refresh.

### Task 5: Style and verify the new UI states

**Files:** Modify src/client/styles.mjs and test/client-ui.test.mjs if a CSS assertion is needed.

- [ ] Step 1: Add semantic-token-only rules for dsh-reasoning-status--saving and dsh-reasoning-reload. Keep the existing footer flex-wrap, min-width:0, focus states, and light/dark token usage. Use the existing border, background, label, and brand tokens; add no hex colors.
- [ ] Step 2: Run node --test test/client-ui.test.mjs, node --check src/client/styles.mjs, and git diff --check. Expected: all UI contracts pass.
- [ ] Step 3: Commit the style change with fix(ui): expose reasoning save states.

### Task 6: Build, release, and verify v0.1.2

**Files:** Modify package.json and package-lock.json late; generate dist/client.js.

- [ ] Step 1: Run npm test before version bump. Record the exact total and failures; expected failure count is zero.
- [ ] Step 2: Run npm run build, then grep -n -E 'reconcileDraft|aria-live|dsh-reasoning-reload|dsh-reasoning-status--saving' dist/client.js. Confirm generated bundle contains all new markers and inspect git status for real generated changes.
- [ ] Step 3: Change only package.json version and package-lock.json root/packages[""].version from 0.1.1 to 0.1.2.
- [ ] Step 4: Run npm test, npm run pack:check, and git diff --check. Expected: tests pass, pack dry-run prints dsh-ccswitch-importer-0.1.2.tgz, and no whitespace errors occur.
- [ ] Step 5: Refresh the existing DSH Desktop instance and rediscover its dynamic Web port. At 375px light and dark, verify scrollWidth equals innerWidth, footer/reload controls fit, dirty edits survive a settings refresh, 远端已更新 appears, 重新载入 adopts remote values, and the live region transitions through 保存中… to 已保存 or an error. Do not mutate unrelated user settings.
- [ ] Step 6: Review status, diff, generated bundle parity, and tag availability. Commit version metadata, create annotated v0.1.2, push main and the tag via the existing SSH-over-443 command, create a non-draft GitHub Release, and verify remote main, peeled tag, release URL, and a clean worktree.

## Plan Self-Review

- Spec coverage: clean adoption and dirty preservation are covered by Tasks 1 and 4; reload by Task 4; revision baseline by Task 2 and 4; live status by Tasks 3-5; Host/schema/disabled-mode boundaries by the scope fence and explicit constraints.
- Placeholder scan: every implementation step names concrete files, commands, expected results, and interfaces; no unresolved placeholders remain.
- Interface consistency: the helper exports draftForModel, draftSignature, reconcileDraft, and reloadDraft; the UI imports those names. Controller save takes route, modelId, mode, efforts, expectedRevision and returns the refreshed snapshot.
- Release boundary: no version bump or tag occurs until behavior tests, bundle parity, Desktop checks, and package checks pass.
