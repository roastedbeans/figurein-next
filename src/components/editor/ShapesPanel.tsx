"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { MousePointer2 } from "lucide-react";
import type { EditorElement, Tool } from "@/types/editor";
import {
  TEXT_VARIANTS,
  DEFAULT_SHAPE_WIDTH,
  DEFAULT_SHAPE_HEIGHT,
  DEFAULT_LINE_LENGTH,
  DEFAULT_FILL,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_FONT_FAMILY,
  SNAP_SIZE,
} from "@/lib/constants";
import { SHAPES_BY_ID, type ShapeStencil } from "@/lib/shape-stencils";
import {
  ShapePathPreview,
  SIDEBAR_TILE_VB,
  TILE_PREVIEW_PAR_MEET,
  TILE_PREVIEW_STROKE_PX,
  TILE_PREVIEW_VECTOR_STROKE,
  tilePreviewExpandViewBox,
} from "@/components/editor/shape-path-preview";
import { cn } from "@/lib/utils";

/** Placeholder for text dropped from Shapes sidebar (tiles + ghost show "Text"). */
const SIDEBAR_TEXT_PLACEHOLDER = "Text";

/** Matches `HEAD_HALF_ANGLE` in `ArrowElement` — thumbnails use filled heads. */
function arrowFilledShaftHeadMarkup(opts: {
  lineX1: number;
  y: number;
  tipX: number;
  /** Length from tip toward tail to rear base edge — stencil units. */
  headSize: number;
  /** SVG `fill` attribute (solid head, canvas parity). */
  headFill: string;
}): string {
  const half = Math.PI / 7;
  const cx = Math.cos(half);
  const sn = Math.sin(half);
  const baseX = opts.tipX - opts.headSize * cx;
  const yUpper = opts.y - opts.headSize * sn;
  const yLower = opts.y + opts.headSize * sn;
  const f = (x: number) => String(Math.round(x * 1000) / 1000);
  return (
    `<line x1="${f(opts.lineX1)}" y1="${f(opts.y)}" x2="${f(baseX)}" y2="${f(opts.y)}"/>` +
    `<polygon points="${f(opts.tipX)},${f(opts.y)} ${f(baseX)},${f(yUpper)} ${f(baseX)},${f(yLower)}" fill="${opts.headFill}" stroke="none"/>`
  );
}

/** Primitive / connector thumbnails (100×60 viewBox) — stencil-space coords scaled for drag ghost. */
function arrowGhostMarkupScaled(
  sx: number,
  sy: number,
  lineXVbStart: number,
  yVb: number,
  tipXVb: number,
  headSizeVb: number,
  strokeCss: string,
  strokeW: number
): string {
  const half = Math.PI / 7;
  const c = Math.cos(half);
  const s = Math.sin(half);
  const bx = tipXVb - headSizeVb * c;
  const yt = yVb - headSizeVb * s;
  const yb = yVb + headSizeVb * s;
  const f = (x: number) => String(Math.round(x * 1000) / 1000);
  const nse = `vector-effect="non-scaling-stroke"`;
  return (
    `<line x1="${f(lineXVbStart * sx)}" y1="${f(yVb * sy)}" x2="${f(bx * sx)}" y2="${f(yVb * sy)}" fill="none" stroke="${strokeCss}" stroke-width="${strokeW}" stroke-linecap="round" ${nse}/>` +
    `<polygon points="${f(tipXVb * sx)},${f(yVb * sy)} ${f(bx * sx)},${f(yt * sy)} ${f(bx * sx)},${f(yb * sy)}" fill="${strokeCss}" stroke="none"/>`
  );
}

/** A shape tile renders one entry — either a primitive tool (rectangle,
 *  circle, line, arrow) or a draw.io-style stencil preset — in a unified grid.
 *  Tiles
 *  are clickable (activate the matching tool) and press-and-drag (hold
 *  down, drag over the canvas, release to stamp at the cursor). */
type PrimitiveEntry = {
  kind: "primitive";
  tool: Extract<Tool, "rectangle" | "circle" | "line" | "arrow" | "text">;
  label: string;
  width: number;
  height: number;
  svgBody: string;
};

type StencilEntry = {
  kind: "stencil";
  shape: ShapeStencil;
};

type ConnectorPresetEntry = {
  kind: "connector-preset";
  id: string;
  label: string;
  width: number;
  height: number;
  svgBody: string;
  sourceLabel: string;
  centerLabel: string;
  targetLabel: string;
};

type ContainerPresetEntry = {
  kind: "container-preset";
  variant: "vertical" | "horizontal";
  label: string;
  width: number;
  height: number;
  /** Tile preview — unified `SIDEBAR_TILE_VB` (square 100×100). */
  svgBody: string;
};

type ShapeEntry =
  | PrimitiveEntry
  | StencilEntry
  | ConnectorPresetEntry
  | ContainerPresetEntry;

