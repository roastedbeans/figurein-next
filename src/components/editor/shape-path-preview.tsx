"use client";

import type { ReactNode } from "react";
import type { ShapeStencil } from "@/lib/shape-stencils";
import { cn } from "@/lib/utils";

const TILE_PREVIEW_PAD = 5;
const TILE_PREVIEW_STROKE_PX = 1;
const TILE_PREVIEW_VECTOR_STROKE =
  "[&_circle]:[vector-effect:non-scaling-stroke] [&_ellipse]:[vector-effect:non-scaling-stroke] [&_line]:[vector-effect:non-scaling-stroke] [&_path]:[vector-effect:non-scaling-stroke] [&_rect]:[vector-effect:non-scaling-stroke] [&_polyline]:[vector-effect:non-scaling-stroke]";
const TILE_PREVIEW_PAR_MEET = "xMidYMid meet";

/** Sidebar stencil tiles share a square artboard (`meet` fills cell height uniformly). */
export const SIDEBAR_TILE_VB = "0 0 100 100";
const SIDEBAR_TILE_MARGIN = 2;
const SIDEBAR_TILE_BODY = 100 - 2 * SIDEBAR_TILE_MARGIN;

export { TILE_PREVIEW_STROKE_PX, TILE_PREVIEW_VECTOR_STROKE, TILE_PREVIEW_PAR_MEET };

export function tilePreviewExpandViewBox(
  viewBoxAttr: string,
  pad = TILE_PREVIEW_PAD
): string {
  const n = viewBoxAttr
    .trim()
    .split(/[\s,]+/)
    .map((s) => Number.parseFloat(s));
  if (n.length !== 4 || n.some(Number.isNaN)) return viewBoxAttr;
  const [x, y, w, h] = n as [number, number, number, number];
  return `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`;
}

function parseViewBoxRect(viewBoxAttr: string): {
  minX: number;
  minY: number;
  w: number;
  h: number;
} | null {
  const n = viewBoxAttr
    .trim()
    .split(/[\s,]+/)
    .map((s) => Number.parseFloat(s));
  if (n.length !== 4 || n.some(Number.isNaN)) return null;
  const [minX, minY, w, h] = n as [number, number, number, number];
  if (w <= 0 || h <= 0) return null;
  return { minX, minY, w, h };
}

/** Stencil tile: same default W×H as canvas stamp, uniform scale into the square tile. */
export function ShapePathPreview({
  shape,
  className,
}: {
  shape: ShapeStencil;
  className: string;
}) {
  const ew = shape.width;
  const eh = shape.height;

  let vbRaw: string;
  let inner: ReactNode;

  if (shape.pathGenerator) {
    vbRaw = SIDEBAR_TILE_VB;
    const sc = Math.min(SIDEBAR_TILE_BODY / ew, SIDEBAR_TILE_BODY / eh);
    const ox = SIDEBAR_TILE_MARGIN + (SIDEBAR_TILE_BODY - ew * sc) / 2;
    const oy = SIDEBAR_TILE_MARGIN + (SIDEBAR_TILE_BODY - eh * sc) / 2;
    const mainD = shape.pathGenerator(ew, eh);
    const overlayD = shape.detailPathGenerator?.(ew, eh);
    inner = (
      <g transform={`translate(${ox},${oy}) scale(${sc})`}>
        <path
          d={mainD}
          fill="none"
          stroke="currentColor"
          strokeWidth={TILE_PREVIEW_STROKE_PX}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {overlayD && (
          <path
            d={overlayD}
            fill="none"
            stroke="currentColor"
            strokeWidth={TILE_PREVIEW_STROKE_PX}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </g>
    );
  } else {
    const rect = parseViewBoxRect(shape.viewBox);
    if (rect && rect.w > 0 && rect.h > 0 && ew > 0 && eh > 0) {
      vbRaw = SIDEBAR_TILE_VB;
      const sc = Math.min(SIDEBAR_TILE_BODY / ew, SIDEBAR_TILE_BODY / eh);
      const ox = SIDEBAR_TILE_MARGIN + (SIDEBAR_TILE_BODY - ew * sc) / 2;
      const oy = SIDEBAR_TILE_MARGIN + (SIDEBAR_TILE_BODY - eh * sc) / 2;
      const sx = ew / rect.w;
      const sy = eh / rect.h;
      const transform =
        `translate(${ox},${oy}) scale(${sc}) ` +
        `scale(${sx},${sy}) translate(${-rect.minX},${-rect.minY})`;
      inner = (
        <g transform={transform}>
          <path
            d={shape.pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth={TILE_PREVIEW_STROKE_PX}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {shape.detailPath && (
            <path
              d={shape.detailPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={TILE_PREVIEW_STROKE_PX}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </g>
      );
    } else {
      vbRaw = shape.viewBox;
      inner = (
        <>
          <path
            d={shape.pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth={TILE_PREVIEW_STROKE_PX}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {shape.detailPath && (
            <path
              d={shape.detailPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={TILE_PREVIEW_STROKE_PX}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </>
      );
    }
  }

  const vb = tilePreviewExpandViewBox(vbRaw);

  return (
    <svg
      viewBox={vb}
      preserveAspectRatio={TILE_PREVIEW_PAR_MEET}
      overflow="visible"
      className={cn(
        "pointer-events-none text-foreground",
        TILE_PREVIEW_VECTOR_STROKE,
        className
      )}
      aria-hidden
    >
      {inner}
    </svg>
  );
}
