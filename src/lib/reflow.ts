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

/** Run the post-generation cascade reflow IN PLACE on `elements`.
 *
 *  For each text whose measured height differs from the snapshot height,
 *  shift downstream followers so intended gaps are preserved against the
 *  REAL bottom of the text, not the estimated one.
 *
 *  Rules (same as the previous server-side implementation, kept in sync):
 *  - Rect / text / icon / path: shift iff ORIGINAL top y ≥ text's planned
 *    bottom AND x-range overlaps the text's.
 *  - Line / arrow: per-endpoint check. An endpoint ≥ planned bottom shifts;
 *    endpoints above stay. This keeps lifelines anchored on actor heads
 *    (top stays) while their bottom extends past newly-grown notes. A
 *    horizontal message arrow has y == y2 so both endpoints shift together.
 *  - Sequence diagrams (detected by 2+ vertical lifelines): drop the x-range
 *    overlap check entirely so a side note on one actor's column still
 *    pushes every message row and label below it — otherwise adjacent
 *    messages in different columns reorder visibly.
 *  - All checks use ORIGINAL (snapshot) coordinates so cascades don't
 *    accidentally re-match each other's shifts.
 *  - Shifts accumulate across texts processed in snapshot-y order, so a
 *    follower sitting under two growing texts receives both deltas.
 */
export function applyCascadeReflow(
  elements: EditorElement[],
  originals: Map<string, PlannedSnapshot>
): void {
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
  if (cascade.length === 0) return;
  cascade.sort((a, b) => a.orig.y - b.orig.y);

  let verticalLifelines = 0;
  for (const el of elements) {
    if (el.type !== "line") continue;
    const o = originals.get(el.id);
    if (!o) continue;
    const x2 = o.x2 ?? o.x;
    const y2 = o.y2 ?? o.y;
    if (Math.abs(x2 - o.x) < 1 && Math.abs(y2 - o.y) >= 100) {
      verticalLifelines++;
    }
  }
  const isSequenceDiagram = verticalLifelines >= 2;

  for (const { id, orig, delta } of cascade) {
    const plannedBottom = orig.y + orig.height;
    const textLeft = orig.x;
    const textRight = orig.x + orig.width;
    for (const other of elements) {
      if (other.id === id) continue;
      const oo = originals.get(other.id);
      if (!oo) continue;
      const isConnector = other.type === "line" || other.type === "arrow";
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
        const conn = other as { y: number; y2?: number };
        if (oo.y >= plannedBottom - 2) {
          conn.y += delta;
        }
        if (
          typeof conn.y2 === "number" &&
          (oo.y2 ?? oo.y) >= plannedBottom - 2
        ) {
          conn.y2 += delta;
        }
        continue;
      }
      if (oo.y < plannedBottom - 2) continue;
      (other as { y: number }).y += delta;
    }
  }
}
