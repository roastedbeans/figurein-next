import type {
  ArrowElement,
  EdgeDir,
  EditorElement,
} from "@/types/editor";
import { pathConnectorBoundsCanvas } from "@/lib/path-element-geometry";

/** Bounding box used for connector binding, edge snap, and attach-point math.
 *  Path presets use the tight visible silhouette (not the letterbox frame). */
export function elementConnectorBox(el: EditorElement): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (el.type === "arrow") {
    const c = el as EditorElement & { x2: number; y2: number };
    const x = Math.min(c.x, c.x2);
    const y = Math.min(c.y, c.y2);
    return { x, y, w: Math.abs(c.x2 - c.x), h: Math.abs(c.y2 - c.y) };
  }
  if (el.type === "path") {
    return pathConnectorBoundsCanvas(el);
  }
  return { x: el.x, y: el.y, w: el.width, h: el.height };
}

/** Axis-aligned bounding box of any element. Lines/arrows aren't valid attach
 *  targets today (we don't bind to a connector), but we accept them defensively
 *  so callers can pass any element without type-narrowing first. */
function bboxOf(el: EditorElement): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return elementConnectorBox(el);
}

/** Side of `target` whose midpoint sits closest to `storedAt`. Used as a
 *  fallback when a binding has no explicit `startDir` / `endDir`. The
 *  reference point is the connector's OWN stored endpoint (which was placed
 *  on or near the target edge at bind time), not the opposite endpoint —
 *  otherwise dragging the free end would slide the bound end around the
 *  target's perimeter. */
function autoSide(
  target: { x: number; y: number; w: number; h: number },
  storedAt: { x: number; y: number }
): EdgeDir {
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const dx = storedAt.x - cx;
  const dy = storedAt.y - cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}

/** Attach point on a target's edge, given a side direction and the
 *  connector's stored endpoint position (the point the user / AI originally
 *  placed at bind time). The perpendicular coordinate is forced onto the
 *  current edge; the along-edge coordinate carries over from `storedAt` and
 *  is clamped into the target's current extent. The result: moving the
 *  target translates the attach point with it, resizing slides it along the
 *  side, and dragging the OPPOSITE endpoint does not move it at all. */
function attachPointOnSide(
  target: { x: number; y: number; w: number; h: number },
  side: EdgeDir,
  storedAt: { x: number; y: number }
): { x: number; y: number; dir: EdgeDir } {
  const left = target.x;
  const right = target.x + target.w;
  const top = target.y;
  const bottom = target.y + target.h;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  switch (side) {
    case "up":
      return { x: clamp(storedAt.x, left, right), y: top, dir: "up" };
    case "down":
      return { x: clamp(storedAt.x, left, right), y: bottom, dir: "down" };
    case "left":
      return { x: left, y: clamp(storedAt.y, top, bottom), dir: "left" };
    case "right":
      return { x: right, y: clamp(storedAt.y, top, bottom), dir: "right" };
  }
}

/** Render-time resolver: given a connector and the elements it claims to bind
 *  to, return a copy with `(x, y)` / `(x2, y2)` and `startDir` / `endDir`
 *  derived from the bound elements' bounding boxes. Endpoints without a
 *  binding (or whose target is missing) keep their stored coords — that path
 *  is what makes a freshly-detached endpoint follow the pointer.
 *
 *  This is the *single source of truth* for connector geometry on screen.
 *  Every consumer (path builder, hit area, selection handles, bbox helpers)
 *  must resolve through this function, otherwise an attached arrow stops
 *  tracking its target the moment the target is moved or resized without the
 *  arrow itself being touched. */
export function resolveConnectorEndpoints<T extends ArrowElement>(
  connector: T,
  startBound: EditorElement | null | undefined,
  endBound: EditorElement | null | undefined
): T {
  // Fast path — neither endpoint binds to anything. Return the same object so
  // the React.memo on ArrowElement keeps its === short-circuit; allocating a
  // new copy here would force a re-render of every connector on every store
  // mutation that touched its parent's id list.
  const startEffective =
    connector.startConnectedTo && startBound ? startBound : null;
  const endEffective =
    connector.endConnectedTo && endBound ? endBound : null;
  if (!startEffective && !endEffective) return connector;

  let { x, y, x2, y2, startDir, endDir } = connector;

  if (startEffective) {
    const box = bboxOf(startEffective);
    // The reference point for both side-selection and along-edge clamping is
    // the connector's OWN stored start coord — the position originally placed
    // at bind time. Using the opposite endpoint here would let a free-end
    // drag yank this end around the target's perimeter, breaking diagonal
    // connectors and detaching a stable anchor whenever the free end moved.
    const storedStart = { x: connector.x, y: connector.y };
    const side: EdgeDir = startDir ?? autoSide(box, storedStart);
    const point = attachPointOnSide(box, side, storedStart);
    x = point.x;
    y = point.y;
    startDir = point.dir;
  }

  if (endEffective) {
    const box = bboxOf(endEffective);
    const storedEnd = { x: connector.x2, y: connector.y2 };
    const side: EdgeDir = endDir ?? autoSide(box, storedEnd);
    const point = attachPointOnSide(box, side, storedEnd);
    x2 = point.x;
    y2 = point.y;
    endDir = point.dir;
  }

  return { ...connector, x, y, x2, y2, startDir, endDir };
}

/** Convenience overload: resolve through an `elementsById` Map. Used by the
 *  bbox helpers in editor-store, which already have the map in hand. */
export function resolveConnectorWithMap<T extends ArrowElement>(
  connector: T,
  elementsById: Map<string, EditorElement>
): T {
  const startBound = connector.startConnectedTo
    ? elementsById.get(connector.startConnectedTo) ?? null
    : null;
  const endBound = connector.endConnectedTo
    ? elementsById.get(connector.endConnectedTo) ?? null
    : null;
  return resolveConnectorEndpoints(connector, startBound, endBound);
}
