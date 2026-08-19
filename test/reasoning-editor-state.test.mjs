import test from 'node:test'
import assert from 'node:assert/strict'
import {
  draftForModel,
  draftSignature,
  reconcileDraft,
  reloadDraft,
} from '../src/ui/reasoning-editor-state.mjs'

test('clean draft adopts a changed remote model and revision', () => {
  const initial = draftForModel({ id: 'gpt-5.6', reasoningEfforts: { low: 'low' } })
  const next = draftForModel({ id: 'gpt-5.6', reasoningEfforts: { high: 'high' } })
  const result = reconcileDraft({
    draft: initial,
    baseline: initial,
    baselineRevision: 3,
    remoteModel: { id: 'gpt-5.6', reasoningEfforts: { high: 'high' } },
    remoteRevision: 4,
    remoteChanged: false,
  })
  assert.deepEqual(result.draft, next)
  assert.deepEqual(result.baseline, next)
  assert.equal(result.baselineRevision, 4)
  assert.equal(result.remoteChanged, false)
})

test('dirty draft is preserved while changed remote data is recorded', () => {
  const baseline = draftForModel({ id: 'gpt-5.6', reasoningEfforts: { low: 'low' } })
  const draft = { mode: 'enabled', efforts: { low: 'custom-low' } }
  const result = reconcileDraft({
    draft,
    baseline,
    baselineRevision: 3,
    remoteModel: { id: 'gpt-5.6', reasoningEfforts: { high: 'high' } },
    remoteRevision: 4,
    remoteChanged: false,
  })
  assert.deepEqual(result.draft, draft)
  assert.deepEqual(result.baseline, baseline)
  assert.equal(result.baselineRevision, 3)
  assert.equal(result.remoteChanged, true)
})

test('draft signatures ignore effort object insertion order', () => {
  assert.equal(
    draftSignature({ mode: 'enabled', efforts: { high: 'high', low: 'low' } }),
    draftSignature({ mode: 'enabled', efforts: { low: 'low', high: 'high' } }),
  )
})

test('reload explicitly adopts the recorded remote model', () => {
  const result = reloadDraft({
    remoteModel: { id: 'gpt-5.6', reasoningEfforts: false },
    remoteRevision: 8,
  })
  assert.deepEqual(result.draft, { mode: 'disabled', efforts: {} })
  assert.deepEqual(result.baseline, result.draft)
  assert.equal(result.baselineRevision, 8)
  assert.equal(result.remoteChanged, false)
})
