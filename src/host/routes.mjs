import { discoverSources, scanProfiles } from '../../lib/core/scan.js'
import { classifyProfiles } from '../../lib/core/mapper.js'
import { importProfiles as runImport } from '../../lib/core/importer.js'

export const API_BASE = '/api/dsh-ccswitch'
const MAX_JSON_BODY_BYTES = 64 * 1024
const SECRET_KEYS = new Set(['apiKey', 'api_key', 'OPENAI_API_KEY', 'credentialValue', 'rawConfig', 'settingsConfig'])

export function isLoopbackRequest(request) {
  const address = request.socket?.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers?.host
  if (typeof host !== 'string') return false
  let hostUrl
  try { hostUrl = new URL(`http://${host}`) } catch { return false }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostUrl.hostname)) return false
  if (request.headers?.['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers?.origin
  if (origin === undefined) return true
  try { return new URL(origin).host === hostUrl.host } catch { return false }
}

export function safeError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-<redacted>')
}

function publicValue(value, key) {
  if (SECRET_KEYS.has(key)) return undefined
  if (typeof value === 'string') return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-<redacted>')
  if (Array.isArray(value)) return value.map((item) => publicValue(item, undefined)).filter((item) => item !== undefined)
  if (value && typeof value === 'object') {
    const result = {}
    for (const [childKey, childValue] of Object.entries(value)) {
      const publicChild = publicValue(childValue, childKey)
      if (publicChild !== undefined) result[childKey] = publicChild
    }
    return result
  }
  return value
}

export function writeJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  response.end(JSON.stringify(publicValue(body)))
}

export async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function defaultScan() {
  const sources = discoverSources()
  return sources.length === 0 ? [] : scanProfiles(sources[0])
}

function methodFence(request, response, isLoopback, method) {
  if (!isLoopback(request)) {
    writeJson(response, 403, { error: 'forbidden: loopback and same-origin only' })
    return false
  }
  if (request.method !== method) {
    writeJson(response, 405, { error: 'method not allowed' })
    return false
  }
  return true
}

export function makeRoutes(deps = {}) {
  const scan = deps.scan ?? defaultScan
  const getProviders = deps.getProviders ?? (async () => ({}))
  const importProfiles = deps.importProfiles ?? runImport
  const isLoopback = deps.isLoopback ?? isLoopbackRequest
  const settings = deps.settings
  const credentials = deps.credentials
  return [
    {
      kind: 'exact',
      path: `${API_BASE}/scan`,
      handler: async (request, response) => {
        if (!methodFence(request, response, isLoopback, 'GET')) return
        try {
          const classified = classifyProfiles(await scan(), await getProviders())
          writeJson(response, 200, { profiles: classified.map((item) => item.summary) })
        } catch (error) {
          writeJson(response, 500, { error: safeError(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${API_BASE}/import`,
      handler: async (request, response) => {
        if (!methodFence(request, response, isLoopback, 'POST')) return
        const body = await readJsonBody(request)
        if (!body || !Array.isArray(body.profileIds) || body.profileIds.some((id) => typeof id !== 'string')) {
          writeJson(response, 400, { error: 'body must be { profileIds: string[], expectedRevision?: number }' })
          return
        }
        if (body.expectedRevision !== undefined && (typeof body.expectedRevision !== 'number' || !Number.isInteger(body.expectedRevision))) {
          writeJson(response, 400, { error: 'expectedRevision must be an integer' })
          return
        }
        try {
          const results = await importProfiles({
            profiles: await scan(),
            selectedIds: body.profileIds,
            settings,
            credentials,
            expectedRevision: body.expectedRevision,
          })
          writeJson(response, 200, { results })
        } catch (error) {
          writeJson(response, 500, { error: safeError(error) })
        }
      },
    },
  ]
}
