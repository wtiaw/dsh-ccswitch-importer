import { knownReasoningFor } from "./catalog.mjs";

export const LEVELS = Object.freeze(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
const LEVEL_SET = new Set(LEVELS);

export function validateReasoningEfforts(value) {
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

export function normalizeReasoningEfforts(value) {
  const result = validateReasoningEfforts(value);
  if (!result.ok) throw new Error(result.message);
  return { ...value };
}

export function reasoningStateForModel(modelId, draft) {
  if (draft?.mode === "disabled") return { mode: "disabled", efforts: undefined };
  if (draft?.mode === "enabled") {
    return { mode: "enabled", efforts: normalizeReasoningEfforts(draft.efforts) };
  }
  const known = knownReasoningFor(modelId);
  return known === undefined
    ? { mode: "disabled", efforts: undefined }
    : { mode: "enabled", efforts: known };
}