/** Tile `<svg>` grows inside the square grid cell (`flex`) without clipping strokes. */
const TILE_GRID_PREVIEW_CLASS =
  "min-h-0 min-w-0 h-full w-full max-w-full flex-1 basis-0";

const PRIMITIVE_TILE_PREVIEW: Record<
  "rectangle" | "circle" | "line" | "arrow" | "text",
  string
> = {
  rectangle: `<rect x="4" y="4" width="92" height="92" rx="5" fill="none"/>`,
  circle: `<circle cx="50" cy="50" r="46" fill="none"/>`,
  line: `<line x1="6" y1="50" x2="94" y2="50"/>`,
  /** Filled polygon head matches canvas arrows (`ArrowElement`). */
  arrow: arrowFilledShaftHeadMarkup({
    lineX1: 8,
    y: 50,
    tipX: 92,
    headSize: 19,
    headFill: "currentColor",
  }),
  text: `<text x="50" y="50" font-size="36" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none">${SIDEBAR_TEXT_PLACEHOLDER}</text>`,
};

/** Labeled-arrow tile: proportional layout from legacy 100×60 into square 100×100. */
const CONNECTOR_TILE_K = 100 / 60;
const CONNECTOR_TILE_PREVIEW =
  `<rect x="13" y="${14 * CONNECTOR_TILE_K}" width="19" height="${
    11 * CONNECTOR_TILE_K
  }" rx="9" ry="9" fill="none"/>` +
  `<rect x="40.5" y="${14 * CONNECTOR_TILE_K}" width="19" height="${
    11 * CONNECTOR_TILE_K
  }" rx="9" ry="9" fill="none"/>` +
  `<rect x="68" y="${14 * CONNECTOR_TILE_K}" width="19" height="${
    11 * CONNECTOR_TILE_K
  }" rx="9" ry="9" fill="none"/>` +
  arrowFilledShaftHeadMarkup({
    lineX1: 8,
    y: 44 * CONNECTOR_TILE_K,
    tipX: 93,
    headSize: 17 * CONNECTOR_TILE_K,
    headFill: "currentColor",
  });

/** Two stacked rects + “Text” in header — 100×100 frame, flush ¼ / ¾ split. */
const CONTAINER_VERTICAL_TILE_PREVIEW =
  `<rect x="8" y="8" width="84" height="21" fill="none"/>` +
  `<rect x="8" y="29" width="84" height="63" fill="none"/>` +
  `<text x="50" y="17.5" font-size="11" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none">${SIDEBAR_TEXT_PLACEHOLDER}</text>`;

/** Left strip + body + sideways “Text” — square frame. */
const CONTAINER_HORIZONTAL_TILE_PREVIEW =
  `<rect x="8" y="8" width="21" height="84" fill="none"/>` +
  `<rect x="29" y="8" width="63" height="84" fill="none"/>` +
  `<text x="17.5" y="50" font-size="11" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none" transform="rotate(-90 17.5 50)">${SIDEBAR_TEXT_PLACEHOLDER}</text>`;

/** Default stamped size — square artboard preset; chrome is ¼ of span. */
const CONTAINER_DROP_W = 220;
const CONTAINER_DROP_H = 220;
/** Header band height (vertical layout, ¼ of span). */
const CONTAINER_VERTICAL_HEADER_H = Math.round(CONTAINER_DROP_H / 4);
/** Left strip width (horizontal layout, ¼ of span). */
const CONTAINER_HORIZONTAL_SIDE_W = Math.round(CONTAINER_DROP_W / 4);
const CONTAINER_INNER_PAD = 4;


/** SVG fragments aligned with sidebar tiles; viewBox "0 0 100 60". */
const PRIMITIVE_GEOMETRY: Record<PrimitiveEntry["tool"], string> = {
  rectangle: `<rect x="4" y="5" width="92" height="50" rx="4" fill="${DEFAULT_FILL}" />`,
  circle: `<circle cx="50" cy="30" r="30" fill="${DEFAULT_FILL}" />`,
  line: `<line x1="4" y1="30" x2="96" y2="30" />`,
  arrow: arrowFilledShaftHeadMarkup({
    lineX1: 4,
    y: 30,
    tipX: 95,
    headSize: 18,
    headFill: DEFAULT_STROKE,
  }),
  text: `<text x="50" y="30" font-size="20" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none">${SIDEBAR_TEXT_PLACEHOLDER}</text>`,
};

