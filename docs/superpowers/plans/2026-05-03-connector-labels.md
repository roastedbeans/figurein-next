# Connector Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add anchored text labels (source, center, target) to `ArrowElement` and a center label to `LineElement`, editable via double-click inline or via the floating toolbar.

**Architecture:** Labels are optional string fields on the element types, computed-position SVG `<text>` nodes rendered inside `ArrowElement.tsx`, and edited via a `<foreignObject>` `<input>` gated on a new `editingConnectorId` store field. `LineElement.tsx` needs no changes — its `label` field spreads through the existing `ArrowElement` renderer automatically.

**Tech Stack:** React, Zustand, SVG `<foreignObject>`, TypeScript, Tailwind CSS

---

## File Map

| File | What changes |
| --- | --- |
| `src/types/editor.ts` | Add `label?` to `LineElement`; add `label?`, `sourceLabel?`, `targetLabel?` to `ArrowElement` |
| `src/stores/editor-store.ts` | Add `editingConnectorId: string \| null` state + `setEditingConnectorId` action |
| `src/components/editor/elements/ArrowElement.tsx` | Export `parsePathPoints`; add `computeLabelPositions`; add `LabelNode` component; render labels + `<foreignObject>` editor; subscribe to new store fields |
| `src/hooks/use-canvas-interaction.ts` | Extend `onDoubleClick` to set `editingConnectorId` for arrow/line elements |
| `src/components/editor/FloatingToolbar.tsx` | Add Source/Label/Target text inputs in the connector section |
| `src/components/editor/elements/LineElement.tsx` | No changes — `label` from `LineElementType` spreads through to `ArrowElement` renderer automatically |

---

### Task 1: Extend type definitions

**Files:**
- Modify: `src/types/editor.ts`

- [ ] **Step 1: Add `label` to `LineElement` and three label fields to `ArrowElement`**

In `src/types/editor.ts`, find the `LineElement` type (currently ends at `lineStyle`) and add `label?`:

```ts
export type LineElement = BaseElement & {
  type: "line";
  x2: number;
  y2: number;
  headStyle: "triangle" | "open" | "none";
  tailStyle: "none" | "triangle" | "open";
  lineStyle: "straight" | "curved" | "elbow";
  cx?: number;
  cy?: number;
  elbowMidRatio?: number;
  elbowCorners?: [number, number][];
  startDir?: EdgeDir;
  endDir?: EdgeDir;
  startConnectedTo?: string;
  endConnectedTo?: string;
  label?: string;
};
```

Find the `ArrowElement` type and add three label fields before the closing `}`:

```ts
export type ArrowElement = BaseElement & {
  type: "arrow";
  x2: number;
  y2: number;
  headStyle: "triangle" | "open" | "none";
  tailStyle: "none" | "triangle" | "open";
  lineStyle: "straight" | "curved" | "elbow";
  cx?: number;
  cy?: number;
  elbowMidRatio?: number;
  elbowCorners?: [number, number][];
  startDir?: EdgeDir;
  endDir?: EdgeDir;
  startConnectedTo?: string;
  endConnectedTo?: string;
  sourceLabel?: string;
  label?: string;
  targetLabel?: string;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no output (zero errors)

---

### Task 2: Add `editingConnectorId` to the editor store

**Files:**
- Modify: `src/stores/editor-store.ts`

- [ ] **Step 1: Add the field and action to the `EditorStore` type**

In `src/stores/editor-store.ts`, find the line (≈165):
```ts
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
```

Add immediately after it:
```ts
  editingConnectorId: string | null;
  setEditingConnectorId: (id: string | null) => void;
```

- [ ] **Step 2: Initialize the field in the store `create` call**

Find the line (≈415):
```ts
    editingTextId: null,
```

Add immediately after it:
```ts
    editingConnectorId: null,
```

- [ ] **Step 3: Add the action implementation**

Find the line (≈901):
```ts
    setEditingTextId: (id) => set({ editingTextId: id }),
```

Add immediately after it:
```ts
    setEditingConnectorId: (id) => set({ editingConnectorId: id }),
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no output (zero errors)

- [ ] **Step 5: Commit**

