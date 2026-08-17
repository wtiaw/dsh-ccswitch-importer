import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toProviderProfile, redactSummary, classifyProfiles, resolveProviderKey, normalizeBaseUrl } from '../lib/core/mapper.js'
import { providerKey, credentialRefFor, variantKey } from '../lib/core/ids.js'

const profile = {
  profileId: '星渡-1786264467316',
  profileName: '星渡',
  isCurrent: true,
  baseURL: 'https://aiwtiaw.top',
  api: 'openai-responses',
  models: [{ id: 'gpt-5.6-terra' }],
  modelReasoningEffort: 'high',
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
  assert.equal(mapped.models[0].id, 'gpt-5.6-terra')
  assert.equal(mapped.models[0].reasoningEfforts.high, 'high')
  assert.equal(mapped.reasoning, 'high')
  // llm-pi-ai's apiKeyEnv is a credential reference (env-var name), derived from
  // the provider key via credentialRefFor — never a bare hash, never the key itself.
  assert.equal(mapped.apiKeyEnv, credentialRefFor(key))
  assert.ok(!JSON.stringify(mapped).includes('sk-SUPER-SECRET'))
})

test('preserves manual provider and model fields on re-import', () => {
  const key = providerKey(profile.profileId, profile.profileName)
  const existing = {
    displayName: '星渡',
    baseURL: 'https://old.example',
    api: 'openai-responses',
    apiKeyEnv: credentialRefFor(key),
    reasoning: 'low',
    headers: { 'x-user': 'keep' },
    models: [{ id: 'gpt-5.6-terra', reasoningEfforts: { low: 'low' }, maxTokens: 2048 }],
  }
  const mapped = toProviderProfile(profile, existing)
  assert.equal(mapped.baseURL, 'https://aiwtiaw.top')
  assert.equal(mapped.reasoning, 'low')
  assert.deepEqual(mapped.headers, { 'x-user': 'keep' })
  assert.deepEqual(mapped.models[0].reasoningEfforts, { low: 'low' })
  assert.equal(mapped.models[0].maxTokens, 2048)
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
  assert.equal(mine.providerKey, key)

  const changed = { ...profile, models: [{ id: 'new-model' }] }
  const classified2 = classifyProfiles([changed], existing)
  assert.equal(classified2.find((c) => c.profileId === profile.profileId).status, 'update')

  const blockedProfile = { ...profile, blocked: true, blockedReason: 'no key', apiKey: undefined }
  const classified3 = classifyProfiles([blockedProfile], {})
  assert.equal(classified3[0].status, 'blocked')
  assert.equal(classified3[0].profileName, '星渡')

  // Classified objects carry only the summary plus non-secret fields — never the api key.
  for (const batch of [classified, classified2, classified3]) {
    assert.ok(!JSON.stringify(batch).includes('sk-SUPER-SECRET'))
  }
})

test('resolveProviderKey returns base key, variant on collision', () => {
  const baseKey = providerKey(profile.profileId, profile.profileName)
  const plain = resolveProviderKey(profile, {})
  assert.equal(plain.key, baseKey)
  assert.deepEqual(plain.warnings, [])

  const collided = resolveProviderKey(profile, {
    [baseKey]: { displayName: '星渡', baseURL: 'https://different.example' },
  })
  assert.notEqual(collided.key, baseKey)
  assert.ok(collided.key.startsWith(baseKey))
  assert.equal(collided.warnings.length, 1)
  assert.match(collided.warnings[0], /已存在同名 provider/)
  assert.ok(!JSON.stringify(collided).includes('sk-SUPER-SECRET'))
})

test('reuses an existing variant after a base-key collision', () => {
  const baseKey = providerKey(profile.profileId, profile.profileName)
  const variant = variantKey(baseKey, 1)
  const resolved = resolveProviderKey(profile, {
    [baseKey]: { displayName: 'other', baseURL: 'https://different.example' },
    [variant]: { displayName: '星渡', baseURL: 'https://aiwtiaw.top' },
  })
  assert.equal(resolved.key, variant)
})

test('classifyProfiles reports preserved local reasoning in warnings', () => {
  const key = providerKey(profile.profileId, profile.profileName)
  const existing = { ...toProviderProfile(profile), reasoning: 'low' }
  const classified = classifyProfiles([profile], { [key]: existing })
  assert.match(classified[0].warnings[0], /保留现有 route reasoning/)
  assert.match(classified[0].summary.warnings[0], /保留现有 route reasoning/)
})

test('classifyProfiles leaves input profiles untouched', () => {
  const input = { ...profile }
  const snapshot = JSON.parse(JSON.stringify(input))
  const key = providerKey(profile.profileId, profile.profileName)
  classifyProfiles([input], {
    [key]: { displayName: '星渡', baseURL: 'https://different.example' },
  })
  assert.deepEqual(input, snapshot)
})

test('classifyProfiles blocks the second profile sharing a provider key', () => {
  const first = { ...profile, profileId: 'same-id', profileName: 'same-name' }
  const second = { ...first, baseURL: 'https://other.example' }
  const [a, b] = classifyProfiles([first, second], {})
  assert.equal(a.status, 'new')
  assert.equal(b.status, 'blocked')
  assert.match(b.warnings[0], /provider 键 .* 重复/)
  assert.ok(!JSON.stringify([a, b]).includes('sk-SUPER-SECRET'))
})

test('normalizeBaseUrl strips trailing slash and keeps path', () => {
  assert.equal(normalizeBaseUrl('https://aiwtiaw.top/'), 'https://aiwtiaw.top')
  assert.equal(normalizeBaseUrl('https://x.example/v1'), 'https://x.example/v1')
})
