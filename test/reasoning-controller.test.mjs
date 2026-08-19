import test from 'node:test'
import assert from 'node:assert/strict'
import { createReasoningSettingsController } from '../src/client/controller.mjs'

const namespace = (revision, wire = 'low') => ({
  result: { ok: true, value: {
    writable: true,
    namespaces: [{ ns: 'llm-pi-ai', revision, value: {
      providers: { route: { models: [{ id: 'model', reasoningEfforts: { low: wire } }] } },
    } }],
  } },
})

test('save sends the editor baseline revision and returns refreshed snapshot', async () => {
  const describes = [namespace(3), namespace(4, 'custom-low')]
  const mutations = []
  const controller = createReasoningSettingsController({
    settings: {
      describe: async () => describes.shift(),
      mutate: async (payload) => { mutations.push(payload); return { result: { ok: true } } },
    },
  })
  await controller.refresh()
  const result = await controller.save('route', 'model', 'enabled', { low: 'custom-low' }, 2)
  assert.equal(mutations[0].expectedRevision, 2)
  assert.equal(result.revision, 4)
  assert.equal(result.providers.route.models[0].reasoningEfforts.low, 'custom-low')
})

test('serializes saves so a later mutation waits for the earlier refresh', async () => {
  const describes = [namespace(3), namespace(4, 'first'), namespace(5, 'second')]
  const mutations = []
  let releaseFirst
  const firstMutation = new Promise((resolve) => { releaseFirst = resolve })
  const controller = createReasoningSettingsController({
    settings: {
      describe: async () => describes.shift(),
      mutate: async (payload) => {
        mutations.push(payload)
        if (mutations.length === 1) await firstMutation
        return { result: { ok: true } }
      },
    },
  })
  await controller.refresh()
  const first = controller.save('route', 'model', 'enabled', { low: 'first' }, 3)
  const second = controller.save('route', 'model', 'enabled', { low: 'second' })
  await Promise.resolve()
  assert.equal(mutations.length, 1)
  releaseFirst()
  await Promise.all([first, second])
  assert.deepEqual(mutations.map((entry) => entry.expectedRevision), [3, 4])
})
