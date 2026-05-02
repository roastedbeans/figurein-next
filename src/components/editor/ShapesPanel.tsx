"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { MousePointer2 } from "lucide-react";
import type { EditorElement, Tool } from "@/types/editor";
import {
  TEXT_VARIANTS,
  type TextVariant,
  DEFAULT_SHAPE_WIDTH,
  DEFAULT_SHAPE_HEIGHT,
  DEFAULT_LINE_LENGTH,
  DEFAULT_FILL,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  SNAP_SIZE,
} from "@/lib/constants";
import { FLOWCHART_SHAPES, type FlowchartShape } from "@/lib/flowchart-shapes";
import { cn } from "@/lib/utils";

const textVariantOrder: TextVariant[] = ["heading", "subheading", "body", "caption"];

/** A shape tile renders one entry — either a primitive tool (rectangle,
 *  circle, line, arrow) or a flowchart preset — in a unified grid. Tiles
 *  are clickable (activate the matching tool) and press-and-drag (hold
 *  down, drag over the canvas, release to stamp at the cursor). */
type PrimitiveEntry = {
  kind: "primitive";
  tool: Extract<Tool, "rectangle" | "circle" | "line" | "arrow">;
  label: string;
  width: number;
  height: number;
  svgBody: string;
};

type FlowchartEntry = {
  kind: "flowchart";
  shape: FlowchartShape;
};

type ShapeEntry = PrimitiveEntry | FlowchartEntry;

/** SVG fragments used inside both the sidebar preview and the drag ghost so
 *  the two visuals match exactly. Each string assumes viewBox "0 0 100 60"
 *  with stroke color/weight set on the wrapper <svg>. */
const PRIMITIVE_GEOMETRY: Record<PrimitiveEntry["tool"], string> = {
  rectangle: `<rect x="6" y="8" width="88" height="44" rx="3" fill="${DEFAULT_FILL}" />`,
  circle: `<ellipse cx="50" cy="30" rx="42" ry="22" fill="${DEFAULT_FILL}" />`,
  line: `<line x1="6" y1="30" x2="94" y2="30" />`,
  arrow: `<line x1="6" y1="30" x2="86" y2="30" /><path d="M 78 22 L 94 30 L 78 38" fill="none" />`,
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
];

const ENTRIES: ShapeEntry[] = [
  ...PRIMITIVES,
  ...FLOWCHART_SHAPES.map<ShapeEntry>((shape) => ({ kind: "flowchart", shape })),
];

function TilePreview({ entry }: { entry: ShapeEntry }) {
  if (entry.kind === "primitive") {
    return (
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none size-9 text-foreground"
        aria-hidden
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        dangerouslySetInnerHTML={{ __html: entry.svgBody }}
      />
    );
  }
  return (
    <svg
      viewBox={entry.shape.viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none size-9 text-foreground"
      aria-hidden
    >
      <path
        d={entry.shape.pathData}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Size and viewBox the drop preview (and the final element on canvas) will
 *  occupy. Single source of truth so the ghost under the cursor and the
 *  committed element are pixel-identical. */
function entryDropSize(entry: ShapeEntry): { width: number; height: number } {
  if (entry.kind === "primitive") {
    return { width: entry.width, height: entry.height };
  }
  return { width: entry.shape.width, height: entry.shape.height };
}

function entryViewBox(entry: ShapeEntry): string {
  return entry.kind === "primitive" ? "0 0 100 60" : entry.shape.viewBox;
}

function entryInnerSvg(entry: ShapeEntry): string {
  if (entry.kind === "primitive") return entry.svgBody;
  return `<path d="${entry.shape.pathData}" fill="${DEFAULT_FILL}" stroke="${DEFAULT_STROKE}" stroke-width="${DEFAULT_STROKE_WIDTH}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />`;
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
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        transform: `translate(${drag.clientX - width / 2}px, ${drag.clientY - height / 2}px)`,
        width,
        height,
        pointerEvents: "none",
        opacity: drag.valid ? 0.85 : 0.45,
        zIndex: 9999,
      }}
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${entryViewBox(drag.entry)}" preserveAspectRatio="none" stroke="${DEFAULT_STROKE}" stroke-width="${DEFAULT_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" fill="${DEFAULT_FILL}">${entryInnerSvg(drag.entry)}</svg>`,
      }}
    />,
    document.body
  );
}

