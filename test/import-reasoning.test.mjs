import test from 'node:test'
import assert from 'node:assert/strict'
import { seedReasoning } from '../src/domain/import-reasoning.mjs'

test('seeds one legal effort for an unknown model', () => {
  assert.deepEqual(seedReasoning('unknown-model', 'high'), {
    efforts: { off: null, high: 'high' },
    defaultEffort: 'high',
    warnings: [],
  })
})

test('maps none to disabled reasoning', () => {
  assert.deepEqual(seedReasoning('unknown-model', 'none'), {
    efforts: false, defaultEffort: 'off', warnings: [],
  })
})

test('uses the conservative catalog for known models', () => {
  const result = seedReasoning('gpt-5.6-terra', 'high')
  assert.equal(result.defaultEffort, 'high')
  assert.equal(result.efforts.high, 'high')
  assert.equal(result.warnings.length, 0)
})

test('blocks unknown reasoning values and explains the fallback', () => {
  const result = seedReasoning('unknown-model', 'strange')
  assert.equal(result.efforts, false)
  assert.equal(result.defaultEffort, undefined)
  assert.match(result.warnings[0], /unknown reasoning effort/i)
})
