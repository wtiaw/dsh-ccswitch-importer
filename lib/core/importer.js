import { credentialRef } from './ids.js'
import { toProviderProfile, normalizeBaseUrl, resolveProviderKey } from './mapper.js'

/**
 * Import selected profiles into DSH. Returns redacted per-profile results.
 * Order per profile: credential first, then settings mutate; on settings
 * failure roll back only a credential this call created.
 */
export async function importProfiles({
  profiles,
  selectedIds,
  settings,
  credentials,
  expectedRevision,
}) {
  const selected = new Set(selectedIds ?? [])
  const results = []

  // Resolve provider keys consistently with classification, and find existing
  // provider values so 'unchanged' detection stays correct here too.
  const existing = (await readExistingProviders(settings)) ?? {}
  const usedKeys = new Set()

  for (const profile of profiles) {
    if (profile.skipped) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, status: 'skipped', skipReason: profile.skipReason })
      continue
    }
    if (!selected.has(profile.profileId)) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, status: 'skipped', skipReason: '未选择' })
      continue
    }
    if (profile.blocked) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, status: 'blocked', error: profile.blockedReason })
      continue
    }

    // Credential ref is always derived from profile identity (never from a
    // variant settings key) so a collision import and an idempotent re-import
    // of the same profile use the same credential ref, matching the mapper's
    // apiKeyEnv which is also derived from the base provider key.
    const ref = credentialRef(profile.profileId, profile.profileName)
    const { key, warnings } = resolveProviderKey(profile, existing)
    if (usedKeys.has(key)) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, status: 'blocked', error: `provider 键 ${key} 重复`, warnings })
      continue
    }
    usedKeys.add(key)

    const wasConfigured = existing[key] !== undefined
    const mapped = toProviderProfile({ ...profile, baseURL: normalizeBaseUrl(profile.baseURL) })

    if (wasConfigured && JSON.stringify(existing[key]) === JSON.stringify(mapped)) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, providerKey: key, status: 'unchanged', warnings })
      continue
    }

    try {
      await credentials.set(ref, profile.apiKey)
    } catch (err) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, providerKey: key, status: 'failed', error: `凭据写入失败：${safeError(err)}`, warnings })
      continue
    }

    try {
      await settings.mutate('llm-pi-ai', [{ op: 'set', path: ['providers', key], value: mapped }], expectedRevision)
    } catch (err) {
      try {
        await credentials.unset(ref)
      } catch (cleanupErr) {
        results.push({
          profileId: profile.profileId,
          profileName: profile.profileName,
          providerKey: key,
          status: 'failed',
          error: `设置写入失败：${safeError(err)}；且凭据回滚失败：${safeError(cleanupErr)}`,
          warnings,
        })
        continue
      }
      results.push({ profileId: profile.profileId, profileName: profile.profileName, providerKey: key, status: 'failed', error: `设置写入失败：${safeError(err)}`, warnings })
      continue
    }

    results.push({ profileId: profile.profileId, profileName: profile.profileName, providerKey: key, status: wasConfigured ? 'updated' : 'new', warnings })
  }
  return results
}

async function readExistingProviders(settings) {
  try {
    const value = settings.get ? await settings.get('llm-pi-ai') : undefined
    if (value && typeof value === 'object' && value.providers) return value.providers
  } catch { /* fall through */ }
  return undefined
}

function safeError(err) {
  const message = err instanceof Error ? err.message : String(err)
  // Never leak credential-shaped tokens into results or logs.
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-<redacted>')
}