const PRIMITIVES: PrimitiveEntry[] = [
  {
    kind: "primitive",
    tool: "rectangle",
    label: "Rectangle",
    width: DEFAULT_SHAPE_WIDTH,
    height: DEFAULT_SHAPE_HEIGHT,
    svgBody: PRIMITIVE_GEOMETRY.rectangle,
  },
  {
    kind: "primitive",
    tool: "circle",
    label: "Circle",
    width: DEFAULT_SHAPE_WIDTH,
    height: DEFAULT_SHAPE_WIDTH,
    svgBody: PRIMITIVE_GEOMETRY.circle,
  },
  {
    kind: "primitive",
    tool: "line",
    label: "Line",
    width: DEFAULT_LINE_LENGTH,
    height: 24,
    svgBody: PRIMITIVE_GEOMETRY.line,
  },
  {
    kind: "primitive",
    tool: "arrow",
    label: "Arrow",
    width: DEFAULT_LINE_LENGTH,
    height: 24,
    svgBody: PRIMITIVE_GEOMETRY.arrow,
  },
  {
    kind: "primitive",
    tool: "text",
    label: "Text",
    width: TEXT_VARIANTS.body.width,
    height: 40,
    svgBody: PRIMITIVE_GEOMETRY.text,
  },
];

function s(id: string): StencilEntry {
  return { kind: "stencil", shape: SHAPES_BY_ID[id] };
}

function p(tool: PrimitiveEntry["tool"]): PrimitiveEntry {
  return PRIMITIVES.find((e) => e.tool === tool)!;
}

const LABELED_ARROW: ConnectorPresetEntry = {
  kind: "connector-preset",
  id: "labeled-arrow",
  label: "Labeled Arrow",
  width: DEFAULT_LINE_LENGTH,
  height: 40,
  // viewBox 0 0 100 60. Three filled pills above the arrow read as "label
  // tags" — text glyphs are illegible at the 24px tile size, but solid pills
  // remain visible and communicate "labels along an arrow."
  svgBody:
    `<rect x="6" y="12" width="22" height="14" rx="7" fill="currentColor" stroke="none" />` +
    `<rect x="39" y="12" width="22" height="14" rx="7" fill="currentColor" stroke="none" />` +
    `<rect x="72" y="12" width="22" height="14" rx="7" fill="currentColor" stroke="none" />` +
    arrowFilledShaftHeadMarkup({
      lineX1: 8,
      y: 44,
      tipX: 93,
      headSize: 17,
      headFill: "currentColor",
    }),
  sourceLabel: "Source",
  centerLabel: "Label",
  targetLabel: "Target",
};

const CONTAINER_VERTICAL: ContainerPresetEntry = {
  kind: "container-preset",
  variant: "vertical",
  label: "Vertical Container",
  width: CONTAINER_DROP_W,
  height: CONTAINER_DROP_H,
  svgBody: CONTAINER_VERTICAL_TILE_PREVIEW,
};

const CONTAINER_HORIZONTAL: ContainerPresetEntry = {
  kind: "container-preset",
  variant: "horizontal",
  label: "Horizontal Container",
  width: CONTAINER_DROP_W,
  height: CONTAINER_DROP_H,
  svgBody: CONTAINER_HORIZONTAL_TILE_PREVIEW,
};

/** Sidebar grid (5 columns): primitives (line → arrow → labeled) → text → arrow block stencil
 *  → flowchart core → speech/notes → … → containers. */
const ENTRIES: ShapeEntry[] = [
  p("rectangle"),
  p("circle"),
  p("line"),
  p("arrow"),
  LABELED_ARROW,
  p("text"),
  s("arrow-right"),
  s("terminator"),
  s("parallelogram"),
  s("hexagon"),
  s("trapezoid"),
  s("diamond"),
  s("triangle"),
  s("predefined-process"),
  s("document"),
  s("cylinder"),
  s("pentagon"),
  s("note"),
  s("callout"),
  s("callout-round"),
  s("callout-oval"),
  s("right-triangle"),
  s("half-circle"),
  s("crescent"),
  s("cross"),
  s("cube"),
  s("wave"),
  s("ribbon"),
  s("cloud"),
  s("concave-lens"),
  s("actor"),
  CONTAINER_VERTICAL,
  CONTAINER_HORIZONTAL,
];

/** Shapes that consist entirely of open strokes — filling them makes no
 *  visual sense and produces the wrong preview. */
const STROKE_ONLY_SHAPE_IDS = new Set(["actor"]);

function TilePreviewRasterSvg(props: {
  baseViewBox: string;
  className: string;
  markup: string;
}) {
  return (
    <svg
      viewBox={tilePreviewExpandViewBox(props.baseViewBox)}
      preserveAspectRatio={TILE_PREVIEW_PAR_MEET}
      overflow="visible"
      className={cn(
        "pointer-events-none text-foreground",
        TILE_PREVIEW_VECTOR_STROKE,
        props.className
      )}
      aria-hidden
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={TILE_PREVIEW_STROKE_PX}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: props.markup }}
      />
    </svg>
  );
}

