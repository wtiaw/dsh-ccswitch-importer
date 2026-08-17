import test from 'node:test'
import assert from 'node:assert/strict'
import { registerReasoningSettings, SETTINGS_SECTION_ID } from '../src/client/registration.mjs'

test('shadows the built-in models section and keeps refresh listeners', () => {
  const registrations = []
  const listeners = new Map()
  const ctx = {
    locale: { register: () => {} },
    slots: {
      inject: (name, factory) => { registrations.push({ name, entry: factory() }); return () => {} },
      register: (options, component) => ({ options, component }),
    },
    remote: {
      $on: (event, handler) => { listeners.set(event, handler); return () => listeners.delete(event) },
    },
  }
  const controller = { refreshes: 0, refresh() { this.refreshes += 1 } }
  const importer = { scans: 0, scan() { this.scans += 1 } }
  const dispose = registerReasoningSettings(ctx, { controller, importer, component: 'Component', t: () => '' })
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].name, 'settings.section')
  assert.equal(registrations[0].entry.options.id, SETTINGS_SECTION_ID)
  assert.equal(registrations[0].entry.options.priority, -1)
  assert.equal(listeners.size, 4)
  listeners.get('settings/document-updated')()
  listeners.get('llm/adapters-updated')()
  listeners.get('credentials/updated')()
  listeners.get('connection/reset')()
  assert.equal(controller.refreshes, 3)
  assert.equal(importer.scans, 1)
  dispose()
  assert.equal(listeners.size, 0)
})
