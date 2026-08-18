window.__ModuleLoader__.load({
	id: "dsh-ccswitch-importer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name2 in all)
		    __defProp(target, name2, { get: all[name2], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
		  // If the importer is in node compatibility mode or this is not an ESM
		  // file that has been converted to a CommonJS file using a Babel-
		  // compatible transform (i.e. "__esModule" has not been set), then set
		  // "default" to the CommonJS "module.exports" for node compatibility.
		  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
		  mod
		));
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

		// src/client/index.mjs
		var index_exports = {};
		__export(index_exports, {
		  apply: () => apply,
		  inject: () => inject,
		  name: () => name
		});
		module.exports = __toCommonJS(index_exports);

		// src/domain/catalog.mjs
		var GPT_56_REASONING = Object.freeze({
		  off: "none",
		  low: "low",
		  medium: "medium",
		  high: "high",
		  xhigh: "xhigh",
		  max: "max"
		});
		var O_SERIES_REASONING = Object.freeze({
		  off: null,
		  low: "low",
		  medium: "medium",
		  high: "high"
		});
		var KNOWN_REASONING_CATALOG = Object.freeze({
		  "gpt-5.6-sol": GPT_56_REASONING,
		  "gpt-5.6-luna": GPT_56_REASONING,
		  "gpt-5.6-terra": GPT_56_REASONING,
		  o1: O_SERIES_REASONING,
		  "o1-pro": O_SERIES_REASONING,
		  o3: O_SERIES_REASONING,
		  "o3-mini": O_SERIES_REASONING,
		  "o3-pro": O_SERIES_REASONING,
		  "o4-mini": O_SERIES_REASONING
		});
		function cloneReasoningEfforts(efforts) {
		  return efforts === void 0 ? void 0 : { ...efforts };
		}
		function knownReasoningFor(modelId) {
		  if (typeof modelId !== "string") return void 0;
		  const key = modelId.trim().toLowerCase();
		  return cloneReasoningEfforts(KNOWN_REASONING_CATALOG[key]);
		}

		// src/domain/validation.mjs
		var LEVELS = Object.freeze(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
		var LEVEL_SET = new Set(LEVELS);
		function validateReasoningEfforts(value) {
		  if (typeof value !== "object" || value === null || Array.isArray(value)) {
		    return { ok: false, message: "reasoning efforts must be an object" };
		  }
		  for (const [level, wire] of Object.entries(value)) {
		    if (!LEVEL_SET.has(level)) return { ok: false, message: `unsupported reasoning level: ${level}` };
		    if (wire !== null && typeof wire !== "string") {
		      return { ok: false, message: `wire value for ${level} must be a string or null` };
		    }
		    if (level !== "off" && (wire === null || wire.trim() === "")) {
		      return { ok: false, message: "non-off reasoning levels need a non-empty wire value" };
		    }
		  }
		  if (!Object.keys(value).some((level) => level !== "off")) {
		    return { ok: false, message: "at least one non-off reasoning level is required" };
		  }
		  return { ok: true };
		}
		function normalizeReasoningEfforts(value) {
		  const result = validateReasoningEfforts(value);
		  if (!result.ok) throw new Error(result.message);
		  return { ...value };
		}
		function reasoningStateForModel(modelId, draft) {
		  if (draft?.mode === "disabled") return { mode: "disabled", efforts: void 0 };
		  if (draft?.mode === "enabled") {
		    return { mode: "enabled", efforts: normalizeReasoningEfforts(draft.efforts) };
		  }
		  const known = knownReasoningFor(modelId);
		  return known === void 0 ? { mode: "disabled", efforts: void 0 } : { mode: "enabled", efforts: known };
		}

		// src/domain/settings.mjs
		function updateModelReasoning(provider, modelId, mode, efforts) {
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
		function settingsMutation(route, before, after) {
		  if (before?.models === after?.models) return { ns: "llm-pi-ai", ops: [] };
		  return {
		    ns: "llm-pi-ai",
		    ops: [{
		      op: "set",
		      path: ["providers", route, "models"],
		      value: after.models
		    }]
		  };
		}

		// src/client/controller.mjs
		function createReasoningSettingsController(api) {
		  let snapshot = { status: "idle", writable: false, revision: void 0, providers: {}, error: null };
		  const listeners = /* @__PURE__ */ new Set();
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
		          error: null
		        });
		      } catch (error) {
		        publish({ ...snapshot, status: "error", error: error instanceof Error ? error.message : String(error) });
		      }
		      return snapshot;
		    },
		    save: async (route, modelId, mode, efforts) => {
		      const before = snapshot.providers[route];
		      const after = updateModelReasoning(before, modelId, mode, efforts);
		      const mutation = settingsMutation(route, before, after);
		      const response = await api.settings.mutate({ ...mutation, expectedRevision: snapshot.revision });
		      if (!response.result.ok) throw new Error(response.result.error.message);
		      await controller.refresh();
		    }
		  };
		  return controller;
		}

		// src/client/import-controller.mjs
		function defaultFetch(url, init) {
		  return globalThis.fetch(url, init);
		}
		function importable(profile) {
		  return profile.status !== "blocked" && profile.credential === "found";
		}
		function createCCSwitchImportController({
		  fetchImpl = defaultFetch,
		  getRevision = () => void 0,
		  onImported = () => {
		  }
		} = {}) {
		  let snapshot = {
		    phase: "idle",
		    profiles: [],
		    selectedIds: [],
		    results: [],
		    error: null
		  };
		  const listeners = /* @__PURE__ */ new Set();
		  const publish = (next) => {
		    snapshot = next;
		    for (const listener of listeners) listener();
		  };
		  const request = async (url, init) => {
		    const response = await fetchImpl(url, init);
		    let body;
		    try {
		      body = await response.json();
		    } catch {
		      body = void 0;
		    }
		    if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
		    return body ?? {};
		  };
		  const controller = {
		    getSnapshot: () => snapshot,
		    subscribe: (listener) => {
		      listeners.add(listener);
		      return () => listeners.delete(listener);
		    },
		    setSelectedIds: (selectedIds) => {
		      publish({ ...snapshot, selectedIds: [...new Set(selectedIds.filter((id) => typeof id === "string"))] });
		    },
		    toggleSelected: (profileId) => {
		      const selected = new Set(snapshot.selectedIds);
		      if (selected.has(profileId)) selected.delete(profileId);
		      else selected.add(profileId);
		      controller.setSelectedIds([...selected]);
		    },
		    scan: async () => {
		      publish({ ...snapshot, phase: "loading", error: null });
		      try {
		        const body = await request("/api/dsh-ccswitch/scan");
		        const profiles = Array.isArray(body.profiles) ? body.profiles : [];
		        const selectedIds = profiles.filter(importable).map((profile) => profile.profileId);
		        publish({ phase: "ready", profiles, selectedIds, results: [], error: null });
		        return snapshot;
		      } catch (error) {
		        publish({ ...snapshot, phase: "error", error: error instanceof Error ? error.message : String(error) });
		        throw error;
		      }
		    },
		    importSelected: async () => {
		      publish({ ...snapshot, phase: "importing", error: null });
		      try {
		        const body = await request("/api/dsh-ccswitch/import", {
		          method: "POST",
		          headers: { "content-type": "application/json" },
		          body: JSON.stringify({ profileIds: snapshot.selectedIds, expectedRevision: getRevision() })
		        });
		        const results = Array.isArray(body.results) ? body.results : [];
		        publish({ ...snapshot, phase: "done", results, error: null });
		        await onImported(results);
		        return snapshot;
		      } catch (error) {
		        publish({ ...snapshot, phase: "error", error: error instanceof Error ? error.message : String(error) });
		        throw error;
		      }
		    }
		  };
		  return controller;
		}

		// src/client/registration.mjs
		var SETTINGS_SECTION_ID = "models";
		function registerReasoningSettings(ctx, { controller, importer, component, t }) {
		  ctx.locale?.register?.("dsh-ccswitch-importer", {
		    zh: { nav: "\u6A21\u578B\u63A8\u7406" },
		    en: { nav: "Model reasoning" }
		  });
		  ctx.slots.inject("settings.section", () => ctx.slots.register({
		    name: "settings.section",
		    id: SETTINGS_SECTION_ID,
		    // Negative priority shadows the built-in Models section when the settings
		    // shell renders content, while ctx.slots.entries still exposes that
		    // built-in entry so the composite can render it in place.
		    priority: -1,
		    order: 10,
		    inject: () => ({ controller, importer, slots: ctx.slots, t })
		  }, component));
		  const refreshImporter = () => {
		    const result = importer?.scan?.();
		    if (result?.catch) void result.catch(() => {
		    });
		  };
		  const disposers = [
		    ctx.remote.$on("settings/document-updated", () => {
		      void controller.refresh();
		    }),
		    ctx.remote.$on("llm/adapters-updated", () => {
		      void controller.refresh();
		    }),
		    ctx.remote.$on("credentials/updated", refreshImporter),
		    ctx.remote.$on("connection/reset", () => {
		      void controller.refresh();
		    })
		  ];
		  return () => disposers.forEach((dispose) => dispose());
		}

		// src/ui/ModelsReasoningComposite.mjs
		var import_react3 = __toESM(require("react"), 1);

		// src/ui/ReasoningSettingsSection.mjs
		var import_react = __toESM(require("react"), 1);
		var h = import_react.default.createElement;
		function displayStatus(status) {
		  if (status === "saving") return "\u4FDD\u5B58\u4E2D\u2026";
		  if (status === "saved") return "\u5DF2\u4FDD\u5B58";
		  return status;
		}
		function ModelEditor({ route, model, controller, writable }) {
		  const initial = (0, import_react.useMemo)(() => {
		    if (model.reasoningEfforts === false) return { mode: "disabled", efforts: {} };
		    if (model.reasoningEfforts && typeof model.reasoningEfforts === "object") {
		      return { mode: "enabled", efforts: { ...model.reasoningEfforts } };
		    }
		    const inferred = reasoningStateForModel(model.id);
		    return { mode: inferred.mode, efforts: { ...inferred.efforts ?? {} } };
		  }, [model.id, model.reasoningEfforts]);
		  const [mode, setMode] = (0, import_react.useState)(initial.mode);
		  const [efforts, setEfforts] = (0, import_react.useState)(initial.efforts);
		  const [status, setStatus] = (0, import_react.useState)("");
		  const [customOpen, setCustomOpen] = (0, import_react.useState)(false);
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
		  return h(
		    "article",
		    { className: "dsh-reasoning-model" },
		    h(
		      "div",
		      { className: "dsh-reasoning-model__top" },
		      h(
		        "div",
		        { className: "dsh-reasoning-model__identity" },
		        h("strong", null, modelName),
		        model.id !== modelName && h("code", null, model.id)
		      ),
		      h(
		        "div",
		        { className: "dsh-reasoning-model__actions" },
		        h(
		          "div",
		          { className: "dsh-reasoning-mode", role: "group", "aria-label": `${model.id} \u63A8\u7406\u6A21\u5F0F` },
		          h("button", {
		            type: "button",
		            className: mode === "disabled" ? "dsh-reasoning-mode__option dsh-reasoning-mode__option--active" : "dsh-reasoning-mode__option",
		            "aria-pressed": mode === "disabled",
		            disabled: !writable,
		            onClick: () => setMode("disabled")
		          }, "\u5173\u95ED"),
		          h("button", {
		            type: "button",
		            className: mode === "enabled" ? "dsh-reasoning-mode__option dsh-reasoning-mode__option--active" : "dsh-reasoning-mode__option",
		            "aria-pressed": mode === "enabled",
		            disabled: !writable,
		            onClick: () => setMode("enabled")
		          }, "\u542F\u7528")
		        ),
		        h("button", { className: "dsh-reasoning-save", type: "button", disabled: !writable || status === "saving", onClick: save }, status === "saving" ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"),
		        status && status !== "saving" && h("span", { role: "status", className: status === "saved" ? "dsh-reasoning-status dsh-reasoning-status--success" : "dsh-reasoning-status dsh-reasoning-status--error" }, displayStatus(status))
		      )
		    ),
		    mode === "enabled" && h(
		      "div",
		      { className: "dsh-reasoning-levels", "aria-label": `${model.id} \u53EF\u7528\u63A8\u7406\u7B49\u7EA7` },
		      h("span", { className: "dsh-reasoning-levels__label" }, "\u53EF\u7528\u7B49\u7EA7"),
		      ...LEVELS.map((level) => {
		        const checked = Object.hasOwn(efforts, level);
		        return h(
		          "label",
		          { key: level, className: "dsh-reasoning-level" + (checked ? " dsh-reasoning-level--active" : "") },
		          h("input", {
		            type: "checkbox",
		            checked,
		            disabled: !writable,
		            onChange: (event) => toggleLevel(level, event.target.checked)
		          }),
		          h("span", null, level)
		        );
		      })
		    ),
		    mode === "enabled" && h(
		      "div",
		      { className: "dsh-reasoning-custom" },
		      h(
		        "button",
		        {
		          type: "button",
		          className: "dsh-reasoning-custom__toggle",
		          "aria-expanded": customOpen,
		          onClick: () => setCustomOpen((current) => !current)
		        },
		        customOpen ? "\u6536\u8D77\u81EA\u5B9A\u4E49\u6620\u5C04" : "\u81EA\u5B9A\u4E49 wire \u503C",
		        h("span", { "aria-hidden": "true" }, customOpen ? "\u2303" : "\u2304")
		      ),
		      customOpen && h(
		        "div",
		        { className: "dsh-reasoning-custom__body" },
		        ...LEVELS.filter((level) => Object.hasOwn(efforts, level)).map((level) => h(
		          "label",
		          { key: level, className: "dsh-reasoning-custom__field" },
		          h("span", null, level === "off" ? "off" : level),
		          h("input", {
		            type: "text",
		            value: efforts[level] ?? "",
		            placeholder: level === "off" ? "\u7559\u7A7A\u8868\u793A null" : level,
		            disabled: !writable,
		            onChange: (event) => setEfforts((current) => ({ ...current, [level]: event.target.value })),
		            "aria-label": `${model.id} ${level} wire \u503C`
		          })
		        ))
		      )
		    )
		  );
		}
		function renderProvider([route, provider], controller, writable) {
		  return h(
		    "section",
		    { key: route, className: "dsh-reasoning-provider" },
		    h(
		      "div",
		      { className: "dsh-reasoning-provider__header" },
		      h("h3", null, route),
		      h("span", null, `${provider.models.length} \u4E2A\u6A21\u578B`)
		    ),
		    h(
		      "div",
		      { className: "dsh-reasoning-provider__models" },
		      ...provider.models.map((model) => h(ModelEditor, {
		        key: model.id,
		        route,
		        model,
		        controller,
		        writable
		      }))
		    )
		  );
		}
		function ReasoningSettingsSection({ controller, embedded = false }) {
		  const snapshot = (0, import_react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
		  const providers = Object.entries(snapshot.providers).filter(([, provider]) => Array.isArray(provider?.models));
		  (0, import_react.useEffect)(() => {
		    if (snapshot.status === "idle") void controller.refresh();
		  }, [controller, snapshot.status]);
		  if (snapshot.status === "loading" && providers.length === 0) return h("p", null, "\u6B63\u5728\u52A0\u8F7D\u6A21\u578B\u63A8\u7406\u8BBE\u7F6E\u2026");
		  if (snapshot.status === "error") return h("p", { role: "alert" }, snapshot.error);
		  return h(
		    "section",
		    { className: embedded ? "dsh-reasoning-settings dsh-reasoning-settings--embedded" : "dsh-reasoning-settings" },
		    !embedded && h(
		      "header",
		      null,
		      h("h2", null, "\u6A21\u578B\u63A8\u7406"),
		      h("p", null, "\u4E3A\u81EA\u5B9A\u4E49 provider \u7684\u6BCF\u4E2A\u6A21\u578B\u8BBE\u7F6E\u63A8\u7406\u7B49\u7EA7\u3002")
		    ),
		    providers.length === 0 ? h("p", null, "\u6682\u65E0\u81EA\u5B9A\u4E49 provider \u6A21\u578B\u3002") : providers.map((entry) => renderProvider(entry, controller, snapshot.writable))
		  );
		}

		// src/ui/CCSwitchImportSection.mjs
		var import_react2 = __toESM(require("react"), 1);
		var h2 = import_react2.default.createElement;
		function isSelectable(profile) {
		  return profile.status !== "blocked" && profile.credential === "found";
		}
		function statusLabel(status) {
		  if (status === "new") return "\u5F85\u5BFC\u5165";
		  if (status === "update") return "\u5C06\u66F4\u65B0";
		  if (status === "unchanged") return "\u65E0\u9700\u66F4\u65B0";
		  if (status === "blocked") return "\u5DF2\u963B\u6B62";
		  return status ?? "";
		}
		function badgeClass(status) {
		  const safe = status === "new" || status === "update" || status === "unchanged" || status === "blocked" ? status : "unchanged";
		  return `dsh-ccswitch-import__badge dsh-ccswitch-import__badge--${safe}`;
		}
		function CCSwitchImportSection({ controller }) {
		  if (!controller) return null;
		  const snapshot = (0, import_react2.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
		  (0, import_react2.useEffect)(() => {
		    if (snapshot.phase === "idle") void controller.scan().catch(() => {
		    });
		  }, [controller, snapshot.phase]);
		  const busy = snapshot.phase === "loading" || snapshot.phase === "importing";
		  const selected = new Set(snapshot.selectedIds);
		  const profiles = Array.isArray(snapshot.profiles) ? snapshot.profiles : [];
		  return h2(
		    "section",
		    { className: "dsh-ccswitch-import", "aria-labelledby": "dsh-ccswitch-import-title" },
		    h2(
		      "div",
		      { className: "dsh-ccswitch-import__header" },
		      h2(
		        "div",
		        null,
		        h2("h2", { id: "dsh-ccswitch-import-title", className: "dsh-ccswitch-import__title" }, "CCSwitch \u5BFC\u5165"),
		        h2("p", { className: "dsh-ccswitch-import__hint" }, "\u4ECE\u672C\u673A CCSwitch \u8BFB\u53D6 provider \u914D\u7F6E\u3002")
		      ),
		      h2(
		        "div",
		        { className: "dsh-ccswitch-import__actions" },
		        h2("button", { className: "dsh-ccswitch-import__secondary", type: "button", disabled: busy, onClick: () => {
		          void controller.scan().catch(() => {
		          });
		        } }, busy ? "\u5904\u7406\u4E2D..." : "\u626B\u63CF"),
		        h2("button", { className: "dsh-ccswitch-import__primary", type: "button", disabled: busy || selected.size === 0, onClick: () => {
		          void controller.importSelected().catch(() => {
		          });
		        } }, "\u5BFC\u5165\u9009\u4E2D")
		      )
		    ),
		    snapshot.error && h2("p", { role: "alert", className: "dsh-ccswitch-import__error" }, snapshot.error),
		    profiles.length === 0 && snapshot.phase !== "loading" ? h2("p", { className: "dsh-ccswitch-import__empty" }, "\u6CA1\u6709\u53EF\u8BFB\u53D6\u7684 CCSwitch provider\u3002") : h2(
		      "div",
		      { className: "dsh-ccswitch-import__list" },
		      ...profiles.map((profile) => {
		        const selectable = isSelectable(profile);
		        return h2(
		          "label",
		          {
		            key: profile.profileId,
		            className: "dsh-ccswitch-import__row" + (selectable ? "" : " dsh-ccswitch-import__row--blocked")
		          },
		          h2("input", {
		            type: "checkbox",
		            checked: selected.has(profile.profileId),
		            disabled: !selectable || busy,
		            onChange: () => controller.toggleSelected(profile.profileId)
		          }),
		          h2(
		            "span",
		            { className: "dsh-ccswitch-import__content" },
		            h2(
		              "span",
		              { className: "dsh-ccswitch-import__primary-line" },
		              h2("strong", null, profile.profileName || profile.profileId),
		              profile.baseURL ? h2("code", null, profile.baseURL) : null
		            ),
		            h2(
		              "span",
		              { className: "dsh-ccswitch-import__meta-line" },
		              h2("code", { className: "dsh-ccswitch-import__provider-key" }, profile.providerKey || "\u5F85\u751F\u6210 provider key"),
		              h2("span", null, `${profile.credential === "found" ? "\u51ED\u636E\u5DF2\u627E\u5230" : "\u7F3A\u5C11\u51ED\u636E"} \xB7 ${(profile.modelIds ?? []).join(", ") || "\u65E0\u6A21\u578B"}`),
		              Array.isArray(profile.warnings) && profile.warnings.length > 0 ? h2("span", { className: "dsh-ccswitch-import__warnings" }, profile.warnings.join("\uFF1B")) : null
		            )
		          ),
		          h2("span", { className: badgeClass(profile.status) }, statusLabel(profile.status))
		        );
		      })
		    ),
		    snapshot.results.length > 0 && h2(
		      "ul",
		      { className: "dsh-ccswitch-import__results" },
		      ...snapshot.results.map((result) => h2(
		        "li",
		        { key: `${result.profileId}-${result.status}` },
		        `${result.profileId}: ${result.status === "failed" ? result.error : statusLabel(result.status)}`
		      ))
		    )
		  );
		}

		// src/ui/ModelsReasoningComposite.mjs
		var h3 = import_react3.default.createElement;
		function ModelsReasoningComposite({ controller, importer, slots, t, close }) {
		  const builtIn = slots.entries("settings.section").find((entry) => entry.options.id === "models" && entry.component !== ModelsReasoningComposite);
		  let modelsPage = null;
		  if (builtIn && typeof builtIn.component === "function") {
		    const injected = typeof builtIn.inject === "function" ? builtIn.inject() : {};
		    modelsPage = h3(builtIn.component, { ...injected, close });
		  }
		  return h3(
		    "div",
		    { className: "dsh-reasoning-composite" },
		    modelsPage,
		    h3(CCSwitchImportSection, { controller: importer }),
		    h3(
		      "section",
		      { className: "dsh-reasoning-embed", "aria-label": t?.("nav") ?? "Model reasoning" },
		      h3("h2", { className: "dsh-reasoning-embed__title" }, t?.("nav") ?? "\u6A21\u578B\u63A8\u7406"),
		      h3(
		        "p",
		        { className: "dsh-reasoning-embed__hint" },
		        "\u4E3A\u81EA\u5B9A\u4E49 provider \u7684\u6BCF\u4E2A\u6A21\u578B\u8BBE\u7F6E\u63A8\u7406\u7B49\u7EA7\uFF1B\u4FDD\u5B58\u540E\u5373\u53EF\u5728\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u5207\u6362\u3002"
		      ),
		      h3(ReasoningSettingsSection, { controller, embedded: true })
		    )
		  );
		}

		// src/client/styles.mjs
		var STYLE_ID = "dsh-ccswitch-importer-styles";
		var CSS = `button[class*="navCell"]:has(span[class*="navLabel"]:empty){display:none;}
		.dsh-reasoning-composite{display:flex;flex-direction:column;gap:20px;}
		.dsh-reasoning-embed{border-top:1px solid var(--dsw-alias-border-l2);padding-top:16px;}
		.dsh-reasoning-embed__title{margin:0 0 4px;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:500;line-height:24px;}
		.dsh-reasoning-embed__hint{margin:0 0 14px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;}
		.dsh-reasoning-settings{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);}
		.dsh-reasoning-provider{padding:0 0 4px;}
		.dsh-reasoning-provider__header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 0 8px;border-bottom:1px solid var(--dsw-alias-border-l2);}
		.dsh-reasoning-provider__header h3{margin:0;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px;overflow-wrap:anywhere;}
		.dsh-reasoning-provider__header span{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap;}
		.dsh-reasoning-provider__models{display:flex;flex-direction:column;}
		.dsh-reasoning-model{position:relative;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2);}
		.dsh-reasoning-model__top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;}
		.dsh-reasoning-model__identity{display:flex;align-items:baseline;gap:8px;min-width:0;}
		.dsh-reasoning-model__identity strong{min-width:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px;overflow-wrap:anywhere;}
		.dsh-reasoning-model__identity code{min-width:0;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code,monospace);font-size:12px;line-height:18px;overflow-wrap:anywhere;}
		.dsh-reasoning-model__actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:none;}
		.dsh-reasoning-mode{display:inline-flex;align-items:center;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
		.dsh-reasoning-mode__option{min-width:38px;height:28px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer;}
		.dsh-reasoning-mode__option:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
		.dsh-reasoning-mode__option--active{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);}
		.dsh-reasoning-mode__option--active:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover);color:var(--dsw-alias-label-primary-foreground);}
		.dsh-reasoning-save,.dsh-ccswitch-import__primary{box-sizing:border-box;min-height:28px;padding:0 10px;border:0;border-radius:14px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer;}
		.dsh-reasoning-save:hover:not(:disabled),.dsh-ccswitch-import__primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover);}
		.dsh-reasoning-save:disabled,.dsh-ccswitch-import__primary:disabled,.dsh-ccswitch-import__secondary:disabled,.dsh-reasoning-mode__option:disabled{opacity:.4;cursor:default;}
		.dsh-reasoning-save:focus-visible,.dsh-ccswitch-import__primary:focus-visible,.dsh-ccswitch-import__secondary:focus-visible,.dsh-reasoning-mode__option:focus-visible,.dsh-reasoning-custom__toggle:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:1px;}
		.dsh-reasoning-status{display:inline-flex;align-items:center;min-height:20px;box-sizing:border-box;padding:1px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;font-size:11px;font-weight:500;line-height:18px;white-space:nowrap;}
		.dsh-reasoning-status--success{color:var(--dsw-alias-state-success-primary);}
		.dsh-reasoning-status--error{max-width:180px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;white-space:normal;}
		.dsh-reasoning-model__mode{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
		.dsh-reasoning-levels{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:10px 0 0;padding-left:2px;}
		.dsh-reasoning-levels__label{margin-right:2px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:28px;}
		.dsh-reasoning-level{position:relative;display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;cursor:pointer;}
		.dsh-reasoning-level:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
		.dsh-reasoning-level--active{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-label-primary);}
		.dsh-reasoning-level:has(input:disabled){cursor:default;opacity:.6;}
		.dsh-reasoning-level input{position:absolute;opacity:0;pointer-events:none;}
		.dsh-reasoning-custom{margin:10px 0 0;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2);}
		.dsh-reasoning-custom__toggle{display:inline-flex;align-items:center;gap:6px;margin-left:-4px;padding:2px 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer;}
		.dsh-reasoning-custom__toggle:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
		.dsh-reasoning-custom__body{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;padding:10px 0 2px;}
		.dsh-reasoning-custom__field{display:flex;flex-direction:column;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;}
		.dsh-reasoning-custom__field input{box-sizing:border-box;width:100%;height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:18px;}
		.dsh-reasoning-custom__field input:focus{border-color:var(--dsw-alias-brand-primary);outline:none;}
		.dsh-reasoning-custom__field input::placeholder{color:var(--dsw-alias-label-dimmed);}
		.dsh-ccswitch-import{border-top:1px solid var(--dsw-alias-border-l2);padding-top:16px;color:var(--dsw-alias-label-primary);}
		.dsh-ccswitch-import__header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
		.dsh-ccswitch-import__title{margin:0 0 4px;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:500;line-height:24px;}
		.dsh-ccswitch-import__hint,.dsh-ccswitch-import__empty{margin:0 0 12px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;}
		.dsh-ccswitch-import__actions{display:flex;gap:8px;flex-wrap:wrap;}
		.dsh-ccswitch-import__secondary{box-sizing:border-box;min-height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer;}
		.dsh-ccswitch-import__secondary:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}
		.dsh-ccswitch-import__list{display:flex;flex-direction:column;gap:8px;}
		.dsh-ccswitch-import__row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;min-width:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
		.dsh-ccswitch-import__row--blocked{opacity:.55;}
		.dsh-ccswitch-import__content{display:flex;min-width:0;flex-direction:column;gap:2px;}
		.dsh-ccswitch-import__primary-line{display:flex;align-items:baseline;gap:8px;min-width:0;}
		.dsh-ccswitch-import__primary-line strong{flex:none;max-width:60%;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
		.dsh-ccswitch-import__primary-line code{min-width:0;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code,monospace);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
		.dsh-ccswitch-import__meta-line{display:flex;align-items:baseline;gap:8px;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow:hidden;white-space:nowrap;}
		.dsh-ccswitch-import__meta-line>*{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
		.dsh-ccswitch-import__meta-line>*+*::before{content:'\xB7';margin-right:8px;color:var(--dsw-alias-label-dimmed);}
		.dsh-ccswitch-import__meta-line .dsh-ccswitch-import__provider-key{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code,monospace);font-size:11px;line-height:16px;}
		.dsh-ccswitch-import__meta-line .dsh-ccswitch-import__warnings{color:var(--dsw-alias-state-warn-primary);}
		.dsh-ccswitch-import__badge{flex:none;min-height:20px;box-sizing:border-box;padding:1px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:500;line-height:18px;white-space:nowrap;}
		.dsh-ccswitch-import__badge--new{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary);}
		.dsh-ccswitch-import__badge--update{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary);}
		.dsh-ccswitch-import__badge--unchanged{color:var(--dsw-alias-label-tertiary);}
		.dsh-ccswitch-import__badge--blocked{color:var(--dsw-alias-label-dimmed);}
		.dsh-ccswitch-import__error{margin:0 0 12px;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;}
		.dsh-ccswitch-import__results{margin:12px 0 0;padding-left:20px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;}
		@media (max-width:640px){[role='dialog']:has(.dsh-ccswitch-import)>nav{flex:0 0 56px;width:56px;min-width:56px;}[role='dialog']:has(.dsh-ccswitch-import)>nav button{width:40px;min-width:40px;padding:0;justify-content:center;}[role='dialog']:has(.dsh-ccswitch-import)>nav button>span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}[role='dialog']:has(.dsh-ccswitch-import)>div{min-width:0;}.dsh-ccswitch-import__header{flex-direction:column;}.dsh-ccswitch-import__actions{width:100%;flex-direction:column;align-items:stretch;}.dsh-ccswitch-import__actions button{width:100%;}.dsh-ccswitch-import__row{grid-template-columns:auto minmax(0,1fr);min-width:0;}.dsh-ccswitch-import__content{min-width:0;}.dsh-ccswitch-import__badge{grid-column:2;justify-self:start;}.dsh-reasoning-model__top{align-items:stretch;flex-direction:column;}.dsh-reasoning-model__actions{justify-content:flex-start;flex-wrap:wrap;}.dsh-reasoning-save{flex:1;}.dsh-reasoning-levels{align-items:flex-start;}.dsh-reasoning-levels__label{width:100%;line-height:18px;}.dsh-reasoning-custom__body{grid-template-columns:minmax(0,1fr);}}`;
		function installEmbedStyles() {
		  if (typeof document === "undefined") return () => {
		  };
		  if (document.getElementById(STYLE_ID)) return () => {
		  };
		  const style = document.createElement("style");
		  style.id = STYLE_ID;
		  style.textContent = CSS;
		  document.head.append(style);
		  return () => style.remove();
		}

		// src/client/index.mjs
		var name = "dsh-ccswitch-importer";
		var inject = [
		  "slots",
		  "locale",
		  "connection",
		  "remote"
		];
		function apply(ctx) {
		  const connection = ctx.get("connection");
		  const controller = createReasoningSettingsController(connection.api);
		  const importer = createCCSwitchImportController({
		    getRevision: () => controller.getSnapshot().revision,
		    onImported: () => controller.refresh()
		  });
		  const t = ctx.locale.bind("dsh-ccswitch-importer");
		  const removeStyles = installEmbedStyles();
		  const dispose = registerReasoningSettings(ctx, {
		    controller,
		    importer,
		    component: ModelsReasoningComposite,
		    t
		  });
		  ctx.effect(() => {
		    controller.refresh();
		    return () => {
		      dispose();
		      removeStyles();
		    };
		  }, "dsh-ccswitch-importer.lifecycle");
		}
		// Annotate the CommonJS export names for ESM import in node:
		0 && (module.exports = {
		  apply,
		  inject,
		  name
		});
		return module.exports;
	}
});