function TilePreview({ entry }: { entry: ShapeEntry }) {
  if (entry.kind === "primitive") {
    return (
      <TilePreviewRasterSvg
        baseViewBox={SIDEBAR_TILE_VB}
        className={TILE_GRID_PREVIEW_CLASS}
        markup={PRIMITIVE_TILE_PREVIEW[entry.tool]}
      />
    );
  }
  if (entry.kind === "connector-preset") {
    return (
      <TilePreviewRasterSvg
        baseViewBox={SIDEBAR_TILE_VB}
        className={TILE_GRID_PREVIEW_CLASS}
        markup={CONNECTOR_TILE_PREVIEW}
      />
    );
  }
  if (entry.kind === "container-preset") {
    return (
      <TilePreviewRasterSvg
        baseViewBox={SIDEBAR_TILE_VB}
        className={TILE_GRID_PREVIEW_CLASS}
        markup={entry.svgBody}
      />
    );
  }
  return <ShapePathPreview shape={entry.shape} className={TILE_GRID_PREVIEW_CLASS} />;
}

function TilePreviewLarge({ entry }: { entry: ShapeEntry }) {
  if (entry.kind === "primitive") {
    return (
      <TilePreviewRasterSvg
        baseViewBox={SIDEBAR_TILE_VB}
        className="size-12 shrink-0"
        markup={PRIMITIVE_TILE_PREVIEW[entry.tool]}
      />
    );
  }
  if (entry.kind === "connector-preset") {
    return (
      <TilePreviewRasterSvg
        baseViewBox={SIDEBAR_TILE_VB}
        className="size-12 shrink-0"
        markup={CONNECTOR_TILE_PREVIEW}
      />
    );
  }
  if (entry.kind === "container-preset") {
    return (
      <TilePreviewRasterSvg
        baseViewBox={SIDEBAR_TILE_VB}
        className="size-12 shrink-0"
        markup={entry.svgBody}
      />
    );
  }
  return <ShapePathPreview shape={entry.shape} className="size-12 shrink-0" />;
}

/** Size and viewBox the drop preview (and the final element on canvas) will
 *  occupy. Single source of truth so the ghost under the cursor and the
 *  committed element are pixel-identical. */
function entryDropSize(entry: ShapeEntry): { width: number; height: number } {
  if (entry.kind === "stencil") return { width: entry.shape.width, height: entry.shape.height };
  return { width: entry.width, height: entry.height };
}

function dragGhostStencilBody(shape: ShapeStencil, w: number, h: number): string {
  const fill = STROKE_ONLY_SHAPE_IDS.has(shape.id) ? "none" : DEFAULT_FILL;
  const sc = DEFAULT_STROKE;
  const sw = DEFAULT_STROKE_WIDTH;
  const nse = `vector-effect="non-scaling-stroke"`;
  if (shape.pathGenerator) {
    let s = `<path d="${shape.pathGenerator(w, h)}" fill="${fill}" stroke="${sc}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${nse}/>`;
    const lip = shape.detailPathGenerator?.(w, h);
    if (lip) {
      s += `<path d="${lip}" fill="none" stroke="${sc}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${nse}/>`;
    }
    return s;
  }
  return `<path d="${shape.pathData}" fill="${fill}" stroke="${sc}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${nse}/>`;
}

function dragGhostPrimitiveBody(entry: PrimitiveEntry): string {
  const w = entry.width;
  const h = entry.height;
  const fc = DEFAULT_FILL;
  const sc = DEFAULT_STROKE;
  const sw = DEFAULT_STROKE_WIDTH;
  switch (entry.tool) {
    case "text":
      return "";
    case "rectangle":
      return `<rect x="0" y="0" width="${w}" height="${h}" fill="${fc}" stroke="${sc}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    case "circle":
      return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>`;
    case "line":
      return `<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" fill="none" stroke="${sc}" stroke-width="${sw}" stroke-linecap="round"/>`;
    case "arrow": {
      const sx = w / 100;
      const sy = h / 60;
      return arrowGhostMarkupScaled(sx, sy, 4, 30, 95, 18, sc, sw);
    }
    default:
      return "";
  }
}

/** Sidebar tile preview ratios (CONNECTOR_TILE_PREVIEW) scaled to ghost w×h. */
function dragGhostConnectorBody(w: number, h: number): string {
  const sc = DEFAULT_STROKE;
  const sw = DEFAULT_STROKE_WIDTH;
  const sx = w / 100;
  const sy = h / 60;
  const r = Math.min(5.5 * sx, 5.5 * sy);
  return (
    `<rect x="${13 * sx}" y="${14 * sy}" width="${19 * sx}" height="${11 * sy}" rx="${r}" ry="${r}" fill="none" stroke="${sc}" stroke-width="${sw}"/>` +
    `<rect x="${40.5 * sx}" y="${14 * sy}" width="${19 * sx}" height="${11 * sy}" rx="${r}" ry="${r}" fill="none" stroke="${sc}" stroke-width="${sw}"/>` +
    `<rect x="${68 * sx}" y="${14 * sy}" width="${19 * sx}" height="${11 * sy}" rx="${r}" ry="${r}" fill="none" stroke="${sc}" stroke-width="${sw}"/>` +
    arrowGhostMarkupScaled(sx, sy, 8, 44, 93, 17, sc, sw)
  );
}

