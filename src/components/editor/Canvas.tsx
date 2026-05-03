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
  useEditorStore,
} from "@/stores/editor-store";
import { CanvasElement } from "./CanvasElement";
import { SelectionHandles } from "./SelectionHandles";
import { useCanvasInteraction } from "@/hooks/use-canvas-interaction";
import { TextFormatToolbar } from "./TextFormatToolbar";
import { buildPath } from "./elements/ArrowElement";
import {
  resolveConnectorEndpoints,
  resolveConnectorWithMap,
} from "@/lib/connector-geometry";
import { resolvePathElementGeometry } from "@/lib/path-element-geometry";
import type {
  ArrowElement as ArrowElementType,
  EditorElement,
} from "@/types/editor";
import {
  GRID_SIZE,
  GRID_MAJOR,
  centeredPanForViewport,
} from "@/lib/constants";
import { DEFAULT_STROKE } from "@/lib/constants";
import {
  dimensionsForCustomImageElement,
  isUploadImageId,
  uuidFromUploadImageId,
} from "@/lib/user-images";
import { useCustomImagesStore } from "@/stores/custom-images-store";

/** Seamless infinite grid rendered via SVG `<pattern>`. Two nested patterns
 *  define minor lines (every GRID_SIZE) and major lines (every GRID_SIZE *
 *  GRID_MAJOR). A single large `<rect>` fills the whole coordinate space —
 *  the browser tiles the pattern natively so there are no per-line DOM nodes.
 *  `patternUnits="userSpaceOnUse"` keeps the grid pinned to canvas coords,
 *  so it scrolls and scales correctly with pan/zoom. */
