import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importProfiles } from '../lib/core/importer.js'
import { providerKey, credentialRef } from '../lib/core/ids.js'

function makeSettings(initial, revision = 7) {
  const state = { section: structuredClone(initial), revision }
  return {
    state,
    async get(ns) {
      // The real settings service exposes get(ns) — the importer reads existing
      // providers through it, so the mock must too.
      if (ns === 'llm-pi-ai') return state.section
      return undefined
    },
    async describe() {
      return [{ ns: 'llm-pi-ai', revision: state.revision }]
    },
    async mutate(ns, ops, expectedRevision) {
      if (expectedRevision !== undefined && expectedRevision !== state.revision) {
        throw Object.assign(new Error('conflict'), { code: 'SETTINGS_CONFLICT' })
      }
      for (const op of ops) {
        if (op.op === 'set') {
          let cur = state.section
          for (let i = 0; i < op.path.length - 1; i++) cur = cur[op.path[i]] ??= {}
          cur[op.path[op.path.length - 1]] = op.value
        } else if (op.op === 'unset') {
          let cur = state.section
          for (let i = 0; i < op.path.length - 1; i++) cur = cur[op.path[i]]
          delete cur[op.path[op.path.length - 1]]
        }
      }
      state.revision += 1
    },
  }
}

function makeCredentials() {
  const store = new Map()
  return {
    store,
    async set(ref, value) { store.set(ref, value) },
    async unset(ref) { store.delete(ref) },
  }
}

const profile = {
  profileId: '星渡-1786264467316',
  profileName: '星渡',
  baseURL: 'https://aiwtiaw.top',
  api: 'openai-responses',
  models: [{ id: 'gpt-5.6-terra' }],
  apiKey: 'sk-SECRET-1',
  warnings: [],
}

test('import writes credential then settings and returns redacted results', async () => {
  const settings = makeSettings({ providers: {} })
  const credentials = makeCredentials()
  const results = await importProfiles({
    profiles: [profile],
    selectedIds: [profile.profileId],
    settings,
    credentials,
  })
  const key = providerKey(profile.profileId, profile.profileName)
  const ref = credentialRef(profile.profileId, profile.profileName)
  assert.equal(credentials.store.get(ref), 'sk-SECRET-1')
  assert.ok(settings.state.section.providers[key])
  assert.equal(settings.state.section.providers[key].displayName, '星渡')
  const result = results.find((r) => r.profileId === profile.profileId)
  assert.equal(result.status, 'new')
  assert.ok(!JSON.stringify(result).includes('sk-SECRET-1'))
})

test('skips unselected profiles and does not touch credentials', async () => {
  const settings = makeSettings({ providers: {} })
  const credentials = makeCredentials()
  const results = await importProfiles({
    profiles: [profile],
    selectedIds: [],
    settings,
    credentials,
  })
  assert.equal(credentials.store.size, 0)
  assert.deepEqual(Object.keys(settings.state.section.providers), [])
  assert.equal(results[0].status, 'skipped')
})

test('credential failure blocks that profile and writes nothing to settings', async () => {
  const settings = makeSettings({ providers: {} })
  const credentials = {
    store: new Map(),
    async set() { throw new Error('credential rejected') },
    async unset() {},
  }
  const results = await importProfiles({ profiles: [profile], selectedIds: [profile.profileId], settings, credentials })
  assert.deepEqual(Object.keys(settings.state.section.providers), [])
  assert.equal(results[0].status, 'failed')
  assert.match(results[0].error, /credential/i)
})

test('settings conflict reports failure and rolls back the new credential', async () => {
  const settings = makeSettings({ providers: {} })
  const credentials = makeCredentials()
  const results = await importProfiles({
    profiles: [profile],
    selectedIds: [profile.profileId],
    settings,
    credentials,
    expectedRevision: 99, // stale
  })
  assert.equal(credentials.store.size, 0)
  assert.equal(results[0].status, 'failed')
  assert.match(results[0].error, /conflict/i)
})

test('unchanged profile is reported and not rewritten', async () => {
  const key = providerKey(profile.profileId, profile.profileName)
  const ref = credentialRef(profile.profileId, profile.profileName)
  const settings = makeSettings({
    providers: {
      // An entry this importer previously wrote: toProviderProfile shape,
      // apiKeyEnv included (see mapper.test.js for the same convention).
      [key]: { displayName: '星渡', baseURL: 'https://aiwtiaw.top', api: 'openai-responses', apiKeyEnv: ref, models: [{ id: 'gpt-5.6-terra' }] },
    },
  })
  const credentials = makeCredentials()
  credentials.store.set(ref, 'existing')
  const results = await importProfiles({ profiles: [profile], selectedIds: [profile.profileId], settings, credentials })
  assert.equal(results[0].status, 'unchanged')
})
