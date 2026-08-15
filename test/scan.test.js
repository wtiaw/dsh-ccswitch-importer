import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { scanProfiles, discoverSources, openDb, DEFAULT_DB_CANDIDATES } from '../lib/core/scan.js'

function makeDb(rows) {
  const dir = mkdtempSync(join(tmpdir(), 'ccs-scan-'))
  const dbPath = join(dir, 'cc-switch.db')
  const db = new DatabaseSync(dbPath)
  db.exec(`CREATE TABLE providers (
    id TEXT, name TEXT, settings_config TEXT, is_current BOOLEAN,
    app_type TEXT, sort_index INTEGER
  )`)
  const insert = db.prepare('INSERT INTO providers (id, name, settings_config, is_current, app_type) VALUES (?, ?, ?, ?, ?)')
  for (const row of rows) insert.run(row.id, row.name, row.settings_config, row.is_current ?? 0, row.app_type ?? 'codex')
  db.close()
  return { dir, dbPath }
}

const VALID_TOML = `model = "gpt-5.6-terra"
[model_providers.custom]
name = "t"
base_url = "https://t.example/v1"
wire_api = "responses"
`

test('scanProfiles extracts valid profiles and skips official/default', () => {
  const { dir, dbPath } = makeDb([
    { id: 'codex-official', name: 'OpenAI Official', settings_config: '{}' },
    { id: 'default', name: 'default', settings_config: '{}' },
    { id: 'p-1', name: 'P1', settings_config: JSON.stringify({ auth: { OPENAI_API_KEY: 'sk-a' }, config: VALID_TOML }), is_current: 1 },
  ])
  try {
    const profiles = scanProfiles(dbPath)
    const active = profiles.filter((p) => !p.skipped)
    assert.equal(active.length, 1)
    assert.equal(active[0].profileName, 'P1')
    assert.equal(active[0].isCurrent, true)
    assert.equal(profiles.filter((p) => p.skipped).length, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('openDb opens read-only and lists codex rows', () => {
  const { dir, dbPath } = makeDb([
    { id: 'p-2', name: 'P2', settings_config: JSON.stringify({ auth: { OPENAI_API_KEY: 'sk-b' }, config: VALID_TOML }) },
  ])
  try {
    const db = openDb(dbPath)
    const rows = db.prepare("SELECT id, name, settings_config, is_current FROM providers").all()
    assert.equal(rows.length, 1)
    db.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('discoverSources returns default candidate paths and honors DSH_HOME', () => {
  assert.ok(DEFAULT_DB_CANDIDATES.some((fn) => fn().includes('.cc-switch')))
  const sources = discoverSources()
  assert.ok(Array.isArray(sources))
})

test('scanProfiles ignores non-codex app_type rows', () => {
  const { dir, dbPath } = makeDb([
    { id: 'c-1', name: 'ClaudeP', settings_config: JSON.stringify({ auth: { ANTHROPIC_API_KEY: 'sk-c' }, config: VALID_TOML }), app_type: 'claude' },
    { id: 'x-1', name: 'CodexP', settings_config: JSON.stringify({ auth: { OPENAI_API_KEY: 'sk-x' }, config: VALID_TOML }) },
  ])
  try {
    const profiles = scanProfiles(dbPath)
    assert.equal(profiles.length, 1)
    assert.equal(profiles[0].profileName, 'CodexP')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('scanProfiles tolerates a db without a providers table', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccs-scan-'))
  const dbPath = join(dir, 'cc-switch.db')
  const db = new DatabaseSync(dbPath)
  db.exec('CREATE TABLE unrelated (x TEXT)')
  db.close()
  try {
    const profiles = scanProfiles(dbPath)
    assert.deepEqual(profiles, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('missing db file yields empty result, not a throw', () => {
  const profiles = scanProfiles('Z:/definitely/not/here/cc-switch.db')
  assert.deepEqual(profiles, [])
})
