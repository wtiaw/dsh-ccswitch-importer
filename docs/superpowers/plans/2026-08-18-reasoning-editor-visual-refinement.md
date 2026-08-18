# Reasoning Editor Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize each per-model reasoning editor into a clear header, effort-selection body, and save footer while preserving all existing settings and wire-value behavior.

**Architecture:** Keep state and persistence inside the existing `ModelEditor`; add presentation-only wrappers and derived selected-count text. Replace only the reasoning-editor CSS rules, retain DSH semantic theme tokens, and rebuild the existing client bundle.

**Tech Stack:** React `createElement`, ESM, serialized CSS, Node test runner, esbuild, DSH Desktop/WebView2.

---

## File Map

- Modify `test/client-ui.test.mjs`: source-level DOM/CSS contract assertions for the new hierarchy and responsive rules.
- Modify `src/ui/ReasoningSettingsSection.mjs`: two-level model editor DOM and selected-count presentation.
- Modify `src/client/styles.mjs`: model block, mode area, effort options, custom mapping, footer, and narrow-screen styling.
- Rebuild `dist/client.js`: generated Desktop client bundle.

### Task 1: Lock the new visual contract with a failing test

- [ ] **Step 1: Extend the reasoning editor UI contract test**

Add assertions that require these source hooks:

```js
assert.match(ui, /dsh-reasoning-model__header/)
assert.match(ui, /dsh-reasoning-model__mode-area/)
assert.match(ui, /dsh-reasoning-model__body/)
assert.match(ui, /dsh-reasoning-model__footer/)
assert.match(ui, /dsh-reasoning-levels__heading/)
assert.match(ui, /dsh-reasoning-levels__options/)
assert.match(ui, /已选.*项/)
assert.match(ui, /dsh-reasoning-custom__toggle--active/)
assert.match(styles, /.dsh-reasoning-model{[^}]*border-radius:8px/)
assert.match(styles, /.dsh-reasoning-model__footer{[^}]*justify-content:flex-end/)
assert.match(styles, /.dsh-reasoning-levels__options{[^}]*flex-wrap:wrap/)
assert.match(styles, /.dsh-reasoning-custom__toggle{[^}]*width:100%/)
```

- [ ] **Step 2: Run the targeted test and confirm red**

Run: `node --test test/client-ui.test.mjs`

Expected: failure because `dsh-reasoning-model__header` and the other new hooks do not exist.

### Task 2: Implement the two-level model editor structure

- [ ] **Step 1: Add the derived selected count**

Inside `ModelEditor`, derive `selectedCount` from keys in `efforts`; do not add state or persistence fields.

```js
const selectedCount = Object.keys(efforts).length;
```

- [ ] **Step 2: Replace the model editor presentation tree**

Use this structure while retaining the existing controls, callbacks, ARIA attributes, and save call:

```text
article.dsh-reasoning-model
  header.dsh-reasoning-model__header
    div.dsh-reasoning-model__identity
    div.dsh-reasoning-model__mode-area
      span.dsh-reasoning-model__mode-label
      div.dsh-reasoning-mode
  div.dsh-reasoning-model__body (enabled only)
    div.dsh-reasoning-levels
      div.dsh-reasoning-levels__heading
      div.dsh-reasoning-levels__options
    div.dsh-reasoning-custom
  footer.dsh-reasoning-model__footer
    status span when present
    button.dsh-reasoning-save
```

The effort summary text is `已选 ${selectedCount} 项`. The custom toggle class adds `dsh-reasoning-custom__toggle--active` only while expanded. Preserve `controller.save(route, model.id, mode, efforts)` exactly.

- [ ] **Step 3: Run the targeted test**

Run: `node --test test/client-ui.test.mjs`

Expected: component hook assertions pass; CSS assertions remain red until Task 3.

### Task 3: Implement theme-safe desktop and mobile styling

- [ ] **Step 1: Replace the flat reasoning row rules**

