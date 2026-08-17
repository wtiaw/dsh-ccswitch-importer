function defaultFetch(url, init) {
  return globalThis.fetch(url, init)
}

function importable(profile) {
  return profile.status !== 'blocked' && profile.credential === 'found'
}

export function createCCSwitchImportController({
  fetchImpl = defaultFetch,
  getRevision = () => undefined,
  onImported = () => {},
} = {}) {
  let snapshot = {
    phase: 'idle',
    profiles: [],
    selectedIds: [],
    results: [],
    error: null,
  }
  const listeners = new Set()
  const publish = (next) => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  const request = async (url, init) => {
    const response = await fetchImpl(url, init)
    let body
    try {
      body = await response.json()
    } catch {
      body = undefined
    }
    if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
    return body ?? {}
  }
  const controller = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setSelectedIds: (selectedIds) => {
      publish({ ...snapshot, selectedIds: [...new Set(selectedIds.filter((id) => typeof id === 'string'))] })
    },
    toggleSelected: (profileId) => {
      const selected = new Set(snapshot.selectedIds)
      if (selected.has(profileId)) selected.delete(profileId)
      else selected.add(profileId)
      controller.setSelectedIds([...selected])
    },
    scan: async () => {
      publish({ ...snapshot, phase: 'loading', error: null })
      try {
        const body = await request('/api/dsh-ccswitch/scan')
        const profiles = Array.isArray(body.profiles) ? body.profiles : []
        const selectedIds = profiles.filter(importable).map((profile) => profile.profileId)
        publish({ phase: 'ready', profiles, selectedIds, results: [], error: null })
        return snapshot
      } catch (error) {
        publish({ ...snapshot, phase: 'error', error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    },
    importSelected: async () => {
      publish({ ...snapshot, phase: 'importing', error: null })
      try {
        const body = await request('/api/dsh-ccswitch/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ profileIds: snapshot.selectedIds, expectedRevision: getRevision() }),
        })
        const results = Array.isArray(body.results) ? body.results : []
        publish({ ...snapshot, phase: 'done', results, error: null })
        await onImported(results)
        return snapshot
      } catch (error) {
        publish({ ...snapshot, phase: 'error', error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    },
  }
  return controller
}
