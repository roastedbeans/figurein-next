"use client";

import type { EditorElement, ArrowElement} from "@/types/editor";
import {
  getDefaultControlPoint,
  getElbowSegmentHandles,
  buildPath,
} from "@/components/editor/elements/ArrowElement";
import { elementById, useEditorStore } from "@/stores/editor-store";
import { resolveConnectorEndpoints } from "@/lib/connector-geometry";
import {
  getPathContentFractions,
  resolvePathElementGeometry,
} from "@/lib/path-element-geometry";

// Shared selection handle dimensions — applied to every element type so the
// corner circles and side pills look consistent across the editor.
const HIGHLIGHT = "hsl(221 83% 53%)";
const SHADOW_FILTER = "drop-shadow(0 3px 8px hsl(221 83% 53% / 0.45))";
// Stronger glow (same highlight blue) used when the current rotation lands
// on a 45° multiple. Signals the "locked on a clean angle" state via a
// brighter halo without shifting palette.
const SNAP_GLOW_FILTER = "drop-shadow(0 0 4px hsl(221 83% 53% / 0.95)) drop-shadow(0 0 10px hsl(221 83% 53% / 0.75))";
const OUTLINE_W = 1;
const NODE_R = 3;                      // corner/endpoint circle radius (diam 6)
const SIDE_SHORT = NODE_R * 2;         // pill short-axis matches circle diameter
const SIDE_LONG = SIDE_SHORT * 3;      // pill long-axis is 3× the circle
const SIDE_RX = SIDE_SHORT / 2;        // fully rounded pill ends
const ROTATE_R = 9;                    // rotation handle circle radius (large enough to hold the icon)
const ROTATE_OFFSET = 24;              // canvas-px gap between element edge and rotation handle
const ROTATE_ICON_SIZE = 12;           // edge length of the rotation icon inside the container

/** True when `deg` is (within float tolerance) a multiple of 45°. */
function isOn45(deg: number): boolean {
  const normalized = ((deg % 45) + 45) % 45;
  return normalized < 0.01 || normalized > 44.99;
}

/** Rotation handle — a circular container with a rotate-cw symbol inside.
 *  The outer circle is the hit target (data-handle="rotate"); the icon is
 *  inert (pointerEvents="none") so drags land on the container. */
function RotateHandle({ cx, cy, glow }: { cx: number; cy: number; glow: boolean }) {
  const half = ROTATE_ICON_SIZE / 2;
  return (
    <g>
      <circle
        data-handle="rotate"
        cx={cx}
        cy={cy}
        r={ROTATE_R}
        fill="transparent"
        stroke={HIGHLIGHT}
        strokeWidth={1.5}
        style={{ cursor: "grab", filter: glow ? SNAP_GLOW_FILTER : undefined }}
      />
      {/* Rotate-cw icon (lucide-style) scaled to fit inside the container. */}
      <svg
        x={cx - half}
        y={cy - half}
        width={ROTATE_ICON_SIZE}
        height={ROTATE_ICON_SIZE}
        viewBox="0 0 24 24"
        fill="none"
        stroke={HIGHLIGHT}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </g>
  );
}

type HandlePosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top"
  | "bottom"
  | "left"
  | "right";

// Each handle's resize-axis angle (degrees, measured from +x, mod 180 since the
// cursor is bidirectional). Used to pick the right CSS cursor once the
// element's rotation is added in.
const handleAxisAngle: Record<HandlePosition, number> = {
  right: 0,
  left: 0,
  "top-left": 45,
  "bottom-right": 45,
  top: 90,
  bottom: 90,
  "top-right": 135,
  "bottom-left": 135,
};

/** Pick the axis-aligned resize cursor whose orientation is nearest to the
 *  given angle. Angles snap to the closest 45° since browsers only ship four
 *  bidirectional resize cursors. */
