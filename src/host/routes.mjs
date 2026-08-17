import { discoverSources, scanProfiles } from '../../lib/core/scan.js'
import { classifyProfiles } from '../../lib/core/mapper.js'
import { importProfiles as runImport } from '../../lib/core/importer.js'

export const API_BASE = '/api/dsh-ccswitch'
const MAX_JSON_BODY_BYTES = 64 * 1024
const SAFE_STATUSES = new Set(['new', 'update', 'updated', 'unchanged', 'blocked', 'failed', 'skipped'])
const SAFE_REASONING = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])

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

export function safeError() {
  return 'request failed'
}

function publicText(value) {
  return typeof value === 'string' ? value.slice(0, 200) : undefined
}

function publicEndpoint(value) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return undefined
  }
}

function publicWarning(value) {
  const text = String(value ?? '')
  if (text.includes('requires_openai_auth')) return 'provider requires OpenAI authentication'
  if (text.includes('没有 model')) return 'model is missing from the source profile'
  if (text.startsWith('unknown reasoning effort')) return 'unknown reasoning effort; configure it in DSH'
  if (text.startsWith('reasoning effort')) return 'reasoning effort is outside the conservative catalog'
  if (text.includes('已保留模型')) return 'existing model reasoning settings were preserved'
  if (text.includes('已保留现有 route')) return 'existing route reasoning was preserved'
  if (text.includes('provider 键') || text.includes('同名 provider')) return 'provider key collision; existing provider was preserved'
  return 'source profile contains an import warning'
}

function publicWarnings(value) {
  return Array.isArray(value) ? value.slice(0, 20).map(publicWarning) : []
}

function publicSummary(summary) {
  return {
    profileId: publicText(summary.profileId),
    profileName: publicText(summary.profileName),
    sourceLabel: 'CCSwitch',
    providerKey: publicText(summary.providerKey),
    baseURL: publicEndpoint(summary.baseURL),
    api: publicText(summary.api),
    modelCount: Number.isInteger(summary.modelCount) ? summary.modelCount : 0,
    modelIds: Array.isArray(summary.modelIds) ? summary.modelIds.filter((id) => typeof id === 'string').slice(0, 100) : [],
    credential: summary.credential === 'found' ? 'found' : 'missing',
    reasoningEffort: SAFE_REASONING.has(summary.reasoningEffort) ? summary.reasoningEffort : undefined,
    status: SAFE_STATUSES.has(summary.status) ? summary.status : 'blocked',
    warnings: publicWarnings(summary.warnings),
    blockedReason: summary.blockedReason ? 'source profile is blocked' : undefined,
  }
}

function publicResult(result) {
  const status = SAFE_STATUSES.has(result?.status) ? result.status : 'failed'
  const output = {
    profileId: publicText(result?.profileId),
    profileName: publicText(result?.profileName),
    providerKey: publicText(result?.providerKey),
    status,
    warnings: publicWarnings(result?.warnings),
  }
  if (status === 'failed') output.error = 'import failed'
  if (status === 'blocked') output.error = 'profile blocked'
  if (status === 'skipped') output.skipReason = 'profile was not selected or is not importable'
  return output
}

export function writeJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  response.end(JSON.stringify(body))
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
          writeJson(response, 200, { profiles: classified.map((item) => publicSummary(item.summary)) })
        } catch {
          writeJson(response, 500, { error: 'scan failed' })
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
          writeJson(response, 200, { results: results.map(publicResult) })
        } catch {
          writeJson(response, 500, { error: 'import failed' })
        }
      },
    },
  ]
}