function buildElementForDrop(
  entry: ShapeEntry,
  canvasX: number,
  canvasY: number,
  zIndex: number
): EditorElement {
  const id = Math.random().toString(36).substring(2, 11);
  const snap = (n: number) => Math.round(n / SNAP_SIZE) * SNAP_SIZE;

  if (entry.kind === "flowchart") {
    const w = entry.shape.width;
    const h = entry.shape.height;
    return {
      id,
      parentId: null,
      type: "path",
      x: snap(canvasX - w / 2),
      y: snap(canvasY - h / 2),
      width: w,
      height: h,
      rotation: 0,
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      opacity: 1,
      zIndex,
      pathData: entry.shape.pathData,
      viewBox: entry.shape.viewBox,
    };
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

  // line / arrow — horizontal stroke centered on the drop point
  const len = DEFAULT_LINE_LENGTH;
  const x1 = snap(canvasX - len / 2);
  const y = snap(canvasY);
  const x2 = x1 + len;
  if (entry.tool === "line") {
    return {
      ...common,
      type: "line",
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
  const textVariant = useEditorStore((s) => s.textVariant);
  const setTextVariant = useEditorStore((s) => s.setTextVariant);
  const pendingPathShape = useEditorStore((s) => s.pendingPathShape);
  const setPendingPathShape = useEditorStore((s) => s.setPendingPathShape);

  const [drag, setDrag] = useState<DragState | null>(null);
  // Track press-start so a tiny wiggle before release still counts as a
  // click (no drag preview shown). Distance threshold keeps the click path
  // feeling snappy instead of requiring a pixel-perfect release.
  const pressRef = useRef<{ entry: ShapeEntry; startX: number; startY: number } | null>(null);

  const handleTileClick = (entry: ShapeEntry) => {
    if (entry.kind === "primitive") {
      setTool(entry.tool);
    } else {
      setPendingPathShape(entry.shape);
      setTool("path");
    }
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
      const canvas = el.closest("#figurein-canvas");
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
          const { canvas, elements, addElement, selectElement } =
            useEditorStore.getState();
          const rawX = (e.clientX - rect.left - canvas.panX) / canvas.zoom;
          const rawY = (e.clientY - rect.top - canvas.panY) / canvas.zoom;
          const el = buildElementForDrop(press.entry, rawX, rawY, elements.length);
          addElement(el);
          selectElement(el.id);
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
    return tool === "path" && pendingPathShape?.id === entry.shape.id;
  };

  const labelFor = (entry: ShapeEntry) =>
    entry.kind === "primitive" ? entry.label : entry.shape.label;

  const keyFor = (entry: ShapeEntry) =>
    entry.kind === "primitive" ? `p-${entry.tool}` : `f-${entry.shape.id}`;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[11px] font-semibold text-foreground/70">
          Shapes
        </h3>
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
        <div className="grid grid-cols-3 gap-1.5">
          {ENTRIES.map((entry) => {
            const active = isActive(entry);
            return (
              <button
                key={keyFor(entry)}
                type="button"
                onMouseDown={(e) => handleTileMouseDown(e, entry)}
                onClick={() => handleTileClick(entry)}
                className={cn(
                  "flex cursor-grab flex-col items-center gap-1 rounded-md border p-2 transition-colors active:cursor-grabbing",
                  active
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "border-transparent hover:bg-muted"
                )}
                title={labelFor(entry)}
              >
                <TilePreview entry={entry} />
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                  {labelFor(entry)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-[11px] font-semibold text-foreground/70">
          Text
        </h3>
        {textVariantOrder.map((v) => {
          const variant = TEXT_VARIANTS[v];
          const active = tool === "text" && textVariant === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                setTextVariant(v);
                setTool("text");
              }}
              className={cn(
                "flex items-center justify-between rounded-md border border-transparent px-3 py-2 text-left transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
            >
              <span
                style={{
                  fontSize: Math.min(variant.fontSize, 22),
                  fontWeight: variant.fontWeight,
                  lineHeight: 1.1,
                }}
              >
                {variant.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {variant.fontSize}
              </span>
            </button>
          );
        })}
      </div>

      {drag && <DragPreview drag={drag} />}
    </div>
  );
}
