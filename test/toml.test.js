import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCodexToml } from '../lib/core/toml.js'

test('parses top-level model and custom provider section', () => {
  const result = parseCodexToml(`
model_provider = "custom"
model = "gpt-5.6-terra"
model_reasoning_effort = "xhigh"
disable_response_storage = true

[model_providers.custom]
name = "星渡"
base_url = "https://aiwtiaw.top"
wire_api = "responses"
requires_openai_auth = true

[mcp_servers]
[mcp_servers.node_repl]
command = 'C:\\x.exe'
`)
  assert.deepEqual(result, {
    model: 'gpt-5.6-terra',
    reasoningEffort: 'xhigh',
    provider: {
      name: '星渡',
      baseUrl: 'https://aiwtiaw.top',
      wireApi: 'responses',
      requiresOpenaiAuth: true,
    },
  })
})

test('returns null provider when no model_providers.custom section', () => {
  const result = parseCodexToml('model = "gpt-5"\n')
  assert.deepEqual(result, { model: 'gpt-5', reasoningEffort: undefined, provider: null })
})

test('handles missing wire_api and requires_openai_auth', () => {
  const result = parseCodexToml(`model = "x"
[model_providers.custom]
name = "n"
base_url = "http://localhost:8080/v1"
`)
  assert.deepEqual(result.provider, {
    name: 'n',
    baseUrl: 'http://localhost:8080/v1',
    wireApi: undefined,
    requiresOpenaiAuth: undefined,
  })
})

test('empty or non-toml input yields empty result', () => {
  assert.deepEqual(parseCodexToml(''), { model: undefined, reasoningEffort: undefined, provider: null })
  assert.deepEqual(parseCodexToml('not toml at all'), { model: undefined, reasoningEffort: undefined, provider: null })
})

test('strips inline comments after values', () => {
  const result = parseCodexToml(`model = "x" # top-level note
[model_providers.custom]
name = "n" # provider name
base_url = "http://localhost:8080/v1" # endpoint
requires_openai_auth = true # flag
`)
  assert.deepEqual(result, {
    model: 'x',
    reasoningEffort: undefined,
    provider: { name: 'n', baseUrl: 'http://localhost:8080/v1', wireApi: undefined, requiresOpenaiAuth: true },
  })
})
