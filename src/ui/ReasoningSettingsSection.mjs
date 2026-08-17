import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LEVELS, reasoningStateForModel } from "../domain/validation.mjs";

const h = React.createElement;

function ModelEditor({ route, model, controller, writable }) {
  const initial = useMemo(() => {
    if (model.reasoningEfforts === false) return { mode: "disabled", efforts: {} };
    if (model.reasoningEfforts && typeof model.reasoningEfforts === "object") {
      return { mode: "enabled", efforts: { ...model.reasoningEfforts } };
    }
    const inferred = reasoningStateForModel(model.id);
    return { mode: inferred.mode, efforts: { ...(inferred.efforts ?? {}) } };
  }, [model.id, model.reasoningEfforts]);
  const [mode, setMode] = useState(initial.mode);
  const [efforts, setEfforts] = useState(initial.efforts);
  const [status, setStatus] = useState("");

  const toggleLevel = (level, checked) => {
    setEfforts((current) => {
      const next = { ...current };
      if (!checked) delete next[level];
      else next[level] = level === "off" ? null : level;
      return next;
    });
  };

  const save = async () => {
    setStatus("saving");
    try {
      await controller.save(route, model.id, mode, efforts);
      setStatus("saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  return h("div", { className: "dsh-reasoning-model" },
    h("div", { className: "dsh-reasoning-model__header" },
      h("strong", null, model.name || model.id),
      h("code", null, model.id),
      h("select", {
        value: mode,
        disabled: !writable,
        onChange: (event) => setMode(event.target.value),
        "aria-label": `${model.id} reasoning mode`,
      },
      h("option", { value: "disabled" }, "Disabled"),
      h("option", { value: "enabled" }, "Enabled"))),
    mode === "enabled" && h("div", { className: "dsh-reasoning-levels" },
      ...LEVELS.map((level) => h("label", { key: level, className: "dsh-reasoning-level" },
        h("input", {
          type: "checkbox",
          checked: Object.hasOwn(efforts, level),
          disabled: !writable,
          onChange: (event) => toggleLevel(level, event.target.checked),
        }),
        h("span", null, level),
        h("input", {
          type: "text",
          value: efforts[level] ?? "",
          placeholder: level === "off" ? "omit or none" : level,
          disabled: !writable || !Object.hasOwn(efforts, level),
          onChange: (event) => setEfforts((current) => ({ ...current, [level]: event.target.value })),
          "aria-label": `${model.id} ${level} wire value`,
        })))),
    h("div", { className: "dsh-reasoning-model__actions" },
      h("button", { type: "button", disabled: !writable || status === "saving", onClick: save }, status === "saving" ? "Saving..." : "Save"),
      status && status !== "saving" && h("span", { role: "status" }, status)));
}

function renderProvider([route, provider], controller, writable) {
  return h(
    "section",
    { key: route, className: "dsh-reasoning-provider" },
    h("h3", null, route),
    ...provider.models.map((model) => h(ModelEditor, {
      key: model.id,
      route,
      model,
      controller,
      writable,
    })),
  );
}

export function ReasoningSettingsSection({ controller, embedded = false }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const providers = Object.entries(snapshot.providers).filter(([, provider]) => Array.isArray(provider?.models));
  useEffect(() => {
    if (snapshot.status === "idle") void controller.refresh();
  }, [controller, snapshot.status]);
  if (snapshot.status === "loading" && providers.length === 0) return h("p", null, "Loading model reasoning settings...");
  if (snapshot.status === "error") return h("p", { role: "alert" }, snapshot.error);
  return h(
    "section",
    { className: embedded ? "dsh-reasoning-settings dsh-reasoning-settings--embedded" : "dsh-reasoning-settings" },
    !embedded && h("header", null,
      h("h2", null, "Model reasoning"),
      h("p", null, "Configure reasoning levels for custom provider models."),
    ),
    providers.length === 0
      ? h("p", null, "No custom provider models found.")
      : providers.map((entry) => renderProvider(entry, controller, snapshot.writable)),
  );
}
