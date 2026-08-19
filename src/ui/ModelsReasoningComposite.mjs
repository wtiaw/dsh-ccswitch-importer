import React, { useState } from "react";
import { ReasoningSettingsSection } from "./ReasoningSettingsSection.mjs";
import { CCSwitchImportSection } from "./CCSwitchImportSection.mjs";
import { loadCollapse, saveCollapse, withPanelToggled } from "./collapse-state.mjs";

const h = React.createElement;

/**
 * Composite occupant of the built-in models settings section.
 * It renders the original ModelsSection (read from the raw slot ledger) and
 * appends the per-model reasoning editor, so no separate settings page exists.
 */
export function ModelsReasoningComposite({ controller, importer, slots, t, close }) {
  const builtIn = slots.entries("settings.section").find((entry) => (
    entry.options.id === "models" && entry.component !== ModelsReasoningComposite
  ));

  let modelsPage = null;
  if (builtIn && typeof builtIn.component === "function") {
    const injected = typeof builtIn.inject === "function" ? builtIn.inject() : {};
    modelsPage = h(builtIn.component, { ...injected, close });
  }

  const [collapse, setCollapse] = useState(() => loadCollapse());
  const reasoningCollapsed = collapse.reasoningPanel === true;
  const toggleReasoning = () => {
    setCollapse((current) => {
      const next = withPanelToggled(current, "reasoningPanel");
      saveCollapse(next);
      return next;
    });
  };

  return h("div", { className: "dsh-reasoning-composite" },
    modelsPage,
    h(CCSwitchImportSection, { controller: importer, collapse, setCollapse }),
    h("section", { className: "dsh-reasoning-embed" + (reasoningCollapsed ? " dsh-reasoning-embed--collapsed" : ""), "aria-label": t?.("nav") ?? "Model reasoning" },
      h("button", {
        type: "button",
        className: "dsh-reasoning-embed__toggle",
        "aria-expanded": !reasoningCollapsed,
        "aria-controls": "dsh-reasoning-embed-body",
        onClick: toggleReasoning,
      },
        h("span", { className: "dsh-reasoning-embed__title" }, t?.("nav") ?? "模型推理"),
        h("span", { className: "dsh-reasoning-embed__hint" },
          reasoningCollapsed ? "点击展开模型推理设置" : "为自定义 provider 的每个模型设置推理等级；保存后即可在模型选择器中切换。"),
        h("span", { className: "dsh-reasoning-embed__toggle-chevron", "aria-hidden": "true" }, reasoningCollapsed ? "⌄" : "⌃"),
      ),
      h("div", { id: "dsh-reasoning-embed-body", hidden: reasoningCollapsed },
        h(ReasoningSettingsSection, { controller, embedded: true, collapse, setCollapse }),
      ),
    ),
  );
}
