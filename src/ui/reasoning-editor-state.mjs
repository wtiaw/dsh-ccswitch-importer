import { reasoningStateForModel } from '../domain/validation.mjs'

export function draftForModel(model) {
  if (model.reasoningEfforts === false) return { mode: 'disabled', efforts: {} }
  if (model.reasoningEfforts && typeof model.reasoningEfforts === 'object') {
    return { mode: 'enabled', efforts: { ...model.reasoningEfforts } }
  }
  const inferred = reasoningStateForModel(model.id)
  return { mode: inferred.mode, efforts: { ...(inferred.efforts ?? {}) } }
}

export function draftSignature(draft) {
  const efforts = Object.entries(draft.efforts ?? {}).sort(([left], [right]) => left.localeCompare(right))
  return JSON.stringify([draft.mode, efforts])
}

export function reconcileDraft({ draft, baseline, baselineRevision, remoteModel, remoteRevision, remoteChanged }) {
  const remoteDraft = draftForModel(remoteModel)
  const remoteSignature = draftSignature(remoteDraft)
  const baselineSignature = draftSignature(baseline)
  const draftIsClean = draftSignature(draft) === baselineSignature
  if (remoteSignature === baselineSignature) {
    return { draft, baseline, baselineRevision: remoteRevision, remoteChanged: false }
  }
  if (draftIsClean) {
    return { draft: remoteDraft, baseline: remoteDraft, baselineRevision: remoteRevision, remoteChanged: false }
  }
  return { draft, baseline, baselineRevision, remoteChanged: true }
}

export function reloadDraft({ remoteModel, remoteRevision }) {
  const next = draftForModel(remoteModel)
  return { draft: next, baseline: next, baselineRevision: remoteRevision, remoteChanged: false }
}