```bash
git add src/types/editor.ts src/stores/editor-store.ts
git commit -m "feat: add connector label fields to types and store"
```

---

### Task 3: Export `parsePathPoints` and add `computeLabelPositions`

**Files:**
- Modify: `src/components/editor/elements/ArrowElement.tsx`

- [ ] **Step 1: Export `parsePathPoints`**

In `src/components/editor/elements/ArrowElement.tsx`, find:
```ts
/** Parse an SVG path "M x y L x y L x y ..." into point array */
function parsePathPoints(d: string): [number, number][] {
```

Change `function` to `export function`:
```ts
/** Parse an SVG path "M x y L x y L x y ..." into point array */
export function parsePathPoints(d: string): [number, number][] {
```

- [ ] **Step 2: Add `computeLabelPositions` after `buildTrimmedPath`**

Find the comment `// ---------------------------------------------------------------------------` that precedes `// Elbow segment handles`. Insert the following block immediately before it:

```ts
// ---------------------------------------------------------------------------
// Label position helpers
// ---------------------------------------------------------------------------

export type ConnectorLabelPositions = {
  center: { x: number; y: number };
  source: { x: number; y: number };
  target: { x: number; y: number };
};

/** Compute the three anchor positions for connector labels.
 *  Pass `fullPath` (from `buildPath`) to skip re-running elbow routing.
 *  All coordinates are in canvas (SVG world) space. */
export function computeLabelPositions(
  element: ArrowElementType,
  fullPath?: string
): ConnectorLabelPositions {
  const { x, y, x2, y2 } = element;
  const style = element.lineStyle || "straight";

  // Center label position
  let centerX: number;
  let centerY: number;
  if (style === "curved") {
    const dp = getDefaultControlPoint(x, y, x2, y2);
    const cpx = element.cx ?? dp.cx;
    const cpy = element.cy ?? dp.cy;
    centerX = 0.25 * x + 0.5 * cpx + 0.25 * x2;
    centerY = 0.25 * y + 0.5 * cpy + 0.25 * y2;
  } else if (style === "elbow") {
    const d = fullPath ?? buildPath(element);
    const pts = parsePathPoints(d);
    let maxLen = -1;
    centerX = (x + x2) / 2;
    centerY = (y + y2) / 2;
    for (let i = 1; i < pts.length; i++) {
      const segLen =
        Math.abs(pts[i][0] - pts[i - 1][0]) +
        Math.abs(pts[i][1] - pts[i - 1][1]);
      if (segLen > maxLen) {
        maxLen = segLen;
        centerX = (pts[i][0] + pts[i - 1][0]) / 2;
        centerY = (pts[i][1] + pts[i - 1][1]) / 2;
      }
    }
  } else {
    centerX = (x + x2) / 2;
    centerY = (y + y2) / 2;
  }

  // Forward angles — direction of travel leaving start and arriving at end
  let fwdStart: number;
  let fwdEnd: number;
  if (style === "curved") {
    const dp = getDefaultControlPoint(x, y, x2, y2);
    const cpx = element.cx ?? dp.cx;
    const cpy = element.cy ?? dp.cy;
    fwdStart = Math.atan2(cpy - y, cpx - x);
    fwdEnd = Math.atan2(y2 - cpy, x2 - cpx);
  } else if (style === "elbow") {
    const d = fullPath ?? buildPath(element);
    const segs = parsePathPoints(d);
    if (segs.length >= 2) {
      fwdStart = Math.atan2(segs[1][1] - segs[0][1], segs[1][0] - segs[0][0]);
      const last = segs.length - 1;
      fwdEnd = Math.atan2(
        segs[last][1] - segs[last - 1][1],
        segs[last][0] - segs[last - 1][0]
      );
    } else {
      fwdStart = Math.atan2(y2 - y, x2 - x);
      fwdEnd = fwdStart;
    }
  } else {
    fwdStart = Math.atan2(y2 - y, x2 - x);
    fwdEnd = fwdStart;
  }

  // 24px along from endpoint + 12px perpendicular (90° CW = visually above a
  // horizontal line; consistent for any orientation)
  const ALONG = 24;
  const PERP = 12;
  return {
    center: { x: centerX, y: centerY },
    source: {
      x: x + Math.cos(fwdStart) * ALONG + Math.sin(fwdStart) * PERP,
      y: y + Math.sin(fwdStart) * ALONG - Math.cos(fwdStart) * PERP,
    },
    target: {
      x: x2 - Math.cos(fwdEnd) * ALONG + Math.sin(fwdEnd) * PERP,
      y: y2 - Math.sin(fwdEnd) * ALONG - Math.cos(fwdEnd) * PERP,
    },
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no output (zero errors)

---

### Task 4: Add label rendering and `<foreignObject>` editor to `ArrowElement`

**Files:**
- Modify: `src/components/editor/elements/ArrowElement.tsx`

- [ ] **Step 1: Add `LabelNode` helper component before `ArrowElementImpl`**

Find the comment `// Component` block. Immediately before `function ArrowElementImpl`, add:

