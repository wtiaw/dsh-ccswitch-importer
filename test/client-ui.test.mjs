import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

test('UI actions use theme-safe semantic tokens', async () => {
  const styles = await readFile(new URL('src/client/styles.mjs', root), 'utf8')
  const importer = await readFile(new URL('src/ui/CCSwitchImportSection.mjs', root), 'utf8')
  assert.match(styles, /--dsw-alias-button-primary-fill/)
  assert.match(styles, /--dsw-alias-label-primary-foreground/)
  assert.match(styles, /--dsw-alias-button-primary-hover/)
  assert.doesNotMatch(styles, /background:var\(--dsw-alias-surface-primary,#fff\)/)
  assert.match(importer, /dsh-ccswitch-import__primary/)
  assert.match(importer, /dsh-ccswitch-import__secondary/)
})

test('reasoning editor exposes compact list and collapsed wire mapping hooks', async () => {
  const ui = await readFile(new URL('src/ui/ReasoningSettingsSection.mjs', root), 'utf8')
  const styles = await readFile(new URL('src/client/styles.mjs', root), 'utf8')
  assert.match(ui, /dsh-reasoning-model__identity/)
  assert.match(ui, /dsh-reasoning-mode/)
  assert.match(ui, /自定义 wire 值/)
  assert.match(ui, /dsh-reasoning-custom/)
  assert.match(styles, /dsh-reasoning-mode/)
  assert.match(styles, /dsh-reasoning-custom/)
})