function cursorForHandle(pos: HandlePosition, rotationDeg: number): string {
  const axis = ((handleAxisAngle[pos] + rotationDeg) % 180 + 180) % 180;
  const bucket = Math.round(axis / 45) % 4;
  switch (bucket) {
    case 0: return "ew-resize";
    case 1: return "nwse-resize";
    case 2: return "ns-resize";
    case 3: return "nesw-resize";
    default: return "ew-resize";
  }
}

export function SelectionHandles({ id }: { id: string }) {
  // Subscribe directly to the selected element so Canvas doesn't need to
  // re-render on every drag frame — only this component tracks position changes.
  const element = useEditorStore((s) => elementById(s.elements, id) ?? null);
  const rotatingElementId = useEditorStore((s) => s.rotatingElementId);

  // Subscribe to connector targets up-front (hooks must run every render
  // regardless of whether `element` resolved). For non-connectors / missing
  // elements the ids are undefined and these reduce to null subscriptions
  // that never fire. For connectors, this is what makes endpoint handles
  // track a moving / resizing target without the connector itself being
  // touched.
  const isLine = element?.type === "arrow";
  const connectorStartId =
    isLine ? (element as ArrowElement).startConnectedTo : undefined;
  const connectorEndId =
    isLine ? (element as ArrowElement).endConnectedTo : undefined;
  const startBound = useEditorStore((s) =>
    connectorStartId ? elementById(s.elements, connectorStartId) ?? null : null
  );
  const endBound = useEditorStore((s) =>
    connectorEndId ? elementById(s.elements, connectorEndId) ?? null : null
  );

  if (!element) return null;

  const isRotatingThis = rotatingElementId === element.id;

  if (isLine) {
    // Resolve endpoints through the bound elements so the handles, outline,
    // and rotation pivot all sit on the connector's CURRENT visible geometry,
    // even when the targets have been moved / resized since the connector was
    // last edited.
    const connector = resolveConnectorEndpoints(
      element as ArrowElement,
      startBound,
      endBound
    );
    const el = connector as EditorElement & { x2: number; y2: number };
    const lineStyle = connector.lineStyle || "straight";

    // Curved: single draggable control point with guide lines
    let controlPointHandle: React.ReactNode = null;
    if (lineStyle === "curved") {
      const defaultCp = getDefaultControlPoint(el.x, el.y, el.x2, el.y2);
      const cx = connector.cx ?? defaultCp.cx;
      const cy = connector.cy ?? defaultCp.cy;
      controlPointHandle = (
        <>
          <line x1={el.x} y1={el.y} x2={cx} y2={cy}
            stroke="hsl(221 83% 53% / 40%)" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
          <line x1={el.x2} y1={el.y2} x2={cx} y2={cy}
            stroke="hsl(221 83% 53% / 40%)" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
          <circle data-handle="control" cx={cx} cy={cy}
            r={NODE_R} fill="white" stroke={HIGHLIGHT} strokeWidth={1.5} className="cursor-grab" />
        </>
      );
    }

    // Elbow: per-segment pill handles oriented parallel to each segment so
    // they match the rect-selection side pills.
    let elbowHandles: React.ReactNode = null;
    if (lineStyle === "elbow") {
      const segHandles = getElbowSegmentHandles(connector as ArrowElement);
      elbowHandles = (
        <>
          {segHandles.map((h, i) => {
            const w = h.isHorizontal ? SIDE_LONG : SIDE_SHORT;
            const hgt = h.isHorizontal ? SIDE_SHORT : SIDE_LONG;
            return (
              <rect
                key={i}
                data-handle={`elbow-${h.segIdx}`}
                x={h.x - w / 2}
                y={h.y - hgt / 2}
                width={w}
                height={hgt}
                rx={SIDE_RX}
                ry={SIDE_RX}
                fill="white"
                stroke={HIGHLIGHT}
                strokeWidth={1.5}
                style={{ cursor: h.cursor }}
              />
            );
          })}
        </>
      );
    }

    // Build the selection outline path matching the actual shape
    const selectionPath = lineStyle !== "straight"
      ? buildPath(connector as ArrowElement)
      : `M ${el.x} ${el.y} L ${el.x2} ${el.y2}`;

    // Rotation handle: perpendicular offset from the midpoint. Choose the
    // "upper" side (lower y) so the handle doesn't sit under the line for
    // near-horizontal connectors. For zero-length connectors, fall back to
    // directly above the midpoint.
    const midX = (el.x + el.x2) / 2;
    const midY = (el.y + el.y2) / 2;
    const ldx = el.x2 - el.x;
    const ldy = el.y2 - el.y;
    const llen = Math.hypot(ldx, ldy) || 1;
    // Perpendicular unit vector — pick the one pointing toward lower y.
    let perpX = -ldy / llen;
    let perpY = ldx / llen;
    if (perpY > 0) { perpX = -perpX; perpY = -perpY; }
    const rotX = midX + perpX * ROTATE_OFFSET;
    const rotY = midY + perpY * ROTATE_OFFSET;

    // A line's "rotation" is the angle of its baseline. If that angle is a
    // 45° multiple, light up the rotation handle with a glow — the visual
    // signal that the connector sits on a clean axis.
    const lineAngleDeg = (Math.atan2(ldy, ldx) * 180) / Math.PI;
    const onSnap = isRotatingThis && isOn45(lineAngleDeg);

    return (
      <g data-selection-handles={id}>
      <g data-no-export>
        <path
          d={selectionPath}
          stroke="hsl(221 83% 53%)"
          strokeWidth={1}
          fill="none"
          pointerEvents="none"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <circle
          data-handle="start"
          cx={el.x}
          cy={el.y}
          r={NODE_R}
          fill="white"
          stroke={HIGHLIGHT}
          strokeWidth={1.5}
          className="cursor-move"
        />
        <circle
          data-handle="end"
          cx={el.x2}
          cy={el.y2}
          r={NODE_R}
          fill="white"
          stroke={HIGHLIGHT}
          strokeWidth={1.5}
          className="cursor-move"
        />
        {controlPointHandle}
        {elbowHandles}
        {/* Rotation handle — drag to rotate endpoints around the midpoint.
            Free rotation, but angles semi-snap when within a few degrees of
            a 45° multiple; the handle glows when we're on one. Only shown
            for straight connectors: elbow routing would twist off its
            orthogonal axes, and curved connectors already expose a control
            point whose placement defines the shape — a second angle handle
            would fight that control. Users can still change the angle on
            either style by dragging an endpoint. */}
        {lineStyle === "straight" && <RotateHandle cx={rotX} cy={rotY} glow={onSnap} />}
      </g>
      </g>
    );
  }

  const { x, y, width, height } = element;
  const isPath = element.type === "path";
  const pathFr = isPath ? getPathContentFractions(element) : null;
  const hx = pathFr ? x + pathFr.frx * width : x;
  const hy = pathFr ? y + pathFr.fry * height : y;
  const hw = pathFr ? pathFr.frw * width : width;
  const hh = pathFr ? pathFr.frh * height : height;
  const pathGeom = isPath ? resolvePathElementGeometry(element) : null;

  // Sit the outline flush on the outside of the element's own border.
  const pad = element.strokeWidth / 2 + OUTLINE_W / 2;
  const pathSelStroke = Math.max(OUTLINE_W * 2, element.strokeWidth + OUTLINE_W);

  const corners: { pos: HandlePosition; cx: number; cy: number }[] = [
    { pos: "top-left", cx: hx - pad, cy: hy - pad },
    { pos: "top-right", cx: hx + hw + pad, cy: hy - pad },
    { pos: "bottom-right", cx: hx + hw + pad, cy: hy + hh + pad },
    { pos: "bottom-left", cx: hx - pad, cy: hy + hh + pad },
  ];

  // Side handles — rounded rectangles oriented parallel to the edge.
  const sides: {
    pos: HandlePosition;
    cx: number;
    cy: number;
    horizontal: boolean;
  }[] = [
    { pos: "top", cx: hx + hw / 2, cy: hy - pad, horizontal: true },
    { pos: "bottom", cx: hx + hw / 2, cy: hy + hh + pad, horizontal: true },
    { pos: "left", cx: hx - pad, cy: hy + hh / 2, horizontal: false },
    { pos: "right", cx: hx + hw + pad, cy: hy + hh / 2, horizontal: false },
  ];

  // Rotation pivot (element center). When the element is rotated, wrap the
  // whole handle group in a rotate transform so the selection outline and
  // handles visually track the rotation. The underlying x/y/width/height
  // values stay axis-aligned — only the rendering rotates.
  const pivotX = x + width / 2;
  const pivotY = y + height / 2;
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation} ${pivotX} ${pivotY})`
    : undefined;

  // Rotation handle sits above the top-center of the content box.
  const rotHandleX = hx + hw / 2;
  const rotHandleY = hy - pad - ROTATE_OFFSET;

  // When the element's rotation lands on a 45° multiple, light up the
  // rotation handle with an amber glow — a visual confirmation that the
  // semi-snap has locked onto a clean angle.
  const onSnap = isRotatingThis && isOn45(element.rotation || 0);

  return (
    <g data-selection-handles={id}>
    <g data-no-export transform={rotateTransform}>
      {isPath && pathGeom ? (
        <svg
          x={x}
          y={y}
          width={width}
          height={height}
          viewBox={pathGeom.viewBox}
          preserveAspectRatio="none"
          overflow="visible"
          pointerEvents="none"
          style={{ filter: SHADOW_FILTER }}
        >
          <path
            d={pathGeom.pathD}
            fill="none"
            stroke={HIGHLIGHT}
            strokeWidth={pathSelStroke}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {pathGeom.overlayD && (
            <path
              d={pathGeom.overlayD}
              fill="none"
              stroke={HIGHLIGHT}
              strokeWidth={pathSelStroke}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      ) : (
        <rect
          x={x - pad}
          y={y - pad}
          width={width + pad * 2}
          height={height + pad * 2}
          fill="none"
          stroke={HIGHLIGHT}
          strokeWidth={OUTLINE_W}
          pointerEvents="none"
          style={{ filter: SHADOW_FILTER }}
        />
      )}
      {/* Corner handles — circles */}
      {corners.map((h) => (
        <circle
          key={h.pos}
          data-handle={h.pos}
          cx={h.cx}
          cy={h.cy}
          r={NODE_R}
          fill="white"
          stroke={HIGHLIGHT}
          strokeWidth={1.5}
          style={{ cursor: cursorForHandle(h.pos, element.rotation || 0) }}
        />
      ))}
      {/* Side handles — rounded rectangles, 3× circle diameter, parallel to
          the edge they sit on. */}
      {sides.map((h) => {
        const w = h.horizontal ? SIDE_LONG : SIDE_SHORT;
        const hgt = h.horizontal ? SIDE_SHORT : SIDE_LONG;
        return (
          <rect
            key={h.pos}
            data-handle={h.pos}
            x={h.cx - w / 2}
            y={h.cy - hgt / 2}
            width={w}
            height={hgt}
            rx={SIDE_RX}
            ry={SIDE_RX}
            fill="white"
            stroke={HIGHLIGHT}
            strokeWidth={1.5}
            style={{ cursor: cursorForHandle(h.pos, element.rotation || 0) }}
          />
        );
      })}
      {/* Rotation handle — drag to rotate the element around its center.
          Free rotation; semi-snaps within a few degrees of a 45° multiple
          and glows amber whenever the current angle is on one. */}
      <RotateHandle cx={rotHandleX} cy={rotHandleY} glow={onSnap} />
    </g>
    </g>
  );
}
