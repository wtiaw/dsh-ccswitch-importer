import { normalizeReasoningEfforts } from "./validation.mjs";

export function updateModelReasoning(provider, modelId, mode, efforts) {
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

export function settingsMutation(route, before, after) {
  if (before?.models === after?.models) return { ns: "llm-pi-ai", ops: [] };
  return {
    ns: "llm-pi-ai",
    ops: [{
      op: "set",
      path: ["providers", route, "models"],
      value: after.models,
    }],
  };
}
