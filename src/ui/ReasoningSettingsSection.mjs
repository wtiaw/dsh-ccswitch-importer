import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LEVELS } from "../domain/validation.mjs";
import { draftForModel, draftSignature, reconcileDraft, rebaseDraft, reloadDraft } from "./reasoning-editor-state.mjs";
import { loadCollapse, saveCollapse, withModelToggled, isModelCollapsed } from "./collapse-state.mjs";

const h = React.createElement;

function displayStatus(status) {
  if (status === "saving") return "保存中…";
  if (status === "saved") return "已保存";
  return status;
}

function ModelEditor({ route, model, controller, writable, revision, collapsed = false, onToggleCollapsed }) {
  const initial = draftForModel(model);
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [baselineRevision, setBaselineRevision] = useState(revision);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [status, setStatus] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const draftRef = useRef(draft);
  const baselineRef = useRef(baseline);
  const baselineRevisionRef = useRef(baselineRevision);
  const remoteChangedRef = useRef(remoteChanged);
  const saveInFlightRef = useRef(false);
  draftRef.current = draft;
  baselineRef.current = baseline;
  baselineRevisionRef.current = baselineRevision;
  remoteChangedRef.current = remoteChanged;

  const applyReconciledState = (next) => {
    const currentDraft = draftRef.current;
    const currentBaseline = baselineRef.current;
    if (draftSignature(next.draft) !== draftSignature(currentDraft)) {
      draftRef.current = next.draft;
      setDraft(next.draft);
    }
    if (draftSignature(next.baseline) !== draftSignature(currentBaseline)) {
      baselineRef.current = next.baseline;
      setBaseline(next.baseline);
    }
    if (next.baselineRevision !== baselineRevisionRef.current) {
      baselineRevisionRef.current = next.baselineRevision;
      setBaselineRevision(next.baselineRevision);
    }
    if (next.remoteChanged !== remoteChangedRef.current) {
      remoteChangedRef.current = next.remoteChanged;
      setRemoteChanged(next.remoteChanged);
    }
  };

  useEffect(() => {
    const next = reconcileDraft({
      draft: draftRef.current,
      baseline: baselineRef.current,
      baselineRevision: baselineRevisionRef.current,
      remoteModel: model,
      remoteRevision: revision,
      remoteChanged: remoteChangedRef.current,
    });
    applyReconciledState(next);
  }, [controller, model.id, model.reasoningEfforts, revision]);

  const setMode = (mode) => setDraft((current) => ({ ...current, mode }));
  const toggleLevel = (level, checked) => {
    setDraft((current) => {
      const efforts = { ...current.efforts };
      if (!checked) delete efforts[level];
      else efforts[level] = level === "off" ? null : level;
      return { ...current, efforts };
    });
  };

  const reload = () => {
    const remoteSnapshot = controller.getSnapshot();
    const remoteModel = remoteSnapshot.providers[route]?.models?.find((entry) => entry.id === model.id) ?? model;
    applyReconciledState(reloadDraft({ remoteModel, remoteRevision: remoteSnapshot.revision }));
    setStatus("");
  };

  const save = async () => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    const draftToSave = draftRef.current;
    const savingSignature = draftSignature(draftToSave);
    const savingRevision = baselineRevisionRef.current;
    setStatus("saving");
    try {
      const nextSnapshot = await controller.save(route, model.id, draftToSave.mode, draftToSave.efforts, savingRevision);
      const savedModel = nextSnapshot.providers[route]?.models?.find((entry) => entry.id === model.id) ?? model;
      if (draftSignature(draftRef.current) === savingSignature) {
        applyReconciledState(reloadDraft({ remoteModel: savedModel, remoteRevision: nextSnapshot.revision }));
      } else {
        applyReconciledState(rebaseDraft({ draft: draftRef.current, savedModel, savedRevision: nextSnapshot.revision }));
      }
      setStatus("saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const modelName = model.name || model.id;
  const selectedCount = Object.keys(draft.efforts).length;
  const customBodyId = ("dsh-reasoning-custom-" + route + "-" + model.id).replace(/[^a-zA-Z0-9_-]/g, "-");
  const statusClass = status === "saving"
    ? "dsh-reasoning-status dsh-reasoning-status--saving"
    : status === "saved"
      ? "dsh-reasoning-status dsh-reasoning-status--success"
      : status
        ? "dsh-reasoning-status dsh-reasoning-status--error"
        : "dsh-reasoning-status";
  return h("article", { className: "dsh-reasoning-model" + (collapsed ? " dsh-reasoning-model--collapsed" : "") },
    h("header", { className: "dsh-reasoning-model__header" },
      h("div", { className: "dsh-reasoning-model__identity" },
        h("strong", null, modelName),
        model.id !== modelName && h("code", null, model.id),
      ),
      h("div", { className: "dsh-reasoning-model__mode-area" },
        h("span", { className: "dsh-reasoning-model__mode-label" }, "推理模式"),
        h("div", { className: "dsh-reasoning-mode", role: "group", "aria-label": model.id + " 推理模式" },
          h("button", {
            type: "button",
            className: draft.mode === "disabled" ? "dsh-reasoning-mode__option dsh-reasoning-mode__option--active" : "dsh-reasoning-mode__option",
            "aria-pressed": draft.mode === "disabled",
            disabled: !writable,
            onClick: () => setMode("disabled"),
          }, "关闭"),
          h("button", {
            type: "button",
            className: draft.mode === "enabled" ? "dsh-reasoning-mode__option dsh-reasoning-mode__option--active" : "dsh-reasoning-mode__option",
            "aria-pressed": draft.mode === "enabled",
            disabled: !writable,
            onClick: () => setMode("enabled"),
          }, "启用"),
        ),
      ),
      h("button", {
        type: "button",
        className: "dsh-reasoning-collapse",
        "aria-expanded": !collapsed,
        "aria-controls": "dsh-reasoning-model-body-" + customBodyId,
        "aria-label": (collapsed ? "展开" : "收起") + " " + modelName + " 推理设置",
        onClick: () => onToggleCollapsed?.(route, model.id, !collapsed),
      }, h("span", { "aria-hidden": "true" }, collapsed ? "⌄" : "⌃")),
    ),
    h("div", { id: "dsh-reasoning-model-body-" + customBodyId, className: "dsh-reasoning-model__body", hidden: collapsed || draft.mode !== "enabled" },
      h("div", { className: "dsh-reasoning-levels", "aria-label": model.id + " 可用推理等级" },
        h("div", { className: "dsh-reasoning-levels__heading" },
          h("span", { className: "dsh-reasoning-levels__label" }, "可用等级"),
          h("span", { className: "dsh-reasoning-levels__summary" }, "已选 " + selectedCount + " 项"),
        ),
        h("div", { className: "dsh-reasoning-levels__options" },
          ...LEVELS.map((level) => {
            const checked = Object.hasOwn(draft.efforts, level);
            return h("label", { key: level, className: "dsh-reasoning-level" + (checked ? " dsh-reasoning-level--active" : "") },
              h("input", {
                type: "checkbox",
                checked,
                disabled: !writable,
                onChange: (event) => toggleLevel(level, event.target.checked),
              }),
              h("span", null, level),
            );
          }),
        ),
      ),
      h("div", { className: "dsh-reasoning-custom" },
        h("button", {
          type: "button",
          className: customOpen ? "dsh-reasoning-custom__toggle dsh-reasoning-custom__toggle--active" : "dsh-reasoning-custom__toggle",
          "aria-expanded": customOpen,
          "aria-controls": customBodyId,
          onClick: () => setCustomOpen((current) => !current),
        }, h("span", null, customOpen ? "收起自定义映射" : "自定义 wire 值"),
        h("span", { "aria-hidden": "true" }, customOpen ? "⌃" : "⌄")),
        customOpen && h("div", { id: customBodyId, className: "dsh-reasoning-custom__body" },
          ...LEVELS.filter((level) => Object.hasOwn(draft.efforts, level)).map((level) => h("label", { key: level, className: "dsh-reasoning-custom__field" },
            h("span", null, level === "off" ? "off" : level),
            h("input", {
              type: "text",
              value: draft.efforts[level] ?? "",
              placeholder: level === "off" ? "留空表示 null" : level,
              disabled: !writable,
              onChange: (event) => setDraft((current) => ({ ...current, efforts: { ...current.efforts, [level]: event.target.value } })),
              "aria-label": model.id + " " + level + " wire 值",
            }),
          )),
        ),
      ),
    ),
    !collapsed && h("footer", { className: "dsh-reasoning-model__footer" },
      h("span", { className: "dsh-reasoning-remote-status", role: "status", "aria-live": "polite" }, remoteChanged ? "远端已更新" : ""),
      remoteChanged && h("button", { className: "dsh-reasoning-reload", type: "button", onClick: reload }, "重新载入"),
      h("span", { role: "status", "aria-live": "polite", className: statusClass }, displayStatus(status)),
      h("button", { className: "dsh-reasoning-save", type: "button", disabled: !writable || status === "saving", onClick: save }, status === "saving" ? "保存中…" : "保存"),
    ),
  );
}

function renderProvider([route, provider], controller, writable, revision, collapse, onToggleCollapsed) {
  return h(
    "section",
    { key: route, className: "dsh-reasoning-provider" },
    h("div", { className: "dsh-reasoning-provider__header" },
      h("h3", null, route),
      h("span", null, provider.models.length + " 个模型"),
    ),
    h("div", { className: "dsh-reasoning-provider__models" },
      ...provider.models.map((model) => h(ModelEditor, {
        key: model.id,
        route,
        model,
        controller,
        writable,
        revision,
        collapsed: isModelCollapsed(collapse, route, model.id),
        onToggleCollapsed,
      })),
    ),
  );
}

export function ReasoningSettingsSection({ controller, embedded = false, collapse: collapseProp, setCollapse: setCollapseProp }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const providers = Object.entries(snapshot.providers).filter(([, provider]) => Array.isArray(provider?.models));
  const [localCollapse, setLocalCollapse] = useState(() => loadCollapse());
  const collapse = collapseProp ?? localCollapse;
  const updateCollapse = setCollapseProp ?? setLocalCollapse;
  const toggleModelCollapsed = (route, modelId, collapsed) => {
    updateCollapse((current) => {
      const next = withModelToggled(current, route, modelId, collapsed);
      saveCollapse(next);
      return next;
    });
  };
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
      : providers.map((entry) => renderProvider(entry, controller, snapshot.writable, snapshot.revision, collapse, toggleModelCollapsed)),
  );
}
