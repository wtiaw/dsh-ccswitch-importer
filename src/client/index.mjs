import { createReasoningSettingsController } from "./controller.mjs";
import { createCCSwitchImportController } from "./import-controller.mjs";
import { registerReasoningSettings } from "./registration.mjs";
import { ModelsReasoningComposite } from "../ui/ModelsReasoningComposite.mjs";
import { installEmbedStyles } from "./styles.mjs";

export const name = "dsh-ccswitch-importer";

export const inject = [
  "slots",
  "locale",
  "connection",
  "remote",
];

export function apply(ctx) {
  const connection = ctx.get("connection");
  const controller = createReasoningSettingsController(connection.api);
  const importer = createCCSwitchImportController({
    getRevision: () => controller.getSnapshot().revision,
    onImported: () => controller.refresh(),
  });
  const t = ctx.locale.bind("dsh-ccswitch-importer");
  const removeStyles = installEmbedStyles();
  const dispose = registerReasoningSettings(ctx, {
    controller,
    importer,
    component: ModelsReasoningComposite,
    t,
  });
  ctx.effect(() => {
    controller.refresh();
    return () => {
      dispose();
      removeStyles();
    };
  }, "dsh-ccswitch-importer.lifecycle");
}
