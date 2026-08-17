import { knownReasoningFor } from './catalog.mjs'

export const IMPORTED_LEVELS = Object.freeze(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
const IMPORTED_LEVEL_SET = new Set(IMPORTED_LEVELS)

export function normalizeImportedEffort(value) {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'none') return 'off'
  return IMPORTED_LEVEL_SET.has(normalized) ? normalized : undefined
}

export function seedReasoning(modelId, rawEffort) {
  const effort = normalizeImportedEffort(rawEffort)
  if (rawEffort !== undefined && effort === undefined) return {
    efforts: false,
    defaultEffort: undefined,
    warnings: [`unknown reasoning effort "${String(rawEffort)}"; configure it in DSH`],
  }
  if (effort === 'off') return { efforts: false, defaultEffort: 'off', warnings: [] }
  const known = knownReasoningFor(modelId)
  if (effort === undefined) return {
    efforts: known ?? false,
    defaultEffort: undefined,
    warnings: [],
  }
  if (known !== undefined && known[effort] !== undefined) return {
    efforts: known,
    defaultEffort: effort,
    warnings: [],
  }
  if (known !== undefined) return {
    efforts: known,
    defaultEffort: undefined,
    warnings: [`reasoning effort "${effort}" is not in the conservative catalog for ${modelId}`],
  }
  return {
    efforts: { off: null, [effort]: effort },
    defaultEffort: effort,
    warnings: [],
  }
}
