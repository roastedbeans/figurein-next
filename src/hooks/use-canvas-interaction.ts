"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useEditorStore, setCanvasCursorPos, elementById } from "@/stores/editor-store";
import type { EditorElement, ArrowElement, LineElement, EdgeDir } from "@/types/editor";
import type { FlowchartShape } from "@/lib/flowchart-shapes";
import {
  DEFAULT_FILL,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_FONT_FAMILY,
  DEFAULT_SHAPE_WIDTH,
  DEFAULT_SHAPE_HEIGHT,
  DEFAULT_LINE_LENGTH,
  GRID_SIZE,
  MIN_ZOOM,
  MAX_ZOOM,
  SNAP_SIZE,
  TEXT_VARIANTS,
} from "@/lib/constants";
import {
  getDefaultElbowCorners,
  cleanOrthogonalPath,
} from "@/components/editor/elements/ArrowElement";

type GroupOrigPos = {
  id: string;
  x: number; y: number;
  x2?: number; y2?: number;
  cx?: number; cy?: number;
  elbowCorners?: [number, number][];
};
type ConnectorOrig = {
  id: string;
  x: number; y: number;
  x2: number; y2: number;
  lineStyle: string;
  elbowCorners?: [number, number][];
  startConnectedTo?: string;
  endConnectedTo?: string;
};

type PreDrawTool = "rectangle" | "circle" | "line" | "arrow" | "path";

type InteractionMode =
  | { type: "none" }
  | { type: "preDraw"; startX: number; startY: number; tool: PreDrawTool; startSnapDir?: EdgeDir; startConnectedTo?: string; pathShape?: FlowchartShape }
  | { type: "drawing"; startX: number; startY: number; elementId: string; defaultW?: number; defaultH?: number }
  | { type: "moving"; startX: number; startY: number; origX: number; origY: number; origX2?: number; origY2?: number; origCx?: number; origCy?: number; origElbowCorners?: [number, number][]; groupOrigs?: GroupOrigPos[]; connectedOrigs?: ConnectorOrig[]; moved?: boolean }
  | { type: "resizing"; handle: string; startX: number; startY: number; orig: EditorElement; committed?: boolean }
  | { type: "rotating"; elementId: string; centerX: number; centerY: number; startPointerAngle: number; origRotation: number; origEndpoints?: { x: number; y: number; x2: number; y2: number }; isLine: boolean; committed?: boolean }
  | { type: "panning"; startX: number; startY: number; origPanX: number; origPanY: number }
  | { type: "marquee"; startX: number; startY: number; origIds: string[]; shiftKey: boolean };

/** Build a new drawing element at a given position/size. Used by both the
 *  drag-to-size path (width/height = dragged bbox) and the click-drop path
 *  (width/height = default, re-centered on the click point). Keeping the
 *  construction in one place ensures both paths produce identical shapes. */
function buildDrawingElement(opts: {
  tool: PreDrawTool;
  x: number;
  y: number;
  width: number;
  height: number;
  x2: number;
  y2: number;
  startSnapDir?: EdgeDir;
  startConnectedTo?: string;
  pathShape?: FlowchartShape;
  zIndex: number;
}): EditorElement {
  const id = Math.random().toString(36).substring(2, 11);
  const base = {
    id,
    parentId: null,
    x: opts.x,
    y: opts.y,
    rotation: 0,
    opacity: 1,
    zIndex: opts.zIndex,
  } as const;
  switch (opts.tool) {
    case "rectangle":
      return {
        ...base,
        type: "rectangle",
        width: opts.width,
        height: opts.height,
        fill: DEFAULT_FILL,
        stroke: DEFAULT_STROKE,
        strokeWidth: DEFAULT_STROKE_WIDTH,
        borderRadius: 0,
      };
    case "circle":
      return {
        ...base,
        type: "circle",
        width: opts.width,
        height: opts.height,
        fill: DEFAULT_FILL,
        stroke: DEFAULT_STROKE,
        strokeWidth: DEFAULT_STROKE_WIDTH,
      };
    case "line":
      return {
        ...base,
        type: "line",
        x2: opts.x2,
        y2: opts.y2,
        width: 0,
        height: 0,
        fill: "none",
        stroke: DEFAULT_STROKE,
        strokeWidth: DEFAULT_STROKE_WIDTH,
        headStyle: "none",
        tailStyle: "none",
        lineStyle: "straight",
        startDir: opts.startSnapDir,
        startConnectedTo: opts.startConnectedTo,
      };
    case "arrow":
      return {
        ...base,
        type: "arrow",
        x2: opts.x2,
        y2: opts.y2,
        width: 0,
        height: 0,
        fill: "none",
        stroke: DEFAULT_STROKE,
        strokeWidth: DEFAULT_STROKE_WIDTH,
        headStyle: "triangle",
        tailStyle: "none",
        lineStyle: "straight",
        startDir: opts.startSnapDir,
        startConnectedTo: opts.startConnectedTo,
      };
    case "path":
      return {
        ...base,
        type: "path",
        width: opts.width,
        height: opts.height,
        fill: DEFAULT_FILL,
        stroke: DEFAULT_STROKE,
        strokeWidth: DEFAULT_STROKE_WIDTH,
        pathData: opts.pathShape!.pathData,
        viewBox: opts.pathShape!.viewBox,
        shapeId: opts.pathShape!.id,
      };
  }
}

/** Axis-aligned bounding box for marquee intersection testing. Lines/arrows
 *  are treated as the box spanning their two endpoints. */
function elementBox(el: EditorElement) {
  if (el.type === "line" || el.type === "arrow") {
    const c = el as EditorElement & { x2: number; y2: number };
    return {
      minX: Math.min(c.x, c.x2),
      minY: Math.min(c.y, c.y2),
      maxX: Math.max(c.x, c.x2),
      maxY: Math.max(c.y, c.y2),
    };
  }
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + el.width,
    maxY: el.y + el.height,
  };
}

function rectsIntersect(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/** Round a value to the nearest snap line */
function snap(v: number): number {
  return Math.round(v / SNAP_SIZE) * SNAP_SIZE;
}

function getCanvasPoint(
  svgRef: RefObject<SVGSVGElement | null>,
  clientX: number,
  clientY: number,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  const svg = svgRef.current;
  if (!svg) return { x: 0, y: 0 };
  const rect = svg.getBoundingClientRect();
  return {
    x: (clientX - rect.left - panX) / zoom,
    y: (clientY - rect.top - panY) / zoom,
  };
}

function findElementId(target: EventTarget | null): string | null {
  let el = target as HTMLElement | SVGElement | null;
  while (el) {
    const id = el.getAttribute?.("data-element-id");
    if (id) return id;
    el = el.parentElement;
  }
  return null;
}

/** How close a pointer (in canvas px) must be to an element edge to attract
 *  the endpoint to that edge. One snap step matches the grid size used for
 *  element placement. */
const SNAP_THRESHOLD = SNAP_SIZE;

/** `bindable` is true only when the snap target is a "solid" asset (rect,
 *  circle, text, path, etc.) — those are the elements an endpoint should
 *  follow when moved. Snapping onto another arrow/line gives position only:
 *  the endpoint latches visually but the two connectors stay independent,
 *  so moving one does not drag the other. */
type SnapResult = { x: number; y: number; dir?: EdgeDir; elementId?: string; bindable?: boolean };

const EDGE_DIRS: EdgeDir[] = ["up", "right", "down", "left"];

/** Clamp v into [lo, hi] and round to the nearest SNAP_SIZE multiple, then
 *  clamp again so the result never leaves the segment [lo, hi]. */
function snapAlongEdge(v: number, lo: number, hi: number): number {
  const clamped = Math.max(lo, Math.min(hi, v));
  const snapped = Math.round(clamped / SNAP_SIZE) * SNAP_SIZE;
  return Math.max(lo, Math.min(hi, snapped));
}

/** Perpendicular projection of (px, py) onto segment ab, clamped to [a, b].
 *  Returns the closest point on the segment and its distance to the pointer. */
function projectOntoSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): { x: number; y: number; dist: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) {
    return { x: ax, y: ay, dist: Math.hypot(px - ax, py - ay) };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return { x, y, dist: Math.hypot(px - x, py - y) };
}

/** Snap a pointer position to the nearest point on any element's edge or line.
 *  Within SNAP_THRESHOLD, attach to:
 *    - Shape edges at grid-aligned positions (preserving EdgeDir so elbow
 *      auto-routing knows which side to exit from).
 *    - Line/arrow vertices (start, end, elbow corners, curve control point)
 *      and any point along a segment via perpendicular projection — so one
 *      connector can hang off another connector at an arbitrary T-junction
 *      or pin precisely at its midpoint.
 *  Returns the input point unchanged if nothing is within threshold. */
