// src/domain/catalog.mjs
var GPT_56_REASONING = Object.freeze({
  off: "none",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "max"
});
var O_SERIES_REASONING = Object.freeze({
  off: null,
  low: "low",
  medium: "medium",
  high: "high"
});
var KNOWN_REASONING_CATALOG = Object.freeze({
  "gpt-5.6-sol": GPT_56_REASONING,
  o1: O_SERIES_REASONING,
  "o1-pro": O_SERIES_REASONING,
  o3: O_SERIES_REASONING,
  "o3-mini": O_SERIES_REASONING,
  "o3-pro": O_SERIES_REASONING,
  "o4-mini": O_SERIES_REASONING
});
function cloneReasoningEfforts(efforts) {
  return efforts === void 0 ? void 0 : { ...efforts };
}
function knownReasoningFor(modelId) {
  if (typeof modelId !== "string") return void 0;
  const key = modelId.trim().toLowerCase();
  if (["luna", "sol", "terra"].includes(key.replace("gpt-5.6-", ""))) return cloneReasoningEfforts(GPT_56_REASONING);
  return cloneReasoningEfforts(KNOWN_REASONING_CATALOG[key]);
}

// src/domain/validation.mjs
var LEVELS = Object.freeze(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
var LEVEL_SET = new Set(LEVELS);
function validateReasoningEfforts(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, message: "reasoning efforts must be an object" };
  }
  for (const [level, wire] of Object.entries(value)) {
    if (!LEVEL_SET.has(level)) return { ok: false, message: `unsupported reasoning level: ${level}` };
    if (wire !== null && typeof wire !== "string") {
      return { ok: false, message: `wire value for ${level} must be a string or null` };
    }
    if (level !== "off" && (wire === null || wire.trim() === "")) {
      return { ok: false, message: "non-off reasoning levels need a non-empty wire value" };
    }
  }
  if (!Object.keys(value).some((level) => level !== "off")) {
    return { ok: false, message: "at least one non-off reasoning level is required" };
  }
  return { ok: true };
}
function normalizeReasoningEfforts(value) {
  const result = validateReasoningEfforts(value);
  if (!result.ok) throw new Error(result.message);
  return { ...value };
}
function reasoningStateForModel(modelId, draft) {
  if (draft?.mode === "disabled") return { mode: "disabled", efforts: void 0 };
  if (draft?.mode === "enabled") {
    return { mode: "enabled", efforts: normalizeReasoningEfforts(draft.efforts) };
  }
  const known = knownReasoningFor(modelId);
  return known === void 0 ? { mode: "disabled", efforts: void 0 } : { mode: "enabled", efforts: known };
}
export {
  LEVELS,
  normalizeReasoningEfforts,
  reasoningStateForModel,
  validateReasoningEfforts
};
