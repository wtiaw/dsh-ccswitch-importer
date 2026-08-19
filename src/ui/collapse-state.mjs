/**
 * Collapse preferences for the reasoning editor panels, persisted in localStorage.
 *
 * Kept as pure functions so the storage shape, merging and defaults are
 * unit-testable without a DOM. A storage backend is injectable; it defaults
 * to the browser localStorage when available.
 */

export const COLLAPSE_KEY = "dsh-ccswitch-importer:collapse:v1";

const EMPTY = Object.freeze({
  reasoningPanel: false,
  importPanel: false,
  models: Object.create(null),
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Normalize an unknown parsed value into the stable collapse shape, so
 * malformed or outdated payloads degrade gracefully instead of throwing.
 */
export function normalizeCollapse(input) {
  const out = {
    reasoningPanel: false,
    importPanel: false,
    models: Object.create(null),
  };
  if (!isRecord(input)) return out;
  out.reasoningPanel = input.reasoningPanel === true;
  out.importPanel = input.importPanel === true;
  if (isRecord(input.models)) {
    for (const route of Object.keys(input.models)) {
      const byModel = input.models[route];
      if (!isRecord(byModel)) continue;
      const normalized = Object.create(null);
      for (const modelId of Object.keys(byModel)) {
        if (byModel[modelId] === true) normalized[modelId] = true;
      }
      out.models[route] = normalized;
    }
  }
  return out;
}

/**
 * Read persisted collapse state. Returns the normalized state and never throws.
 */
export function loadCollapse(storage = defaultStorage()) {
  if (!storage) return EMPTY;
  try {
    const raw = storage.getItem(COLLAPSE_KEY);
    if (raw == null) return EMPTY;
    return normalizeCollapse(JSON.parse(raw));
  } catch {
    return EMPTY;
  }
}

/**
 * Persist collapse state. Returns true on success, false when unavailable.
 */
export function saveCollapse(state, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(COLLAPSE_KEY, JSON.stringify(normalizeCollapse(state)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Produce the next state with one model card toggled, without mutating the input.
 */
export function withPanelToggled(state, panel) {
  if (panel !== "reasoningPanel" && panel !== "importPanel") return state;
  return { ...state, [panel]: state?.[panel] !== true };
}

export function withModelToggled(state, route, modelId, collapsed) {
  const models = { ...(state.models ?? {}) };
  const byRoute = { ...(models[route] ?? {}) };
  if (collapsed) byRoute[modelId] = true;
  else delete byRoute[modelId];
  if (Object.keys(byRoute).length === 0) delete models[route];
  else models[route] = byRoute;
  return { ...state, models };
}

/**
 * True when the given model card should render collapsed (unexpanded).
 */
export function isModelCollapsed(state, route, modelId) {
  return state?.models?.[route]?.[modelId] === true;
}

function defaultStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
