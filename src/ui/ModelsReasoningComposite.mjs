import React from "react";
import { ReasoningSettingsSection } from "./ReasoningSettingsSection.mjs";
import { CCSwitchImportSection } from "./CCSwitchImportSection.mjs";

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

  return h("div", { className: "dsh-reasoning-composite" },
    modelsPage,
    h(CCSwitchImportSection, { controller: importer }),
    h("section", { className: "dsh-reasoning-embed", "aria-label": t?.("nav") ?? "Model reasoning" },
      h("h2", { className: "dsh-reasoning-embed__title" }, t?.("nav") ?? "模型推理"),
      h("p", { className: "dsh-reasoning-embed__hint" },
        "为自定义 provider 的每个模型设置推理等级；保存后即可在模型选择器中切换。"),
      h(ReasoningSettingsSection, { controller, embedded: true }),
    ),
  );
}
