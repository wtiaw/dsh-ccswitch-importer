import test from 'node:test'
import assert from 'node:assert/strict'
import { createCCSwitchImportController } from '../src/client/import-controller.mjs'

test('scan stores only redacted summaries and selects importable rows', async () => {
  let calledUrl
  const controller = createCCSwitchImportController({
    fetchImpl: async (url, init) => {
      calledUrl = url
      assert.equal(init, undefined)
      return {
        ok: true,
        async json() { return { profiles: [
          { profileId: 'p1', profileName: 'P1', status: 'new', credential: 'found' },
          { profileId: 'p2', profileName: 'P2', status: 'blocked', credential: 'missing' },
        ] } },
      }
    },
  })
  await controller.scan()
  assert.equal(calledUrl, '/api/dsh-ccswitch/scan')
  assert.deepEqual(controller.getSnapshot().profiles.map((profile) => profile.profileId), ['p1', 'p2'])
  assert.deepEqual(controller.getSnapshot().selectedIds, ['p1'])
})

test('import posts selected IDs and settings revision', async () => {
  let request
  let refreshed = 0
  const controller = createCCSwitchImportController({
    getRevision: () => 12,
    onImported: () => { refreshed += 1 },
    fetchImpl: async (url, init) => {
      request = { url, init }
      return { ok: true, async json() { return { results: [{ profileId: 'p1', status: 'new' }] } } }
    },
  })
  controller.setSelectedIds(['p1'])
  await controller.importSelected()
  assert.equal(request.url, '/api/dsh-ccswitch/import')
  assert.deepEqual(JSON.parse(request.init.body), { profileIds: ['p1'], expectedRevision: 12 })
  assert.equal(refreshed, 1)
  assert.equal(controller.getSnapshot().results[0].status, 'new')
})

test('non-2xx responses become an error state', async () => {
  const controller = createCCSwitchImportController({
    fetchImpl: async () => ({ ok: false, status: 500, async json() { return { error: 'scan failed' } } }),
  })
  await assert.rejects(() => controller.scan(), /scan failed/)
  assert.equal(controller.getSnapshot().phase, 'error')
})