function dragGhostContainerBody(
  variant: "vertical" | "horizontal",
  w: number,
  h: number
): string {
  const fc = DEFAULT_FILL;
  const sc = DEFAULT_STROKE;
  const sw = DEFAULT_STROKE_WIDTH;
  const nse = `vector-effect="non-scaling-stroke"`;
  if (variant === "vertical") {
    const headH = (h * CONTAINER_VERTICAL_HEADER_H) / CONTAINER_DROP_H;
    const fs = Math.max(10, Math.min(16, headH * 0.42));
    const lineY = headH / 2;
    return (
      `<rect x="0" y="0" width="${w}" height="${headH}" fill="${fc}" stroke="${sc}" stroke-width="${sw}" ${nse}/>` +
      `<rect x="0" y="${headH}" width="${w}" height="${h - headH}" fill="${fc}" stroke="${sc}" stroke-width="${sw}" ${nse}/>` +
      `<text x="${w / 2}" y="${lineY}" font-size="${fs}" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle" dominant-baseline="central" fill="${sc}" stroke="none">Vertical Container</text>`
    );
  }
  const sideW = (w * CONTAINER_HORIZONTAL_SIDE_W) / CONTAINER_DROP_W;
  const cx = sideW / 2;
  const cy = h / 2;
  const fs = Math.max(
    9,
    Math.min(
      14,
      Math.min(sideW - 2 * CONTAINER_INNER_PAD, h - 2 * CONTAINER_INNER_PAD) * 0.32
    )
  );
  return (
    `<rect x="0" y="0" width="${sideW}" height="${h}" fill="${fc}" stroke="${sc}" stroke-width="${sw}" ${nse}/>` +
    `<rect x="${sideW}" y="0" width="${w - sideW}" height="${h}" fill="${fc}" stroke="${sc}" stroke-width="${sw}" ${nse}/>` +
    `<text x="${cx}" y="${cy}" font-size="${fs}" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle" dominant-baseline="central" fill="${sc}" stroke="none" transform="rotate(-90 ${cx} ${cy})">Horizontal Container</text>`
  );
}

/** Drag overlay SVG: geometry + stroke parity with what lands on canvas. */
function buildDragGhostSvg(entry: ShapeEntry): string {
  const { width: w, height: h } = entryDropSize(entry);
  let viewBoxStr: string;
  let preserve: "none" | "xMidYMid meet";
  let inner: string;

  if (entry.kind === "primitive") {
    viewBoxStr = `0 0 ${w} ${h}`;
    preserve = "xMidYMid meet";
    inner = dragGhostPrimitiveBody(entry);
  } else if (entry.kind === "connector-preset") {
    viewBoxStr = `0 0 ${w} ${h}`;
    preserve = "xMidYMid meet";
    inner = dragGhostConnectorBody(w, h);
  } else if (entry.kind === "container-preset") {
    viewBoxStr = `0 0 ${w} ${h}`;
    preserve = "xMidYMid meet";
    inner = dragGhostContainerBody(entry.variant, w, h);
  } else {
    // Match PathElement: full logical box for generator paths (letterboxing
    // stays inside the element); stencil `viewBox` for static pathData.
    const shape = entry.shape;
    if (shape.pathGenerator) {
      viewBoxStr = `0 0 ${w} ${h}`;
    } else {
      viewBoxStr = shape.viewBox;
    }
    preserve = "none";
    inner = dragGhostStencilBody(shape, w, h);
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="${viewBoxStr}" preserveAspectRatio="${preserve}" overflow="visible" ` +
    `stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  );
}

type DragState = {
  entry: ShapeEntry;
  clientX: number;
  clientY: number;
  valid: boolean;
};

/** Cursor-following overlay drawn via a portal on <body>. Sized to match
 *  what the element will become on canvas, so the preview and the committed
 *  element land on the exact same spot with no "side to center" jump. */
function DragPreview({ drag }: { drag: DragState }) {
  const { width, height } = entryDropSize(drag.entry);
  const baseStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    transform: `translate(${drag.clientX - width / 2}px, ${drag.clientY - height / 2}px)`,
    width,
    height,
    pointerEvents: "none",
    opacity: drag.valid ? 0.85 : 0.45,
    zIndex: 9999,
  };

  // Text primitive: render the actual textbox content at native size. The
  // generic SVG path stretches glyphs and the placeholder rect to fit the
  // textbox dimensions, which looks distorted compared to HTML text at the
  // committed size.
  if (drag.entry.kind === "primitive" && drag.entry.tool === "text") {
    const variant = TEXT_VARIANTS.body;
    return createPortal(
      <div
        style={{
          ...baseStyle,
          fontSize: variant.fontSize,
          fontWeight: variant.fontWeight,
          fontFamily: DEFAULT_FONT_FAMILY,
          color: DEFAULT_STROKE,
          lineHeight: 1.2,
          whiteSpace: "pre",
          border: "1px solid hsl(221 83% 53%)",
          borderRadius: 2,
          padding: 2,
          boxSizing: "border-box",
        }}
        aria-hidden
      >
        {SIDEBAR_TEXT_PLACEHOLDER}
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      style={baseStyle}
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: buildDragGhostSvg(drag.entry),
      }}
    />,
    document.body
  );
}

