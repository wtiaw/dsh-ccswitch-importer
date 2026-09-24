export const SETTINGS_SECTION_ID = "models";

/**
 * Register the reasoning editor as the winning occupant of the built-in
 * models settings section. The built-in Models page stays on the ledger and
 * is rendered by our composite component, so the reasoning controls appear on
 * the same page instead of adding a separate top-level settings page.
 */
export function registerReasoningSettings(ctx, { controller, importer, component, t }) {
  ctx.locale?.register?.("dsh-ccswitch-importer", {
    zh: { nav: "模型推理" },
    en: { nav: "Model reasoning" },
  });

  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: SETTINGS_SECTION_ID,
    // Negative priority shadows the built-in Models section when the settings
    // shell renders content, while ctx.slots.entries still exposes that
    // built-in entry so the composite can render it in place.
    priority: -1,
    order: 10,
    inject: () => ({ controller, importer, slots: ctx.slots, t }),
  }, component));

  const refreshImporter = () => {
    const result = importer?.scan?.();
    if (result?.catch) void result.catch(() => {});
  };
  const listen = (event, handler) => {
    try {
      const dispose = ctx.remote.$on(event, handler);
      return typeof dispose === "function" ? dispose : () => {};
    } catch {
      return () => {};
    }
  };
  const disposers = [
    listen("settings/document-updated", () => { void controller.refresh(); }),
    listen("llm/adapters-updated", () => { void controller.refresh(); }),
    listen("credentials/updated", refreshImporter),
    listen("credentials/reference-updated", refreshImporter),
    listen("connection/reset", () => { void controller.refresh(); }),
  ];
  return () => disposers.forEach((dispose) => dispose());
}
