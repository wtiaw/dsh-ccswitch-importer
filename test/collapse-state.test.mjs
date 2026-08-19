import test from "node:test";
import assert from "node:assert/strict";
import {
  COLLAPSE_KEY,
  isModelCollapsed,
  loadCollapse,
  withPanelToggled,
  normalizeCollapse,
  saveCollapse,
  withModelToggled,
} from "../src/ui/collapse-state.mjs";

function createStorage(value = null) {
  let stored = value;
  return {
    getItem(key) { return key === COLLAPSE_KEY ? stored : null; },
    setItem(key, next) { if (key === COLLAPSE_KEY) stored = next; },
    read() { return stored; },
  };
}

test("normalizeCollapse keeps only supported boolean state", () => {
  const state = normalizeCollapse({
    reasoningPanel: true,
    importPanel: "yes",
    models: {
      provider: { modelA: true, modelB: false, ignored: "true" },
      invalid: "not-an-object",
    },
  });
  assert.equal(state.reasoningPanel, true);
  assert.equal(state.importPanel, false);
  assert.equal(isModelCollapsed(state, "provider", "modelA"), true);
  assert.equal(isModelCollapsed(state, "provider", "modelB"), false);
  assert.equal(isModelCollapsed(state, "provider", "ignored"), false);
  assert.equal(isModelCollapsed(state, "invalid", "modelA"), false);
});

test("loadCollapse tolerates missing and malformed storage", () => {
  assert.deepEqual(loadCollapse(createStorage()), normalizeCollapse({}));
  assert.deepEqual(loadCollapse(createStorage("{")), normalizeCollapse({}));
  assert.deepEqual(loadCollapse(null), normalizeCollapse({}));
});

test("saveCollapse and loadCollapse round-trip normalized preferences", () => {
  const storage = createStorage();
  const state = {
    reasoningPanel: true,
    importPanel: false,
    models: { provider: { modelA: true, modelB: false } },
  };
  assert.equal(saveCollapse(state, storage), true);
  assert.match(storage.read(), /"reasoningPanel":true/);
  assert.deepEqual(loadCollapse(storage), normalizeCollapse(state));
});

test("withPanelToggled flips only supported panels", () => {
  const before = normalizeCollapse({ reasoningPanel: false, importPanel: false });
  const next = withPanelToggled(before, "reasoningPanel");
  assert.equal(next.reasoningPanel, true);
  assert.equal(next.importPanel, false);
  assert.equal(withPanelToggled(next, "unknown"), next);
});

test("withModelToggled does not mutate prior state", () => {
  const before = normalizeCollapse({ models: { provider: { modelA: true } } });
  const expanded = withModelToggled(before, "provider", "modelA", false);
  const collapsed = withModelToggled(expanded, "provider", "modelB", true);
  assert.equal(isModelCollapsed(before, "provider", "modelA"), true);
  assert.equal(isModelCollapsed(expanded, "provider", "modelA"), false);
  assert.equal(isModelCollapsed(collapsed, "provider", "modelB"), true);
  assert.equal(before.models.provider.modelA, true);
  assert.equal(Object.keys(before.models.provider).length, 1);
});