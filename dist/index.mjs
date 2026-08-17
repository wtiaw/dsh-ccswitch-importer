// lib/core/scan.js
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// lib/core/toml.js
function stripInlineComment(value) {
  const first = value[0];
  if (first === '"' || first === "'") {
    const close = value.indexOf(first, 1);
    if (close !== -1) return value.slice(0, close + 1);
    return value;
  }
  const comment = value.indexOf(" #");
  if (comment !== -1) return value.slice(0, comment);
  return value;
}
function unquote(raw) {
  const value = stripInlineComment(raw.trim());
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if (first === '"' && last === '"' || first === "'" && last === "'") {
      return value.slice(1, -1);
    }
  }
  return value;
}
function parseBool(raw) {
  const value = unquote(raw).toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return void 0;
}
function parseCodexToml(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return { model: void 0, reasoningEffort: void 0, provider: null };
  }
  let model;
  let reasoningEffort;
  let section = null;
  let provider = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      if (section === "model_providers.custom") {
        provider = { name: void 0, baseUrl: void 0, wireApi: void 0, requiresOpenaiAuth: void 0 };
      }
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const rawValue = line.slice(eq + 1).trim();
    if (section === null && key === "model") {
      model = unquote(rawValue);
      continue;
    }
    if (section === null && key === "model_reasoning_effort") {
      reasoningEffort = unquote(rawValue);
      continue;
    }
    if (section === "model_providers.custom" && provider) {
      if (key === "name") provider.name = unquote(rawValue);
      else if (key === "base_url") provider.baseUrl = unquote(rawValue);
      else if (key === "wire_api") provider.wireApi = unquote(rawValue);
      else if (key === "requires_openai_auth") provider.requiresOpenaiAuth = parseBool(rawValue);
    }
  }
  return { model, reasoningEffort, provider };
}

// lib/core/extract.js
var SKIP_OFFICIAL = /* @__PURE__ */ new Set(["codex-official"]);
var SKIP_NAMES = /* @__PURE__ */ new Set(["default"]);
function extractProfile(row) {
  const profileId = String(row.id ?? "");
  const profileName = String(row.name ?? "");
  if (SKIP_OFFICIAL.has(profileId)) {
    return { profileId, profileName, skipped: true, skipReason: "\u5B98\u65B9 Codex \u767B\u5F55\u6001\uFF08official\uFF09\u4E0D\u652F\u6301\u5BFC\u5165" };
  }
  if (SKIP_NAMES.has(profileName) || profileName === "OpenAI Official") {
    return { profileId, profileName, skipped: true, skipReason: "\u5B98\u65B9/\u9ED8\u8BA4 provider \u4E0D\u652F\u6301\u5BFC\u5165" };
  }
  const base = {
    profileId,
    profileName,
    isCurrent: Boolean(row.is_current),
    blocked: false,
    blockedReason: "",
    warnings: [],
    unsupported: [],
    apiKey: void 0,
    baseURL: "",
    api: void 0,
    models: [],
    modelReasoningEffort: void 0
  };
  let parsed;
  try {
    parsed = JSON.parse(String(row.settings_config ?? "{}"));
  } catch {
    return { ...base, blocked: true, blockedReason: "settings_config \u4E0D\u662F\u5408\u6CD5 JSON" };
  }
  const auth = (parsed && typeof parsed === "object" ? parsed.auth : void 0) ?? {};
  const apiKey = typeof auth.OPENAI_API_KEY === "string" && auth.OPENAI_API_KEY.length > 0 ? auth.OPENAI_API_KEY : void 0;
  if (apiKey === void 0) {
    return { ...base, blocked: true, blockedReason: "\u672A\u627E\u5230 API key\uFF08auth.OPENAI_API_KEY \u7F3A\u5931\uFF09" };
  }
  const configText = typeof parsed.config === "string" ? parsed.config : "";
  const { model, reasoningEffort, provider } = parseCodexToml(configText);
  if (!provider || typeof provider.baseUrl !== "string" || provider.baseUrl === "") {
    return { ...base, blocked: true, blockedReason: "config \u4E2D\u7F3A\u5C11\u53EF\u7528\u7684 [model_providers.custom] \u6BB5" };
  }
  const warnings = [];
  if (provider.requiresOpenaiAuth === true) {
    warnings.push("provider \u6807\u8BB0 requires_openai_auth\uFF0C\u5BFC\u5165\u540E\u53EF\u80FD\u4ECD\u65E0\u6CD5\u901A\u8FC7 API key \u8BA4\u8BC1");
  }
  if (provider.wireApi !== void 0 && provider.wireApi !== "responses" && provider.wireApi !== "chat") {
    warnings.push(`\u672A\u77E5 wire_api "${provider.wireApi}"\uFF0C\u6309 openai-completions \u5904\u7406`);
  }
  if (!model) {
    warnings.push("config \u4E2D\u6CA1\u6709 model \u5B57\u6BB5\uFF0C\u5BFC\u5165\u540E\u9700\u5728 DSH \u4E2D\u8865\u5145\u6A21\u578B");
  }
  const api = provider.wireApi === "responses" ? "openai-responses" : "openai-completions";
  return {
    ...base,
    apiKey,
    baseURL: provider.baseUrl,
    api,
    models: model ? [{ id: model }] : [],
    modelReasoningEffort: reasoningEffort,
    warnings,
    unsupported: []
  };
}