function snapToElements(
  pt: { x: number; y: number },
  elements: EditorElement[],
  excludeId?: string
): SnapResult {
  let bestDist = SNAP_THRESHOLD;
  let snapped: SnapResult = { ...pt };

  for (const el of elements) {
    if (el.id === excludeId) continue;

    if (el.type === "line" || el.type === "arrow") {
      // Build the polyline the connector actually follows, so projection
      // hits the visible geometry (not just the straight baseline for
      // elbow/curved styles).
      const line = el as LineElement | ArrowElement;
      const arrow = el.type === "arrow" ? (el as ArrowElement) : null;
      const pts: Array<[number, number]> = [[line.x, line.y]];
      if (arrow?.lineStyle === "elbow" && arrow.elbowCorners) {
        for (const c of arrow.elbowCorners) pts.push([c[0], c[1]]);
      }
      pts.push([line.x2, line.y2]);

      // Vertex snaps — endpoints and elbow corners. Checked first so they
      // win ties against the projection onto an adjacent segment. All
      // results are rounded to SNAP_SIZE so line-to-line connections
      // stay on the same grid the drawing tool uses — otherwise a
      // projected/midpoint snap would leave the new endpoint off-grid
      // even though every other part of the editor keeps geometry
      // grid-aligned.
      for (const [vx, vy] of pts) {
        const d = Math.hypot(pt.x - vx, pt.y - vy);
        if (d < bestDist) {
          bestDist = d;
          snapped = { x: snap(vx), y: snap(vy), elementId: el.id, bindable: false };
        }
      }
      // Curved arrow: also allow snapping to the bezier control point so
      // users can latch onto the visible handle, not just the baseline.
      if (arrow?.lineStyle === "curved" && arrow.cx !== undefined && arrow.cy !== undefined) {
        const d = Math.hypot(pt.x - arrow.cx, pt.y - arrow.cy);
        if (d < bestDist) {
          bestDist = d;
          snapped = { x: snap(arrow.cx), y: snap(arrow.cy), elementId: el.id, bindable: false };
        }
      }
      // Per-segment snaps — midpoint and perpendicular projection along
      // each sub-segment. Projection covers the whole length; midpoint
      // gives a slightly stickier snap at the center of each leg.
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const midDist = Math.hypot(pt.x - mx, pt.y - my);
        if (midDist < bestDist) {
          bestDist = midDist;
          snapped = { x: snap(mx), y: snap(my), elementId: el.id, bindable: false };
        }
        const proj = projectOntoSegment(pt.x, pt.y, ax, ay, bx, by);
        if (proj.dist < bestDist) {
          bestDist = proj.dist;
          snapped = { x: snap(proj.x), y: snap(proj.y), elementId: el.id, bindable: false };
        }
      }
      continue;
    }

    const l = el.x;
    const t = el.y;
    const r = el.x + el.width;
    const b = el.y + el.height;

    const candidates: Array<{ x: number; y: number; dir: EdgeDir; edgeDist: number }> = [
      // Top edge — horizontal, y = t, x in [l, r]
      { x: snapAlongEdge(pt.x, l, r), y: t, dir: EDGE_DIRS[0], edgeDist: Math.abs(pt.y - t) },
      // Right edge — vertical, x = r, y in [t, b]
      { x: r, y: snapAlongEdge(pt.y, t, b), dir: EDGE_DIRS[1], edgeDist: Math.abs(pt.x - r) },
      // Bottom edge — horizontal, y = b, x in [l, r]
      { x: snapAlongEdge(pt.x, l, r), y: b, dir: EDGE_DIRS[2], edgeDist: Math.abs(pt.y - b) },
      // Left edge — vertical, x = l, y in [t, b]
      { x: l, y: snapAlongEdge(pt.y, t, b), dir: EDGE_DIRS[3], edgeDist: Math.abs(pt.x - l) },
    ];

    for (const c of candidates) {
      // Reject candidates where the pointer isn't within the edge's
      // perpendicular reach AND within the edge's extent — stops diagonal
      // points far from a corner from snapping to a short edge.
      const withinExtent =
        (c.dir === "up" || c.dir === "down")
          ? pt.x >= l - SNAP_THRESHOLD && pt.x <= r + SNAP_THRESHOLD
          : pt.y >= t - SNAP_THRESHOLD && pt.y <= b + SNAP_THRESHOLD;
      if (!withinExtent) continue;
      const total = Math.hypot(pt.x - c.x, pt.y - c.y);
      if (c.edgeDist <= SNAP_THRESHOLD && total < bestDist) {
        bestDist = total;
        snapped = { x: c.x, y: c.y, dir: c.dir, elementId: el.id, bindable: true };
      }
    }
  }

  return snapped;
}

function findHandle(target: EventTarget | null): string | null {
  let el = target as HTMLElement | SVGElement | null;
  while (el) {
    const handle = el.getAttribute?.("data-handle");
    if (handle) return handle;
    el = el.parentElement;
  }
  return null;
}

function setDragging(svgRef: RefObject<SVGSVGElement | null>, active: boolean) {
  const svg = svgRef.current;
  if (!svg) return;
  if (active) {
    svg.classList.add("is-dragging");
  } else {
    svg.classList.remove("is-dragging");
  }
}


