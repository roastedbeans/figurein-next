import type { EditorElement } from "@/types/editor";

/** Height snapshot captured at generation time — used by the cascade to
 *  compute per-text deltas once the browser has reported real measurements. */
export type PlannedSnapshot = {
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width: number;
  height: number;
};

/** Run the post-generation cascade reflow on `elements`, returning a new
 *  array where every shifted element has a new object reference.
 *
 *  Previously this function mutated in place, which meant shifted connectors
 *  kept the same object reference before and after the reflow. Zustand's
 *  selector equality check (Object.is) saw no change and skipped re-rendering
 *  the affected CanvasElements — arrows stayed at their pre-reflow positions
 *  until a page refresh forced a fresh read. Returning new references fixes
 *  that: each shifted element's CanvasElement re-renders immediately.
 *
 *  Rules:
 *  - Rect / text / icon / image / path: shift iff ORIGINAL top y ≥ text's planned
 *    bottom AND x-range overlaps the text's.
 *  - Line / arrow: per-endpoint check. An endpoint ≥ planned bottom shifts;
 *    endpoints above stay. This keeps lifelines anchored on actor heads
 *    (top stays) while their bottom extends past newly-grown notes. A
 *    horizontal message arrow has y == y2 so both endpoints shift together.
 *  - Sequence diagrams (detected by 2+ vertical lifelines): drop the x-range
 *    overlap check entirely so a side note on one actor's column still
 *    pushes every message row and label below it.
 *  - All checks use ORIGINAL (snapshot) coordinates so cascades don't
 *    accidentally re-match each other's shifts.
 *  - Shifts accumulate across texts processed in snapshot-y order. */
export function applyCascadeReflow(
  elements: EditorElement[],
  originals: Map<string, PlannedSnapshot>
): EditorElement[] {
  const cascade: Array<{
    id: string;
    orig: PlannedSnapshot;
    delta: number;
  }> = [];
  for (const el of elements) {
    if (el.type !== "text") continue;
    const orig = originals.get(el.id);
    if (!orig) continue;
    const delta = el.height - orig.height;
    if (delta === 0) continue;
    cascade.push({ id: el.id, orig, delta });
  }
  if (cascade.length === 0) return elements;
  cascade.sort((a, b) => a.orig.y - b.orig.y);

  let verticalLifelines = 0;
  for (const el of elements) {
    // Lifelines are headless connectors — visually a line, structurally an
    // arrow with no head/tail. Detect them by the lack of head AND tail.
    if (el.type !== "arrow") continue;
    if (el.headStyle !== "none" || el.tailStyle !== "none") continue;
    const o = originals.get(el.id);
    if (!o) continue;
    const x2 = o.x2 ?? o.x;
    const y2 = o.y2 ?? o.y;
    if (Math.abs(x2 - o.x) < 1 && Math.abs(y2 - o.y) >= 100) {
      verticalLifelines++;
    }
  }
  const isSequenceDiagram = verticalLifelines >= 2;

  // Accumulate per-element shifts here instead of mutating in place. Using a
  // Map keyed by id means multiple cascade entries (two growing notes above
  // the same arrow) correctly add their deltas together.
  const yShift = new Map<string, number>();
  const y2Shift = new Map<string, number>();

  for (const { id, orig, delta } of cascade) {
    const plannedBottom = orig.y + orig.height;
    const textLeft = orig.x;
    const textRight = orig.x + orig.width;
    for (const other of elements) {
      if (other.id === id) continue;
      const oo = originals.get(other.id);
      if (!oo) continue;
      const isConnector = other.type === "arrow";
      if (!isSequenceDiagram) {
        const ol = isConnector ? Math.min(oo.x, oo.x2 ?? oo.x) : oo.x;
        const or = isConnector
          ? Math.max(oo.x, oo.x2 ?? oo.x)
          : oo.x + oo.width;
        if (or < textLeft || ol > textRight) continue;
      }
      if (isConnector) {
        // Per-endpoint cascade. A lifeline's top stays anchored on its
        // actor while its bottom extends; a horizontal message arrow
        // moves as a whole (y == y2).
        if (oo.y >= plannedBottom - 2) {
          yShift.set(other.id, (yShift.get(other.id) ?? 0) + delta);
        }
        if ((oo.y2 ?? oo.y) >= plannedBottom - 2) {
          y2Shift.set(other.id, (y2Shift.get(other.id) ?? 0) + delta);
        }
        continue;
      }
      if (oo.y < plannedBottom - 2) continue;
      yShift.set(other.id, (yShift.get(other.id) ?? 0) + delta);
    }
  }

  if (yShift.size === 0 && y2Shift.size === 0) return elements;

  // Build a new array. Unchanged elements keep their existing reference so
  // React.memo / Zustand equality checks don't trigger unnecessary re-renders.
  // Shifted elements get a new spread so those checks DO fire.
  return elements.map((el) => {
    const dy = yShift.get(el.id);
    const dy2 = y2Shift.get(el.id);
    if (dy === undefined && dy2 === undefined) return el;
    const updates: Partial<{ y: number; y2: number }> = {};
    if (dy !== undefined) updates.y = el.y + dy;
    if (dy2 !== undefined) {
      const prev = (el as EditorElement & { y2?: number }).y2;
      if (typeof prev === "number") updates.y2 = prev + dy2;
    }
    return { ...el, ...updates } as EditorElement;
  });
}