Implement one lightweight model block with:

```css
.dsh-reasoning-model { min-width:0; overflow:hidden; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-1); }
.dsh-reasoning-model__header { display:flex; align-items:center; justify-content:space-between; gap:12px; min-width:0; padding:12px; }
.dsh-reasoning-model__body { min-width:0; padding:12px; border-top:1px solid var(--dsw-alias-border-l2); }
.dsh-reasoning-model__footer { display:flex; align-items:center; justify-content:flex-end; gap:8px; min-width:0; padding:10px 12px; border-top:1px solid var(--dsw-alias-border-l2); }
```

- [ ] **Step 2: Style the mode and effort hierarchy**

Use `label-tertiary` for the small mode label, retain primary button tokens for the active segmented option, add an effort heading/summary row, and place effort labels inside a wrapping options container. Keep checkboxes visually hidden but focusable; add a semantic `focus-within` outline and disabled opacity.

- [ ] **Step 3: Style advanced mapping and footer states**

Make the custom toggle full width with left/right alignment and an active modifier. Keep current input values and field grid; use `bg-layer-1`, `border-l2`, and label tokens. Keep save success/error pills and make Save the footer primary action.

- [ ] **Step 4: Add the 640px layout rules**

At narrow width, stack the header, keep the mode area full-width, preserve wrapping effort pills, collapse custom fields to one column, and set all reasoning block containers to `min-width:0`. Do not alter the existing host-nav collapse behavior.

- [ ] **Step 5: Run the targeted test and confirm green**

Run: `node --test test/client-ui.test.mjs`

Expected: all UI contract tests pass.

- [ ] **Step 6: Commit source and test changes**

```bash
git add src/ui/ReasoningSettingsSection.mjs src/client/styles.mjs test/client-ui.test.mjs
git commit -m "fix(ui): refine reasoning editor hierarchy"
```

### Task 4: Build and verify the client bundle

- [ ] **Step 1: Run the full suite**

Run: `npm test`

Expected: 67 tests pass, 0 fail (one new UI contract test or the expanded test count as implemented).

- [ ] **Step 2: Run package and diff checks**

Run: `npm run pack:check` and `git diff --check`.

Expected: package dry-run succeeds and no whitespace errors are reported.

- [ ] **Step 3: Confirm generated bundle parity**

Confirm `dist/client.js` contains the new hierarchy classes and matches the build output. Stage only real generated content; ignore Windows line-ending/index noise whose blob hash equals HEAD.

- [ ] **Step 4: Commit the generated bundle**

```bash
git add dist/client.js
git commit -m "build: refresh desktop client bundle"
```

### Task 5: Verify in the real DSH Desktop

- [ ] **Step 1: Rebuild/load the plugin in the existing Desktop instance**

Discover the current dynamic Web port after any restart and verify the boot manifest revision; do not start a replacement Vite server.

- [ ] **Step 2: Verify desktop light and dark layouts**

At 1440px, inspect the model header, mode segmented control, selected effort pills, full-width custom mapping toggle, footer Save/status, and a model with reasoning disabled. Assert document `scrollWidth === innerWidth`.

- [ ] **Step 3: Verify narrow light and dark layouts**

At 375px, confirm the settings nav remains 56px, model blocks stay inside the content area, effort pills wrap, footer controls remain readable, and document `scrollWidth === 375`.

- [ ] **Step 4: Verify interaction states**

Expand and collapse custom wire mapping, toggle one effort without saving, and verify the visible state changes. Exercise Save only if it can be restored to the original value in the same check; otherwise use the existing controller tests for persistence and visually inspect non-mutating states.

- [ ] **Step 5: Request code review and integrate only after approval**

Review the diff for semantic tokens, responsiveness, accessibility, and unchanged controller/data contracts. Fast-forward the feature branch into `main` only after tests and browser evidence pass. Keep version bump/tag/release as a separate final release step.
