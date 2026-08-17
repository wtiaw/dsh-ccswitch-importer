import test from 'node:test'
import assert from 'node:assert/strict'
import { makeRoutes, readJsonBody, isLoopbackRequest, safeError } from '../src/host/routes.mjs'

function fakeReq(overrides = {}) {
  return {
    method: 'GET',
    url: '/api/dsh-ccswitch/scan',
    headers: { host: '127.0.0.1:5624' },
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  }
}

function fakeRes() {
  const calls = []
  return {
    calls,
    writeHead(status, headers) { calls.push(['head', status, headers]) },
    end(body) { calls.push(['end', body]) },
  }
}

function withBody(request, body) {
  return Object.assign(request, {
    [Symbol.asyncIterator]: async function* () { yield Buffer.from(body) },
  })
}

test('scan route returns redacted summaries without secrets', async () => {
  const routes = makeRoutes({
    scan: async () => [{
      profileId: 'p-1', profileName: 'P1', baseURL: 'https://x/v1', api: 'openai-responses',
      models: [{ id: 'm' }], modelReasoningEffort: 'high', apiKey: 'sk-SECRET-X', warnings: [],
    }],
    getProviders: async () => ({}),
    isLoopback: () => true,
  })
  const route = routes.find((item) => item.path === '/api/dsh-ccswitch/scan')
  const res = fakeRes()
  await route.handler(fakeReq(), res)
  const body = JSON.parse(res.calls.find((call) => call[0] === 'end')[1])
  assert.ok(!JSON.stringify(body).includes('sk-SECRET-X'))
  assert.equal(body.profiles[0].credential, 'found')
  assert.equal(body.profiles[0].reasoningEffort, 'high')
})

test('import route forwards only selected IDs and revision', async () => {
  let received
  const routes = makeRoutes({
    scan: async () => [{ profileId: 'p-1', profileName: 'P1', apiKey: 'sk-SECRET-X', models: [] }],
    settings: {},
    credentials: {},
    importProfiles: async (args) => { received = args; return [{ profileId: 'p-1', providerKey: 'ccs-p1-aaaaaaaa', status: 'new' }] },
    isLoopback: () => true,
  })
  const route = routes.find((item) => item.path === '/api/dsh-ccswitch/import')
  const req = withBody(fakeReq({ method: 'POST', url: '/api/dsh-ccswitch/import', headers: { host: '127.0.0.1:5624', origin: 'http://127.0.0.1:5624', 'content-type': 'application/json' } }), JSON.stringify({ profileIds: ['p-1'], expectedRevision: 3, profile: { apiKey: 'sk-DO-NOT-TRUST' } }))
  const res = fakeRes()
  await route.handler(req, res)
  assert.deepEqual(received.selectedIds, ['p-1'])
  assert.equal(received.expectedRevision, 3)
  assert.ok(!JSON.stringify(received).includes('sk-DO-NOT-TRUST'))
  assert.equal(JSON.parse(res.calls.find((call) => call[0] === 'end')[1]).results[0].status, 'new')
})

test('loopback and same-origin fences reject unsafe requests', () => {
  assert.equal(isLoopbackRequest(fakeReq()), true)
  assert.equal(isLoopbackRequest(fakeReq({ socket: { remoteAddress: '10.0.0.5' } })), false)
  assert.equal(isLoopbackRequest(fakeReq({ headers: {} })), false)
  assert.equal(isLoopbackRequest(fakeReq({ headers: { host: '127.0.0.1:5624', 'sec-fetch-site': 'cross-site' } })), false)
  assert.equal(isLoopbackRequest(fakeReq({ headers: { host: '127.0.0.1:5624', origin: 'http://127.0.0.1:9999' } })), false)
})

test('readJsonBody caps size and tolerates garbage', async () => {
  const big = { [Symbol.asyncIterator]: async function* () { yield Buffer.alloc(64 * 1024 + 1, 'a') } }
  assert.equal(await readJsonBody(big), undefined)
  const garbage = { [Symbol.asyncIterator]: async function* () { yield Buffer.from('not json') } }
  assert.equal(await readJsonBody(garbage), undefined)
  const ok = { [Symbol.asyncIterator]: async function* () { yield Buffer.from('{"a":1}') } }
  assert.deepEqual(await readJsonBody(ok), { a: 1 })
})

test('safeError redacts credential-shaped values', () => {
  assert.equal(safeError(new Error('bad sk-SECRET-X')), 'bad sk-<redacted>')
})
