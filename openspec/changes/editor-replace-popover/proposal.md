## Why

The canvas **Replace with…** popover (`ReplacePopover`) and store `replaceElement` define how users swap geometry and assets without resizing or moving the selection. Requirements live only in code today, which makes regressions easy when shapes, icons, or templates evolve. Locking intent in OpenSpec aligns future edits (including agents) with the same UX and data contract.

## What Changes

- Add a **delta-capability spec** describing replace eligibility, popover sections, caps, and `replaceElement` template behavior.
- Add a **technical design note** tying UI entry points to store logic (no redesign unless spec explicitly extends it).

## Capabilities

### New Capabilities

- `editor-replace-popover`: Replace-trigger visibility, picker layout (shapes + icons), search/cap on icons, and mapping from picker actions to `ReplaceTemplate`.

### Modified Capabilities

<!-- None — no prior openspec/specs baseline for this area. -->

## Impact

- **Code**: Primarily [`src/components/editor/ReplacePopover.tsx`](../../../src/components/editor/ReplacePopover.tsx), [`src/stores/editor-store.ts`](../../../src/stores/editor-store.ts) (`isReplaceable` pattern may live beside or only in ReplacePopover consumers).
- **Data**: Serialized elements after replace inherit id, geometry, strokes/fills where applicable (`replaceElement`).
- **UX**: Toolbar / selection affordance that mounts `ReplacePopover` for replaceable elements only.