// lib/core/scan.js
var DEFAULT_DB_CANDIDATES = [
  () => join(homedir(), ".cc-switch", "cc-switch.db")
];
function openDb(dbPath) {
  return new DatabaseSync(dbPath, { readOnly: true });
}
function discoverSources() {
  return DEFAULT_DB_CANDIDATES.map((fn) => fn()).filter((p) => existsSync(p));
}
function scanProfiles(dbPath) {
  if (typeof dbPath !== "string" || dbPath === "" || !existsSync(dbPath)) return [];
  let db;
  try {
    db = openDb(dbPath);
    const rows = db.prepare("SELECT id, name, settings_config, is_current, app_type FROM providers").all();
    return rows.filter((row) => row.app_type === "codex").map((row) => extractProfile(row)).filter((profile) => profile !== void 0);
  } catch (err) {
    console.error("[dsh-ccswitch-importer] scan failed:", err);
    return [];
  } finally {
    if (db) db.close();
  }
}

// lib/core/ids.js
import { createHash } from "node:crypto";
function shortHash(input, length) {
  return createHash("sha256").update(input).digest("hex").slice(0, length);
}
function slugify(name2) {
  const slug = String(name2).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "provider";
}
function providerKey(profileId, profileName) {
  const slug = slugify(profileName);
  const hash = shortHash(`${profileId}::${profileName}`, 8);
  return `ccs-${slug}-${hash}`;
}
function credentialRefFor(providerKeyValue) {
  const hash = providerKeyValue.split("-").pop();
  if (!/^[a-f0-9]{8}$/.test(hash)) {
    throw new Error(`credentialRefFor: expected an 8-hex hash tail, got "${hash}"`);
  }
  return `DSH_CCSWITCH_${hash.toUpperCase()}_API_KEY`;
}
function credentialRef(profileId, profileName) {
  return credentialRefFor(providerKey(profileId, profileName));
}
function variantKey(baseKey, index) {
  return `${baseKey}-${shortHash(`${baseKey}::${index}`, 4)}`;
}

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
  if (["luna", "sol", "terra"].includes(key.replace("gpt-5.6-", ""))) return cloneReasoningEfforts(GPT_56_REASONING);
  return cloneReasoningEfforts(KNOWN_REASONING_CATALOG[key]);
}

