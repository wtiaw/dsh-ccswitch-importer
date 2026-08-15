import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toProviderProfile, redactSummary, classifyProfiles, normalizeBaseUrl } from '../lib/core/mapper.js'
import { providerKey, credentialRefFor } from '../lib/core/ids.js'

const profile = {
  profileId: '星渡-1786264467316',
  profileName: '星渡',
  isCurrent: true,
  baseURL: 'https://aiwtiaw.top',
  api: 'openai-responses',
  models: [{ id: 'gpt-5.6-terra' }],
  apiKey: 'sk-SUPER-SECRET',
  warnings: [],
  unsupported: [],
}

test('toProviderProfile maps to llm-pi-ai shape with apiKeyEnv only', () => {
  const key = providerKey(profile.profileId, profile.profileName)
  const mapped = toProviderProfile(profile)
  assert.equal(mapped.displayName, '星渡')
  assert.equal(mapped.baseURL, 'https://aiwtiaw.top')
  assert.equal(mapped.api, 'openai-responses')
  assert.deepEqual(mapped.models, [{ id: 'gpt-5.6-terra' }])
  // llm-pi-ai's apiKeyEnv is a credential reference (env-var name), derived from
  // the provider key via credentialRefFor — never a bare hash, never the key itself.
  assert.equal(mapped.apiKeyEnv, credentialRefFor(key))
  assert.ok(!JSON.stringify(mapped).includes('sk-SUPER-SECRET'))
})

test('redactSummary never contains the api key', () => {
  const summary = redactSummary(profile, providerKey(profile.profileId, profile.profileName), 'new')
  assert.ok(!JSON.stringify(summary).includes('sk-SUPER-SECRET'))
  assert.equal(summary.credential, 'found')
  assert.equal(summary.status, 'new')
  assert.equal(summary.modelIds[0], 'gpt-5.6-terra')
  assert.equal(summary.profileName, '星渡')
})

test('classifyProfiles marks new/update/unchanged/blocked', () => {
  const key = providerKey(profile.profileId, profile.profileName)
  const existing = {
    [key]: toProviderProfile(profile), // identical -> unchanged
    'some-other': { displayName: 'other' },
  }
  const classified = classifyProfiles([profile], existing)
  const mine = classified.find((c) => c.profileId === profile.profileId)
  assert.equal(mine.status, 'unchanged')

  const changed = { ...profile, models: [{ id: 'new-model' }] }
  const classified2 = classifyProfiles([changed], existing)
  assert.equal(classified2.find((c) => c.profileId === profile.profileId).status, 'update')

  const blockedProfile = { ...profile, blocked: true, blockedReason: 'no key', apiKey: undefined }
  const classified3 = classifyProfiles([blockedProfile], {})
  assert.equal(classified3[0].status, 'blocked')
})

test('normalizeBaseUrl strips trailing slash and keeps path', () => {
  assert.equal(normalizeBaseUrl('https://aiwtiaw.top/'), 'https://aiwtiaw.top')
  assert.equal(normalizeBaseUrl('https://x.example/v1'), 'https://x.example/v1')
})
