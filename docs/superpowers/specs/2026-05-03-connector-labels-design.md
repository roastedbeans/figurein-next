# Connector Labels Design

**Date:** 2026-05-03
**Status:** Approved

## Summary

Add anchored text labels to `ArrowElement` (source, center, target) and `LineElement` (center only). Labels are stored as optional string fields on the element, rendered as SVG `<text>` nodes computed from connector geometry, and edited inline via `<foreignObject>` on double-click (center label) or via the floating toolbar (all three slots for arrow, center only for line).

## Data Model

### `LineElement` (addition)

```ts
label?: string;   // center label, edited by double-click
```

### `ArrowElement` (additions)

```ts
sourceLabel?: string;   // near the start point
label?: string;         // at path midpoint, edited by double-click
targetLabel?: string;   // near the end point
```

All fields are optional. Existing saved documents load without migration. Empty string and `undefined` both mean "no label" — the node is not rendered.

## Label Positioning

Labels are computed from connector geometry. No stored offsets.

| Label | Position |
| --- | --- |
| `label` (center) | Midpoint of the full path. Straight: `((x+x2)/2, (y+y2)/2)`. Curved: point at `t=0.5` on the quadratic. Elbow: midpoint of the longest segment. |
| `sourceLabel` | 24px along the path from the start point, offset 12px perpendicular to the left of the line's travel direction. Elbow: follows first segment direction. |
| `targetLabel` | 24px back from the end point, offset 12px perpendicular to the left of the line's travel direction. Elbow: follows last segment direction. |

Each label renders as:

- A `<rect>` background sized to the text bounding box (white fill, small padding) for readability over the line.
- A `<text>` node with `text-anchor="middle"`, `dominantBaseline="middle"`, `fontSize=12`, `fill` matching the connector's stroke color.
- `pointerEvents="none"` on both so clicks/drags still target the connector's transparent hit area.

## Editing Interaction

### Center label — double-click

Double-clicking anywhere on an arrow or line activates inline editing for `label`. A `<foreignObject>` contenteditable `<div>` appears at the center label position, focused immediately. Committing (Enter, Escape, or blur) calls `updateElement({ label: value })`. Empty content clears the field to `undefined`.

The `<foreignObject>` editor is rendered inside the existing element SVG component, gated on a local `editing: boolean` state. The double-click event is routed from `use-canvas-interaction.ts`, which already handles `TextElement` double-click — the same code path is extended for `arrow` and `line`.

### Source / Target labels — floating toolbar

Arrow-only. Two `<input type="text">` fields in the floating toolbar labelled **Source** and **Target**, placed in a "Labels" section below existing stroke controls, separated by `<Separator>`. They call `updateElement` on `onChange`.

## Floating Toolbar Changes

- **Arrow selected:** New "Labels" section with three inputs — Source, Label, Target.
- **Line selected:** New "Label" section with one input — Label.
- Placeholder text: `"Source label"`, `"Label"`, `"Target label"`.
- Style: same `<input>` pattern used elsewhere in the toolbar.

## Files Changed

| File | Change |
| --- | --- |
| `src/types/editor.ts` | Add `label?`, `sourceLabel?`, `targetLabel?` to `ArrowElement`; add `label?` to `LineElement` |
| `src/components/editor/elements/ArrowElement.tsx` | Render 3 label nodes + background rects; local `editing` state; `<foreignObject>` editor for center label; export `computeLabelPositions` helper |
| `src/components/editor/elements/LineElement.tsx` | Render center label node + background rect; `<foreignObject>` editor for center label |
| `src/components/editor/FloatingToolbar.tsx` | Add Source/Label/Target inputs for `arrow`; add Label input for `line` |
| `src/hooks/use-canvas-interaction.ts` | Route double-click on `arrow`/`line` to trigger the inline editor |

## Out of Scope

- Drag-to-reposition individual labels (labels always sit at computed positions).
- Labels on `PathElement`, `LineElement` source/target slots, or any other element type.
- Label font/size/color customization (inherits connector stroke color at 12px).
