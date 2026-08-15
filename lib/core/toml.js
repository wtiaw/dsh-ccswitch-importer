/**
 * Minimal Codex config.toml extraction for the CC Switch importer.
 * Reads only: top-level `model`, and the `[model_providers.custom]` section's
 * name / base_url / wire_api / requires_openai_auth. Everything else is ignored.
 */

function stripInlineComment(value) {
  // In TOML a ` #` comment can only appear after the value. For quoted values
  // cut everything after the closing quote (a # inside the quotes is data);
  // for unquoted values cut at the first ` #`.
  const first = value[0]
  if (first === '"' || first === "'") {
    const close = value.indexOf(first, 1)
    if (close !== -1) return value.slice(0, close + 1)
    return value
  }
  const comment = value.indexOf(' #')
  if (comment !== -1) return value.slice(0, comment)
  return value
}

function unquote(raw) {
  const value = stripInlineComment(raw.trim())
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

function parseBool(raw) {
  const value = unquote(raw).toLowerCase()
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export function parseCodexToml(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { model: undefined, provider: null }
  }
  let model
  let section = null
  let provider = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      section = sectionMatch[1]
      if (section === 'model_providers.custom') {
        // All four keys are always present so callers can rely on the shape;
        // missing fields are explicitly undefined.
        provider = { name: undefined, baseUrl: undefined, wireApi: undefined, requiresOpenaiAuth: undefined }
      }
      continue
    }
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const rawValue = line.slice(eq + 1).trim()
    if (section === null && key === 'model') {
      model = unquote(rawValue)
      continue
    }
    if (section === 'model_providers.custom' && provider) {
      if (key === 'name') provider.name = unquote(rawValue)
      else if (key === 'base_url') provider.baseUrl = unquote(rawValue)
      else if (key === 'wire_api') provider.wireApi = unquote(rawValue)
      else if (key === 'requires_openai_auth') provider.requiresOpenaiAuth = parseBool(rawValue)
    }
  }
  return { model, provider }
}
