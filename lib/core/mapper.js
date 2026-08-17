import { credentialRefForProviderKey, providerKey, variantKey } from './ids.js'
import { normalizeImportedEffort, seedReasoning } from '../../src/domain/import-reasoning.mjs'

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function profileWarnings(profile, extra = []) {
  const modelId = profile.models?.find((model) => typeof model?.id === 'string')?.id
  const seed = modelId === undefined ? { warnings: [] } : seedReasoning(modelId, profile.modelReasoningEffort)
  return [...new Set([...(profile.warnings ?? []), ...(seed.warnings ?? []), ...extra])]
}

function preservationWarnings(profile, existing) {
  if (!isObject(existing)) return []
  const warnings = []
  const primaryModel = profile.models?.find((model) => typeof model?.id === 'string')
  if (existing.reasoning !== undefined && primaryModel) {
    const importedDefault = seedReasoning(primaryModel.id, profile.modelReasoningEffort).defaultEffort
    if (importedDefault !== undefined && existing.reasoning !== importedDefault) {
      warnings.push(`已保留现有 route reasoning ${existing.reasoning}，未覆盖导入值 ${importedDefault}`)
    }
  }
  const existingModels = Array.isArray(existing.models) ? existing.models : []
  for (const sourceModel of (profile.models ?? [])) {
    const current = existingModels.find((model) => model?.id === sourceModel?.id)
    if (!current || current.reasoningEfforts === undefined) continue
    const importedEfforts = seedReasoning(sourceModel.id, profile.modelReasoningEffort).efforts
    if (importedEfforts !== undefined && JSON.stringify(current.reasoningEfforts) !== JSON.stringify(importedEfforts)) {
      warnings.push(`已保留模型 ${sourceModel.id} 的现有 reasoningEfforts`)
    }
  }
  return warnings
}

export function normalizeBaseUrl(url) {
  return String(url ?? '').replace(/\/+$/, '')
}

export function toProviderProfile(profile, existing, providerKeyValue) {
  const previous = isObject(existing) ? existing : {}
  const resolvedKey = providerKeyValue ?? providerKey(profile.profileId, profile.profileName)
  const key = credentialRefForProviderKey(resolvedKey)
  const existingModels = Array.isArray(previous.models) ? previous.models : []
  const sourceModels = (profile.models ?? []).filter((model) => typeof model?.id === 'string' && model.id.length > 0)
  const sourceIds = new Set(sourceModels.map((model) => model.id))
  const models = sourceModels.map((sourceModel) => {
    const current = existingModels.find((model) => model?.id === sourceModel.id)
    const next = { ...(isObject(current) ? current : {}), ...sourceModel }
    if (current?.reasoningEfforts === undefined) {
      next.reasoningEfforts = seedReasoning(sourceModel.id, profile.modelReasoningEffort).efforts
    }
    return next
  })
  for (const model of existingModels) {
    if (isObject(model) && typeof model.id === 'string' && !sourceIds.has(model.id)) models.push({ ...model })
  }
  const mapped = {
    ...previous,
    displayName: profile.profileName,
    baseURL: normalizeBaseUrl(profile.baseURL),
    api: profile.api,
    apiKeyEnv: key,
    models,
  }
  const primaryModel = sourceModels[0]
  if (mapped.reasoning === undefined && primaryModel) {
    const defaultEffort = seedReasoning(primaryModel.id, profile.modelReasoningEffort).defaultEffort
    if (defaultEffort !== undefined) mapped.reasoning = defaultEffort
  }
  return mapped
}

export function redactSummary(profile, key, status, extraWarnings = []) {
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
    reasoningEffort: normalizeImportedEffort(profile.modelReasoningEffort),
    status,
    warnings: profileWarnings(profile, extraWarnings),
    blockedReason: profile.blocked ? profile.blockedReason : undefined,
  }
}

export function resolveProviderKey(profile, existingProviders) {
  const existing = existingProviders ?? {}
  const baseKey = providerKey(profile.profileId, profile.profileName)
  let key = baseKey
  const sameRoute = (entry) => entry?.displayName === profile.profileName && entry?.baseURL === normalizeBaseUrl(profile.baseURL)
  let collisionWarning
  if (existing[key] !== undefined && !sameRoute(existing[key])) {
    let index = 1
    while (existing[variantKey(baseKey, index)] !== undefined) {
      const candidate = variantKey(baseKey, index)
      if (sameRoute(existing[candidate])) {
        key = candidate
        break
      }
      index += 1
    }
    if (key === baseKey) key = variantKey(baseKey, index)
    collisionWarning = `已存在同名 provider，将使用 ${key} 导入，不覆盖现有配置`
  }
  const warnings = profileWarnings(profile, [
    ...(collisionWarning ? [collisionWarning] : []),
    ...preservationWarnings(profile, existing[key]),
  ])
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
      const duplicateWarning = `provider 键 ${key} 重复，仅导入第一条`
      return {
        profileId: profile.profileId,
        profileName: profile.profileName,
        status: 'blocked',
        providerKey: key,
        warnings: [...warnings, duplicateWarning],
        summary: redactSummary(profile, key, 'blocked', [...warnings, duplicateWarning]),
      }
    }
    seen.set(key, true)
    const existingEntry = existing[key]
    const mapped = toProviderProfile(profile, existingEntry, key)
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
      summary: redactSummary(profile, key, status, warnings),
    }
  })
}