```tsx
/** Renders a single connector label: white background rect + text. */
function LabelNode({
  text,
  pos,
  stroke,
}: {
  text: string;
  pos: { x: number; y: number };
  stroke: string;
}) {
  const PAD = 3;
  const w = Math.max(20, text.length * 7) + PAD * 2;
  const h = 16;
  return (
    <g pointerEvents="none">
      <rect
        x={pos.x - w / 2}
        y={pos.y - h / 2}
        width={w}
        height={h}
        rx={2}
        fill="white"
        opacity={0.85}
      />
      <text
        x={pos.x}
        y={pos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
        fill={stroke}
        fontFamily="inherit"
      >
        {text}
      </text>
    </g>
  );
}
```

- [ ] **Step 2: Add store subscriptions to `ArrowElementImpl`**

Inside `ArrowElementImpl`, after the existing `startBound`/`endBound`/`resolved` declarations, add:

```ts
  const updateElement = useEditorStore((s) => s.updateElement);
  const editingConnectorId = useEditorStore((s) => s.editingConnectorId);
  const setEditingConnectorId = useEditorStore((s) => s.setEditingConnectorId);
  const isEditing = editingConnectorId === element.id;
```

- [ ] **Step 3: Compute label positions after `trimmedPath`**

After the line `const trimmedPath = buildTrimmedPath(resolved, headSize, fullPath);`, add:

```ts
  const labelPositions = computeLabelPositions(resolved, fullPath);
```

- [ ] **Step 4: Add label nodes and editor to the return JSX**

In the `return` statement of `ArrowElementImpl`, after `{tailNode}` and before the closing `</g>`, add:

```tsx
      {/* Connector labels */}
      {resolved.sourceLabel && (
        <LabelNode
          text={resolved.sourceLabel}
          pos={labelPositions.source}
          stroke={resolved.stroke}
        />
      )}
      {resolved.label && !isEditing && (
        <LabelNode
          text={resolved.label}
          pos={labelPositions.center}
          stroke={resolved.stroke}
        />
      )}
      {resolved.targetLabel && (
        <LabelNode
          text={resolved.targetLabel}
          pos={labelPositions.target}
          stroke={resolved.stroke}
        />
      )}
      {/* Inline center-label editor (activated by double-click) */}
      {isEditing && (
        <foreignObject
          x={labelPositions.center.x - 60}
          y={labelPositions.center.y - 12}
          width={120}
          height={24}
          style={{ overflow: "visible" }}
        >
          <div style={{ width: "120px" }}>
            <input
              type="text"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              defaultValue={resolved.label ?? ""}
              onBlur={(e) => {
                updateElement(element.id, {
                  label: e.currentTarget.value.trim() || undefined,
                });
                setEditingConnectorId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateElement(element.id, {
                    label: e.currentTarget.value.trim() || undefined,
                  });
                  setEditingConnectorId(null);
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  setEditingConnectorId(null);
                  e.currentTarget.blur();
                }
                e.stopPropagation();
              }}
              style={{
                width: "100%",
                fontSize: "12px",
                textAlign: "center",
                border: "1px solid hsl(221 83% 53%)",
                borderRadius: "4px",
                padding: "2px 4px",
                outline: "none",
                background: "white",
                boxSizing: "border-box" as const,
              }}
            />
          </div>
        </foreignObject>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no output (zero errors)

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/elements/ArrowElement.tsx
git commit -m "feat: add label rendering and inline editor to ArrowElement"
```

