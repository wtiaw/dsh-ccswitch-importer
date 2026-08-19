# Reasoning Editor Refresh Conflict Design

> Status: approved direction; implementation follows the selected A strategy.

## Goal

Keep per-model reasoning edits safe when the settings snapshot refreshes while the editor is mounted, and expose saving progress to assistive technology without changing the existing settings schema or Host contract.

## Behavior

- When the local draft is clean, a refreshed model state replaces the editor draft and its revision baseline.
- When the local draft is dirty and the remote model state changes, keep the draft, record the newest remote baseline, and show `远端已更新` with a `重新载入` action.
- `重新载入` discards the local draft explicitly and adopts the newest remote state.
- Save sends the revision from the draft baseline. A stale baseline therefore fails through the existing optimistic settings mutation instead of overwriting a newer remote revision; the draft remains visible after failure.
- While saving, a persistent `role=status` with `aria-live=polite` announces `保存中…`; success and error messages use the same live region.
- `reasoningEfforts === false` remains the editable disabled mode. No per-model capability semantics are introduced.

## Architecture

1. Add pure reasoning-editor state helpers for model-to-draft conversion, canonical signatures, and clean/dirty reconciliation. They remain separate from persistence and are directly unit tested.
2. Extend the existing Client controller save method with an optional expected revision argument, defaulting to the current snapshot for backwards compatibility. Return the refreshed snapshot after a successful mutation.
3. Track draft, remote baseline, baseline revision, and remote-change state in `ModelEditor`. Reconcile incoming model props through the pure helper; use the baseline revision when saving; synchronize the post-save snapshot without marking it as an external conflict.
4. Keep the existing footer save command, adding only the explicit reload command and live status semantics needed by the approved behavior.

## Tests

- Pure helper tests cover clean remote adoption, dirty draft preservation, canonical equality for reordered effort keys, and explicit reload state.
- Controller tests verify the optional expected revision is sent and a successful save returns the refreshed snapshot.
- UI contract tests verify live status semantics, remote-update/reload hooks, and the unchanged mode/save data path.
- Full npm test, package dry-run, generated bundle parity, and DSH Desktop responsive checks remain release gates.

## Non-Goals

- No Host changes.
- No settings schema changes.
- No autosave, dirty tracking beyond conflict protection, merge editor, or force-save command.
- No reinterpretation of disabled reasoning as unsupported capability.
