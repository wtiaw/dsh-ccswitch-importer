import { credentialRefForProviderKey } from './ids.js'
import { toProviderProfile, resolveProviderKey } from './mapper.js'

/** Import selected profiles into DSH. Secrets stay in the Host process. */
export async function importProfiles({ profiles, selectedIds, settings, credentials, expectedRevision }) {
  const selected = new Set(selectedIds ?? [])
  const results = []
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

    const { key, warnings } = resolveProviderKey(profile, existing)
    const ref = credentialRefForProviderKey(key)
    if (usedKeys.has(key)) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, status: 'blocked', error: `provider 键 ${key} 重复`, warnings })
      continue
    }
    usedKeys.add(key)

    const wasConfigured = existing[key] !== undefined
    const mapped = toProviderProfile(profile, existing[key], key)
    if (wasConfigured && JSON.stringify(existing[key]) === JSON.stringify(mapped)) {
      results.push({ profileId: profile.profileId, profileName: profile.profileName, providerKey: key, status: 'unchanged', warnings })
      continue
    }

    const previousCredential = await readCredential(credentials, ref)
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
        await restoreCredential(credentials, ref, previousCredential)
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

async function readCredential(credentials, ref) {
  if (typeof credentials?.resolve === 'function') {
    try {
      const resolved = await credentials.resolve(ref)
      if (resolved?.value !== undefined) return { configured: true, value: resolved.value }
    } catch { /* use describe fallback */ }
  }
  if (typeof credentials?.describe === 'function') {
    try {
      const described = await credentials.describe(ref)
      return { configured: described?.configured === true, value: undefined }
    } catch { /* treat unavailable state as absent */ }
  }
  return { configured: false, value: undefined }
}

async function restoreCredential(credentials, ref, previous) {
  if (previous.value !== undefined) return credentials.set(ref, previous.value)
  if (!previous.configured) return credentials.unset(ref)
}

function safeError(err) {
  const message = err instanceof Error ? err.message : String(err)
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-<redacted>')
}