export function useCanvasInteraction(svgRef: RefObject<SVGSVGElement | null>) {
  const modeRef = useRef<InteractionMode>({ type: "none" });
  const elbowDragRef = useRef<{
    cornerIdxA: number;
    cornerIdxB: number;
    isHorizontal: boolean;
  } | null>(null);
  const spaceRef = useRef(false);

  // DOM nodes for imperative CSS transforms during single-element drag.
  // Bypasses React reconciliation entirely — visual tracking comes from
  // CSS translate applied on every raw mousemove; React only commits once
  // on mouseup via updateElementsLive.
  // Text elements (foreignObject) are excluded — will-change: transform on a
  // <g> containing foreignObject causes the compositor to rasterize HTML at
  // the wrong scale, visually stretching the element during drag.
  const dragNodeRefs = useRef<SVGGElement[]>([]);
  // Nodes that receive a drop-shadow filter during drag (all element types,
  // including text which is excluded from dragNodeRefs).
  const dragShadowNodesRef = useRef<SVGGElement[]>([]);
  // Canvas state snapshot at drag start. Cached once so the raw mousemove
  // handler never calls getBoundingClientRect() per-event (layout thrash).
  const dragCacheRef = useRef<{
    svgRect: DOMRect;
    panX: number;
    panY: number;
    zoom: number;
  } | null>(null);
  // Full element + connector updates from the last rAF frame. Applied in
  // one shot on mouseup instead of every rAF frame.
  const pendingFrameUpdatesRef = useRef<Map<string, Partial<EditorElement>> | null>(null);

  const store = useEditorStore;

  const onMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Right-click is reserved for the context menu — never start a drag,
      // marquee, or selection change from button === 2. CanvasContextMenu's
      // own onContextMenu handler updates selection if needed.
      if (e.button === 2) {
        modeRef.current = { type: "none" };
        return;
      }

      const state = store.getState();
      const { zoom, panX, panY } = state.canvas;
      const pt = getCanvasPoint(svgRef, e.clientX, e.clientY, zoom, panX, panY);

      // Middle-click or space+click for panning
      if (e.button === 1 || spaceRef.current) {
        modeRef.current = {
          type: "panning",
          startX: e.clientX,
          startY: e.clientY,
          origPanX: panX,
          origPanY: panY,
        };
        return;
      }

      // Check for handle drag (resize / rotate)
      const handle = findHandle(e.target);
      if (handle && state.selectedElementId) {
        const el = state.elements.find(
          (el) => el.id === state.selectedElementId
        );
        if (el) {
          if (handle === "rotate") {
            // Enter rotation mode. Pivot is element center for rect-based
            // elements and the midpoint for lines/arrows. `startPointerAngle`
            // captures where the handle was at mousedown so the element
            // rotates *relative* to that grab point — grabbing the handle
            // doesn't cause a jump.
            const isLine = el.type === "line" || el.type === "arrow";
            let cx: number, cy: number;
            let origEndpoints: { x: number; y: number; x2: number; y2: number } | undefined;
            // For lines/arrows the "rotation" the user perceives is the
            // baseline angle from head to tail, not a stored rotation field
            // (which is always 0 for lines since rendering rotates via the
            // endpoints themselves). Seeding origRotation with that baseline
            // means semi-snap compares the *final line angle* against 45°
            // multiples — matching the SelectionHandles glow and what the
            // user sees on screen.
            let origRotation = el.rotation || 0;
            if (isLine) {
              const lc = el as EditorElement & { x2: number; y2: number };
              cx = (lc.x + lc.x2) / 2;
              cy = (lc.y + lc.y2) / 2;
              origEndpoints = { x: lc.x, y: lc.y, x2: lc.x2, y2: lc.y2 };
              origRotation = (Math.atan2(lc.y2 - lc.y, lc.x2 - lc.x) * 180) / Math.PI;
            } else {
              cx = el.x + el.width / 2;
              cy = el.y + el.height / 2;
            }
            modeRef.current = {
              type: "rotating",
              elementId: el.id,
              centerX: cx,
              centerY: cy,
              startPointerAngle: Math.atan2(pt.y - cy, pt.x - cx),
              origRotation,
              origEndpoints,
              isLine,
            };
            state.setRotatingElementId(el.id);
            return;
          }
          modeRef.current = {
            type: "resizing",
            handle,
            startX: pt.x,
            startY: pt.y,
            orig: { ...el } as EditorElement,
          };
          // Light up the rotation-handle glow while the user drags a line's
          // head or tail — the baseline angle is what changes, and the
          // indicator should behave the same as rotation-handle drags.
          if ((el.type === "line" || el.type === "arrow") && (handle === "start" || handle === "end")) {
            state.setRotatingElementId(el.id);
          }
          return;
        }
      }

      // Select tool: select or move
      if (state.tool === "select") {
        const elementId = findElementId(e.target);
        const isShift = e.shiftKey;

        if (!elementId) {
          // Empty canvas press → leave group-edit mode (if entered) and start
          // a marquee. Shift keeps existing set so the marquee toggles hits
          // into it.
          if (state.editingGroupId) state.setEditingGroupId(null);
          if (!isShift) state.selectElement(null);
          modeRef.current = {
            type: "marquee",
            startX: pt.x,
            startY: pt.y,
            origIds: isShift ? [...state.selectedElementIds] : [],
            shiftKey: isShift,
          };
          return;
        }

        // Resolve the selection unit for this click. If the clicked element
        // belongs to a group, the whole group is treated as one atom — shift
        // toggles the group in/out, plain click selects all its members.
        // Exception: while that group is "entered" for editing (double-click),
        // members click like loose elements so they can be moved one by one.
        const clickedEl = state.elements.find((el) => el.id === elementId);
        const inEditedGroup =
          !!clickedEl?.groupId && clickedEl.groupId === state.editingGroupId;
        // Clicking outside the edited group exits edit mode.
        if (state.editingGroupId && !inEditedGroup) {
          state.setEditingGroupId(null);
        }
        const groupUnitIds =
          clickedEl?.groupId && !inEditedGroup
            ? state.elements
                .filter((el) => el.groupId === clickedEl.groupId)
                .map((el) => el.id)
            : [elementId];

        // Shift-click: toggle the whole unit. For a group, "in" means every
        // member is already selected — otherwise we union the unit into the
        // current selection. No drag starts.
        if (isShift) {
          const curSet = new Set(state.selectedElementIds);
          const allIn = groupUnitIds.every((id) => curSet.has(id));
          const next = allIn
            ? state.selectedElementIds.filter((id) => !groupUnitIds.includes(id))
            : [...new Set([...state.selectedElementIds, ...groupUnitIds])];
          state.selectMultiple(next);
          return;
        }

        // Plain click: if every member of the clicked unit is already in
        // the selection (either because it's a singleton that was selected,
        // or because the whole group is part of a broader multi-select),
        // keep the current selection so the drag moves everything. Otherwise
        // replace the selection with the unit.
        const curSet = new Set(state.selectedElementIds);
        const unitFullyIn = groupUnitIds.every((id) => curSet.has(id));
        if (!unitFullyIn) {
          if (groupUnitIds.length > 1) state.selectMultiple(groupUnitIds);
          else state.selectElement(elementId);
        }
        {
          const el = state.elements.find((el) => el.id === elementId);
          if (el) {
            const inEditedGroup =
              !!el.groupId && el.groupId === state.editingGroupId;

            // Resolve the initial bulk — group members, active multi-select,
            // or just this one element.
            const bulkIds = new Set<string>();
            if (el.groupId && !inEditedGroup) {
              for (const e of state.elements) {
                if (e.groupId === el.groupId) bulkIds.add(e.id);
              }
            } else if (state.selectedElementIds.length > 1) {
              for (const id of state.selectedElementIds) bulkIds.add(id);
            } else {
              bulkIds.add(el.id);
            }

            // Dragging a connector carries its connected shapes along so the
            // arrow + endpoints move rigidly, instead of detaching. Only one
            // hop — we don't pull in arrows attached to the newly-included
            // shapes (those ride along via connectedOrigs below with their
            // endpoints adjusted, not as rigid bulk members).
            for (const id of [...bulkIds]) {
              const e = state.elements.find((x) => x.id === id);
              if (!e) continue;
              if (e.type === "arrow" || e.type === "line") {
                const conn = e as ArrowElement | LineElement;
                if (conn.startConnectedTo) bulkIds.add(conn.startConnectedTo);
                if (conn.endConnectedTo) bulkIds.add(conn.endConnectedTo);
              }
            }

            // Capture full geometry for every bulk member, including the
            // interior points of connectors (cx/cy, elbowCorners) so they
            // translate rigidly along with the endpoints.
            let groupOrigs: GroupOrigPos[] | undefined;
            if (bulkIds.size > 1) {
              groupOrigs = state.elements
                .filter((e) => bulkIds.has(e.id))
                .map((e) => {
                  const base: GroupOrigPos = { id: e.id, x: e.x, y: e.y };
                  if (e.type === "line" || e.type === "arrow") {
                    const c = e as ArrowElement | LineElement;
                    base.x2 = c.x2;
                    base.y2 = c.y2;
                    if (e.type === "arrow") {
                      const a = e as ArrowElement;
                      if (a.cx !== undefined) base.cx = a.cx;
                      if (a.cy !== undefined) base.cy = a.cy;
                      if (a.elbowCorners) {
                        base.elbowCorners = a.elbowCorners.map(
                          (cc) => [...cc] as [number, number]
                        );
                      }
                    }
                  }
                  return base;
                });
            }

            const isLineType = el.type === "line" || el.type === "arrow";
            const arrowEl = el.type === "arrow" ? (el as ArrowElement) : null;

            // connectedOrigs: connectors outside the bulk that reference
            // any bulk member — their endpoints need to follow the anchor,
            // even though the connector itself isn't being dragged. A
            // connector can be anchored to a shape OR to another connector
            // (line-to-line snap), so we don't gate on element type here.
            let connectedOrigs: ConnectorOrig[] | undefined;
            const connectors = state.elements.filter((e): e is ArrowElement | LineElement => {
              if (e.type !== "arrow" && e.type !== "line") return false;
              if (bulkIds.has(e.id)) return false;
              const c = e as ArrowElement;
              return (
                (c.startConnectedTo !== undefined && bulkIds.has(c.startConnectedTo)) ||
                (c.endConnectedTo !== undefined && bulkIds.has(c.endConnectedTo))
              );
            });
            if (connectors.length > 0) {
              connectedOrigs = connectors.map((c) => ({
                id: c.id,
                x: c.x, y: c.y,
                x2: (c as ArrowElement).x2, y2: (c as ArrowElement).y2,
                lineStyle: (c as ArrowElement).lineStyle || "straight",
                elbowCorners: (c as ArrowElement).elbowCorners?.map(cc => [...cc] as [number, number]),
                startConnectedTo: (c as ArrowElement).startConnectedTo,
                endConnectedTo: (c as ArrowElement).endConnectedTo,
              }));
            }
            modeRef.current = {
              type: "moving",
              startX: pt.x,
              startY: pt.y,
              origX: el.x,
              origY: el.y,
              origX2: isLineType ? (el as EditorElement & { x2: number }).x2 : undefined,
              origY2: isLineType ? (el as EditorElement & { y2: number }).y2 : undefined,
              origCx: arrowEl?.cx,
              origCy: arrowEl?.cy,
              origElbowCorners: arrowEl?.elbowCorners?.map(c => [...c] as [number, number]),
              groupOrigs,
              connectedOrigs,
            };
          }
        }
        return;
      }

      // Drawing tools — snap start point to grid (or element edge for lines/arrows).
      // Text places immediately on mousedown (no drag semantic); everything else
      // enters a "preDraw" holding state so we can tell a click from a drag at
      // mouseup — a click stamps a default-size element centered on the click
      // point without any intermediate render of a misplaced 0-size version.
      const isLineType = state.tool === "line" || state.tool === "arrow";
      let sx: number, sy: number;
      let startSnapDir: EdgeDir | undefined;
      let startConnectedTo: string | undefined;
      if (isLineType) {
        const elemSnap = snapToElements(pt, state.elements);
        if (elemSnap.elementId) {
          sx = elemSnap.x;
          sy = elemSnap.y;
          startSnapDir = elemSnap.dir;
          // Only bind when the snap target is a solid asset. Snapping onto
          // another arrow/line gives position-only — the two connectors stay
          // independent so moving one doesn't drag the other.
          startConnectedTo = elemSnap.bindable ? elemSnap.elementId : undefined;
        } else {
          sx = snap(pt.x); sy = snap(pt.y);
        }
      } else {
        sx = snap(pt.x); sy = snap(pt.y);
      }

      if (state.tool === "text") {
        const variant = TEXT_VARIANTS[state.textVariant];
        const tw = variant.width;
        const th = Math.round(variant.fontSize * 1.2 + 8);
        const id = generateId();
        const newElement: EditorElement = {
          id,
          parentId: null,
          type: "text",
          x: snap(sx - tw / 2),
          y: snap(sy - th / 2),
          width: tw,
          height: th,
          rotation: 0,
          fill: "none",
          stroke: "none",
          strokeWidth: 0,
          opacity: 1,
          zIndex: state.elements.length,
          content: variant.content,
          fontSize: variant.fontSize,
          fontWeight: variant.fontWeight,
          fontFamily: DEFAULT_FONT_FAMILY,
          fontStyle: "normal",
          textAlign: "left",
          verticalAlign: "top",
          color: "#1a1a1a",
          borderRadius: 0,
        };
        state.addElement(newElement);
        state.setTool("select");
        state.selectElement(id);
        state.setAutoEditTextId(id);
        return;
      }

      if (state.tool === "path" && !state.pendingPathShape) {
        // No shape primed — fall back to select so mousedown doesn't leave a
        // dangling preDraw. Panel UX normally guarantees this is populated.
        state.setTool("select");
        return;
      }

      modeRef.current = {
        type: "preDraw",
        startX: sx,
        startY: sy,
        tool: state.tool as PreDrawTool,
        startSnapDir,
        startConnectedTo,
        pathShape: state.tool === "path" ? state.pendingPathShape ?? undefined : undefined,
      };
    },
    [svgRef, store]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | MouseEvent) => {
      const mode = modeRef.current;

      // Track cursor in canvas coords — paste-at-cursor reads this so a
      // Cmd+V places elements where the pointer is. Skip entirely during
      // an active pan: the cursor pos isn't used mid-pan, and the
      // `getBoundingClientRect` read forced a layout flush every rAF
      // frame right after the pan's setAttribute write — textbook layout
      // thrash that compounded as a pan session went on. We compute the
      // point inline instead of calling getCanvasPoint so the bounding
      // rect is read *once* per mousemove (getCanvasPoint would read it
      // again otherwise).
      const state0 = store.getState();
      if (mode.type !== "panning") {
        const svg = svgRef.current;
        if (svg) {
          const rect = svg.getBoundingClientRect();
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            const { zoom, panX, panY } = state0.canvas;
            setCanvasCursorPos({
              x: (e.clientX - rect.left - panX) / zoom,
              y: (e.clientY - rect.top - panY) / zoom,
            });
          }
        }
      }

      // Hover tracking — always active so the element under the pointer is
      // highlighted even when idle. Cleared during active drags so the item
      // being moved doesn't light up as a hover target.
      if (mode.type === "none") {
        const hoverId = findElementId(e.target);
        if (hoverId !== state0.hoveredElementId) state0.setHoveredElementId(hoverId);
        return;
      }
      if (state0.hoveredElementId) state0.setHoveredElementId(null);

      // Disable pointer-events on elements during drag to prevent hover highlights
      setDragging(svgRef, true);

      const state = store.getState();
      const { zoom, panX, panY } = state.canvas;

      if (mode.type === "panning") {
        const dx = e.clientX - mode.startX;
        const dy = e.clientY - mode.startY;
        state.setPan(mode.origPanX + dx, mode.origPanY + dy);
        return;
      }

      const pt = getCanvasPoint(svgRef, e.clientX, e.clientY, zoom, panX, panY);

      if (mode.type === "marquee") {
        const x = Math.min(mode.startX, pt.x);
        const y = Math.min(mode.startY, pt.y);
        const w = Math.abs(pt.x - mode.startX);
        const h = Math.abs(pt.y - mode.startY);
        state.setMarquee({ x, y, w, h });
        return;
      }

      if (mode.type === "preDraw") {
        // Defer element creation until the user has actually dragged past a
        // small threshold. Below that we treat the release as a click and
        // stamp a centered default-size element in onMouseUp — no misplaced
        // intermediate render, so no visual "jump" on drop.
        const threshold = 4 / zoom;
        const dx = pt.x - mode.startX;
        const dy = pt.y - mode.startY;
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
        const newEl = buildDrawingElement({
          tool: mode.tool,
          x: mode.startX,
          y: mode.startY,
          width: 0,
          height: 0,
          x2: mode.startX,
          y2: mode.startY,
          startSnapDir: mode.startSnapDir,
          startConnectedTo: mode.startConnectedTo,
          pathShape: mode.pathShape,
          zIndex: state.elements.length,
        });
        state.addElement(newEl);
        modeRef.current = {
          type: "drawing",
          startX: mode.startX,
          startY: mode.startY,
          elementId: newEl.id,
          defaultW: mode.pathShape?.width,
          defaultH: mode.pathShape?.height,
        };
        // The element is freshly added at 0 size. The next mousemove (which
        // will fire within milliseconds since the mouse is still moving past
        // threshold) runs the drawing branch below and resizes it to the
        // cursor — so there's no user-visible flash.
        return;
      }

      if (mode.type === "drawing") {
        const el = elementById(state.elements, mode.elementId);
        if (!el) return;

        if (el.type === "line" || el.type === "arrow") {
          // Snap endpoint to a designated connection point, else fall back
          // to the grid. The four-midpoint snap already returns exact edge
          // coordinates — no additional axis-snapping needed.
          const snapped = snapToElements(pt, state.elements, mode.elementId);
          const useEdge = !!snapped.elementId;
          let finalX = useEdge ? snapped.x : snap(pt.x);
          let finalY = useEdge ? snapped.y : snap(pt.y);
          // Soft-snap to 45° multiples (0/45/90/135/180/…) when the free
          // angle lands within SOFT_LINE_DEG of a multiple. Gives that
          // tactile click at the cardinal + diagonal directions without
          // requiring Shift. Edge snap wins; Shift's 15° snap also wins
          // (it runs after this block and overwrites finalX/Y).
          if (!useEdge) {
            const dx = pt.x - mode.startX;
            const dy = pt.y - mode.startY;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
              const SOFT_LINE_DEG = 5;
              const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
              const nearest45 = Math.round(angleDeg / 45) * 45;
              if (Math.abs(angleDeg - nearest45) <= SOFT_LINE_DEG) {
                const rad = (nearest45 * Math.PI) / 180;
                finalX = snap(mode.startX + Math.cos(rad) * len);
                finalY = snap(mode.startY + Math.sin(rad) * len);
              }
            }
          }
          // Shift during line/arrow draw: constrain to the nearest 15°
          // angle from the start point. Edge snapping still wins so the
          // connector can latch to a target.
          if (e.shiftKey && !useEdge) {
            const dx = pt.x - mode.startX;
            const dy = pt.y - mode.startY;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
              const step = Math.PI / 12; // 15°
              const angle = Math.round(Math.atan2(dy, dx) / step) * step;
              finalX = snap(mode.startX + Math.cos(angle) * len);
              finalY = snap(mode.startY + Math.sin(angle) * len);
            }
          }
          state.setSnapTargetId(useEdge ? (snapped.elementId ?? null) : null);
          const updates: Partial<EditorElement> = { x2: finalX, y2: finalY };
          (updates as Record<string, unknown>).endDir = useEdge ? snapped.dir : undefined;
          (updates as Record<string, unknown>).endConnectedTo = useEdge && snapped.bindable ? snapped.elementId : undefined;
          state.updateElementLive(mode.elementId, updates);
        } else {
          let gx = snap(pt.x);
          let gy = snap(pt.y);
          // Shift during shape draw: force a square (or 1:1 circle bounds)
          // by using the larger axis and mirroring sign. Pointer direction
          // still decides which corner the element grows toward.
          if (e.shiftKey) {
            const rawDx = pt.x - mode.startX;
            const rawDy = pt.y - mode.startY;
            const size = snap(Math.max(Math.abs(rawDx), Math.abs(rawDy)));
            const sx = rawDx >= 0 ? 1 : -1;
            const sy = rawDy >= 0 ? 1 : -1;
            gx = mode.startX + sx * size;
            gy = mode.startY + sy * size;
          }
          const x1 = Math.min(mode.startX, gx);
          const y1 = Math.min(mode.startY, gy);
          const x2 = Math.max(mode.startX, gx);
          const y2 = Math.max(mode.startY, gy);
          state.updateElementLive(mode.elementId, {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
          });
        }
        return;
      }

      if (mode.type === "moving") {
        const rawDx = pt.x - mode.startX;
        const rawDy = pt.y - mode.startY;
        // Drag threshold — don't commit any move (which would snap off-grid
        // elements and detach connectors) until the pointer has actually
        // traveled a few pixels. Lets clicks-to-select be inert.
        if (!mode.moved) {
          const threshold = 3 / zoom;
          if (Math.abs(rawDx) < threshold && Math.abs(rawDy) < threshold) {
            return;
          }
          // Snapshot the pre-drag state exactly once per drag so undo rewinds
          // to where the element started, not through every pointer frame.
          state.pushHistory();
          mode.moved = true;

          // Collect DOM nodes for imperative CSS transforms (single-element
          // drag only — group drag keeps the React path for all its highlights).
          if (!mode.groupOrigs) {
            const svg = svgRef.current;
            if (svg) {
              const nodes: SVGGElement[] = [];
              const shadowNodes: SVGGElement[] = [];
              const selId = state.selectedElementId;
              if (selId) {
                const selEl = state.elements.find((el) => el.id === selId);
                const isText = selEl?.type === "text";
                const elNode = svg.querySelector(`[data-drag-wrapper="${selId}"]`) as SVGGElement | null;
                if (elNode) {
                  elNode.style.filter = "drop-shadow(0 4px 16px rgba(0,0,0,0.18))";
                  shadowNodes.push(elNode);
                  if (!isText) {
                    elNode.style.willChange = "transform";
                    nodes.push(elNode);
                  }
                }
                if (!isText) {
                  const hsNode = svg.querySelector(`[data-selection-handles="${selId}"]`) as SVGGElement | null;
                  if (hsNode) { hsNode.style.willChange = "transform"; nodes.push(hsNode); }
                }
              }
              dragNodeRefs.current = nodes;
              dragShadowNodesRef.current = shadowNodes;
              // Cache canvas state once — raw mousemove reuses this instead
              // of calling getBoundingClientRect() on every event.
              dragCacheRef.current = { svgRect: svg.getBoundingClientRect(), panX, panY, zoom };
              pendingFrameUpdatesRef.current = null;
            }
          }
        }
        // Snap the target position, then compute the effective delta
        const snappedX = snap(mode.origX + rawDx);
        const snappedY = snap(mode.origY + rawDy);
        const dx = snappedX - mode.origX;
        const dy = snappedY - mode.origY;

        // Batch ALL element updates from this frame into a single map, then
        // commit with one set() at the end. A group drag of 10 shapes plus 5
        // attached connectors used to fire 15 sequential store mutations per
        // mousemove — each one notified every CanvasElement subscriber and
        // did an O(N) array map. Now it's one notification, one map pass.
        const frameUpdates = new Map<string, Partial<EditorElement>>();
        const movingIds = new Set<string>();

        if (mode.groupOrigs) {
          // Bulk move — translate every captured element rigidly, including
          // connector interior points (cx/cy, elbowCorners) so paths keep
          // their shape.
          for (const orig of mode.groupOrigs) {
            const updates: Partial<EditorElement> = {
              x: orig.x + dx,
              y: orig.y + dy,
            };
            if (orig.x2 !== undefined) (updates as Record<string, number>).x2 = orig.x2 + dx;
            if (orig.y2 !== undefined) (updates as Record<string, number>).y2 = orig.y2 + dy;
            if (orig.cx !== undefined) (updates as Record<string, number>).cx = orig.cx + dx;
            if (orig.cy !== undefined) (updates as Record<string, number>).cy = orig.cy + dy;
            if (orig.elbowCorners) {
              (updates as Record<string, unknown>).elbowCorners = orig.elbowCorners.map(
                ([cx, cy]) => [cx + dx, cy + dy] as [number, number]
              );
            }
            frameUpdates.set(orig.id, updates);
            movingIds.add(orig.id);
          }
        } else {
          // Single element move — translate just the clicked element and
          // whatever connector-internal points it has.
          const movingId = state.selectedElementId!;
          const moveUpdates: Partial<EditorElement> = {
            x: snappedX,
            y: snappedY,
          };
          if (mode.origX2 !== undefined) (moveUpdates as Record<string, number>).x2 = mode.origX2 + dx;
          if (mode.origY2 !== undefined) (moveUpdates as Record<string, number>).y2 = mode.origY2 + dy;
          if (mode.origCx !== undefined) (moveUpdates as Record<string, number>).cx = mode.origCx + dx;
          if (mode.origCy !== undefined) (moveUpdates as Record<string, number>).cy = mode.origCy + dy;
          if (mode.origElbowCorners) {
            (moveUpdates as Record<string, unknown>).elbowCorners =
              mode.origElbowCorners.map(([cx, cy]) => [cx + dx, cy + dy] as [number, number]);
          }
          frameUpdates.set(movingId, moveUpdates);
          movingIds.add(movingId);
        }

        // External connectors — those pointing to any element in the move
        // set, but not themselves being dragged — follow their anchor.
        // Using connectedOrigs (captured at drag start) keeps the delta
        // measured from the original position so elbow-corner adjustments
        // stay consistent. Only reset the elbow path if the preserved shape
        // collapses.
        const tol = 2;
        if (mode.connectedOrigs && movingIds.size > 0) {
          for (const orig of mode.connectedOrigs) {
            const conn = elementById(state.elements, orig.id) as ArrowElement | LineElement | undefined;
            if (!conn) continue;
            const upd: Record<string, unknown> = {};

            const startConnected =
              orig.startConnectedTo !== undefined && movingIds.has(orig.startConnectedTo);
            const endConnected =
              orig.endConnectedTo !== undefined && movingIds.has(orig.endConnectedTo);
            if (!startConnected && !endConnected) continue;
            const isElbow = orig.lineStyle === "elbow";

            // If one endpoint rides a moving anchor and the opposite end
            // is unattached, carry the whole connector with the anchor so
            // the arrow doesn't visibly stretch off its free tail. When
            // the opposite end is anchored to something OUTSIDE the move
            // set, keep the partial stretch — the two anchors genuinely
            // diverge.
            const startFree = orig.startConnectedTo === undefined;
            const endFree = orig.endConnectedTo === undefined;
            const dragStart = startConnected || (endConnected && startFree);
            const dragEnd = endConnected || (startConnected && endFree);

            const newX = dragStart ? snap(orig.x + dx) : orig.x;
            const newY = dragStart ? snap(orig.y + dy) : orig.y;
            const newX2 = dragEnd ? snap(orig.x2 + dx) : orig.x2;
            const newY2 = dragEnd ? snap(orig.y2 + dy) : orig.y2;

            if (dragStart) {
              upd.x = newX;
              upd.y = newY;
            }
            if (dragEnd) {
              upd.x2 = newX2;
              upd.y2 = newY2;
            }

            if (isElbow && orig.elbowCorners && orig.elbowCorners.length > 0) {
              const corners = orig.elbowCorners.map(c => [...c] as [number, number]);

              if (dragStart && dragEnd) {
                for (let i = 0; i < corners.length; i++) {
                  corners[i] = [corners[i][0] + dx, corners[i][1] + dy];
                }
                upd.elbowCorners = corners;
              } else if (dragStart) {
                const first = corners[0];
                const wasVert = Math.abs(first[0] - orig.x) < tol;
                const wasHoriz = Math.abs(first[1] - orig.y) < tol;
                if (wasVert) {
                  corners[0] = [newX, first[1]];
                  upd.elbowCorners = corners;
                } else if (wasHoriz) {
                  corners[0] = [first[0], newY];
                  upd.elbowCorners = corners;
                } else {
                  upd.elbowCorners = undefined;
                }
              } else if (dragEnd) {
                const lastIdx = corners.length - 1;
                const last = corners[lastIdx];
                const wasVert = Math.abs(last[0] - orig.x2) < tol;
                const wasHoriz = Math.abs(last[1] - orig.y2) < tol;
                if (wasVert) {
                  corners[lastIdx] = [newX2, last[1]];
                  upd.elbowCorners = corners;
                } else if (wasHoriz) {
                  corners[lastIdx] = [last[0], newY2];
                  upd.elbowCorners = corners;
                } else {
                  upd.elbowCorners = undefined;
                }
              }
            }

            if (Object.keys(upd).length > 0) {
              frameUpdates.set(orig.id, upd as Partial<EditorElement>);
            }
          }
        }

        // Single-element CSS drag: skip React reconciliation entirely during
        // the drag. The raw mousemove applies a CSS translate for smooth
        // sub-frame visual tracking; we store the final snapped delta and
        // the full update map for a one-shot commit on mouseup.
        if (dragNodeRefs.current.length > 0) {
          pendingFrameUpdatesRef.current = frameUpdates;
          return;
        }

        // Group drag (or no CSS nodes): one mutation per rAF frame — fires a
        // single subscriber notification and does one O(N) pass over the
        // elements array regardless of how many elements are moving.
        state.updateElementsLive(frameUpdates);
        return;
      }

      if (mode.type === "rotating") {
        // Push history on first actual move so undo returns to the pre-drag
        // rotation, not through every pointer frame.
        if (!mode.committed) {
          state.pushHistory();
          mode.committed = true;
        }
        const pointerAngle = Math.atan2(pt.y - mode.centerY, pt.x - mode.centerX);
        const deltaDeg = (pointerAngle - mode.startPointerAngle) * (180 / Math.PI);
        let newRotation = mode.origRotation + deltaDeg;
        // Semi-snap: rotation is free, but when the angle passes within a
        // narrow window of a 45° multiple it sticks to the exact multiple.
        // This gives the user a tactile "click" at 0°/45°/90°/… without
        // preventing arbitrary angles in between. Hold shift to bypass the
        // stickiness entirely for fine adjustments near a snap point.
        if (!e.shiftKey) {
          const SOFT_SNAP_DEG = 0.5;
          const nearest45 = Math.round(newRotation / 45) * 45;
          if (Math.abs(newRotation - nearest45) <= SOFT_SNAP_DEG) {
            newRotation = nearest45;
          }
        }
        // Normalize to (-180, 180] so values stay readable in the inspector
        // and the store doesn't accumulate unbounded turns.
        newRotation = ((newRotation % 360) + 540) % 360 - 180;

        if (mode.isLine && mode.origEndpoints) {
          // Lines/arrows rotate their endpoints around the midpoint. We
          // rotate from the ORIGINAL endpoints by the total angle delta
          // (newRotation - origRotation) so each frame is computed from
          // scratch — no drift from cumulative per-frame rotations.
          const totalDeltaRad = (newRotation - mode.origRotation) * (Math.PI / 180);
          const cos = Math.cos(totalDeltaRad);
          const sin = Math.sin(totalDeltaRad);
          const rotatePoint = (px: number, py: number) => {
            const vx = px - mode.centerX;
            const vy = py - mode.centerY;
            return {
              x: mode.centerX + vx * cos - vy * sin,
              y: mode.centerY + vx * sin + vy * cos,
            };
          };
          const p1 = rotatePoint(mode.origEndpoints.x, mode.origEndpoints.y);
          const p2 = rotatePoint(mode.origEndpoints.x2, mode.origEndpoints.y2);
          state.updateElementLive(mode.elementId, {
            x: p1.x,
            y: p1.y,
            x2: p2.x,
            y2: p2.y,
          } as Partial<EditorElement>);
        } else {
          state.updateElementLive(mode.elementId, { rotation: newRotation });
        }
        return;
      }

      if (mode.type === "resizing") {
        const orig = mode.orig;
        const dx = pt.x - mode.startX;
        const dy = pt.y - mode.startY;

        // When the element is rotated, drag deltas arrive in world coords
        // but the bbox lives in its own (unrotated) frame. Rotate the
        // delta by -θ into the element's local frame so the switch below
        // grows the bbox along its local axes, which visually corresponds
        // to the rotated right/top/etc. edge the user is dragging.
        const rot = orig.rotation || 0;
        const rotRad = (rot * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);
        const localDx = rot !== 0 ? dx * cosR + dy * sinR : dx;
        const localDy = rot !== 0 ? -dx * sinR + dy * cosR : dy;

        // Snapshot the pre-drag state exactly once per drag so undo returns
        // the element to its starting geometry, not through every pointer
        // frame. Done on the first move — pointer-down alone (with no actual
        // drag) shouldn't leave a history entry behind.
        if (!mode.committed) {
          state.pushHistory();
          mode.committed = true;
        }

        const isLine = orig.type === "line" || orig.type === "arrow";
        if (isLine) {
          // Control point drag for curved lines/arrows (free 2D)
          if (mode.handle === "control") {
            state.updateElementLive(orig.id, { cx: pt.x, cy: pt.y });
            return;
          }

          // Elbow per-segment handle drag (dynamic corners)
          if (mode.handle.startsWith("elbow-")) {
            if (!elbowDragRef.current) {
              // First move: set up the drag (split boundary segments if needed)
              const arrow = mode.orig as ArrowElement;
              let corners: [number, number][] = arrow.elbowCorners
                ? arrow.elbowCorners.map(c => [...c] as [number, number])
                : getDefaultElbowCorners(arrow.x, arrow.y, arrow.x2, arrow.y2, arrow.startDir, arrow.endDir);

              const allPoints: [number, number][] = [[arrow.x, arrow.y], ...corners, [arrow.x2, arrow.y2]];
              const segIdx = parseInt(mode.handle.split("-")[1]);
              const numSeg = allPoints.length - 1;
              if (segIdx < 0 || segIdx >= numSeg) return;

              const [ax, ay] = allPoints[segIdx];
              const [bx, by] = allPoints[segIdx + 1];
              const isHoriz = Math.abs(by - ay) < 2;
              const isFirst = segIdx === 0;
              const isLast = segIdx === numSeg - 1;

              if (isFirst) {
                // Split first segment — insert jog to maintain orthogonality
                if (isHoriz) {
                  const splitX = (ax + bx) / 2;
                  corners = [
                    [splitX, ay],
                    [splitX, snap(pt.y)],
                    [corners[0][0], snap(pt.y)],
                    ...corners.slice(1),
                  ];
                } else {
                  const splitY = (ay + by) / 2;
                  corners = [
                    [ax, splitY],
                    [snap(pt.x), splitY],
                    [snap(pt.x), corners[0][1]],
                    ...corners.slice(1),
                  ];
                }
                elbowDragRef.current = { cornerIdxA: 1, cornerIdxB: 2, isHorizontal: isHoriz };
                state.updateElementLive(orig.id, { elbowCorners: corners } as Partial<EditorElement>);
                return;
              }

              if (isLast) {
                // Split last segment — insert bridge to anchored endpoint
                const lastIdx = corners.length - 1;
                if (isHoriz) {
                  corners = [
                    ...corners.slice(0, -1),
                    [corners[lastIdx][0], snap(pt.y)],
                    [arrow.x2, snap(pt.y)],
                  ];
                } else {
                  corners = [
                    ...corners.slice(0, -1),
                    [snap(pt.x), corners[lastIdx][1]],
                    [snap(pt.x), arrow.y2],
                  ];
                }
                elbowDragRef.current = {
                  cornerIdxA: corners.length - 2,
                  cornerIdxB: corners.length - 1,
                  isHorizontal: isHoriz,
                };
                state.updateElementLive(orig.id, { elbowCorners: corners } as Partial<EditorElement>);
                return;
              }

              // Non-boundary segment: materialize corners, set up drag
              elbowDragRef.current = {
                cornerIdxA: segIdx - 1,
                cornerIdxB: segIdx,
                isHorizontal: isHoriz,
              };
              if (!arrow.elbowCorners) {
                state.updateElementLive(orig.id, { elbowCorners: corners } as Partial<EditorElement>);
              }
            }

            // Apply drag: update the two corners of the active segment
            const elbowState = elbowDragRef.current!;
            const currentEl = elementById(store.getState().elements, orig.id) as ArrowElement | undefined;
            if (!currentEl?.elbowCorners) return;

            const updatedCorners = currentEl.elbowCorners.map(c => [...c] as [number, number]);

            if (elbowState.isHorizontal) {
              const newY = snap(pt.y);
              updatedCorners[elbowState.cornerIdxA] = [updatedCorners[elbowState.cornerIdxA][0], newY];
              updatedCorners[elbowState.cornerIdxB] = [updatedCorners[elbowState.cornerIdxB][0], newY];
            } else {
              const newX = snap(pt.x);
              updatedCorners[elbowState.cornerIdxA] = [newX, updatedCorners[elbowState.cornerIdxA][1]];
              updatedCorners[elbowState.cornerIdxB] = [newX, updatedCorners[elbowState.cornerIdxB][1]];
            }

            state.updateElementLive(orig.id, { elbowCorners: updatedCorners } as Partial<EditorElement>);
            return;
          }

          // Snap line/arrow endpoint to a designated connection point on a
          // nearby element, else to the grid. Midpoint snap returns exact
          // edge coordinates, so no axis-snap fallback is required.
          const elemSnap = snapToElements(pt, state.elements, orig.id);
          const useEdge = !!elemSnap.elementId;
          const final = useEdge
            ? { x: elemSnap.x, y: elemSnap.y }
            : { x: snap(pt.x), y: snap(pt.y) };
          state.setSnapTargetId(useEdge ? (elemSnap.elementId ?? null) : null);

          // Angle detent on endpoint drags: when the pointer sits within a
          // small perpendicular pixel band of the nearest 45° ray, drop the
          // endpoint onto that ray (projected). The endpoint "sticks" until
          // the pointer leaves the band — a drag delay, not an angular
          // snap-zone. Edge-snap and Shift bypass it.
          if (!useEdge && !e.shiftKey && (orig.type === "line" || orig.type === "arrow")) {
            const origLine = orig as EditorElement & { x2: number; y2: number };
            const fx = mode.handle === "start" ? origLine.x2 : origLine.x;
            const fy = mode.handle === "start" ? origLine.y2 : origLine.y;
            const ddx = final.x - fx;
            const ddy = final.y - fy;
            if (ddx !== 0 || ddy !== 0) {
              const angleDeg = (Math.atan2(ddy, ddx) * 180) / Math.PI;
              const nearest45 = Math.round(angleDeg / 45) * 45;
              const snappedRad = (nearest45 * Math.PI) / 180;
              const rayX = Math.cos(snappedRad);
              const rayY = Math.sin(snappedRad);
              const projLen = ddx * rayX + ddy * rayY;
              const perpDist = Math.abs(ddx * rayY - ddy * rayX);
              const DETENT_PX = 6;
              if (perpDist <= DETENT_PX) {
                final.x = fx + projLen * rayX;
                final.y = fy + projLen * rayY;
              }
            }
          }
          if (mode.handle === "start") {
            const updates: Partial<EditorElement> = { x: final.x, y: final.y };
            if (orig.type === "arrow" || orig.type === "line") {
              const newDir = useEdge ? elemSnap.dir : undefined;
              (updates as Record<string, unknown>).startDir = newDir;
              (updates as Record<string, unknown>).startConnectedTo = useEdge && elemSnap.bindable ? elemSnap.elementId : undefined;
              // Adjust elbow corners when start endpoint moves
              const currentArrow = elementById(state.elements, orig.id) as ArrowElement | undefined;
              if (currentArrow?.elbowCorners && currentArrow.elbowCorners.length > 0 && currentArrow.lineStyle === "elbow") {
                const corners = currentArrow.elbowCorners.map(c => [...c] as [number, number]);
                const tol = 2;
                const wasVertical = Math.abs(corners[0][0] - currentArrow.x) < tol;
                const wasHorizontal = Math.abs(corners[0][1] - currentArrow.y) < tol;
                const newIsVert = newDir === "up" || newDir === "down";
                const newIsHoriz = newDir === "left" || newDir === "right";

                if ((wasVertical && newIsHoriz) || (wasHorizontal && newIsVert)) {
                  // Direction changed perpendicular — reset for clean auto-routing
                  (updates as Record<string, unknown>).elbowCorners = undefined;
                } else if (wasVertical) {
                  corners[0] = [final.x, corners[0][1]];
                  (updates as Record<string, unknown>).elbowCorners = corners;
                } else if (wasHorizontal) {
                  corners[0] = [corners[0][0], final.y];
                  (updates as Record<string, unknown>).elbowCorners = corners;
                }
              }
            }
            state.updateElementLive(orig.id, updates);
          } else {
            const updates: Partial<EditorElement> = { x2: final.x, y2: final.y };
            if (orig.type === "arrow" || orig.type === "line") {
              const newDir = useEdge ? elemSnap.dir : undefined;
              (updates as Record<string, unknown>).endDir = newDir;
              (updates as Record<string, unknown>).endConnectedTo = useEdge && elemSnap.bindable ? elemSnap.elementId : undefined;
              // Adjust elbow corners when end endpoint moves
              const currentArrow = elementById(state.elements, orig.id) as ArrowElement | undefined;
              if (currentArrow?.elbowCorners && currentArrow.elbowCorners.length > 0 && currentArrow.lineStyle === "elbow") {
                const corners = currentArrow.elbowCorners.map(c => [...c] as [number, number]);
                const lastIdx = corners.length - 1;
                const tol = 2;
                const wasVertical = Math.abs(corners[lastIdx][0] - currentArrow.x2) < tol;
                const wasHorizontal = Math.abs(corners[lastIdx][1] - currentArrow.y2) < tol;
                const newIsVert = newDir === "up" || newDir === "down";
                const newIsHoriz = newDir === "left" || newDir === "right";

                if ((wasVertical && newIsHoriz) || (wasHorizontal && newIsVert)) {
                  // Direction changed perpendicular — reset for clean auto-routing
                  (updates as Record<string, unknown>).elbowCorners = undefined;
                } else if (wasVertical) {
                  corners[lastIdx] = [final.x, corners[lastIdx][1]];
                  (updates as Record<string, unknown>).elbowCorners = corners;
                } else if (wasHorizontal) {
                  corners[lastIdx] = [corners[lastIdx][0], final.y];
                  (updates as Record<string, unknown>).elbowCorners = corners;
                }
              }
            }
            state.updateElementLive(orig.id, updates);
          }
          return;
        }

        // For shapes: snap the edge being dragged to the grid
        // Compute raw new bounds, then snap the moving edge
        let newX = orig.x;
        let newY = orig.y;
        let newW = orig.width;
        let newH = orig.height;

        switch (mode.handle) {
          case "top-left":
            newX = snap(orig.x + localDx);
            newY = snap(orig.y + localDy);
            newW = orig.x + orig.width - newX;
            newH = orig.y + orig.height - newY;
            break;
          case "top":
            newY = snap(orig.y + localDy);
            newH = orig.y + orig.height - newY;
            break;
          case "top-right":
            newY = snap(orig.y + localDy);
            newW = snap(orig.x + orig.width + localDx) - orig.x;
            newH = orig.y + orig.height - newY;
            break;
          case "right":
            newW = snap(orig.x + orig.width + localDx) - orig.x;
            break;
          case "bottom-right":
            newW = snap(orig.x + orig.width + localDx) - orig.x;
            newH = snap(orig.y + orig.height + localDy) - orig.y;
            break;
          case "bottom":
            newH = snap(orig.y + orig.height + localDy) - orig.y;
            break;
          case "bottom-left":
            newX = snap(orig.x + localDx);
            newW = orig.x + orig.width - newX;
            newH = snap(orig.y + orig.height + localDy) - orig.y;
            break;
          case "left":
            newX = snap(orig.x + localDx);
            newW = orig.x + orig.width - newX;
            break;
        }

        // Aspect-lock: either sticky (element.aspectLocked) or held (Shift).
        // Corners: project the pointer displacement onto the original
        // diagonal direction (anchor-to-handle) and derive a single scale
        // factor, then snap the longer axis and compute the shorter from
        // the original ratio. This avoids the per-frame "driving axis"
        // flip that caused w/h to jump back and forth by a snap step when
        // the pointer moved along the diagonal. Edge handles: scale the
        // perpendicular axis from the already-snapped driver so there is
        // only one snap source.
        const aspectLock = e.shiftKey || orig.aspectLocked === true;
        if (aspectLock && orig.width > 0 && orig.height > 0) {
          const ratio = orig.width / orig.height;
          const isCorner =
            mode.handle === "top-left" ||
            mode.handle === "top-right" ||
            mode.handle === "bottom-left" ||
            mode.handle === "bottom-right";
          if (isCorner) {
            const sx = mode.handle.includes("left") ? -1 : 1;
            const sy = mode.handle.includes("top") ? -1 : 1;
            const anchorX = sx === -1 ? orig.x + orig.width : orig.x;
            const anchorY = sy === -1 ? orig.y + orig.height : orig.y;
            // Diagonal vector from anchor to the handle in its original pos
            const dirX = sx * orig.width;
            const dirY = sy * orig.height;
            const diagLen = Math.hypot(dirX, dirY);
            // Scalar projection of the pointer displacement along the
            // diagonal. Positive = handle moves away from anchor (grow).
            const proj = (localDx * dirX + localDy * dirY) / diagLen;
            let scale = (diagLen + proj) / diagLen;
            // Floor the scale so the element can't invert or collapse.
            const minScale = GRID_SIZE / Math.max(orig.width, orig.height);
            if (scale < minScale) scale = minScale;
            // Snap the longer side to the grid, derive the shorter from the
            // ratio. One snap source → no axis-switch jitter.
            if (orig.width >= orig.height) {
              newW = snap(orig.width * scale);
              newH = newW / ratio;
            } else {
              newH = snap(orig.height * scale);
              newW = newH * ratio;
            }
            newX = sx === -1 ? anchorX - newW : anchorX;
            newY = sy === -1 ? anchorY - newH : anchorY;
          } else if (mode.handle === "right" || mode.handle === "left") {
            newH = newW / ratio;
            // Keep vertical center fixed so the element grows symmetrically
            // around the horizontal axis line it was previously centered on.
            newY = orig.y + (orig.height - newH) / 2;
          } else if (mode.handle === "top" || mode.handle === "bottom") {
            newW = newH * ratio;
            newX = orig.x + (orig.width - newW) / 2;
          }
        }

        // Ensure minimum size (at least one grid cell)
        const minSize = GRID_SIZE;
        if (newW < minSize) {
          newW = minSize;
          if (mode.handle.includes("left")) newX = orig.x + orig.width - minSize;
        }
        if (newH < minSize) {
          newH = minSize;
          if (mode.handle.includes("top")) newY = orig.y + orig.height - minSize;
        }

        // For rotated elements, the switch above placed the new bbox in
        // local coords as if unrotated. Because rotation pivots around the
        // bbox center, changing width/height also shifts where the anchor
        // edge ends up in world space. Recompute newX/newY so the anchor
        // (the edge/corner opposite the dragged handle) stays pinned at
        // its original world-space location — making the drag feel like
        // it extends along the element's rotated axis.
        if (rot !== 0) {
          const handleAnchor: Record<string, [number, number]> = {
            "top-left": [1, 1],
            top: [0, 1],
            "top-right": [-1, 1],
            right: [-1, 0],
            "bottom-right": [-1, -1],
            bottom: [0, -1],
            "bottom-left": [1, -1],
            left: [1, 0],
          };
          const anchor = handleAnchor[mode.handle];
          if (anchor) {
            const [sgnX, sgnY] = anchor;
            const oldCx = orig.x + orig.width / 2;
            const oldCy = orig.y + orig.height / 2;
            const offOldX = (sgnX * orig.width) / 2;
            const offOldY = (sgnY * orig.height) / 2;
            const worldAnchorX = oldCx + cosR * offOldX - sinR * offOldY;
            const worldAnchorY = oldCy + sinR * offOldX + cosR * offOldY;
            const offNewX = (sgnX * newW) / 2;
            const offNewY = (sgnY * newH) / 2;
            const newCx = worldAnchorX - (cosR * offNewX - sinR * offNewY);
            const newCy = worldAnchorY - (sinR * offNewX + cosR * offNewY);
            newX = newCx - newW / 2;
            newY = newCy - newH / 2;
          }
        }

        state.updateElementLive(orig.id, {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
      }
    },
    [svgRef, store]
  );

  const onMouseUp = useCallback(() => {
    const mode = modeRef.current;

    if (mode.type === "marquee") {
      const state = store.getState();
      const m = state.marquee;
      // A click without movement leaves a zero-area marquee — treat as no
      // selection change beyond what mousedown already did.
      if (m && (m.w > 0 || m.h > 0)) {
        const box = {
          minX: m.x,
          minY: m.y,
          maxX: m.x + m.w,
          maxY: m.y + m.h,
        };
        const hits = state.elements
          .filter((el) => rectsIntersect(elementBox(el), box))
          .map((el) => el.id);

        let next: string[];
        if (mode.shiftKey) {
          // XOR: toggle each hit in/out of the original set.
          const orig = new Set(mode.origIds);
          for (const id of hits) {
            if (orig.has(id)) orig.delete(id);
            else orig.add(id);
          }
          next = [...orig];
        } else {
          next = hits;
        }
        state.selectMultiple(next);
      }
      state.setMarquee(null);
      modeRef.current = { type: "none" };
      setDragging(svgRef, false);
      return;
    }

    // Clean up elbow corners after segment drag
    if (mode.type === "resizing" && mode.handle.startsWith("elbow-") && elbowDragRef.current) {
      const state = store.getState();
      const el = state.elements.find(e => e.id === mode.orig.id) as ArrowElement | undefined;
      if (el?.elbowCorners) {
        const allPts: [number, number][] = [[el.x, el.y], ...el.elbowCorners, [el.x2, el.y2]];
        const cleaned = cleanOrthogonalPath(allPts);
        const cleanedCorners = cleaned.slice(1, -1) as [number, number][];
        state.updateElementLive(el.id, { elbowCorners: cleanedCorners } as Partial<EditorElement>);
      }
      elbowDragRef.current = null;
    }

    if (mode.type === "preDraw") {
      // Pure click (no drag past threshold) — stamp a default-size element
      // centered on the click point. Because the element isn't added until
      // now, the user never sees it in an intermediate misplaced state.
      const state = store.getState();
      const isLineType = mode.tool === "line" || mode.tool === "arrow";
      let newEl: EditorElement;
      if (isLineType) {
        const half = DEFAULT_LINE_LENGTH / 2;
        newEl = buildDrawingElement({
          tool: mode.tool,
          x: snap(mode.startX - half),
          y: mode.startY,
          width: 0,
          height: 0,
          x2: snap(mode.startX + half),
          y2: mode.startY,
          startSnapDir: mode.startSnapDir,
          startConnectedTo: mode.startConnectedTo,
          zIndex: state.elements.length,
        });
      } else {
        const isCircle = mode.tool === "circle";
        const w = mode.pathShape?.width ?? DEFAULT_SHAPE_WIDTH;
        const h = mode.pathShape?.height ?? (isCircle ? DEFAULT_SHAPE_WIDTH : DEFAULT_SHAPE_HEIGHT);
        newEl = buildDrawingElement({
          tool: mode.tool,
          x: snap(mode.startX - w / 2),
          y: snap(mode.startY - h / 2),
          width: w,
          height: h,
          x2: 0,
          y2: 0,
          pathShape: mode.pathShape,
          zIndex: state.elements.length,
        });
      }
      state.addElement(newEl);
      state.selectElement(newEl.id);
      state.setTool("select");
    }

    if (mode.type === "drawing") {
      const state = store.getState();
      const el = state.elements.find((el) => el.id === mode.elementId);
      // Past the drag threshold the element was created and sized to the
      // drag. Just select it and exit the tool — no inflate/recenter path
      // is needed here because pure clicks go through preDraw above.
      if (el) {
        state.selectElement(el.id);
        state.setTool("select");
      }
    }
    // Commit the final position for CSS-transform drags. During drag, React
    // reconciliation was skipped entirely; we apply the pending update map now.
    // Clearing CSS transforms first, then immediately calling updateElementsLive,
    // lets React's useSyncExternalStore commit SVG attribute changes before the
    // browser paints — so there is no frame where the element snaps back to its
    // drag-start position.
    if (mode.type === "moving" && mode.moved && dragNodeRefs.current.length > 0) {
      const state = store.getState();
      const pending = pendingFrameUpdatesRef.current;
      if (pending && pending.size > 0) {
        for (const node of dragNodeRefs.current) node.style.transform = "";
        state.updateElementsLive(pending);
      }
      pendingFrameUpdatesRef.current = null;
      dragCacheRef.current = null;
    }

    for (const node of dragShadowNodesRef.current) {
      node.style.filter = "";
    }
    dragShadowNodesRef.current = [];
    for (const node of dragNodeRefs.current) {
      node.style.transform = "";
      node.style.willChange = "";
    }
    dragNodeRefs.current = [];

    modeRef.current = { type: "none" };
    setDragging(svgRef, false);
    store.getState().setSnapTargetId(null);
    store.getState().setRotatingElementId(null);
  }, [store, svgRef]);

  // Drive move/up from the window, not the SVG. React props on the <svg>
  // only fire while the cursor is over the element — so a marquee drag
  // freezes the moment the pointer crosses into the sidebar, and a mouseup
  // released outside leaves the mode stuck. Window listeners keep the
  // interaction glued to the pointer until it's actually released.
  //
  // mousemove is coalesced through requestAnimationFrame: the OS can fire
  // mousemove at 200+ Hz, but we only need one update per paint. Each raw
  // event just parks the latest coordinates in a ref; the rAF callback
  // runs the real handler once per frame. mouseup flushes any pending
  // move first so the drop reflects the latest cursor position.
  useEffect(() => {
    let rafId = 0;
    let latest: MouseEvent | null = null;

    const flush = () => {
      rafId = 0;
      const ev = latest;
      latest = null;
      if (ev) onMouseMove(ev);
    };

    const moveListener = (ev: MouseEvent) => {
      latest = ev;
      // Instant visual feedback — apply a CSS translate to the dragged element
      // and its selection handles on every raw mousemove, without waiting for
      // the rAF. Uses the canvas state cached at drag start so we never call
      // getBoundingClientRect() here (that would force a synchronous layout
      // flush on every event, thrashing against React's attribute writes).
      const mode = modeRef.current;
      const cache = dragCacheRef.current;
      if (mode.type === "moving" && mode.moved && dragNodeRefs.current.length > 0 && cache) {
        const rawX = (ev.clientX - cache.svgRect.left - cache.panX) / cache.zoom;
        const rawY = (ev.clientY - cache.svgRect.top - cache.panY) / cache.zoom;
        const dx = snap(mode.origX + (rawX - mode.startX)) - mode.origX;
        const dy = snap(mode.origY + (rawY - mode.startY)) - mode.origY;
        const t = `translate(${dx}px,${dy}px)`;
        for (const node of dragNodeRefs.current) node.style.transform = t;
      }
      if (rafId === 0) rafId = requestAnimationFrame(flush);
    };
    const upListener = () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        const ev = latest;
        latest = null;
        if (ev) onMouseMove(ev);
      }
      onMouseUp();
    };
    window.addEventListener("mousemove", moveListener);
    window.addEventListener("mouseup", upListener);
    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", moveListener);
      window.removeEventListener("mouseup", upListener);
    };
  }, [onMouseMove, onMouseUp]);

  // Wheel handler must be a native event (non-passive) so preventDefault actually works.
  // React registers onWheel as passive, which silently ignores preventDefault,
  // allowing the browser's native ctrl+wheel page zoom to fire.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const state = store.getState();

      if (e.ctrlKey || e.metaKey) {
        // Zoom toward cursor position
        const rect = svg.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const oldZoom = state.canvas.zoom;
        const zoomFactor = 1 - e.deltaY * 0.005;
        const newZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, oldZoom * zoomFactor)
        );
        const scale = newZoom / oldZoom;

        const newPanX = cursorX - scale * (cursorX - state.canvas.panX);
        const newPanY = cursorY - scale * (cursorY - state.canvas.panY);

        state.setZoom(newZoom);
        state.setPan(newPanX, newPanY);
      } else {
        // Pan
        state.setPan(
          state.canvas.panX - e.deltaX,
          state.canvas.panY - e.deltaY
        );
      }
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [store, svgRef]);

  // Space key tracking for pan mode. Lives inside useEffect so listeners
  // unwind cleanly on unmount — the previous "attach in render body with a
  // module-level flag guard" pattern survived hot reloads but leaked a
  // listener per mount that still referenced the old spaceRef closure.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !(e.target as HTMLElement)?.closest?.("[contenteditable]")
      ) {
        spaceRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceRef.current = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const onMouseLeave = useCallback(() => {
    const state = store.getState();
    if (state.hoveredElementId) state.setHoveredElementId(null);
  }, [store]);

  // Double-click a grouped element to "enter" the group — members can then
  // be clicked and moved individually until the user clicks outside the
  // group, presses Escape, or changes tool. TextElement's own onDoubleClick
  // stops propagation while the text is single-selected, so text editing
  // still works once the group is entered.
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

  return {
    // onMouseMove/onMouseUp are attached at window level above — do not also
    // expose them as React props on the <svg>, or we'd handle each move twice
    // whenever the pointer is over the canvas.
    handlers: {
      onMouseDown,
      onMouseLeave,
      onDoubleClick,
    },
  };
}
