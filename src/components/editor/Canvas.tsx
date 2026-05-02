"use client";

import {
  memo,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";
import {
  elementById,
  sortedElementIds,
  stableTileBounds,
  useEditorStore,
} from "@/stores/editor-store";
import { CanvasElement } from "./CanvasElement";
import { SelectionHandles } from "./SelectionHandles";
import { useCanvasInteraction } from "@/hooks/use-canvas-interaction";
import { TextFormatToolbar } from "./TextFormatToolbar";
import { buildPath } from "./elements/ArrowElement";
import type { ArrowElement as ArrowElementType, EditorElement } from "@/types/editor";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_SIZE,
  GRID_MAJOR,
} from "@/lib/constants";
import { DEFAULT_STROKE } from "@/lib/constants";

/** Build grid line arrays once (they never change). */
function buildGridLines() {
  const minor: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const major: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const majorStep = GRID_SIZE * GRID_MAJOR;

  // Vertical lines
  for (let x = GRID_SIZE; x < CANVAS_WIDTH; x += GRID_SIZE) {
    const isMajor = x % majorStep === 0;
    (isMajor ? major : minor).push({ x1: x, y1: 0, x2: x, y2: CANVAS_HEIGHT });
  }
  // Horizontal lines
  for (let y = GRID_SIZE; y < CANVAS_HEIGHT; y += GRID_SIZE) {
    const isMajor = y % majorStep === 0;
    (isMajor ? major : minor).push({ x1: 0, y1: y, x2: CANVAS_WIDTH, y2: y });
  }
  return { minor, major };
}

const GRID_LINES = buildGridLines();

/** Tile + grid background, extracted so React.memo can keep its ~3200 grid
 *  `<line>` elements out of reconciliation whenever the Canvas re-renders
 *  for reasons that don't affect them (pan, hover, selection, marquee).
 *  Props are chosen so that pure pan keeps the tuple === across renders:
 *  `tiles` and `tileRange` are memoized refs on `elements`, and `zoom` /
 *  `gridOpacity` only change on wheel + grid toggle. */
const TileLayer = memo(function TileLayer({
  tiles,
  tileRange,
  zoom,
  gridOpacity,
}: {
  tiles: { i: number; j: number }[];
  tileRange: { iMin: number; iMax: number; jMin: number; jMax: number };
  zoom: number;
  gridOpacity: number;
}) {
  return (
    <>
      {/* Single shadow for the UNION of all tiles. `data-sheet-shadow` is
          targeted by globals.css to drop the filter during `is-panning`,
          since feDropShadow blocks GPU layer promotion of the pan <g>. */}
      <rect
        data-no-export
        data-sheet-shadow="1"
        x={tileRange.iMin * CANVAS_WIDTH}
        y={tileRange.jMin * CANVAS_HEIGHT}
        width={(tileRange.iMax - tileRange.iMin + 1) * CANVAS_WIDTH}
        height={(tileRange.jMax - tileRange.jMin + 1) * CANVAS_HEIGHT}
        fill="white"
        filter="url(#figurein-sheet-shadow)"
      />
      {tiles.map(({ i, j }) => (
        <g
          key={`${i}:${j}`}
          transform={`translate(${i * CANVAS_WIDTH}, ${j * CANVAS_HEIGHT})`}
          data-no-export
        >
          <rect
            x={0}
            y={0}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            fill="white"
            stroke="hsl(0 0% 86%)"
            strokeWidth={1 / zoom}
          />
          {gridOpacity > 0 && (
            <g opacity={gridOpacity}>
              {GRID_LINES.minor.map((l, idx) => (
                <line
                  key={`m${idx}`}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="hsl(0 0% 92%)"
                  strokeWidth={0.5}
                />
              ))}
              {GRID_LINES.major.map((l, idx) => (
                <line
                  key={`M${idx}`}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="hsl(0 0% 85%)"
                  strokeWidth={0.5}
                />
              ))}
            </g>
          )}
        </g>
      ))}
    </>
  );
});

/** Screen-space "Editing group" badge. Subscribes to canvas on its own so
 *  the parent Canvas can skip canvas from its main subscription — only this
 *  tiny component re-renders on pan, keeping the badge glued to the group's
 *  top-left in screen coords. */
