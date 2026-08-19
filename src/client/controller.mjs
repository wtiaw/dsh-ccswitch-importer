import { settingsMutation, updateModelReasoning } from "../domain/settings.mjs";

export function createReasoningSettingsController(api) {
  let snapshot = { status: "idle", writable: false, revision: undefined, providers: {}, error: null };
  const listeners = new Set();
  const publish = (next) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const controller = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh: async () => {
      publish({ ...snapshot, status: "loading", error: null });
      try {
        const response = await api.settings.describe({});
        if (!response.result.ok) throw new Error(response.result.error.message);
        const namespace = response.result.value.namespaces.find((entry) => entry.ns === "llm-pi-ai");
        const providers = namespace?.value?.providers ?? {};
        publish({
          status: "ready",
          writable: response.result.value.writable === true,
          revision: namespace?.revision,
          providers,
          error: null,
        });
      } catch (error) {
        publish({ ...snapshot, status: "error", error: error instanceof Error ? error.message : String(error) });
      }
      return snapshot;
    },
    save: async (route, modelId, mode, efforts, expectedRevision = snapshot.revision) => {
      const before = snapshot.providers[route];
      const after = updateModelReasoning(before, modelId, mode, efforts);
      const mutation = settingsMutation(route, before, after);
      const response = await api.settings.mutate({ ...mutation, expectedRevision });
      if (!response.result.ok) throw new Error(response.result.error.message);
      await controller.refresh();
      return controller.getSnapshot();
    },
  };
  return controller;
}