function newDropElementId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/** Two rectangles plus a label text, sharing `groupId` (vertical vs horizontal chrome). */
function buildContainerPresetElements(
  variant: "vertical" | "horizontal",
  canvasX: number,
  canvasY: number,
  baseZIndex: number
): EditorElement[] {
  const snap = (n: number) => Math.round(n / SNAP_SIZE) * SNAP_SIZE;
  const groupId = newDropElementId();
  const cx = snap(canvasX);
  const cy = snap(canvasY);
  const x0 = cx - CONTAINER_DROP_W / 2;
  const y0 = cy - CONTAINER_DROP_H / 2;
  const fv = TEXT_VARIANTS.body;
  const z0 = baseZIndex;

  const rectBase = {
    parentId: null,
    rotation: 0 as const,
    opacity: 1,
    fill: DEFAULT_FILL,
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    borderRadius: 0,
    groupId,
  };

  if (variant === "vertical") {
    const headH = CONTAINER_VERTICAL_HEADER_H;
    const idHeader = newDropElementId();
    const idBody = newDropElementId();
    const idText = newDropElementId();
    const tw = CONTAINER_DROP_W - 2 * CONTAINER_INNER_PAD;
    const th = headH - 2 * CONTAINER_INNER_PAD;
    return [
      {
        ...rectBase,
        id: idHeader,
        type: "rectangle" as const,
        x: x0,
        y: y0,
        width: CONTAINER_DROP_W,
        height: headH,
        zIndex: z0,
      },
      {
        ...rectBase,
        id: idBody,
        type: "rectangle" as const,
        x: x0,
        y: y0 + headH,
        width: CONTAINER_DROP_W,
        height: CONTAINER_DROP_H - headH,
        zIndex: z0 + 1,
      },
      {
        id: idText,
        parentId: null,
        type: "text" as const,
        x: x0 + CONTAINER_INNER_PAD,
        y: y0 + CONTAINER_INNER_PAD,
        width: tw,
        height: th,
        rotation: 0,
        opacity: 1,
        zIndex: z0 + 2,
        fill: "none",
        stroke: "none",
        strokeWidth: DEFAULT_STROKE_WIDTH,
        content: "Vertical Container",
        fontSize: fv.fontSize,
        fontWeight: fv.fontWeight,
        fontFamily: DEFAULT_FONT_FAMILY,
        fontStyle: "normal" as const,
        textAlign: "center" as const,
        verticalAlign: "middle" as const,
        color: DEFAULT_STROKE,
        borderRadius: 0,
        groupId,
      },
    ];
  }

  const idSide = newDropElementId();
  const idBody = newDropElementId();
  const idText = newDropElementId();
  const side = CONTAINER_HORIZONTAL_SIDE_W;
  const tw = CONTAINER_DROP_H - 2 * CONTAINER_INNER_PAD;
  const th = side - 2 * CONTAINER_INNER_PAD;
  const scx = x0 + side / 2;
  const scy = y0 + CONTAINER_DROP_H / 2;

  return [
    {
      ...rectBase,
      id: idSide,
      type: "rectangle" as const,
      x: x0,
      y: y0,
      width: side,
      height: CONTAINER_DROP_H,
      zIndex: z0,
    },
    {
      ...rectBase,
      id: idBody,
      type: "rectangle" as const,
      x: x0 + side,
      y: y0,
      width: CONTAINER_DROP_W - side,
      height: CONTAINER_DROP_H,
      zIndex: z0 + 1,
    },
    {
      id: idText,
      parentId: null,
      type: "text" as const,
      x: scx - tw / 2,
      y: scy - th / 2,
      width: tw,
      height: th,
      rotation: -90,
      opacity: 1,
      zIndex: z0 + 2,
      fill: "none",
      stroke: "none",
      strokeWidth: DEFAULT_STROKE_WIDTH,
      content: "Horizontal Container",
      fontSize: fv.fontSize,
      fontWeight: fv.fontWeight,
      fontFamily: DEFAULT_FONT_FAMILY,
      fontStyle: "normal" as const,
      textAlign: "center" as const,
      verticalAlign: "middle" as const,
      color: DEFAULT_STROKE,
      borderRadius: 0,
      groupId,
    },
  ];
}

