# Reasoning Editor Visual Refinement Design

> Status: approved direction, pending written-spec review (2026-08-18)

## Context

The Models settings page already combines CCSwitch import and per-model reasoning configuration. The import list now uses a compact, theme-safe visual language, but each reasoning model still presents model identity, mode selection, save, effort pills, and advanced wire mapping at nearly the same visual level.

The user selected the hierarchy/action-area focus and approved the recommended two-level model editor approach.

## Goals

- Give every model a clear hierarchy: identity and mode, effort selection, then advanced/save actions.
- Make selected effort levels easy to scan across multiple models.
- Separate mode selection from persistence so Enable/Disable does not compete visually with Save.
- Keep the editor compact and native to DSH rather than turning every model into a heavy decorative card.
- Preserve usable 375px behavior and existing light/dark semantic token support.

## Non-Goals

- Do not change the Host plugin, settings schema, controller state, save request, model catalog, effort values, or wire mapping semantics.
- Do not add autosave, dirty tracking, reset, bulk editing, or new validation behavior.
- Do not change the CCSwitch import section except where a shared responsive rule already applies.

## Component Structure

Each ModelEditor becomes a two-level editing block:

~~~text
article.dsh-reasoning-model
├─ header.dsh-reasoning-model__header
│  ├─ div.dsh-reasoning-model__identity (display name + optional model id)
│  └─ div.dsh-reasoning-model__mode-area (推理模式 label + 关闭/启用 control)
├─ div.dsh-reasoning-model__body (enabled only)
│  ├─ div.dsh-reasoning-levels (heading, selected summary, wrapping options)
│  └─ div.dsh-reasoning-custom (full-width toggle + optional fields)
└─ footer.dsh-reasoning-model__footer (status + Save)
~~~

Disabled mode omits the body but keeps the header and footer, so models without an effort editor do not collapse into an ambiguous single row.

## Visual System

### Model Block

- Use a subtle 1px border-l2, 8px radius, and bg-layer-1 background.
- Do not nest decorative cards. Header, body, and footer are structural bands inside one editor block.
- Separate adjacent bands with border-l2; use 12px padding on desktop and 10px on narrow screens.

### Header and Mode

- Model name remains 14px/500 primary text; model id remains 12px code/tertiary text.
- Add a small 推理模式 tertiary label immediately before the segmented control.
- The selected mode continues using button-primary-fill and label-primary-foreground; inactive options remain transparent with hover state.
- Mode selection stays a binary segmented control with aria-pressed.

### Effort Selection

- The effort section receives an explicit heading row with a selected-count summary such as 已选 6 项.
- Options move into a dedicated wrapping container.
- Each option stays a native checkbox label. The checkbox remains visually hidden but focusable.
- Inactive: border-l2, secondary text, transparent background.
- Active: brand-primary border, business-tertiary fill, primary text.
- Focus: border-l3 two-pixel outline via focus-within.
- Disabled: lower opacity and default cursor.

### Advanced Wire Mapping

- The toggle becomes a full-width row with text on the left and chevron on the right.
- Expanded state receives an active modifier and aria-expanded=true.
- The custom body keeps its current field generation and values, but uses a clear grid, consistent label width, and theme-safe input background/border.
- There is no new help copy or behavior.

### Footer and Save State

- The footer is a quiet action band aligned right on desktop.
- Save is the only primary action in the footer.
- Existing saved/error status stays immediately before Save, using current semantic state colors and pill geometry.
- While saving, the Save button retains its current label and disabled behavior; no new state contract is introduced.

## Responsive Behavior

At max-width 640px:

- Header stacks identity above the mode area.
- Mode label and segmented control remain visible and fit inside the content width.
- The effort heading may wrap; options wrap naturally with stable pill sizes.
- Footer spans full width; Save remains a stable command button.
- Custom fields collapse to one column.
- Every model block and child content uses min-width: 0; no horizontal overflow at 375px.

## Accessibility

- Preserve aria-label on mode groups and effort groups.
- Preserve checkbox semantics for multi-select effort values.
- Preserve aria-expanded on custom mapping.
- Preserve role=status for save feedback.
- Add only visual/structural wrappers; no keyboard behavior is removed.

## Data and Contract Safety

The implementation must preserve exactly:

~~~js
controller.save(route, model.id, mode, efforts)
~~~

- reasoningEfforts === false means disabled mode.
- Object reasoning efforts mean enabled mode and copied values.
- off keeps its default wire value of null.
- Existing manual custom wire input values remain intact.
- Existing provider grouping and zero-model provider display remain intact.

## Verification

1. Source-contract tests assert the new header/body/footer, effort heading/options, selected summary, and custom toggle modifiers.
2. Existing controller/domain/Host tests remain unchanged and pass.
3. npm test, npm run pack:check, and git diff --check pass.
4. DSH Desktop smoke tests at 1440px and 375px in light and dark themes verify no horizontal overflow, legible mode controls, distinguishable selected effort pills, stable footer alignment, and usable custom wire expanded/collapsed states.

## Release Boundary

This refinement remains part of the unreleased v0.1.1 UI release. Do not tag or publish until the reasoning editor visual verification passes.