// src/domain/import-reasoning.mjs
var IMPORTED_LEVELS = Object.freeze(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
var IMPORTED_LEVEL_SET = new Set(IMPORTED_LEVELS);
function normalizeImportedEffort(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim().toLowerCase();
  if (normalized === "none") return "off";
  return IMPORTED_LEVEL_SET.has(normalized) ? normalized : void 0;
}
function seedReasoning(modelId, rawEffort) {
  const effort = normalizeImportedEffort(rawEffort);
  if (rawEffort !== void 0 && effort === void 0) return {
    efforts: false,
    defaultEffort: void 0,
    warnings: [`unknown reasoning effort "${String(rawEffort)}"; configure it in DSH`]
  };
  if (effort === "off") return { efforts: false, defaultEffort: "off", warnings: [] };
  const known = knownReasoningFor(modelId);
  if (effort === void 0) return {
    efforts: known ?? false,
    defaultEffort: void 0,
    warnings: []
  };
  if (known !== void 0 && known[effort] !== void 0) return {
    efforts: known,
    defaultEffort: effort,
    warnings: []
  };
  if (known !== void 0) return {
    efforts: known,
    defaultEffort: void 0,
    warnings: [`reasoning effort "${effort}" is not in the conservative catalog for ${modelId}`]
  };
  return {
    efforts: { off: null, [effort]: effort },
    defaultEffort: effort,
    warnings: []
  };
}

// lib/core/mapper.js
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function profileWarnings(profile, extra = []) {
  const modelId = profile.models?.find((model) => typeof model?.id === "string")?.id;
  const seed = modelId === void 0 ? { warnings: [] } : seedReasoning(modelId, profile.modelReasoningEffort);
  return [.../* @__PURE__ */ new Set([...profile.warnings ?? [], ...seed.warnings ?? [], ...extra])];
}
function normalizeBaseUrl(url) {
  return String(url ?? "").replace(/\/+$/, "");
}
function toProviderProfile(profile, existing) {
  const previous = isObject(existing) ? existing : {};
  const key = credentialRefFor(providerKey(profile.profileId, profile.profileName));
  const existingModels = Array.isArray(previous.models) ? previous.models : [];
  const sourceModels = (profile.models ?? []).filter((model) => typeof model?.id === "string" && model.id.length > 0);
  const sourceIds = new Set(sourceModels.map((model) => model.id));
  const models = sourceModels.map((sourceModel) => {
    const current = existingModels.find((model) => model?.id === sourceModel.id);
    const next = { ...isObject(current) ? current : {}, ...sourceModel };
    if (current?.reasoningEfforts === void 0) {
      next.reasoningEfforts = seedReasoning(sourceModel.id, profile.modelReasoningEffort).efforts;
    }
    return next;
  });
  for (const model of existingModels) {
    if (isObject(model) && typeof model.id === "string" && !sourceIds.has(model.id)) models.push({ ...model });
  }
  const mapped = {
    ...previous,
    displayName: profile.profileName,
    baseURL: normalizeBaseUrl(profile.baseURL),
    api: profile.api,
    apiKeyEnv: key,
    models
  };
  const primaryModel = sourceModels[0];
  if (mapped.reasoning === void 0 && primaryModel) {
    const defaultEffort = seedReasoning(primaryModel.id, profile.modelReasoningEffort).defaultEffort;
    if (defaultEffort !== void 0) mapped.reasoning = defaultEffort;
  }
  return mapped;
}
function redactSummary(profile, key, status, extraWarnings = []) {
  return {
    profileId: profile.profileId,
    profileName: profile.profileName,
    sourceLabel: "CCSwitch",
    providerKey: key,
    baseURL: normalizeBaseUrl(profile.baseURL),
    api: profile.api,
    modelCount: (profile.models ?? []).length,
    modelIds: (profile.models ?? []).map((m) => m.id),
    credential: profile.apiKey !== void 0 ? "found" : "missing",
    reasoningEffort: normalizeImportedEffort(profile.modelReasoningEffort),
    status,
    warnings: profileWarnings(profile, extraWarnings),
    blockedReason: profile.blocked ? profile.blockedReason : void 0
  };
}
function resolveProviderKey(profile, existingProviders) {
  const existing = existingProviders ?? {};
  const baseKey = providerKey(profile.profileId, profile.profileName);
  let key = baseKey;
  let warnings = profileWarnings(profile);
  if (existing[key] !== void 0 && !(existing[key].displayName === profile.profileName && existing[key].baseURL === normalizeBaseUrl(profile.baseURL))) {
    let index = 1;
    while (existing[variantKey(baseKey, index)] !== void 0) index += 1;
    key = variantKey(baseKey, index);
    warnings = [...warnings, `\u5DF2\u5B58\u5728\u540C\u540D provider\uFF0C\u5C06\u4F7F\u7528 ${key} \u5BFC\u5165\uFF0C\u4E0D\u8986\u76D6\u73B0\u6709\u914D\u7F6E`];
  }
  return { key, warnings };
}
function classifyProfiles(profiles, existingProviders) {
  const existing = existingProviders ?? {};
  const seen = /* @__PURE__ */ new Map();
  return profiles.map((profile) => {
    if (profile.skipped || profile.blocked) {
      return {
        profileId: profile.profileId,
        profileName: profile.profileName,
        status: "blocked",
        summary: redactSummary(profile, "", "blocked")
      };
    }
    const { key, warnings } = resolveProviderKey(profile, existing);
    if (seen.has(key)) {
      const duplicateWarning = `provider \u952E ${key} \u91CD\u590D\uFF0C\u4EC5\u5BFC\u5165\u7B2C\u4E00\u6761`;
      return {
        profileId: profile.profileId,
        profileName: profile.profileName,
        status: "blocked",
        providerKey: key,
        warnings: [...warnings, duplicateWarning],
        summary: redactSummary(profile, key, "blocked", [duplicateWarning])
      };
    }
    seen.set(key, true);
    const existingEntry = existing[key];
    const mapped = toProviderProfile(profile, existingEntry);
    const status = existingEntry === void 0 ? "new" : JSON.stringify(existingEntry) === JSON.stringify(mapped) ? "unchanged" : "update";
    return {
      profileId: profile.profileId,
      profileName: profile.profileName,
      status,
      providerKey: key,
      warnings,
      summary: redactSummary(profile, key, status)
    };
  });
}

// lib/core/importer.js
async function importProfiles({ profiles, selectedIds, settings, credentials, expectedRevision }) {
  const selected = new Set(selectedIds ?? []);
  const results = [];
  const existing = await readExistingProviders(settings) ?? {};
  const usedKeys = /* @__PURE__ */ new Set();
  for (const profile of profiles) {
    if (profile.skipped) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, status: "skipped", skipReason: profile.skipReason });
      continue;
    }
    if (!selected.has(profile.profileId)) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, status: "skipped", skipReason: "\u672A\u9009\u62E9" });
      continue;
    }
    if (profile.blocked) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, status: "blocked", error: profile.blockedReason });
      continue;
    }
    const ref = credentialRef(profile.profileId, profile.profileName);
    const { key, warnings } = resolveProviderKey(profile, existing);
    if (usedKeys.has(key)) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, status: "blocked", error: `provider \u952E ${key} \u91CD\u590D`, warnings });
      continue;
    }
    usedKeys.add(key);
    const wasConfigured = existing[key] !== void 0;
    const mapped = toProviderProfile(profile, existing[key]);
    if (wasConfigured && JSON.stringify(existing[key]) === JSON.stringify(mapped)) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, providerKey: key, status: "unchanged", warnings });
      continue;
    }
    const previousCredential = await readCredential(credentials, ref);
    try {
      await credentials.set(ref, profile.apiKey);
    } catch (err) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, providerKey: key, status: "failed", error: `\u51ED\u636E\u5199\u5165\u5931\u8D25\uFF1A${safeError(err)}`, warnings });
      continue;
    }
    try {
      await settings.mutate("llm-pi-ai", [{ op: "set", path: ["providers", key], value: mapped }], expectedRevision);
    } catch (err) {
      try {
        await restoreCredential(credentials, ref, previousCredential);
      } catch (cleanupErr) {
        results.push({
          profileId: profile.profileId,
          profileName: profile.profileName,
          providerKey: key,
          status: "failed",
          error: `\u8BBE\u7F6E\u5199\u5165\u5931\u8D25\uFF1A${safeError(err)}\uFF1B\u4E14\u51ED\u636E\u56DE\u6EDA\u5931\u8D25\uFF1A${safeError(cleanupErr)}`,
          warnings
        });
        continue;
      }
      results.push({ profileId: profile.profileId, profileName: profile.profileName, providerKey: key, status: "failed", error: `\u8BBE\u7F6E\u5199\u5165\u5931\u8D25\uFF1A${safeError(err)}`, warnings });
      continue;
    }
    results.push({ profileId: profile.profileId, profileName: profile.profileName, providerKey: key, status: wasConfigured ? "updated" : "new", warnings });
  }
  return results;
}
async function readExistingProviders(settings) {
  try {
    const value = settings.get ? await settings.get("llm-pi-ai") : void 0;
    if (value && typeof value === "object" && value.providers) return value.providers;
  } catch {
  }
  return void 0;
}
async function readCredential(credentials, ref) {
  if (typeof credentials?.resolve === "function") {
    try {
      const resolved = await credentials.resolve(ref);
      if (resolved?.value !== void 0) return { configured: true, value: resolved.value };
    } catch {
    }
  }
  if (typeof credentials?.describe === "function") {
    try {
      const described = await credentials.describe(ref);
      return { configured: described?.configured === true, value: void 0 };
    } catch {
    }
  }
  return { configured: false, value: void 0 };
}
async function restoreCredential(credentials, ref, previous) {
  if (previous.value !== void 0) return credentials.set(ref, previous.value);
  if (!previous.configured) return credentials.unset(ref);
}
function safeError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-<redacted>");
}

