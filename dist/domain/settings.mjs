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
  "gpt-5.6-luna": GPT_56_REASONING,
  "gpt-5.6-terra": GPT_56_REASONING,
  o1: O_SERIES_REASONING,
  "o1-pro": O_SERIES_REASONING,
  o3: O_SERIES_REASONING,
  "o3-mini": O_SERIES_REASONING,
  "o3-pro": O_SERIES_REASONING,
  "o4-mini": O_SERIES_REASONING
});

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

// src/domain/settings.mjs
function updateModelReasoning(provider, modelId, mode, efforts) {
  const models = Array.isArray(provider?.models) ? provider.models : [];
  const ids = models.map((model) => model?.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate model ID");
  const index = ids.indexOf(modelId);
  if (index < 0) throw new Error(`model not found: ${modelId}`);
  const nextModels = models.map((model, at) => {
    if (at !== index) return { ...model };
    const next = { ...model };
    if (mode === "disabled") {
      next.reasoningEfforts = false;
    } else if (mode === "enabled") {
      next.reasoningEfforts = normalizeReasoningEfforts(efforts);
    } else {
      throw new Error(`unknown reasoning mode: ${mode}`);
    }
    return next;
  });
  return { ...provider, models: nextModels };
}
function settingsMutation(route, before, after) {
  if (before?.models === after?.models) return { ns: "llm-pi-ai", ops: [] };
  return {
    ns: "llm-pi-ai",
    ops: [{
      op: "set",
      path: ["providers", route, "models"],
      value: after.models
    }]
  };
}
export {
  settingsMutation,
  updateModelReasoning
};
