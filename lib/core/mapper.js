import { credentialRefFor, providerKey, variantKey } from './ids.js'

export function normalizeBaseUrl(url) {
  return String(url ?? '').replace(/\/+$/, '')
}

export function toProviderProfile(profile) {
  const key = credentialRefFor(providerKey(profile.profileId, profile.profileName))
  return {
    displayName: profile.profileName,
    baseURL: normalizeBaseUrl(profile.baseURL),
    api: profile.api,
    apiKeyEnv: key,
    models: (profile.models ?? []).map((m) => ({ id: m.id })),
  }
}

export function redactSummary(profile, key, status) {
  return {
    profileId: profile.profileId,
    profileName: profile.profileName,
    sourceLabel: 'CCSwitch',
    providerKey: key,
    baseURL: normalizeBaseUrl(profile.baseURL),
    api: profile.api,
    modelCount: (profile.models ?? []).length,
    modelIds: (profile.models ?? []).map((m) => m.id),
    credential: profile.apiKey !== undefined ? 'found' : 'missing',
    status,
    warnings: profile.warnings ?? [],
    blockedReason: profile.blocked ? profile.blockedReason : undefined,
  }
}

export function resolveProviderKey(profile, existingProviders) {
  const existing = existingProviders ?? {}
  const baseKey = providerKey(profile.profileId, profile.profileName)
  let key = baseKey
  let warnings = profile.warnings ?? []
  if (existing[key] !== undefined && !(existing[key].displayName === profile.profileName && existing[key].baseURL === normalizeBaseUrl(profile.baseURL))) {
    // Collision with an unrelated route: deterministic variant, never overwrite.
    let index = 1
    while (existing[variantKey(baseKey, index)] !== undefined) index += 1
    key = variantKey(baseKey, index)
    warnings = [...warnings, `已存在同名 provider，将使用 ${key} 导入，不覆盖现有配置`]
  }
  return { key, warnings }
}

export function classifyProfiles(profiles, existingProviders) {
  const existing = existingProviders ?? {}
  const seen = new Map()
  return profiles.map((profile) => {
    if (profile.skipped || profile.blocked) {
      return {
        profileId: profile.profileId,
        profileName: profile.profileName,
        status: 'blocked',
        summary: redactSummary(profile, '', 'blocked'),
      }
    }
    const { key, warnings } = resolveProviderKey(profile, existing)
    if (seen.has(key)) {
      return {
        profileId: profile.profileId,
        profileName: profile.profileName,
        status: 'blocked',
        providerKey: key,
        warnings: [...warnings, `provider 键 ${key} 重复，仅导入第一条`],
        summary: redactSummary(profile, key, 'blocked'),
      }
    }
    seen.set(key, true)
    const mapped = toProviderProfile(profile)
    const existingEntry = existing[key]
    const status = existingEntry === undefined
      ? 'new'
      : JSON.stringify(existingEntry) === JSON.stringify(mapped)
        ? 'unchanged'
        : 'update'
    return {
      profileId: profile.profileId,
      profileName: profile.profileName,
      status,
      providerKey: key,
      warnings,
      summary: redactSummary(profile, key, status),
    }
  })
}