// src/host/routes.mjs
var API_BASE = "/api/dsh-ccswitch";
var MAX_JSON_BODY_BYTES = 64 * 1024;
var SECRET_KEYS = /* @__PURE__ */ new Set(["apiKey", "api_key", "OPENAI_API_KEY", "credentialValue", "rawConfig", "settingsConfig"]);
function isLoopbackRequest(request) {
  const address = request.socket?.remoteAddress;
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
  const host = request.headers?.host;
  if (typeof host !== "string") return false;
  let hostUrl;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostUrl.hostname)) return false;
  if (request.headers?.["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers?.origin;
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}
function safeError2(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-<redacted>");
}
function publicValue(value, key) {
  if (SECRET_KEYS.has(key)) return void 0;
  if (typeof value === "string") return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-<redacted>");
  if (Array.isArray(value)) return value.map((item) => publicValue(item, void 0)).filter((item) => item !== void 0);
  if (value && typeof value === "object") {
    const result = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const publicChild = publicValue(childValue, childKey);
      if (publicChild !== void 0) result[childKey] = publicChild;
    }
    return result;
  }
  return value;
}
function writeJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer"
  });
  response.end(JSON.stringify(publicValue(body)));
}
async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_JSON_BODY_BYTES) return void 0;
    chunks.push(buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function defaultScan() {
  const sources = discoverSources();
  return sources.length === 0 ? [] : scanProfiles(sources[0]);
}
function methodFence(request, response, isLoopback, method) {
  if (!isLoopback(request)) {
    writeJson(response, 403, { error: "forbidden: loopback and same-origin only" });
    return false;
  }
  if (request.method !== method) {
    writeJson(response, 405, { error: "method not allowed" });
    return false;
  }
  return true;
}
function makeRoutes(deps = {}) {
  const scan = deps.scan ?? defaultScan;
  const getProviders = deps.getProviders ?? (async () => ({}));
  const importProfiles2 = deps.importProfiles ?? importProfiles;
  const isLoopback = deps.isLoopback ?? isLoopbackRequest;
  const settings = deps.settings;
  const credentials = deps.credentials;
  return [
    {
      kind: "exact",
      path: `${API_BASE}/scan`,
      handler: async (request, response) => {
        if (!methodFence(request, response, isLoopback, "GET")) return;
        try {
          const classified = classifyProfiles(await scan(), await getProviders());
          writeJson(response, 200, { profiles: classified.map((item) => item.summary) });
        } catch (error) {
          writeJson(response, 500, { error: safeError2(error) });
        }
      }
    },
    {
      kind: "exact",
      path: `${API_BASE}/import`,
      handler: async (request, response) => {
        if (!methodFence(request, response, isLoopback, "POST")) return;
        const body = await readJsonBody(request);
        if (!body || !Array.isArray(body.profileIds) || body.profileIds.some((id) => typeof id !== "string")) {
          writeJson(response, 400, { error: "body must be { profileIds: string[], expectedRevision?: number }" });
          return;
        }
        if (body.expectedRevision !== void 0 && (typeof body.expectedRevision !== "number" || !Number.isInteger(body.expectedRevision))) {
          writeJson(response, 400, { error: "expectedRevision must be an integer" });
          return;
        }
        try {
          const results = await importProfiles2({
            profiles: await scan(),
            selectedIds: body.profileIds,
            settings,
            credentials,
            expectedRevision: body.expectedRevision
          });
          writeJson(response, 200, { results });
        } catch (error) {
          writeJson(response, 500, { error: safeError2(error) });
        }
      }
    }
  ];
}

// src/host/index.mjs
var name = "dsh-ccswitch-importer";
var inject = ["webServer", "settings", "credentials"];
function scanCCSwitch() {
  const sources = discoverSources();
  return sources.length === 0 ? [] : scanProfiles(sources[0]);
}
function apply(ctx) {
  const routes = makeRoutes({
    scan: scanCCSwitch,
    getProviders: async () => {
      const value = await ctx.settings.get("llm-pi-ai");
      return value?.providers ?? {};
    },
    settings: ctx.settings,
    credentials: ctx.credentials,
    importProfiles
  });
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) if (typeof dispose === "function") dispose();
    };
  }, "dsh-ccswitch-importer: routes");
}
export {
  apply,
  inject,
  name
};