function buildElementForDrop(
  entry: ShapeEntry,
  canvasX: number,
  canvasY: number,
  zIndex: number
): EditorElement {
  const id = Math.random().toString(36).substring(2, 11);
  const snap = (n: number) => Math.round(n / SNAP_SIZE) * SNAP_SIZE;

  if (entry.kind === "connector-preset") {
    const len = DEFAULT_LINE_LENGTH;
    const x1 = snap(canvasX - len / 2);
    const yMid = snap(canvasY);
    return {
      id,
      parentId: null,
      rotation: 0,
      opacity: 1,
      zIndex,
      type: "arrow",
      x: x1,
      y: yMid,
      x2: x1 + len,
      y2: yMid,
      width: 0,
      height: 0,
      fill: "none",
      stroke: DEFAULT_STROKE,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      headStyle: "triangle",
      tailStyle: "none",
      lineStyle: "straight",
      sourceLabel: entry.sourceLabel,
      label: entry.centerLabel,
      targetLabel: entry.targetLabel,
    };
  }

  if (entry.kind === "stencil") {
    const w = entry.shape.width;
    const h = entry.shape.height;
    const fill = STROKE_ONLY_SHAPE_IDS.has(entry.shape.id) ? "none" : DEFAULT_FILL;
    return {
      id,
      parentId: null,
      type: "path",
      x: snap(canvasX - w / 2),
      y: snap(canvasY - h / 2),
      width: w,
      height: h,
      rotation: 0,
      fill,
      stroke: DEFAULT_STROKE,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      opacity: 1,
      zIndex,
      pathData: entry.shape.pathGenerator
        ? entry.shape.pathGenerator(w, h)
        : entry.shape.pathData,
      viewBox: entry.shape.pathGenerator
        ? `0 0 ${w} ${h}`
        : entry.shape.viewBox,
      shapeId: entry.shape.id,
    };
  }

  if (entry.kind !== "primitive") {
    throw new Error(
      "[FigurIn] use buildContainerPresetElements for container-preset stamps"
    );
  }

  const common = {
    id,
    parentId: null,
    rotation: 0,
    opacity: 1,
    zIndex,
  } as const;

  if (entry.tool === "rectangle") {
    const w = entry.width;
    const h = entry.height;
    return {
      ...common,
      type: "rectangle",
      x: snap(canvasX - w / 2),
      y: snap(canvasY - h / 2),
      width: w,
      height: h,
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      borderRadius: 0,
    };
  }
  if (entry.tool === "circle") {
    const w = entry.width;
    const h = entry.height;
    return {
      ...common,
      type: "circle",
      x: snap(canvasX - w / 2),
      y: snap(canvasY - h / 2),
      width: w,
      height: h,
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      strokeWidth: DEFAULT_STROKE_WIDTH,
    };
  }

  // text box
  if (entry.kind === "primitive" && entry.tool === "text") {
    const variant = TEXT_VARIANTS.body;
    return {
      ...common,
      type: "text" as const,
      x: snap(canvasX - variant.width / 2),
      y: snap(canvasY - 20),
      width: variant.width,
      height: 40,
      fill: "none",
      stroke: "none",
      strokeWidth: DEFAULT_STROKE_WIDTH,
      content: SIDEBAR_TEXT_PLACEHOLDER,
      fontSize: variant.fontSize,
      fontWeight: variant.fontWeight,
      fontFamily: DEFAULT_FONT_FAMILY,
      fontStyle: "normal" as const,
      textAlign: "left" as const,
      verticalAlign: "top" as const,
      color: DEFAULT_STROKE,
      borderRadius: 0,
    };
  }

  // line / arrow — horizontal stroke centered on the drop point
  const len = DEFAULT_LINE_LENGTH;
  const x1 = snap(canvasX - len / 2);
  const y = snap(canvasY);
  const x2 = x1 + len;
  if (entry.tool === "line") {
    // Line tool produces an arrow with no head — connectors are unified
    // under one type now; "line" is a UI label, not a separate element.
    return {
      ...common,
      type: "arrow",
      x: x1,
      y,
      x2,
      y2: y,
      width: 0,
      height: 0,
      fill: "none",
      stroke: DEFAULT_STROKE,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      headStyle: "none",
      tailStyle: "none",
      lineStyle: "straight",
    };
  }
  return {
    ...common,
    type: "arrow",
    x: x1,
    y,
    x2,
    y2: y,
    width: 0,
    height: 0,
    fill: "none",
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    headStyle: "triangle",
    tailStyle: "none",
    lineStyle: "straight",
  };
}

