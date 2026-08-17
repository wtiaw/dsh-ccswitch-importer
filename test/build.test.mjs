import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createLoaderBundle } from '../scripts/build.mjs'

test('creates the canonical ModuleLoader registration', () => {
  const bundle = createLoaderBundle('dsh-ccswitch-importer', 'module.exports = { apply() {} };')
  assert.match(bundle, /window\.__ModuleLoader__\.load\(\{/)
  assert.match(bundle, /id:\s*[\"']dsh-ccswitch-importer[\"']/)
  assert.match(bundle, /factory:\s*\(require\)\s*=>/)
})

test('package points at the bundled Host and Client entries', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.main, 'dist/index.mjs')
  assert.equal(packageJson.exports['./client'], './dist/client.js')
  assert.equal(packageJson.scripts.build, 'node scripts/build.mjs')
})

