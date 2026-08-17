import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LEVELS, reasoningStateForModel } from "../domain/validation.mjs";

const h = React.createElement;

function displayStatus(status) {
  if (status === "saving") return "保存中…";
  if (status === "saved") return "已保存";
  return status;
}

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
  const [customOpen, setCustomOpen] = useState(false);

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

  const modelName = model.name || model.id;
  return h("article", { className: "dsh-reasoning-model" },
    h("div", { className: "dsh-reasoning-model__top" },
      h("div", { className: "dsh-reasoning-model__identity" },
        h("strong", null, modelName),
        model.id !== modelName && h("code", null, model.id),
      ),
      h("div", { className: "dsh-reasoning-model__actions" },
        h("div", { className: "dsh-reasoning-mode", role: "group", "aria-label": `${model.id} 推理模式` },
          h("button", {
            type: "button",
            className: mode === "disabled" ? "dsh-reasoning-mode__option dsh-reasoning-mode__option--active" : "dsh-reasoning-mode__option",
            "aria-pressed": mode === "disabled",
            disabled: !writable,
            onClick: () => setMode("disabled"),
          }, "关闭"),
          h("button", {
            type: "button",
            className: mode === "enabled" ? "dsh-reasoning-mode__option dsh-reasoning-mode__option--active" : "dsh-reasoning-mode__option",
            "aria-pressed": mode === "enabled",
            disabled: !writable,
            onClick: () => setMode("enabled"),
          }, "启用"),
        ),
        h("button", { className: "dsh-reasoning-save", type: "button", disabled: !writable || status === "saving", onClick: save }, status === "saving" ? "保存中…" : "保存"),
        status && status !== "saving" && h("span", { role: "status", className: status === "saved" ? "dsh-reasoning-status dsh-reasoning-status--success" : "dsh-reasoning-status dsh-reasoning-status--error" }, displayStatus(status)),
      ),
    ),
    mode === "enabled" && h("div", { className: "dsh-reasoning-levels", "aria-label": `${model.id} 可用推理等级` },
      h("span", { className: "dsh-reasoning-levels__label" }, "可用等级"),
      ...LEVELS.map((level) => h("label", { key: level, className: "dsh-reasoning-level" },
        h("input", {
          type: "checkbox",
          checked: Object.hasOwn(efforts, level),
          disabled: !writable,
          onChange: (event) => toggleLevel(level, event.target.checked),
        }),
        h("span", null, level),
      )),
    ),
    mode === "enabled" && h("div", { className: "dsh-reasoning-custom" },
      h("button", {
        type: "button",
        className: "dsh-reasoning-custom__toggle",
        "aria-expanded": customOpen,
        onClick: () => setCustomOpen((current) => !current),
      }, customOpen ? "收起自定义映射" : "自定义 wire 值",
      h("span", { "aria-hidden": "true" }, customOpen ? "⌃" : "⌄")),
      customOpen && h("div", { className: "dsh-reasoning-custom__body" },
        ...LEVELS.filter((level) => Object.hasOwn(efforts, level)).map((level) => h("label", { key: level, className: "dsh-reasoning-custom__field" },
          h("span", null, level === "off" ? "off" : level),
          h("input", {
            type: "text",
            value: efforts[level] ?? "",
            placeholder: level === "off" ? "留空表示 null" : level,
            disabled: !writable,
            onChange: (event) => setEfforts((current) => ({ ...current, [level]: event.target.value })),
            "aria-label": `${model.id} ${level} wire 值`,
          }),
        )),
      ),
    ),
  );
}

function renderProvider([route, provider], controller, writable) {
  return h(
    "section",
    { key: route, className: "dsh-reasoning-provider" },
    h("div", { className: "dsh-reasoning-provider__header" },
      h("h3", null, route),
      h("span", null, `${provider.models.length} 个模型`),
    ),
    h("div", { className: "dsh-reasoning-provider__models" },
      ...provider.models.map((model) => h(ModelEditor, {
        key: model.id,
        route,
        model,
        controller,
        writable,
      })),
    ),
  );
}

export function ReasoningSettingsSection({ controller, embedded = false }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const providers = Object.entries(snapshot.providers).filter(([, provider]) => Array.isArray(provider?.models));
  useEffect(() => {
    if (snapshot.status === "idle") void controller.refresh();
  }, [controller, snapshot.status]);
  if (snapshot.status === "loading" && providers.length === 0) return h("p", null, "正在加载模型推理设置…");
  if (snapshot.status === "error") return h("p", { role: "alert" }, snapshot.error);
  return h(
    "section",
    { className: embedded ? "dsh-reasoning-settings dsh-reasoning-settings--embedded" : "dsh-reasoning-settings" },
    !embedded && h("header", null,
      h("h2", null, "模型推理"),
      h("p", null, "为自定义 provider 的每个模型设置推理等级。"),
    ),
    providers.length === 0
      ? h("p", null, "暂无自定义 provider 模型。")
      : providers.map((entry) => renderProvider(entry, controller, snapshot.writable)),
  );
}