function EditingGroupBadge({
  box,
  onExit,
}: {
  box: { x: number; y: number; w: number; h: number };
  onExit: () => void;
}) {
  const { panX, panY, zoom } = useEditorStore((s) => s.canvas);
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: box.x * zoom + panX - 6,
        top: box.y * zoom + panY - 30,
      }}
    >
      <div
        className="pointer-events-auto flex items-center gap-1.5 rounded-md bg-[hsl(271_81%_56%)] px-2 py-1 text-[11px] font-medium text-white shadow-md select-none"
        style={{ whiteSpace: "nowrap" }}
      >
        <span>Editing group</span>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onExit();
          }}
          title="Exit group (Esc)"
          className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-white/30"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

/** Shown while an AI-generated page is waiting for the browser to measure
 *  its text elements. The store holds the planned geometry; the actual
 *  heights + downstream shifts are finalized by the per-text first-mount
 *  hook in TextElement. The overlay keeps the intermediate state hidden —
 *  users see the planned layout for a single paint, then the reflowed
 *  final — which is visually preferable to watching boxes jump. */
function GenerationOverlay() {
  const pending = useEditorStore((s) => s.pendingMeasure);
  if (!pending) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[1px]"
    >
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-md">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        Finalizing layout…
      </div>
    </div>
  );
}

/** Blue outline + drop-shadow overlay used for both hover and snap-target
 *  states. For line/arrow, draws a thin glow stroke just outside the path;
 *  otherwise draws a rounded-rect outline inflated so it sits outside the
 *  element's own border (instead of overlapping it). */
