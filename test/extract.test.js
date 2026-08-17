import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractProfile } from '../lib/core/extract.js'

const toml = `model_provider = "custom"
model = "gpt-5.6-terra"
model_reasoning_effort = "xhigh"
[model_providers.custom]
name = "星渡"
base_url = "https://aiwtiaw.top"
wire_api = "responses"
`

test('extracts a full api-key profile', () => {
  const row = {
    id: '星渡-1786264467316',
    name: '星渡',
    is_current: 1,
    settings_config: JSON.stringify({
      auth: { OPENAI_API_KEY: 'sk-secret-value' },
      config: toml,
    }),
  }
  const profile = extractProfile(row)
  assert.equal(profile.profileId, '星渡-1786264467316')
  assert.equal(profile.profileName, '星渡')
  assert.equal(profile.baseURL, 'https://aiwtiaw.top')
  assert.equal(profile.api, 'openai-responses')
  assert.deepEqual(profile.models, [{ id: 'gpt-5.6-terra' }])
  assert.equal(profile.modelReasoningEffort, 'xhigh')
  assert.equal(profile.apiKey, 'sk-secret-value')
  assert.equal(profile.isCurrent, true)
  assert.deepEqual(profile.warnings, [])
  assert.deepEqual(profile.unsupported, [])
})

test('maps wire_api chat to openai-completions', () => {
  const row = {
    id: 'p1',
    name: 'P1',
    settings_config: JSON.stringify({
      auth: { OPENAI_API_KEY: 'k' },
      config: `model = "m"\n[model_providers.custom]\nname = "p"\nbase_url = "https://x/v1"\nwire_api = "chat"\n`,
    }),
  }
  assert.equal(extractProfile(row).api, 'openai-completions')
})

test('missing api key is reported, profile is blocked', () => {
  const row = {
    id: 'p2',
    name: 'P2',
    settings_config: JSON.stringify({ auth: {}, config: toml }),
  }
  const profile = extractProfile(row)
  assert.equal(profile.apiKey, undefined)
  assert.ok(profile.blocked)
  assert.match(profile.blockedReason, /API key/i)
})

test('malformed settings_config json yields a blocked profile', () => {
  const profile = extractProfile({ id: 'p3', name: 'P3', settings_config: '{broken' })
  assert.ok(profile.blocked)
  assert.match(profile.blockedReason, /settings_config/i)
})

test('no usable model_providers.custom section blocks the profile', () => {
  const row = {
    id: 'p4',
    name: 'P4',
    settings_config: JSON.stringify({ auth: { OPENAI_API_KEY: 'k' }, config: 'model = "m"\n' }),
  }
  const profile = extractProfile(row)
  assert.ok(profile.blocked)
  assert.match(profile.blockedReason, /model_providers/i)
})

test('codex-official and default are skipped outright', () => {
  const official = extractProfile({ id: 'codex-official', name: 'OpenAI Official', settings_config: '{}' })
  assert.equal(official.skipped, true)
  assert.match(official.skipReason, /official/i)
  const fallback = extractProfile({ id: 'default', name: 'default', settings_config: '{}' })
  assert.equal(fallback.skipped, true)
})

test('warns when requires_openai_auth is set', () => {
  const row = {
    id: 'p5',
    name: 'P5',
    settings_config: JSON.stringify({
      auth: { OPENAI_API_KEY: 'k' },
      config: `model = "m"\n[model_providers.custom]\nname = "p"\nbase_url = "https://x/v1"\nwire_api = "responses"\nrequires_openai_auth = true\n`,
    }),
  }
  const profile = extractProfile(row)
  assert.deepEqual(profile.warnings, ['provider 标记 requires_openai_auth，导入后可能仍无法通过 API key 认证'])
})

test('blocked profile never carries the api key', () => {
  const row = {
    id: 'p6',
    name: 'P6',
    settings_config: JSON.stringify({
      auth: { OPENAI_API_KEY: 'sk-secret-value' },
      config: 'model = "m"\n', // no [model_providers.custom] section
    }),
  }
  const profile = extractProfile(row)
  assert.ok(profile.blocked)
  assert.equal(profile.apiKey, undefined)
})