export function ShapesPanel() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const pendingPathShape = useEditorStore((s) => s.pendingPathShape);
  const setPendingPathShape = useEditorStore((s) => s.setPendingPathShape);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverPopup, setHoverPopup] = useState<{ entry: ShapeEntry; rect: DOMRect } | null>(null);
  // Track press-start so a tiny wiggle before release still counts as a
  // click (no drag preview shown). Distance threshold keeps the click path
  // feeling snappy instead of requiring a pixel-perfect release.
  const pressRef = useRef<{ entry: ShapeEntry; startX: number; startY: number } | null>(null);

  const handleTileClick = (entry: ShapeEntry) => {
    if (entry.kind === "primitive") {
      setTool(entry.tool);
    } else if (entry.kind === "stencil") {
      setPendingPathShape(entry.shape);
      setTool("path");
    }
    // connector-preset: drag-only, click is a no-op
  };

  const handleTileMouseDown = (e: React.MouseEvent, entry: ShapeEntry) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pressRef.current = { entry, startX: e.clientX, startY: e.clientY };
  };

  useEffect(() => {
    const DRAG_THRESHOLD = 4;

    const hitCanvas = (x: number, y: number): SVGSVGElement | null => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const canvas = el.closest("#figurin-canvas");
      return canvas instanceof SVGSVGElement ? canvas : null;
    };

    const onMouseMove = (e: MouseEvent) => {
      const press = pressRef.current;
      if (!press && !drag) return;

      if (press && !drag) {
        const dx = e.clientX - press.startX;
        const dy = e.clientY - press.startY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
        document.body.style.cursor = "grabbing";
        setDrag({
          entry: press.entry,
          clientX: e.clientX,
          clientY: e.clientY,
          valid: hitCanvas(e.clientX, e.clientY) !== null,
        });
        return;
      }

      if (drag) {
        setDrag({
          entry: drag.entry,
          clientX: e.clientX,
          clientY: e.clientY,
          valid: hitCanvas(e.clientX, e.clientY) !== null,
        });
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const press = pressRef.current;
      pressRef.current = null;

      if (drag) {
        const svg = hitCanvas(e.clientX, e.clientY);
        if (svg && press) {
          const rect = svg.getBoundingClientRect();
          const {
            canvas,
            elements,
            addElement,
            addElements,
            selectElement,
            selectMultiple,
          } = useEditorStore.getState();
          const rawX = (e.clientX - rect.left - canvas.panX) / canvas.zoom;
          const rawY = (e.clientY - rect.top - canvas.panY) / canvas.zoom;
          if (press.entry.kind === "container-preset") {
            const batch = buildContainerPresetElements(
              press.entry.variant,
              rawX,
              rawY,
              elements.length
            );
            addElements(batch);
            selectMultiple(batch.map((el) => el.id));
          } else {
            const el = buildElementForDrop(
              press.entry,
              rawX,
              rawY,
              elements.length
            );
            addElement(el);
            selectElement(el.id);
          }
        }
        document.body.style.cursor = "";
        setDrag(null);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (drag || pressRef.current)) {
        pressRef.current = null;
        document.body.style.cursor = "";
        setDrag(null);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drag]);

  const isActive = (entry: ShapeEntry) => {
    if (entry.kind === "primitive") return tool === entry.tool;
    if (entry.kind === "connector-preset" || entry.kind === "container-preset")
      return false;
    return tool === "path" && pendingPathShape?.id === entry.shape.id;
  };

  const labelFor = (entry: ShapeEntry) => {
    if (entry.kind === "stencil") return entry.shape.label;
    return entry.label;
  };

  const keyFor = (entry: ShapeEntry) => {
    if (entry.kind === "primitive") return `p-${entry.tool}`;
    if (entry.kind === "connector-preset") return `c-${entry.id}`;
    if (entry.kind === "container-preset") return `k-${entry.variant}`;
    return `f-${entry.shape.id}`;
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex flex-col gap-1">
        <Button
          variant={tool === "select" ? "secondary" : "ghost"}
          size="sm"
          className="justify-start gap-2"
          onClick={() => setTool("select")}
        >
          <MousePointer2 className="size-4" />
          Select
        </Button>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Click to draw, or drag onto the canvas
        </p>
        <div className="grid grid-cols-5 gap-0">
          {ENTRIES.map((entry) => {
            const active = isActive(entry);
            return (
              <button
                key={keyFor(entry)}
                type="button"
                onMouseDown={(e) => handleTileMouseDown(e, entry)}
                onClick={() => handleTileClick(entry)}
                onMouseEnter={(e) =>
                  setHoverPopup({ entry, rect: e.currentTarget.getBoundingClientRect() })
                }
                onMouseLeave={() => setHoverPopup(null)}
                className={cn(
                  "flex aspect-square w-full min-w-0 flex-col cursor-grab rounded-md border p-1 transition-colors active:cursor-grabbing",
                  active
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "border-transparent hover:bg-muted"
                )}
                aria-label={labelFor(entry)}
              >
                <TilePreview entry={entry} />
              </button>
            );
          })}
        </div>
      </div>

      {drag && <DragPreview drag={drag} />}
      {hoverPopup &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: hoverPopup.rect.right + 8,
              top: Math.min(hoverPopup.rect.top, window.innerHeight - 100),
              zIndex: 9999,
            }}
            className="pointer-events-none flex flex-col items-center gap-1.5 rounded-lg border bg-background p-3 shadow-md"
          >
            <TilePreviewLarge entry={hoverPopup.entry} />
            <span className="text-xs font-medium text-foreground">
              {labelFor(hoverPopup.entry)}
            </span>
          </div>,
          document.body
        )}
    </div>
  );
}
