import { test } from 'node:test'
import assert from 'node:assert/strict'
import { providerKey, credentialRef, credentialRefFor, variantKey } from '../lib/core/ids.js'

test('provider key is deterministic and namespaced', () => {
  const a = providerKey('星渡-1786264467316', '星渡')
  const b = providerKey('星渡-1786264467316', '星渡')
  assert.equal(a, b)
  assert.match(a, /^ccs-[a-z0-9]+-[a-f0-9]{8}$/)
})

test('different profiles yield different keys', () => {
  const a = providerKey('星渡-1786264467316', '星渡')
  const c = providerKey('aiwtiaw-1784966712052', 'AIWtiaw')
  assert.notEqual(a, c)
})

test('credential refs are uppercase env-shaped and deterministic', () => {
  const ref = credentialRef('星渡-1786264467316', '星渡')
  assert.match(ref, /^DSH_CCSWITCH_[A-F0-9]{8}_API_KEY$/)
  assert.equal(ref, credentialRef('星渡-1786264467316', '星渡'))
})

test('credentialRefFor derives from a provider key', () => {
  const key = providerKey('星渡-1786264467316', '星渡')
  assert.equal(credentialRefFor(key), credentialRef('星渡-1786264467316', '星渡'))
})

test('credentialRefFor rejects non-8-hex tails (e.g. variant keys)', () => {
  assert.throws(() => credentialRefFor('ccs-provider-abcdef12-3456'), /8-hex/)
  assert.throws(() => credentialRefFor('ccs-provider-nohash'), /8-hex/)
})

test('variantKey appends a deterministic suffix', () => {
  const base = providerKey('p-1', 'P')
  const v1 = variantKey(base, 1)
  assert.match(v1, /^ccs-[a-z0-9]+-[a-f0-9]{8}-[a-f0-9]{4}$/)
  assert.equal(v1, variantKey(base, 1))
  assert.notEqual(v1, variantKey(base, 2))
})
