import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, inject, name } from '../src/host/index.mjs'

test('Host apply registers injected routes and disposes them', () => {
  const registered = []
  const disposed = []
  let effectCleanup
  const ctx = {
    settings: { async get() { return { providers: {} } } },
    credentials: {},
    webServer: {
      register(route) {
        registered.push(route)
        return () => disposed.push(route.path)
      },
    },
    effect(effect, label) {
      assert.equal(label, 'dsh-ccswitch-importer: routes')
      effectCleanup = effect()
    },
  }

  assert.equal(name, 'dsh-ccswitch-importer')
  assert.deepEqual(inject, ['webServer', 'settings', 'credentials'])
  apply(ctx)
  assert.deepEqual(registered.map((route) => route.path), [
    '/api/dsh-ccswitch/scan',
    '/api/dsh-ccswitch/import',
  ])
  effectCleanup()
  assert.deepEqual(disposed, registered.map((route) => route.path))
})
