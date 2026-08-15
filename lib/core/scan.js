import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { extractProfile } from './extract.js'

export const DEFAULT_DB_CANDIDATES = [
  () => join(homedir(), '.cc-switch', 'cc-switch.db'),
]

/** Open the CC Switch SQLite database strictly read-only. */
export function openDb(dbPath) {
  return new DatabaseSync(dbPath, { readOnly: true })
}

/** Discover candidate database paths (extendable for manual-source UI). */
export function discoverSources() {
  return DEFAULT_DB_CANDIDATES.map((fn) => fn()).filter((p) => existsSync(p))
}

/** Scan every codex provider row and extract profiles. Never throws on a missing db. */
export function scanProfiles(dbPath) {
  if (typeof dbPath !== 'string' || dbPath === '' || !existsSync(dbPath)) return []
  let db
  try {
    db = openDb(dbPath)
    const rows = db.prepare('SELECT id, name, settings_config, is_current FROM providers').all()
    return rows
      .map((row) => extractProfile(row))
      .filter((profile) => profile !== undefined)
  } catch (err) {
    console.error('[dsh-ccswitch-importer] scan failed:', err)
    return []
  } finally {
    if (db) db.close()
  }
}
