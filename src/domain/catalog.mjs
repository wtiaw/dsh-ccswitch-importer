const GPT_56_REASONING = Object.freeze({
  off: "none",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "max",
});

const O_SERIES_REASONING = Object.freeze({
  off: null,
  low: "low",
  medium: "medium",
  high: "high",
});

export const KNOWN_REASONING_CATALOG = Object.freeze({
  "gpt-5.6-sol": GPT_56_REASONING,
  "gpt-5.6-luna": GPT_56_REASONING,
  "gpt-5.6-terra": GPT_56_REASONING,
  o1: O_SERIES_REASONING,
  "o1-pro": O_SERIES_REASONING,
  o3: O_SERIES_REASONING,
  "o3-mini": O_SERIES_REASONING,
  "o3-pro": O_SERIES_REASONING,
  "o4-mini": O_SERIES_REASONING,
});

export function cloneReasoningEfforts(efforts) {
  return efforts === undefined ? undefined : { ...efforts };
}

export function knownReasoningFor(modelId) {
  if (typeof modelId !== "string") return undefined;
  const key = modelId.trim().toLowerCase();
  return cloneReasoningEfforts(KNOWN_REASONING_CATALOG[key]);
}
