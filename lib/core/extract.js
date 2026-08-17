import { parseCodexToml } from './toml.js'

const SKIP_OFFICIAL = new Set(['codex-official'])
const SKIP_NAMES = new Set(['default'])

/**
 * Extract one CC Switch providers row into a Host-only CodexApiProfile.
 * Never serialize or return this object to the browser.
 */
export function extractProfile(row) {
  const profileId = String(row.id ?? '')
  const profileName = String(row.name ?? '')

  if (SKIP_OFFICIAL.has(profileId)) {
    return { profileId, profileName, skipped: true, skipReason: '官方 Codex 登录态（official）不支持导入' }
  }
  if (SKIP_NAMES.has(profileName) || profileName === 'OpenAI Official') {
    return { profileId, profileName, skipped: true, skipReason: '官方/默认 provider 不支持导入' }
  }

  const base = {
    profileId,
    profileName,
    isCurrent: Boolean(row.is_current),
    blocked: false,
    blockedReason: '',
    warnings: [],
    unsupported: [],
    apiKey: undefined,
    baseURL: '',
    api: undefined,
    models: [],
    modelReasoningEffort: undefined,
  }

  let parsed
  try {
    parsed = JSON.parse(String(row.settings_config ?? '{}'))
  } catch {
    return { ...base, blocked: true, blockedReason: 'settings_config 不是合法 JSON' }
  }

  const auth = (parsed && typeof parsed === 'object' ? parsed.auth : undefined) ?? {}
  const apiKey = typeof auth.OPENAI_API_KEY === 'string' && auth.OPENAI_API_KEY.length > 0
    ? auth.OPENAI_API_KEY
    : undefined
  if (apiKey === undefined) {
    return { ...base, blocked: true, blockedReason: '未找到 API key（auth.OPENAI_API_KEY 缺失）' }
  }

  const configText = typeof parsed.config === 'string' ? parsed.config : ''
  const { model, reasoningEffort, provider } = parseCodexToml(configText)

  if (!provider || typeof provider.baseUrl !== 'string' || provider.baseUrl === '') {
    return { ...base, blocked: true, blockedReason: 'config 中缺少可用的 [model_providers.custom] 段' }
  }

  const warnings = []
  if (provider.requiresOpenaiAuth === true) {
    warnings.push('provider 标记 requires_openai_auth，导入后可能仍无法通过 API key 认证')
  }
  if (provider.wireApi !== undefined && provider.wireApi !== 'responses' && provider.wireApi !== 'chat') {
    warnings.push(`未知 wire_api "${provider.wireApi}"，按 openai-completions 处理`)
  }
  if (!model) {
    warnings.push('config 中没有 model 字段，导入后需在 DSH 中补充模型')
  }

  const api = provider.wireApi === 'responses' ? 'openai-responses' : 'openai-completions'

  return {
    ...base,
    apiKey,
    baseURL: provider.baseUrl,
    api,
    models: model ? [{ id: model }] : [],
    modelReasoningEffort: reasoningEffort,
    warnings,
    unsupported: [],
  }
}