function InfiniteGrid({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;
  const minor = GRID_SIZE;
  const major = GRID_SIZE * GRID_MAJOR;
  return (
    <g data-no-export opacity={opacity}>
      <defs>
        <pattern id="fg-minor" width={minor} height={minor} patternUnits="userSpaceOnUse">
          <path
            d={`M ${minor} 0 L 0 0 0 ${minor}`}
            fill="none"
            stroke="hsl(0 0% 91%)"
            strokeWidth={0.5}
          />
        </pattern>
        <pattern id="fg-major" width={major} height={major} patternUnits="userSpaceOnUse">
          <rect width={major} height={major} fill="url(#fg-minor)" />
          <path
            d={`M ${major} 0 L 0 0 0 ${major}`}
            fill="none"
            stroke="hsl(0 0% 84%)"
            strokeWidth={0.5}
          />
        </pattern>
      </defs>
      <rect x={-100000} y={-100000} width={200000} height={200000} fill="url(#fg-major)" />
    </g>
  );
}

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

const HIGHLIGHT = "hsl(221 83% 53%)";
const HIGHLIGHT_SHADOW = "drop-shadow(0 3px 8px hsl(221 83% 53% / 0.45))";
const HIGHLIGHT_STROKE = 1;

/** Connector-specific highlight. Subscribes to the connector's bound elements
 *  the SAME WAY ArrowElement does — same selector, same `resolveConnectorEndpoints`
 *  call signature — so the visible arrow and the highlight outline render
 *  from bit-identical resolved geometry. Any divergence between the two
 *  would mean a hovered/selected arrow whose blue glow drifts off the
 *  rendered arrow path, which is the bug we just hit. Treat this function
 *  and ArrowElementImpl as a matched pair: changes here must mirror over. */
const ConnectorHighlight = memo(function ConnectorHighlight({
  element,
}: {
  element: ArrowElementType;
}) {
  const startBound = useEditorStore((s) =>
    element.startConnectedTo
      ? elementById(s.elements, element.startConnectedTo) ?? null
      : null
  );
  const endBound = useEditorStore((s) =>
    element.endConnectedTo
      ? elementById(s.elements, element.endConnectedTo) ?? null
      : null
  );
  const resolved = resolveConnectorEndpoints(element, startBound, endBound);
  const d = buildPath(resolved as ArrowElementType);
  const offset = resolved.strokeWidth / 2 + HIGHLIGHT_STROKE / 2;
  return (
    <path
      data-no-export
      d={d}
      fill="none"
      stroke={HIGHLIGHT}
      strokeWidth={resolved.strokeWidth + offset * 2}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      opacity={0.35}
      pointerEvents="none"
      style={{ filter: HIGHLIGHT_SHADOW }}
    />
  );
});

/** Blue outline + drop-shadow overlay used for both hover and snap-target
 *  states. For line/arrow, defers to ConnectorHighlight (which resolves
 *  bindings); otherwise draws a rounded-rect outline inflated so it sits
 *  outside the element's own border (instead of overlapping it). */
const ElementHighlight = memo(function ElementHighlight({ element }: { element: EditorElement }) {
  if (element.type === "arrow") {
    return <ConnectorHighlight element={element as ArrowElementType} />;
  }

  const pad = element.strokeWidth / 2 + HIGHLIGHT_STROKE / 2;
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})`
    : undefined;

  if (element.type === "path") {
    const { viewBox, pathD, overlayD } = resolvePathElementGeometry(element);
    const pathStroke = element.strokeWidth + pad * 2;
    return (
      <g transform={rotateTransform}>
        <svg
          data-no-export
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          viewBox={viewBox}
          preserveAspectRatio="none"
          overflow="visible"
          opacity={0.35}
          pointerEvents="none"
          style={{ filter: HIGHLIGHT_SHADOW }}
        >
          <path
            d={pathD}
            fill="none"
            stroke={HIGHLIGHT}
            strokeWidth={pathStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {overlayD && (
            <path
              d={overlayD}
              fill="none"
              stroke={HIGHLIGHT}
              strokeWidth={pathStroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </g>
    );
  }

  // Inflate the overlay rect by half the element's stroke plus half the
  // highlight stroke so the highlight sits flush on the outside of the
  // element's border, not centered on it and with no visible gap.
  return (
    <rect
      data-no-export
      x={element.x - pad}
      y={element.y - pad}
      width={element.width + pad * 2}
      height={element.height + pad * 2}
      fill="none"
      stroke={HIGHLIGHT}
      strokeWidth={HIGHLIGHT_STROKE}
      pointerEvents="none"
      transform={rotateTransform}
      style={{ filter: HIGHLIGHT_SHADOW }}
    />
  );
});

/** Tight axis-aligned bbox of a set of elements (lines/arrows use both
 *  endpoints and any elbow corners). Connector endpoints are resolved
 *  through `elementsById` so a bound arrow's bbox tracks its target's
 *  current position, not the stale stored coords. Returns null for empty
 *  input. */
function groupBBox(
  members: EditorElement[],
  elementsById: Map<string, EditorElement>
): { x: number; y: number; w: number; h: number } | null {
  if (members.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of members) {
    if (el.type === "arrow") {
      const r = resolveConnectorWithMap(
        el as ArrowElementType,
        elementsById
      );
      const corners = (r as ArrowElementType).elbowCorners;
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x > maxX) maxX = r.x;
      if (r.y > maxY) maxY = r.y;
      if (r.x2 < minX) minX = r.x2;
      if (r.y2 < minY) minY = r.y2;
      if (r.x2 > maxX) maxX = r.x2;
      if (r.y2 > maxY) maxY = r.y2;
      if (corners) {
        for (const [cx, cy] of corners) {
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
  // Per-element subscriptions for the derived highlight/selection UI. Each
  // returns a stable ref when the relevant element hasn't changed, so the
  // Only track the id — element position changes on every drag frame, and
  // SelectionHandles owns its own subscription to the element data, so Canvas
  // doesn't need to re-render on every position update.
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
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
    const { panX, panY } = centeredPanForViewport(width, height, z);
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
  // skipping the CPU rasterize of ~3200 grid lines every frame.
  // `useLayoutEffect` runs pre-paint so the initial transform lands on
  // frame 1 (no flash).
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

  const editingGroupBox = useMemo(() => {
    if (editingGroupMembers.length === 0) return null;
    // Imperative read — we do NOT want Canvas subscribing to the full
    // elements array (would re-render on every drag frame). Pulling the
    // current snapshot here is fine because `editingGroupMembers` already
    // re-fires whenever any member's reference flips, which is the only
    // scenario that can move the bbox edges.
    const snap = useEditorStore.getState().elements;
    const byId = new Map<string, EditorElement>();
    for (const e of snap) byId.set(e.id, e);
    return groupBBox(editingGroupMembers, byId);
  }, [editingGroupMembers]);

  const { handlers } = useCanvasInteraction(svgRef);

  // Icons and Images use HTML5 drag-and-drop from their sidebar strips.
  const onDragOver = useCallback((e: React.DragEvent) => {
    const t = e.dataTransfer.types;
    if (
      t.includes("application/figurin-icon") ||
      t.includes("application/figurin-image")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      const iconId = e.dataTransfer.getData("application/figurin-icon");
      const imageIdPayloadRaw = e.dataTransfer.getData("application/figurin-image");

      const imageIdPayload =
        imageIdPayloadRaw && isUploadImageId(imageIdPayloadRaw)
          ? imageIdPayloadRaw
          : null;

      if (!iconId && !imageIdPayload) return;
      e.preventDefault();

      const state = useEditorStore.getState();
      const { panX, panY, zoom: z } = state.canvas;
      const rect = svg.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - panX) / z;
      const rawY = (e.clientY - rect.top - panY) / z;
      const snapSize = GRID_SIZE / 4;
      const snapX = Math.round(rawX / snapSize) * snapSize;
      const snapY = Math.round(rawY / snapSize) * snapSize;

      if (imageIdPayload) {
        const uuid = uuidFromUploadImageId(imageIdPayload);
        const entry = useCustomImagesStore.getState().getById(uuid);
        const { width: w, height: h } = dimensionsForCustomImageElement(
          entry?.width ?? null,
          entry?.height ?? null
        );
        const id = Math.random().toString(36).substring(2, 11);
        addElement({
          id,
          parentId: null,
          type: "image",
          x: snapX - w / 2,
          y: snapY - h / 2,
          width: w,
          height: h,
          rotation: 0,
          fill: "none",
          stroke: "none",
          strokeWidth: 0,
          opacity: 1,
          zIndex: state.elements.length,
          imageId: imageIdPayload,
        });
        selectElement(id);
        return;
      }

      if (!iconId) return;

      const idIcon = Math.random().toString(36).substring(2, 11);
      addElement({
        id: idIcon,
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
      selectElement(idIcon);
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
      id="figurin-canvas"
      className="h-full w-full cursor-crosshair select-none"
      style={{
        WebkitUserSelect: "none",
        visibility: centered ? "visible" : "hidden",
      }}
      {...handlers}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Neutral backdrop — almost white with a faint warm hint. */}
      <rect width="100%" height="100%" fill="hsl(220 20% 97%)" data-no-export />

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
        <InfiniteGrid opacity={gridOpacity} />

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

        {/* Selection handles — only when exactly one element is selected.
            SelectionHandles subscribes to its own element data so Canvas
            doesn't re-render on every drag-frame position update. */}
        {selectedElementId && multiSelected.length === 0 && (
          <SelectionHandles id={selectedElementId} />
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
