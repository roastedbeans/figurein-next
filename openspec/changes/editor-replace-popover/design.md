## Context

- **UI**: `ReplacePopover` is a Radix/Base UI-style popover with two bands: stencil shapes (`SHAPES` + rectangle/circle primitives) and a searchable lucide-derived icon grid.
- **State**: Replacements mutate the current page through `replaceElement(id, ReplaceTemplate)`, preserving bbox, transforms, strokes, opacity, grouping, etc., while swapping type/content per template.
- **Constraints**: Connector elements (arrows/lines as defined by product) intentionally omit replace UX; grid size is capped for performance (`ICON_RESULT_CAP`).

## Goals / Non-Goals

**Goals:**

- Preserve layout and styling fields across type changes where the codebase already does (see `replaceElement` `base` payload).
- Keep stencil picks aligned with shape catalog (`shapeId`, optional `pathGenerator` for dynamic paths).
- Prevent unbounded DOM in the icons section.

**Non-Goals:**

- Replacing arrows/connectors via this popover (explicit product exclusion unless a new capability is proposed).
- Uploading inline images inside this popover (`ImagesPanel` / image elements remain separate flows unless specs expand).

## Decisions

- **Single template union (`ReplaceTemplate`)** — Replacements are enumerated variants (`icon`, `rectangle`, `circle`, `stencil`) so picker actions map 1:1 to store mutations; avoids stringly-typed “kind” drifting from TS.
- **Stencil path regeneration** — When `shapeId` maps to `SHAPES_BY_ID` with a generator, path data is regenerated from bbox; otherwise stored `pathData` + `viewBox` from the stencil catalog are applied.
- **Icon search cap** — First N results from `searchIcons` only; avoids rendering the full lucide manifest in the popover layer.

## Risks / Trade-offs

- **[Risk] Incomplete search** → Users may assume “no results” means the icon pack lacks the glyph; mitigation: clear empty state (already inline) and cap called out in spec.
- **[Risk] Aspect / border-radius fidelity** → Circle from non-square rects uses ellipse semantics in UI; mitigation: documented in implementation comment and preserved by type switch.
