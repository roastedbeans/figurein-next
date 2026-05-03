import { memo } from "react";
import type { ArrowElement as ArrowElementType, EdgeDir } from "@/types/editor";
import { GRID_SIZE } from "@/lib/constants";
import { strokeDashArray, strokeLineCap } from "@/lib/stroke";
import { elementById, useEditorStore } from "@/stores/editor-store";
import { resolveConnectorEndpoints } from "@/lib/connector-geometry";

/** Half-angle (from centerline to side edge) of each arrowhead style. Used
 *  both to draw the arrowhead and to compute the trim distance so the line
 *  ends exactly at the arrowhead's base, not past it. */
const HEAD_HALF_ANGLE = Math.PI / 7;      // triangle — ~25.7°
const OPEN_HEAD_HALF_ANGLE = Math.PI / 6; // open — 30°

/** Perpendicular distance from tip to base edge of an arrowhead of the given
 *  `size` and half-angle. The line is trimmed by this amount so it meets the
 *  arrowhead base flush. */
function headBaseTrim(style: "triangle" | "open" | "none", size: number): number {
  if (style === "none") return 0;
  const half = style === "open" ? OPEN_HEAD_HALF_ANGLE : HEAD_HALF_ANGLE;
  return size * Math.cos(half);
}

/** Compute the default bezier control point (perpendicular offset at midpoint) */
export function getDefaultControlPoint(
  x: number, y: number, x2: number, y2: number
): { cx: number; cy: number } {
  const mx = (x + x2) / 2;
  const my = (y + y2) / 2;
  const dx = x2 - x;
  const dy = y2 - y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { cx: mx, cy: my };
  const offset = len * 0.25;
  const nx = -dy / len;
  const ny = dx / len;
  return { cx: mx + nx * offset, cy: my + ny * offset };
}

export type ElbowSegmentHandle = {
  x: number;
  y: number;
  cursor: "ns-resize" | "ew-resize";
  /** Segment index in the full points array [start, ...corners, end] */
  segIdx: number;
  isHorizontal: boolean;
};

/** Compute default elbow corners by picking the SHORTEST orthogonal path
 *  that respects startDir/endDir (if given). Tries 0, 1, 2-corner candidates
 *  in order; falls back to a 3/4-corner detour only when geometry forces it. */
export function getDefaultElbowCorners(
  x: number, y: number, x2: number, y2: number,
  startDir?: EdgeDir, endDir?: EdgeDir
): [number, number][] {
  const gap = GRID_SIZE * 2;
  const dx = x2 - x;
  const dy = y2 - y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Build candidates shortest-first. The first one that passes direction
  // checks is returned. We prefer paths whose "primary" axis matches the
  // longer geometric delta, so the visible kink lands near the smaller side.
  const candidates: [number, number][][] = [];

  // 0 corners — straight line (only valid when aligned on one axis)
  candidates.push([]);

  // 1 corner L-shapes: one H segment + one V segment
  if (absDx >= absDy) {
    candidates.push([[x2, y]]); // H then V
    candidates.push([[x, y2]]); // V then H
  } else {
    candidates.push([[x, y2]]); // V then H
    candidates.push([[x2, y]]); // H then V
  }

  // 2 corner Z-shapes: split on the perpendicular axis at the midpoint
  const midX = (x + x2) / 2;
  const midY = (y + y2) / 2;
  if (absDx >= absDy) {
    candidates.push([[midX, y], [midX, y2]]);
    candidates.push([[x, midY], [x2, midY]]);
  } else {
    candidates.push([[x, midY], [x2, midY]]);
    candidates.push([[midX, y], [midX, y2]]);
  }

  // 2 corner C/U-shapes: crossbar past both endpoints (for same-direction exits)
  const crossXMax = Math.max(x, x2) + gap;
  const crossXMin = Math.min(x, x2) - gap;
  const crossYMax = Math.max(y, y2) + gap;
  const crossYMin = Math.min(y, y2) - gap;
  candidates.push([[crossXMax, y], [crossXMax, y2]]);
  candidates.push([[crossXMin, y], [crossXMin, y2]]);
  candidates.push([[x, crossYMax], [x2, crossYMax]]);
  candidates.push([[x, crossYMin], [x2, crossYMin]]);

  for (const cand of candidates) {
    if (isValidOrthogonalPath(x, y, x2, y2, cand, startDir, endDir)) {
      return cand;
    }
  }

  // Forced detour: directions constrain us into a loop-around path.
  if (startDir && endDir) {
    const sVert = startDir === "up" || startDir === "down";
    const eVert = endDir === "up" || endDir === "down";
    const sOff = dirToOffset(startDir, gap);
    const eOff = dirToOffset(endDir, gap);
    const sxStub = x + sOff.dx, syStub = y + sOff.dy;
    const exStub = x2 + eOff.dx, eyStub = y2 + eOff.dy;

    if (sVert && eVert) {
      // 4-corner S through two horizontal segments at syStub/eyStub
      let midBarX = (sxStub + exStub) / 2;
      if (Math.abs(sxStub - exStub) < 1) midBarX = sxStub + gap;
      return [[x, syStub], [midBarX, syStub], [midBarX, eyStub], [x2, eyStub]];
    }
    if (!sVert && !eVert) {
      // 4-corner S through a vertical segment at midY
      let midBarY = (syStub + eyStub) / 2;
      if (Math.abs(syStub - eyStub) < 1) midBarY = syStub + gap;
      return [[sxStub, y], [sxStub, midBarY], [exStub, midBarY], [exStub, y2]];
    }
    if (sVert) {
      // 3-corner jog from vertical stub to horizontal stub
      return [[x, syStub], [exStub, syStub], [exStub, y2]];
    }
    return [[sxStub, y], [sxStub, eyStub], [x2, eyStub]];
  }

  // No directions + nothing matched (shouldn't happen since candidates[1] always matches)
  return [[midX, y], [midX, y2]];
}