---

### Task 5: Route double-click on arrow/line to open the label editor

**Files:**
- Modify: `src/hooks/use-canvas-interaction.ts`

- [ ] **Step 1: Extend `onDoubleClick` to handle connectors**

In `src/hooks/use-canvas-interaction.ts`, find the `onDoubleClick` callback (≈line 1897):

```ts
  const onDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const state = store.getState();
      const elementId = findElementId(e.target);
      if (!elementId) return;
      const el = state.elements.find((x) => x.id === elementId);
      if (!el?.groupId) return;
      state.setEditingGroupId(el.groupId);
      state.selectElement(elementId);
    },
    [store]
  );
```

Replace it with:

```ts
  const onDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const state = store.getState();
      const elementId = findElementId(e.target);
      if (!elementId) return;
      const el = state.elements.find((x) => x.id === elementId);
      if (!el) return;

      // Double-click on a connector → open the center label editor
      if (el.type === "arrow" || el.type === "line") {
        state.setEditingConnectorId(elementId);
        return;
      }

      if (!el.groupId) return;
      state.setEditingGroupId(el.groupId);
      state.selectElement(elementId);
    },
    [store]
  );
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no output (zero errors)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-canvas-interaction.ts
git commit -m "feat: route double-click on arrow/line to connector label editor"
```

---

### Task 6: Add label inputs to the floating toolbar

**Files:**
- Modify: `src/components/editor/FloatingToolbar.tsx`

- [ ] **Step 1: Import `ArrowElement` type**

Find the existing type import:
```ts
import type { EditorElement, StrokeStyle } from "@/types/editor";
```

Change it to:
```ts
import type { ArrowElement as ArrowElementType, EditorElement, StrokeStyle } from "@/types/editor";
```

- [ ] **Step 2: Add label inputs after the connector controls block**

In the JSX of `FloatingToolbar`, find the closing of the line/arrow connector block (≈line 831):
```tsx
        {/* Line / Arrow: path style + heads */}
        {(element.type === "line" || element.type === "arrow") && (
          <>
            <Separator orientation="vertical" className="mx-0.5" />
            <LineStylePicker
              ...
            />
            <div className="flex items-center gap-0.5">
              <ArrowEndPicker side="left" ... />
              <Button ... />
              <ArrowEndPicker side="right" ... />
            </div>
          </>
        )}
```

Add a new block immediately after the closing `)}` of that block:

```tsx
        {/* Connector labels */}
        {(element.type === "line" || element.type === "arrow") && (
          <>
            <Separator orientation="vertical" className="mx-0.5" />
            {element.type === "arrow" && (
              <input
                type="text"
                placeholder="Source label"
                value={(element as ArrowElementType).sourceLabel ?? ""}
                onChange={(e) =>
                  update({
                    sourceLabel: e.target.value || undefined,
                  } as Partial<EditorElement>)
                }
                className="h-7 w-[72px] rounded-md border bg-background px-1.5 text-xs"
              />
            )}
            <input
              type="text"
              placeholder="Label"
              value={(element as ArrowElementType).label ?? ""}
              onChange={(e) =>
                update({
                  label: e.target.value || undefined,
                } as Partial<EditorElement>)
              }
              className="h-7 w-[72px] rounded-md border bg-background px-1.5 text-xs"
            />
            {element.type === "arrow" && (
              <input
                type="text"
                placeholder="Target label"
                value={(element as ArrowElementType).targetLabel ?? ""}
                onChange={(e) =>
                  update({
                    targetLabel: e.target.value || undefined,
                  } as Partial<EditorElement>)
                }
                className="h-7 w-[72px] rounded-md border bg-background px-1.5 text-xs"
              />
            )}
          </>
        )}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no output (zero errors)

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/FloatingToolbar.tsx
git commit -m "feat: add source/label/target inputs to floating toolbar for connectors"
```