const ElementHighlight = memo(function ElementHighlight({ element }: { element: EditorElement }) {
  const HIGHLIGHT = "hsl(221 83% 53%)";
  const SHADOW_FILTER = "drop-shadow(0 3px 8px hsl(221 83% 53% / 0.45))";
  const STROKE_W = 1;

  if (element.type === "line" || element.type === "arrow") {
    const d = buildPath(element as ArrowElementType);
    // Sit flush outside the element's own stroke so they don't overlap.
    const offset = element.strokeWidth / 2 + STROKE_W / 2;
    return (
      <path
        data-no-export
        d={d}
        fill="none"
        stroke={HIGHLIGHT}
        strokeWidth={element.strokeWidth + offset * 2}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        opacity={0.35}
        pointerEvents="none"
        style={{ filter: SHADOW_FILTER }}
      />
    );
  }

  // Inflate the overlay rect by half the element's stroke plus half the
  // highlight stroke so the highlight sits flush on the outside of the
  // element's border, not centered on it and with no visible gap.
  const pad = element.strokeWidth / 2 + STROKE_W / 2;
  // Match the element's own rotation so the hover outline tracks the
  // rendered shape, not its axis-aligned bbox.
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})`
    : undefined;
  return (
    <rect
      data-no-export
      x={element.x - pad}
      y={element.y - pad}
      width={element.width + pad * 2}
      height={element.height + pad * 2}
      fill="none"
      stroke={HIGHLIGHT}
      strokeWidth={STROKE_W}
      pointerEvents="none"
      transform={rotateTransform}
      style={{ filter: SHADOW_FILTER }}
    />
  );
});

/** Tight axis-aligned bbox of a set of elements (lines/arrows use both
 *  endpoints and any elbow corners). Returns null for empty input. */
function groupBBox(
  members: EditorElement[]
): { x: number; y: number; w: number; h: number } | null {
  if (members.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of members) {
    if (el.type === "line" || el.type === "arrow") {
      const c = el as EditorElement & {
        x2: number;
        y2: number;
        elbowCorners?: [number, number][];
      };
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
      if (c.x2 < minX) minX = c.x2;
      if (c.y2 < minY) minY = c.y2;
      if (c.x2 > maxX) maxX = c.x2;
      if (c.y2 > maxY) maxY = c.y2;
      if (c.elbowCorners) {
        for (const [cx, cy] of c.elbowCorners) {
          if (cx < minX) minX = cx;
          if (cy < minY) minY = cy;
          if (cx > maxX) maxX = cx;
          if (cy > maxY) maxY = cy;
        }
      }
    } else {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      const right = el.x + el.width;
      const bottom = el.y + el.height;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  // Imperative handle on the pan/zoom <g>. Updated by the subscribe effect
  // below so panning never runs through React.
  const gRef = useRef<SVGGElement>(null);
  // Only the stable-reference slice of the store sits in Canvas's main
  // subscription. Pointedly excluded: `s.elements` — Canvas never subscribes
  // to the elements array itself, because that changes on every drag frame
  // and would re-render the whole tree 60Hz. Element data flows to children
  // via subscribe-by-id (see `sortedIds` below + `CanvasElement`). Selection /
  // hover / snap-target ids are also omitted here — the per-element selectors
  // below read them inline and return element refs directly.
  const {
    marquee,
    addElement,
    selectElement,
    setPan,
    setViewportSize,
    currentPageId,
    setEditingGroupId,
    showGrid,
  } = useEditorStore(
    useShallow((s) => ({
      marquee: s.marquee,
      addElement: s.addElement,
      selectElement: s.selectElement,
      setPan: s.setPan,
      setViewportSize: s.setViewportSize,
      currentPageId: s.currentPageId,
      setEditingGroupId: s.setEditingGroupId,
      showGrid: s.showGrid,
    }))
  );
  // Sorted-by-zIndex id list with stable reference — mutated only when
  // elements are added/removed or their zIndex changes. Keeps Canvas out
  // of the re-render path for position/content mutations.
  const sortedIds = useEditorStore((s) => sortedElementIds(s.elements));
  // Tile range, also stable-ref — only bumps when an element spills past a
  // new tile boundary, which is rare compared to drag frequency.
  const tileRange = useEditorStore((s) => stableTileBounds(s.elements));
  // Per-element subscriptions for the derived highlight/selection UI. Each
  // returns a stable ref when the relevant element hasn't changed, so the
  // Canvas only re-renders when one of these specific elements is touched.
  const selectedElement = useEditorStore((s) =>
    s.selectedElementId ? elementById(s.elements, s.selectedElementId) ?? null : null
  );
  const snapTargetElement = useEditorStore((s) =>
    s.snapTargetId ? elementById(s.elements, s.snapTargetId) ?? null : null
  );
  const hoveredElement = useEditorStore((s) => {
    const id = s.hoveredElementId;
    if (!id || id === s.snapTargetId || id === s.selectedElementId) return null;
    return elementById(s.elements, id) ?? null;
  });
  // Multi-selected element list — useShallow so same contents = same reference.
  const multiSelected = useEditorStore(
    useShallow((s): EditorElement[] => {
      if (s.selectedElementIds.length <= 1) return [];
      const out: EditorElement[] = [];
      for (const id of s.selectedElementIds) {
        const el = elementById(s.elements, id);
        if (el) out.push(el);
      }
      return out;
    })
  );
  // Members of the currently-entered group (for the dashed overlay +
  // group-edit badge box). Same useShallow pattern.
  const editingGroupMembers = useEditorStore(
    useShallow((s): EditorElement[] => {
      if (!s.editingGroupId) return [];
      const out: EditorElement[] = [];
      for (const el of s.elements) {
        if (el.groupId === s.editingGroupId) out.push(el);
      }
      return out;
    })
  );
  // Subscribe to zoom separately — it changes only on wheel/pinch (rare),
  // while pan changes ~60Hz during drag. Keeping canvas out of the main
  // subscription means pan updates NEVER trigger a Canvas re-render; we
  // apply panX/panY imperatively to the <g> transform below. Zoom still
  // needs React because it scales stroke widths, dashes, and grid opacity.
  const zoom = useEditorStore((s) => s.canvas.zoom);

  // `centered` gates the first paint. On initial mount (and after a page
  // switch) React commits once with the store's default pan=(0,0), which
  // would render the figure at the upper-left for a frame. We keep the SVG
  // `visibility: hidden` until the layout effect has measured and applied
  // the centered pan, then flip it visible — users only see the centered
  // result, never the top-left flash.
  const [centered, setCentered] = useState(false);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const { width, height } = svg.getBoundingClientRect();
    // Seed the store's viewport BEFORE setPan so the clamp inside setPan
    // has a real rect to work with — otherwise the very first centering
    // call would be a clamp no-op.
    setViewportSize(width, height);
    const z = useEditorStore.getState().canvas.zoom;
    const panX = (width - CANVAS_WIDTH * z) / 2;
    const panY = (height - CANVAS_HEIGHT * z) / 2;
    setPan(panX, panY);
    setCentered(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageId]);

  // Keep the viewport size in sync with the SVG element so the pan clamp
  // adjusts when the window resizes or panels toggle. ResizeObserver fires
  // on any layout change, including the sidebar collapse/expand that
  // changes the canvas's horizontal space.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewportSize(width, height);
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [setViewportSize]);

  // Apply pan+zoom to the <g> via the CSS `transform` property (not the SVG
  // `transform` attribute). DevTools' INP breakdown showed ~160 ms of
  // *presentation delay* per interaction with <1 ms of JS — the cost lives
  // in paint, not handlers. Writing to `style.transform` (with the
  // `will-change: transform` hint below) lets the browser hoist the <g>
  // onto its own GPU layer so pans become compositor-only translations,
  // skipping the CPU rasterize of ~3200 grid lines + feDropShadow every
  // frame. `useLayoutEffect` runs pre-paint so the initial transform
  // lands on frame 1 (no flash).
  useLayoutEffect(() => {
    const apply = (state: ReturnType<typeof useEditorStore.getState>) => {
      const g = gRef.current;
      if (!g) return;
      const { panX, panY, zoom: z } = state.canvas;
      g.style.transform = `translate(${panX}px, ${panY}px) scale(${z})`;
    };
    apply(useEditorStore.getState());
    return useEditorStore.subscribe((state, prev) => {
      if (state.canvas !== prev.canvas) apply(state);
    });
  }, []);

  // Auto-tile layout: turn the range into an explicit tile list. Depends
  // solely on `tileRange` (stable-ref) so this memo only re-runs when tiles
  // actually change — not on every element mutation.
  const tiles = useMemo(() => {
    const out: { i: number; j: number }[] = [];
    for (let j = tileRange.jMin; j <= tileRange.jMax; j++) {
      for (let i = tileRange.iMin; i <= tileRange.iMax; i++) {
        out.push({ i, j });
      }
    }
    return out;
  }, [tileRange]);
  const editingGroupBox = useMemo(
    () => (editingGroupMembers.length > 0 ? groupBBox(editingGroupMembers) : null),
    [editingGroupMembers]
  );

  const { handlers } = useCanvasInteraction(svgRef);

  // Icons still use the HTML5 drag-and-drop API (IconsPanel). Shapes use a
  // custom press-and-drag in ShapesPanel that writes directly to the store,
  // so no canvas drop handler is needed for them.
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/figurein-icon")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      const iconId = e.dataTransfer.getData("application/figurein-icon");
      if (!iconId) return;
      e.preventDefault();

      const state = useEditorStore.getState();
      const { panX, panY, zoom: z } = state.canvas;
      const rect = svg.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - panX) / z;
      const rawY = (e.clientY - rect.top - panY) / z;
      const snapSize = GRID_SIZE / 4;
      const snapX = Math.round(rawX / snapSize) * snapSize;
      const snapY = Math.round(rawY / snapSize) * snapSize;

      const id = Math.random().toString(36).substring(2, 11);
      addElement({
        id,
        parentId: null,
        type: "icon",
        x: snapX - 30,
        y: snapY - 30,
        width: 60,
        height: 60,
        rotation: 0,
        fill: "none",
        stroke: "none",
        strokeWidth: 0,
        opacity: 1,
        zIndex: state.elements.length,
        iconId,
        color: DEFAULT_STROKE,
      });
      selectElement(id);
    },
    [addElement, selectElement]
  );

  // Determine grid opacity based on zoom — fade grid when very zoomed out.
  // Forced to 0 when the user has toggled the grid off.
  const gridOpacity = !showGrid
    ? 0
    : zoom < 0.4
      ? 0
      : zoom < 0.7
        ? (zoom - 0.4) / 0.3
        : 1;

  return (
    <div className="relative h-full w-full">
    <svg
      ref={svgRef}
      id="figurein-canvas"
      className="h-full w-full cursor-crosshair select-none"
      style={{
        WebkitUserSelect: "none",
        visibility: centered ? "visible" : "hidden",
      }}
      {...handlers}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Canvas-sheet drop shadow. Two stacked feDropShadows create Apple-style
          layered depth: a tight contact shadow + a wider ambient cast. Both are
          marked data-no-export so they're stripped from PNG/SVG exports. */}
      <defs data-no-export>
        <filter
          id="figurein-sheet-shadow"
          x="-5%"
          y="-5%"
          width="110%"
          height="115%"
        >
          {/* Clamp dy/stdDeviation: at low zoom the scaled values explode
              (e.g. 180 at zoom 0.1), and feDropShadow convolution cost grows
              with the blur radius on a union-of-tiles rect that can be many
              thousands of user units wide. Cap keeps pan/zoom smooth. */}
          <feDropShadow
            dx="0"
            dy={Math.min(1 / zoom, 4)}
            stdDeviation={Math.min(2 / zoom, 8)}
            floodColor="rgb(0 0 0)"
            floodOpacity="0.06"
          />
          <feDropShadow
            dx="0"
            dy={Math.min(8 / zoom, 24)}
            stdDeviation={Math.min(18 / zoom, 36)}
            floodColor="rgb(0 0 0)"
            floodOpacity="0.14"
          />
        </filter>
      </defs>

      {/* Neutral backdrop — slightly darker than the sheet so the drop shadow
          reads clearly. macOS-chrome gray. */}
      <rect width="100%" height="100%" fill="hsl(220 13% 93%)" data-no-export />

      {/* Canvas area — no marker defs needed; arrowheads are drawn inline.
          Transform is applied imperatively via `gRef` (see effect below) so
          pan never runs through React. Zoom is in the transform too but
          changes infrequently, so paying a re-render for it is fine.
          `willChange: transform` promotes this to its own GPU layer so pans
          become compositor-only translations; `transformOrigin: 0 0` so the
          scale composes around the top-left instead of the element center. */}
      <g
        ref={gRef}
        style={{ willChange: "transform", transformOrigin: "0 0" }}
      >
        {/* Tile sheets + grid — memoized so pan doesn't re-reconcile the
            3200+ grid <line> elements every frame. */}
        <TileLayer
          tiles={tiles}
          tileRange={tileRange}
          zoom={zoom}
          gridOpacity={gridOpacity}
        />

        {/* Elements — iterated by id so Canvas re-renders only on structure
            changes (add/delete/zIndex reshuffle). Each child subscribes to
            its own element data via useEditorStore, so per-element content
            mutations never touch this map. */}
        {sortedIds.map((id) => (
          <CanvasElement key={id} id={id} />
        ))}

        {/* Hover + snap-target highlight — blue outline with a drop-shadow to
            give the element a lifted feel. Connectors (lines/arrows) get a
            matching-path stroke overlay so the line itself glows. */}
        {hoveredElement && <ElementHighlight element={hoveredElement} />}
        {snapTargetElement && <ElementHighlight element={snapTargetElement} />}

        {/* Multi-selection: outline every selected element. Selection handles
            are skipped here — they'd overlap and only support a single
            element's resize anyway. */}
        {multiSelected.map((el) => (
          <ElementHighlight key={`ms-${el.id}`} element={el} />
        ))}

        {/* Selection handles — only when exactly one element is selected. */}
        {selectedElement && multiSelected.length === 0 && (
          <SelectionHandles element={selectedElement} />
        )}

        {/* Marquee selection rect — drawn while the user is dragging across
            empty canvas with the select tool. */}
        {marquee && (marquee.w > 0 || marquee.h > 0) && (
          <rect
            data-no-export
            x={marquee.x}
            y={marquee.y}
            width={marquee.w}
            height={marquee.h}
            fill="hsl(221 83% 53% / 0.08)"
            stroke="hsl(221 83% 53%)"
            strokeWidth={1 / zoom}
            pointerEvents="none"
          />
        )}

        {/* Group-edit indicator — dashed purple frame around the entered
            group. Drawn inside the zoomed layer so it tracks pan/zoom. Pad
            slightly so it doesn't touch element edges. The element-level
            pointer events are unaffected; this overlay is visual only. */}
        {editingGroupBox && (
          <rect
            data-no-export
            x={editingGroupBox.x - 6}
            y={editingGroupBox.y - 6}
            width={editingGroupBox.w + 12}
            height={editingGroupBox.h + 12}
            rx={4}
            fill="none"
            stroke="hsl(271 81% 56%)"
            strokeWidth={1 / zoom}
            strokeDasharray={`${6 / zoom} ${4 / zoom}`}
            pointerEvents="none"
          />
        )}
      </g>

    </svg>

    {/* Group-edit badge — plain HTML overlay pinned to the top-left of the
        entered group's bbox in screen space. Stays a constant size at any
        zoom; "Exit" button leaves edit mode. Rendered outside the SVG so
        it isn't affected by SVG's stacking context or export logic. */}
    {/* Rich-text format toolbar — floats above the text element currently
        in edit mode (set by TextElement on double-click). */}
    <TextFormatToolbar />

    <GenerationOverlay />

    {editingGroupBox && (
      <EditingGroupBadge
        box={editingGroupBox}
        onExit={() => setEditingGroupId(null)}
      />
    )}
    </div>
  );
}
