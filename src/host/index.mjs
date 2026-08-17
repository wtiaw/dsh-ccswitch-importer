import { discoverSources, scanProfiles } from '../../lib/core/scan.js'
import { importProfiles } from '../../lib/core/importer.js'
import { makeRoutes } from './routes.mjs'

export const name = 'dsh-ccswitch-importer'
export const inject = ['webServer', 'settings', 'credentials']

function scanCCSwitch() {
  const sources = discoverSources()
  return sources.length === 0 ? [] : scanProfiles(sources[0])
}

export function apply(ctx) {
  const routes = makeRoutes({
    scan: scanCCSwitch,
    getProviders: async () => {
      const value = await ctx.settings.get('llm-pi-ai')
      return value?.providers ?? {}
    },
    settings: ctx.settings,
    credentials: ctx.credentials,
    importProfiles,
  })
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) if (typeof dispose === 'function') dispose()
    }
  }, 'dsh-ccswitch-importer: routes')
}
