import type { PathElement as PathElementType } from "@/types/editor";
import { SHAPES_BY_ID } from "@/lib/shape-stencils";
import {
  measurePathBBox,
  pathBounds,
  type PathBounds,
} from "@/lib/path-bounds";

const boundsCache = new Map<string, PathBounds | null>();
function tightBounds(d: string): PathBounds | null {
  const cached = boundsCache.get(d);
  if (cached !== undefined) return cached;
  const exact = measurePathBBox(d);
  const b = exact ?? pathBounds(d);
  boundsCache.set(d, b);
  return b;
}

function unionBounds(a: PathBounds, b: PathBounds): PathBounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const r = Math.max(a.x + a.w, b.x + b.w);
  const bt = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: r - x, h: bt - y };
}

/** Main + optional overlay paths, same as `PathElement` / drag ghost. */
export function resolvePathElementGeometry(element: PathElementType): {
  viewBox: string;
  pathD: string;
  overlayD?: string;
} {
  const shapeDef = element.shapeId ? SHAPES_BY_ID[element.shapeId] : undefined;
  const generator = shapeDef?.pathGenerator;
  const pathD = generator
    ? generator(element.width, element.height)
    : element.pathData;
  const overlayD = generator
    ? shapeDef?.detailPathGenerator?.(element.width, element.height)
    : shapeDef?.detailPath;

  let viewBox: string;
  if (generator) {
    viewBox = `0 0 ${element.width} ${element.height}`;
  } else {
    const raw = element.viewBox?.trim();
    const parts = raw?.split(/[\s,]+/).map(Number.parseFloat);
    const vbOk =
      parts?.length === 4 &&
      parts.every((x) => !Number.isNaN(x)) &&
      (parts[2] as number) > 0 &&
      (parts[3] as number) > 0;
    if (vbOk) {
      viewBox = raw!;
    } else {
      const b = tightBounds(pathD);
      viewBox =
        b && b.w > 0 && b.h > 0
          ? `${b.x} ${b.y} ${b.w} ${b.h}`
          : "0 0 100 100";
    }
  }

  return { viewBox, pathD, overlayD };
}

function parseViewBox(viewBox: string): {
  minX: number;
  minY: number;
  vbW: number;
  vbH: number;
} | null {
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number.parseFloat);
  if (
    parts.length !== 4 ||
    parts.some(Number.isNaN) ||
    parts[2] <= 0 ||
    parts[3] <= 0
  ) {
    return null;
  }
  return {
    minX: parts[0],
    minY: parts[1],
    vbW: parts[2],
    vbH: parts[3],
  };
}

/**
 * Where the visible path sits inside the element box (canvas-space, unrotated),
 * as fractions of element.width / element.height from the element origin.
 * Used so selection handles + resize logic hug the real silhouette.
 */
export function getPathContentFractions(
  element: PathElementType
): { frx: number; fry: number; frw: number; frh: number } | null {
  if (element.width <= 0 || element.height <= 0) return null;
  const { viewBox, pathD, overlayD } = resolvePathElementGeometry(element);
  const vb = parseViewBox(viewBox);
  if (!vb) return null;

  let mainB = tightBounds(pathD);
  const overlayB = overlayD ? tightBounds(overlayD) : null;
  if (mainB && overlayB) {
    mainB = unionBounds(mainB, overlayB);
  } else if (!mainB && overlayB) {
    mainB = overlayB;
  }
  if (!mainB || mainB.w <= 0 || mainB.h <= 0) return null;

  const relX = ((mainB.x - vb.minX) / vb.vbW) * element.width;
  const relY = ((mainB.y - vb.minY) / vb.vbH) * element.height;
  const relW = (mainB.w / vb.vbW) * element.width;
  const relH = (mainB.h / vb.vbH) * element.height;

  if (relW < 1 || relH < 1) return null;

  return {
    frx: relX / element.width,
    fry: relY / element.height,
    frw: relW / element.width,
    frh: relH / element.height,
  };
}

/** Offset from element center to the anchor point (opposite handle) for path resize
 *  while rotated, in element-local unrotated coords. */
export function pathResizeAnchorOffsetFromCenter(
  handle: string,
  frx: number,
  fry: number,
  frw: number,
  frh: number,
  elemW: number,
  elemH: number
): { ox: number; oy: number } {
  const brx = (frx + frw) * elemW;
  const bry = (fry + frh) * elemH;
  const tcx = (frx + frw / 2) * elemW;
  const tcy = (fry + frh / 2) * elemH;
  const cx = elemW / 2;
  const cy = elemH / 2;
  switch (handle) {
    case "top-left":
      return { ox: brx - cx, oy: bry - cy };
    case "top-right":
      return { ox: frx * elemW - cx, oy: bry - cy };
    case "bottom-right":
      return { ox: frx * elemW - cx, oy: fry * elemH - cy };
    case "bottom-left":
      return { ox: brx - cx, oy: fry * elemH - cy };
    case "top":
      return { ox: tcx - cx, oy: bry - cy };
    case "bottom":
      return { ox: tcx - cx, oy: fry * elemH - cy };
    case "left":
      return { ox: brx - cx, oy: tcy - cy };
    case "right":
      return { ox: frx * elemW - cx, oy: tcy - cy };
    default:
      return { ox: 0, oy: 0 };
  }
}

/** Axis-aligned bbox in canvas space for connector snap/attach — tight path
 *  silhouette, then the AABB of that rect after `element.rotation`. */
export function pathConnectorBoundsCanvas(
  el: PathElementType
): { x: number; y: number; w: number; h: number } {
  const fr = getPathContentFractions(el);
  const frx = fr?.frx ?? 0;
  const fry = fr?.fry ?? 0;
  const frw = fr?.frw ?? 1;
  const frh = fr?.frh ?? 1;
  const baseX = el.x + frx * el.width;
  const baseY = el.y + fry * el.height;
  const bw = frw * el.width;
  const bh = frh * el.height;

  const rot = el.rotation || 0;
  if (rot === 0) {
    return { x: baseX, y: baseY, w: bw, h: bh };
  }

  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pts: [number, number][] = [
    [baseX, baseY],
    [baseX + bw, baseY],
    [baseX + bw, baseY + bh],
    [baseX, baseY + bh],
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of pts) {
    const dx = px - cx;
    const dy = py - cy;
    const rx = cx + dx * cos - dy * sin;
    const ry = cy + dx * sin + dy * cos;
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