/** A segment from (ax,ay)→(bx,by) travels in direction `dir` iff it is strictly
 *  axis-aligned, non-zero, and its sign matches. */
function segmentMatchesDir(
  ax: number, ay: number, bx: number, by: number, dir: EdgeDir
): boolean {
  const dSegX = bx - ax;
  const dSegY = by - ay;
  switch (dir) {
    case "right": return Math.abs(dSegY) < 0.5 && dSegX > 0.5;
    case "left":  return Math.abs(dSegY) < 0.5 && dSegX < -0.5;
    case "down":  return Math.abs(dSegX) < 0.5 && dSegY > 0.5;
    case "up":    return Math.abs(dSegX) < 0.5 && dSegY < -0.5;
  }
}

function oppositeDir(dir: EdgeDir): EdgeDir {
  return dir === "up" ? "down" : dir === "down" ? "up" : dir === "left" ? "right" : "left";
}

/** Every segment must be strictly H or V (no diagonals, no zero-length), and
 *  the first/last segment directions must match the given constraints. */
function isValidOrthogonalPath(
  sx: number, sy: number,
  ex: number, ey: number,
  corners: [number, number][],
  startDir?: EdgeDir,
  endDir?: EdgeDir
): boolean {
  const pts: [number, number][] = [[sx, sy], ...corners, [ex, ey]];
  if (pts.length < 2) return false;

  for (let i = 1; i < pts.length; i++) {
    const dSegX = pts[i][0] - pts[i - 1][0];
    const dSegY = pts[i][1] - pts[i - 1][1];
    const isH = Math.abs(dSegY) < 0.5;
    const isV = Math.abs(dSegX) < 0.5;
    if (!isH && !isV) return false;   // diagonal
    if (isH && isV) return false;     // zero-length
  }

  if (startDir && !segmentMatchesDir(pts[0][0], pts[0][1], pts[1][0], pts[1][1], startDir)) {
    return false;
  }
  if (endDir) {
    const last = pts.length - 1;
    if (!segmentMatchesDir(pts[last - 1][0], pts[last - 1][1], pts[last][0], pts[last][1], oppositeDir(endDir))) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Direction helpers
// ---------------------------------------------------------------------------

function dirToOffset(dir: EdgeDir, distance: number): { dx: number; dy: number } {
  switch (dir) {
    case "up": return { dx: 0, dy: -distance };
    case "down": return { dx: 0, dy: distance };
    case "left": return { dx: -distance, dy: 0 };
    case "right": return { dx: distance, dy: 0 };
  }
}

/** Deduplicate consecutive identical points and remove collinear middle points */
export function cleanOrthogonalPath(pts: [number, number][]): [number, number][] {
  // Deduplicate consecutive identical points
  const cleaned: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    if (Math.abs(pts[i][0] - prev[0]) > 0.5 || Math.abs(pts[i][1] - prev[1]) > 0.5) {
      cleaned.push(pts[i]);
    }
  }
  // Remove collinear middle points (same x or same y as both neighbors)
  const final: [number, number][] = [cleaned[0]];
  for (let i = 1; i < cleaned.length - 1; i++) {
    const prev = final[final.length - 1];
    const curr = cleaned[i];
    const next = cleaned[i + 1];
    const sameX = Math.abs(prev[0] - curr[0]) < 0.5 && Math.abs(curr[0] - next[0]) < 0.5;
    const sameY = Math.abs(prev[1] - curr[1]) < 0.5 && Math.abs(curr[1] - next[1]) < 0.5;
    if (!sameX && !sameY) {
      final.push(curr);
    }
  }
  final.push(cleaned[cleaned.length - 1]);
  return final;
}

// ---------------------------------------------------------------------------
// Path builder
// ---------------------------------------------------------------------------

export function buildPath(element: ArrowElementType): string {
  const { x, y, x2, y2 } = element;
  const style = element.lineStyle || "straight";

  // Straight — always a direct line, edge dirs ignored
  if (style === "straight") {
    return `M ${x} ${y} L ${x2} ${y2}`;
  }

  // Curved — always a quadratic bezier, edge dirs ignored
  if (style === "curved") {
    const defaultCp = getDefaultControlPoint(x, y, x2, y2);
    const cx = element.cx ?? defaultCp.cx;
    const cy = element.cy ?? defaultCp.cy;
    return `M ${x} ${y} Q ${cx} ${cy} ${x2} ${y2}`;
  }

  // Elbow — route through corners with orthogonal segments
  const corners = element.elbowCorners ??
    getDefaultElbowCorners(x, y, x2, y2, element.startDir, element.endDir);
  const allPoints: [number, number][] = [[x, y], ...corners, [x2, y2]];
  const cleaned = cleanOrthogonalPath(allPoints);
  return cleaned.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
}

// ---------------------------------------------------------------------------
// Arrowhead geometry
// ---------------------------------------------------------------------------

/** Get angle (in radians) of the path at the end (head) and start (tail).
 *  For elbow arrows, pass `prebuiltPath` (the result of `buildPath(element)`)
 *  to skip re-running the elbow routing + `cleanOrthogonalPath` work — that
 *  computation is measurable on drag-heavy flows where multiple connected
 *  arrows re-render per frame. */
function getEndAngle(element: ArrowElementType, prebuiltPath?: string): number {
  const { x, y, x2, y2 } = element;
  const style = element.lineStyle || "straight";

  if (style === "curved") {
    const defaultCp = getDefaultControlPoint(x, y, x2, y2);
    const cx = element.cx ?? defaultCp.cx;
    const cy = element.cy ?? defaultCp.cy;
    return Math.atan2(y2 - cy, x2 - cx);
  }

  if (style === "elbow") {
    const d = prebuiltPath ?? buildPath(element);
    const segs = d.split(/[ML]\s*/).filter(Boolean).map(s => {
      const [px, py] = s.trim().split(/\s+/).map(Number);
      return { x: px, y: py };
    });
    if (segs.length >= 2) {
      const last = segs[segs.length - 1];
      const prev = segs[segs.length - 2];
      return Math.atan2(last.y - prev.y, last.x - prev.x);
    }
  }

  return Math.atan2(y2 - y, x2 - x);
}

function getStartAngle(element: ArrowElementType, prebuiltPath?: string): number {
  const { x, y, x2, y2 } = element;
  const style = element.lineStyle || "straight";

  if (style === "curved") {
    const defaultCp = getDefaultControlPoint(x, y, x2, y2);
    const cx = element.cx ?? defaultCp.cx;
    const cy = element.cy ?? defaultCp.cy;
    return Math.atan2(y - cy, x - cx);
  }

  if (style === "elbow") {
    const d = prebuiltPath ?? buildPath(element);
    const segs = d.split(/[ML]\s*/).filter(Boolean).map(s => {
      const [px, py] = s.trim().split(/\s+/).map(Number);
      return { x: px, y: py };
    });
    if (segs.length >= 2) {
      return Math.atan2(segs[0].y - segs[1].y, segs[0].x - segs[1].x);
    }
  }

  return Math.atan2(y - y2, x - x2);
}

/** Triangle arrowhead points as an SVG polygon string */
function arrowheadPoints(
  tipX: number, tipY: number, angle: number, size: number
): string {
  const halfAngle = HEAD_HALF_ANGLE;
  const p1x = tipX - size * Math.cos(angle - halfAngle);
  const p1y = tipY - size * Math.sin(angle - halfAngle);
  const p2x = tipX - size * Math.cos(angle + halfAngle);
  const p2y = tipY - size * Math.sin(angle + halfAngle);
  return `${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}`;
}

/** Open arrowhead as polyline points */
function openArrowheadPath(
  tipX: number, tipY: number, angle: number, size: number
): string {
  const halfAngle = OPEN_HEAD_HALF_ANGLE;
  const p1x = tipX - size * Math.cos(angle - halfAngle);
  const p1y = tipY - size * Math.sin(angle - halfAngle);
  const p2x = tipX - size * Math.cos(angle + halfAngle);
  const p2y = tipY - size * Math.sin(angle + halfAngle);
  return `M ${p1x} ${p1y} L ${tipX} ${tipY} L ${p2x} ${p2y}`;
}

// ---------------------------------------------------------------------------
// Path trimming — shorten the line so it stops at the arrowhead base
// ---------------------------------------------------------------------------

/** Parse an SVG path "M x y L x y L x y ..." into point array */
export function parsePathPoints(d: string): [number, number][] {
  return d.split(/[MLQ]\s*/).filter(Boolean).map(s => {
    const nums = s.trim().split(/[\s,]+/).map(Number);
    // For Q commands there are 4 numbers (cx cy x y) — take the last pair
    return [nums[nums.length - 2], nums[nums.length - 1]] as [number, number];
  });
}

/** Shorten a point along a direction by `dist` pixels */
function pullBack(
  tipX: number, tipY: number, angle: number, dist: number
): [number, number] {
  return [tipX - dist * Math.cos(angle), tipY - dist * Math.sin(angle)];
}

/** Build the visible line path, trimmed to stop exactly at arrowhead bases
 *  (so the line meets the head flush with no visible gap). Pass `prebuiltPath`
 *  (result of `buildPath(element)`) to skip re-running the elbow routing +
 *  `cleanOrthogonalPath` work — the caller typically already needs the full
 *  path for the hit area, so threading it through saves a full recompute
 *  per render on every elbow arrow. */
function buildTrimmedPath(
  element: ArrowElementType,
  headSize: number,
  prebuiltPath?: string
): string {
  const headTrim = headBaseTrim(element.headStyle, headSize);
  const tailTrim = headBaseTrim(element.tailStyle, headSize);
  const style = element.lineStyle || "straight";

  // For curved paths, we can't easily trim the quadratic — use a simpler approach:
  // render the full path but trim by adjusting the endpoint
  if (style === "curved") {
    const { x, y, x2, y2 } = element;
    const defaultCp = getDefaultControlPoint(x, y, x2, y2);
    const cx = element.cx ?? defaultCp.cx;
    const cy = element.cy ?? defaultCp.cy;

    let sx = x, sy = y;
    let ex = x2, ey = y2;

    if (tailTrim > 0) {
      const startAngle = Math.atan2(cy - y, cx - x);
      [sx, sy] = pullBack(x, y, startAngle, -tailTrim);
    }
    if (headTrim > 0) {
      const endAngle = Math.atan2(y2 - cy, x2 - cx);
      [ex, ey] = pullBack(x2, y2, endAngle, headTrim);
    }
    return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
  }

  // For straight and multi-segment paths, trim the first/last segment
  const fullPath = prebuiltPath ?? buildPath(element);
  const pts = parsePathPoints(fullPath);
  if (pts.length < 2) return fullPath;

  // Trim end (head)
  if (headTrim > 0 && pts.length >= 2) {
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
    pts[pts.length - 1] = pullBack(last[0], last[1], angle, headTrim);
  }

  // Trim start (tail)
  if (tailTrim > 0 && pts.length >= 2) {
    const first = pts[0];
    const next = pts[1];
    const angle = Math.atan2(first[1] - next[1], first[0] - next[0]);
    pts[0] = pullBack(first[0], first[1], angle, tailTrim);
  }

  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
}

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

// ---------------------------------------------------------------------------
// Elbow segment handles — per-segment draggable midpoints
// ---------------------------------------------------------------------------

/** Compute draggable per-segment handles for an elbow arrow.
 *  Places a handle at the midpoint of every segment (including first/last).
 *  Dragging boundary segments (adjacent to start/end) creates new corners. */
export function getElbowSegmentHandles(element: ArrowElementType): ElbowSegmentHandle[] {
  if ((element.lineStyle || "straight") !== "elbow") return [];

  const { x, y, x2, y2 } = element;
  const corners = element.elbowCorners ??
    getDefaultElbowCorners(x, y, x2, y2, element.startDir, element.endDir);

  const allPoints: [number, number][] = [[x, y], ...corners, [x2, y2]];
  const handles: ElbowSegmentHandle[] = [];
  const tol = 2;

  for (let i = 0; i < allPoints.length - 1; i++) {
    const [sx, sy] = allPoints[i];
    const [ex, ey] = allPoints[i + 1];
    const segLen = Math.abs(ex - sx) + Math.abs(ey - sy);
    if (segLen < 4) continue;

    const isHoriz = Math.abs(ey - sy) < tol;

    handles.push({
      x: (sx + ex) / 2,
      y: (sy + ey) / 2,
      cursor: isHoriz ? "ns-resize" : "ew-resize",
      segIdx: i,
      isHorizontal: isHoriz,
    });
  }

  return handles;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

function ArrowElementImpl({ element, dataId }: { element: ArrowElementType; dataId?: string }) {
  // Subscribe to the bound elements so a resize / move of the connector's
  // target re-renders us. `elementById` returns a stable reference when the
  // element hasn't changed, so an unrelated mutation on the store doesn't
  // cause this component to re-render.
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

  const updateElement = useEditorStore((s) => s.updateElement);
  const editingConnectorId = useEditorStore((s) => s.editingConnectorId);
  const setEditingConnectorId = useEditorStore((s) => s.setEditingConnectorId);
  const isEditing = editingConnectorId === element.id;

  const fullPath = buildPath(resolved);
  const headSize = Math.max(resolved.strokeWidth * 4, 8);
  const trimmedPath = buildTrimmedPath(resolved, headSize, fullPath);
  const labelPositions = computeLabelPositions(resolved, fullPath);

  // Compute arrowhead at end
  let headNode: React.ReactNode = null;
  if (resolved.headStyle === "triangle") {
    const angle = getEndAngle(resolved, fullPath);
    headNode = (
      <polygon
        points={arrowheadPoints(resolved.x2, resolved.y2, angle, headSize)}
        fill={resolved.stroke}
        stroke="none"
        opacity={resolved.opacity}
        pointerEvents="none"
      />
    );
  } else if (resolved.headStyle === "open") {
    const angle = getEndAngle(resolved, fullPath);
    headNode = (
      <path
        d={openArrowheadPath(resolved.x2, resolved.y2, angle, headSize)}
        fill="none"
        stroke={resolved.stroke}
        strokeWidth={resolved.strokeWidth}
        opacity={resolved.opacity}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        pointerEvents="none"
      />
    );
  }

  // Compute arrowhead at start (tail)
  let tailNode: React.ReactNode = null;
  if (resolved.tailStyle === "triangle") {
    const angle = getStartAngle(resolved, fullPath);
    tailNode = (
      <polygon
        points={arrowheadPoints(resolved.x, resolved.y, angle, headSize)}
        fill={resolved.stroke}
        stroke="none"
        opacity={resolved.opacity}
        pointerEvents="none"
      />
    );
  } else if (resolved.tailStyle === "open") {
    const angle = getStartAngle(resolved, fullPath);
    tailNode = (
      <path
        d={openArrowheadPath(resolved.x, resolved.y, angle, headSize)}
        fill="none"
        stroke={resolved.stroke}
        strokeWidth={resolved.strokeWidth}
        opacity={resolved.opacity}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        pointerEvents="none"
      />
    );
  }

  return (
    <g data-element-id={dataId ?? element.id} className="cursor-move">
      {/* Wide transparent hit area — uses full path for easy clicking */}
      <path
        d={fullPath}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(resolved.strokeWidth, 2) + 12}
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      {/* Visible path — trimmed so line stops at arrowhead base */}
      <path
        d={trimmedPath}
        fill="none"
        stroke={resolved.stroke}
        strokeWidth={resolved.strokeWidth}
        strokeDasharray={strokeDashArray(resolved.strokeStyle, resolved.strokeWidth)}
        opacity={resolved.opacity}
        strokeLinecap={strokeLineCap(resolved.strokeStyle)}
        strokeLinejoin="miter"
        pointerEvents="none"
      />
      {headNode}
      {tailNode}
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
    </g>
  );
}

// Default shallow-equal memoization: the store replaces `element` immutably
// on every mutation, so === on `element` short-circuits untouched arrows.
// `dataId` is only used by LineElement (stable string) — shallow-equal works.
export const ArrowElement = memo(ArrowElementImpl);
