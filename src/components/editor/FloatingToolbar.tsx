"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { elementById, useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { DragNumberInput } from "@/components/ui/drag-number-input";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyCenter,
  LayoutGrid,
  Bold,
  Italic,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftRight,
  Copy,
  Trash2,
  Lock,
  Unlock,
} from "lucide-react";
import { ColorPickerField } from "@/components/editor/ColorPicker";
import { ReplacePopover, isReplaceable } from "@/components/editor/ReplacePopover";
import { cn } from "@/lib/utils";
import type { ArrowElement as ArrowElementType, EditorElement, StrokeStyle } from "@/types/editor";
import { SNAP_SIZE, TEXT_VARIANTS } from "@/lib/constants";

type EndStyle = "triangle" | "open" | "none";
const END_STYLES: EndStyle[] = ["triangle", "open", "none"];
const END_LABEL: Record<EndStyle, string> = {
  triangle: "Solid",
  open: "Open",
  none: "None",
};

/** Small SVG preview of an arrow end — the head sits on the right side and
 *  the tail sits on the left. Uses currentColor so it picks up button text. */
function ArrowEndIcon({
  style,
  side,
}: {
  style: EndStyle;
  side: "left" | "right";
}) {
  const W = 22;
  const H = 10;
  const y = H / 2;
  const HEAD = 6;
  const SW = 1.5;

  if (side === "left") {
    const lineStart = style === "none" ? 0 : HEAD;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        {style === "triangle" && (
          <path
            d={`M 0 ${y} L ${HEAD} 2 L ${HEAD} ${H - 2} Z`}
            fill="currentColor"
          />
        )}
        {style === "open" && (
          <polyline
            points={`${HEAD},2 0,${y} ${HEAD},${H - 2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={SW}
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
        )}
        <line
          x1={lineStart}
          y1={y}
          x2={W}
          y2={y}
          stroke="currentColor"
          strokeWidth={SW}
        />
      </svg>
    );
  }

  const lineEnd = style === "none" ? W : W - HEAD;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <line
        x1={0}
        y1={y}
        x2={lineEnd}
        y2={y}
        stroke="currentColor"
        strokeWidth={SW}
      />
      {style === "triangle" && (
        <path
          d={`M ${W} ${y} L ${W - HEAD} 2 L ${W - HEAD} ${H - 2} Z`}
          fill="currentColor"
        />
      )}
      {style === "open" && (
        <polyline
          points={`${W - HEAD},2 ${W},${y} ${W - HEAD},${H - 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={SW}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      )}
    </svg>
  );
}

type LineStyle = "straight" | "curved" | "elbow";

/** Small SVG showing the shape of each line-style option. Uses currentColor
 *  so the icon picks up the toggle's text color (active vs muted). */
function LineStylePreview({ style }: { style: LineStyle }) {
  const W = 24;
  const H = 12;
  const SW = 1.75;
  const d =
    style === "straight"
      ? `M 2 ${H / 2} L ${W - 2} ${H / 2}`
      : style === "curved"
        ? `M 2 ${H / 2} Q ${W / 4} 0, ${W / 2} ${H / 2} T ${W - 2} ${H / 2}`
        : `M 2 3 H ${W / 2} V ${H - 3} H ${W - 2}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const LINE_STYLES: LineStyle[] = ["straight", "curved", "elbow"];
const LINE_STYLE_LABEL: Record<LineStyle, string> = {
  straight: "Straight",
  curved: "Curved",
  elbow: "Elbow",
};

function LineStylePicker({
  value,
  onChange,
}: {
  value: LineStyle;
  onChange: (v: LineStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Line style"
        title={`Line style: ${LINE_STYLE_LABEL[value]}`}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border bg-background hover:bg-accent"
      >
        <LineStylePreview style={value} />
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-auto p-1">
        <div className="flex gap-1">
          {LINE_STYLES.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              title={LINE_STYLE_LABEL[opt]}
              aria-label={LINE_STYLE_LABEL[opt]}
              className={cn(
                "inline-flex size-9 cursor-pointer items-center justify-center rounded-md border transition-colors",
                value === opt
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-foreground hover:bg-accent"
              )}
            >
              <LineStylePreview style={opt} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const STROKE_STYLES: StrokeStyle[] = ["solid", "dashed", "dotted"];
const STROKE_STYLE_LABEL: Record<StrokeStyle, string> = {
  solid: "Solid",
  dashed: "Dashed",
  dotted: "Dotted",
};

/** Small SVG showing each stroke-style option as a horizontal line. */
function StrokeStylePreview({ style }: { style: StrokeStyle }) {
  const W = 24;
  const H = 8;
  const y = H / 2;
  const SW = 2;
  const dashArray =
    style === "dashed" ? "5 3" : style === "dotted" ? "1 3" : undefined;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <line
        x1={1}
        y1={y}
        x2={W - 1}
        y2={y}
        stroke="currentColor"
        strokeWidth={SW}
        strokeDasharray={dashArray}
        strokeLinecap={style === "dotted" ? "round" : "butt"}
      />
    </svg>
  );
}

function StrokeStylePicker({
  value,
  onChange,
}: {
  value: StrokeStyle;
  onChange: (v: StrokeStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Stroke style"
        title={`Stroke style: ${STROKE_STYLE_LABEL[value]}`}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border bg-background hover:bg-accent"
      >
        <StrokeStylePreview style={value} />
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-auto p-1">
        <div className="flex gap-1">
          {STROKE_STYLES.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              title={STROKE_STYLE_LABEL[opt]}
              aria-label={STROKE_STYLE_LABEL[opt]}
              className={cn(
                "inline-flex size-9 cursor-pointer items-center justify-center rounded-md border transition-colors",
                value === opt
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-foreground hover:bg-accent"
              )}
            >
              <StrokeStylePreview style={opt} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type TextAlign = "left" | "center" | "right";
const TEXT_ALIGNS: TextAlign[] = ["left", "center", "right"];
const TEXT_ALIGN_LABEL: Record<TextAlign, string> = {
  left: "Align left",
  center: "Align center",
  right: "Align right",
};
const TEXT_ALIGN_ICON: Record<TextAlign, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

function TextAlignPicker({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (v: TextAlign) => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = TEXT_ALIGN_ICON[value];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Text alignment"
        title={`Alignment: ${TEXT_ALIGN_LABEL[value]}`}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border bg-background hover:bg-accent"
      >
        <Icon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-auto p-1">
        <div className="flex gap-1">
          {TEXT_ALIGNS.map((opt) => {
            const OptIcon = TEXT_ALIGN_ICON[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                title={TEXT_ALIGN_LABEL[opt]}
                aria-label={TEXT_ALIGN_LABEL[opt]}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-md border transition-colors",
                  value === opt
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-foreground hover:bg-accent"
                )}
              >
                <OptIcon className="size-4" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type VerticalAlign = "top" | "middle" | "bottom";
const VERTICAL_ALIGNS: VerticalAlign[] = ["top", "middle", "bottom"];
const VERTICAL_ALIGN_LABEL: Record<VerticalAlign, string> = {
  top: "Align top",
  middle: "Align middle",
  bottom: "Align bottom",
};
const VERTICAL_ALIGN_ICON: Record<VerticalAlign, typeof AlignStartHorizontal> = {
  top: AlignStartHorizontal,
  middle: AlignCenterHorizontal,
  bottom: AlignEndHorizontal,
};

function VerticalAlignPicker({
  value,
  onChange,
}: {
  value: VerticalAlign;
  onChange: (v: VerticalAlign) => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = VERTICAL_ALIGN_ICON[value];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Vertical alignment"
        title={`Vertical: ${VERTICAL_ALIGN_LABEL[value]}`}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border bg-background hover:bg-accent"
      >
        <Icon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-auto p-1">
        <div className="flex gap-1">
          {VERTICAL_ALIGNS.map((opt) => {
            const OptIcon = VERTICAL_ALIGN_ICON[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                title={VERTICAL_ALIGN_LABEL[opt]}
                aria-label={VERTICAL_ALIGN_LABEL[opt]}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-md border transition-colors",
                  value === opt
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-foreground hover:bg-accent"
                )}
              >
                <OptIcon className="size-4" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ArrowEndPicker({
  side,
  value,
  onChange,
}: {
  side: "left" | "right";
  value: EndStyle;
  onChange: (v: EndStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={side === "left" ? "Arrow tail" : "Arrow head"}
        title={side === "left" ? "Arrow tail" : "Arrow head"}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border bg-background hover:bg-accent"
      >
        <ArrowEndIcon style={value} side={side} />
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-auto p-1">
        <div className="flex gap-1">
          {END_STYLES.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              title={END_LABEL[opt]}
              aria-label={END_LABEL[opt]}
              className={cn(
                "inline-flex size-9 cursor-pointer items-center justify-center rounded-md border transition-colors",
                value === opt
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-foreground hover:bg-accent"
              )}
            >
              <ArrowEndIcon style={opt} side={side} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Tiny labeled number field. The label is rendered inside the field and
 *  shares the drag-to-adjust behavior, so there is one visual control per
 *  property (not "label + input" as two separate regions). */
function NumberField({
  label,
  ...props
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  onChangeLive?: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  sensitivity?: number;
}) {
  return <DragNumberInput aria-label={label} label={label} {...props} />;
}

const TEXT_PRESET_VARIANTS = [
  { key: "heading", label: "Heading", short: "H" },
  { key: "subheading", label: "Subheading", short: "Sub" },
  { key: "body", label: "Body", short: "Body" },
  { key: "caption", label: "Caption", short: "Cap" },
] as const;

function TextPresetPicker({
  fontSize,
  fontWeight,
  onChange,
}: {
  fontSize: number;
  fontWeight: "normal" | "bold";
  onChange: (fontSize: number, fontWeight: "normal" | "bold") => void;
}) {
  const [open, setOpen] = useState(false);
  const active = TEXT_PRESET_VARIANTS.find(
    (p) =>
      TEXT_VARIANTS[p.key].fontSize === fontSize &&
      TEXT_VARIANTS[p.key].fontWeight === fontWeight
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Text style preset"
        title={active ? active.label : "Text style preset"}
        className={cn(
          "inline-flex h-7 cursor-pointer items-center rounded-md border px-1.5 text-[10px] font-medium transition-colors",
          active
            ? "border-primary bg-primary/5 text-primary"
            : "border-transparent bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        {active ? active.short : "—"}
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-auto p-1">
        <div className="flex flex-col gap-0.5">
          {TEXT_PRESET_VARIANTS.map((p) => {
            const vt = TEXT_VARIANTS[p.key];
            const isActive =
              vt.fontSize === fontSize && vt.fontWeight === fontWeight;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onChange(vt.fontSize, vt.fontWeight);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-md px-2 py-1 transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
              >
                <span style={{ fontSize: Math.min(vt.fontSize, 18), fontWeight: vt.fontWeight, lineHeight: 1 }}>
                  {p.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{vt.fontSize}px</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Contextual top toolbar — appears at the top-center of the canvas area
 *  whenever an element is selected and surfaces the selection's properties. */
export function FloatingToolbar() {
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const element = useEditorStore((s) =>
    s.selectedElementId ? elementById(s.elements, s.selectedElementId) ?? null : null
  );
  const editingConnectorLabel = useEditorStore((s) => s.editingConnectorLabel);
  const {
    updateElement,
    updateElementLive,
    deleteElement,
    deleteElements,
    bringToFront,
    sendToBack,
    duplicateElement,
    alignSelection,
    distributeSelection,
    tidySelection,
  } = useEditorStore(
    useShallow((s) => ({
      updateElement: s.updateElement,
      updateElementLive: s.updateElementLive,
      deleteElement: s.deleteElement,
      deleteElements: s.deleteElements,
      bringToFront: s.bringToFront,
      sendToBack: s.sendToBack,
      duplicateElement: s.duplicateElement,
      alignSelection: s.alignSelection,
      distributeSelection: s.distributeSelection,
      tidySelection: s.tidySelection,
    }))
  );

  // Multi-select: alignment + distribution toolbar. The canvas is the
  // implicit parent — no grouping required to align / distribute / delete.
  if (selectedIds.length > 1) {
    return (
      <MultiSelectToolbar
        ids={selectedIds}
        onAlign={(axis) => alignSelection(selectedIds, axis)}
        onDistribute={(axis) => distributeSelection(selectedIds, axis)}
        onTidy={() => tidySelection(selectedIds)}
        onDelete={() => deleteElements(selectedIds)}
      />
    );
  }

  if (!element) return null;

  const update = (updates: Partial<EditorElement>) =>
    updateElement(element.id, updates);
  const updateLive = (updates: Partial<EditorElement>) =>
    updateElementLive(element.id, updates);

  // Width/height fields are meaningless for lines/arrows (those use x2/y2
  // endpoints instead), so only the position is editable for those types.
  const isConnector = element.type === "arrow";
  const supportsAspectLock = !isConnector;
  const ratio =
    element.height > 0 ? element.width / element.height : 1;
  // Round to the nearest snap unit so the aspect-locked partner dimension
  // stays on the same grid the canvas resize + placement logic uses.
  const snapUnit = (n: number) =>
    Math.max(SNAP_SIZE, Math.round(n / SNAP_SIZE) * SNAP_SIZE);
  const applyWidth = (width: number, live: boolean) => {
    const updates: Partial<EditorElement> = { width };
    if (element.aspectLocked) {
      updates.height = snapUnit(width / ratio);
    }
    (live ? updateLive : update)(updates);
  };
  const applyHeight = (height: number, live: boolean) => {
    const updates: Partial<EditorElement> = { height };
    if (element.aspectLocked) {
      updates.width = snapUnit(height * ratio);
    }
    (live ? updateLive : update)(updates);
  };

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-black/5 bg-background/95 px-2 py-1.5 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_8px_24px_-8px_rgb(0_0_0/0.18),0_2px_6px_-2px_rgb(0_0_0/0.08)]">
        {/* Position + size. step=SNAP_SIZE keeps typed/dragged edits on the
            same grid the canvas uses, so nudging W or H doesn't push the
            element half a pixel off alignment. */}
        <NumberField
          label="X"
          value={element.x}
          onChange={(x) => update({ x })}
          onChangeLive={(x) => updateLive({ x })}
          step={SNAP_SIZE}
          sensitivity={1}
        />
        <NumberField
          label="Y"
          value={element.y}
          onChange={(y) => update({ y })}
          onChangeLive={(y) => updateLive({ y })}
          step={SNAP_SIZE}
          sensitivity={1}
        />
        {!isConnector && (
          <>
            <NumberField
              label="W"
              value={element.width}
              onChange={(w) => applyWidth(w, false)}
              onChangeLive={(w) => applyWidth(w, true)}
              min={SNAP_SIZE}
              step={SNAP_SIZE}
              sensitivity={1}
            />
            <NumberField
              label="H"
              value={element.height}
              onChange={(h) => applyHeight(h, false)}
              onChangeLive={(h) => applyHeight(h, true)}
              min={SNAP_SIZE}
              step={SNAP_SIZE}
              sensitivity={1}
            />
            {supportsAspectLock && (
              <Toggle
                size="sm"
                pressed={element.aspectLocked === true}
                onPressedChange={(p) => update({ aspectLocked: p })}
                aria-label="Lock aspect ratio"
                title={
                  element.aspectLocked
                    ? "Aspect ratio locked (resize keeps w:h)"
                    : "Lock aspect ratio"
                }
              >
                {element.aspectLocked ? (
                  <Lock className="size-3.5" />
                ) : (
                  <Unlock className="size-3.5" />
                )}
              </Toggle>
            )}
          </>
        )}

        <Separator orientation="vertical" className="mx-0.5" />

        {/* Fill + stroke color swatches */}
        <ColorPickerField
          compact
          allowNone
          label="Fill"
          value={element.fill}
          onChange={(fill) => update({ fill })}
          onChangeLive={(fill) => updateLive({ fill })}
        />
        <ColorPickerField
          compact
          allowNone
          label="Stroke"
          value={element.stroke}
          onChange={(stroke) => update({ stroke })}
          onChangeLive={(stroke) => updateLive({ stroke })}
        />
        {element.type !== "icon" && element.type !== "image" && (
          <StrokeStylePicker
            value={element.strokeStyle ?? "solid"}
            onChange={(strokeStyle) => update({ strokeStyle })}
          />
        )}

        <Separator orientation="vertical" className="mx-0.5" />

        {/* Stroke width + opacity + radius form the "appearance" cluster —
            dimensions that tune how the shape's surface reads. */}
        <NumberField
          label="Stroke"
          value={element.strokeWidth}
          onChange={(strokeWidth) => update({ strokeWidth })}
          onChangeLive={(strokeWidth) => updateLive({ strokeWidth })}
          min={0}
          max={10}
          step={0.5}
          sensitivity={0.25}
        />
        <NumberField
          label="Opacity"
          value={element.opacity}
          onChange={(opacity) => update({ opacity })}
          onChangeLive={(opacity) => updateLive({ opacity })}
          min={0}
          max={1}
          step={0.05}
          sensitivity={0.2}
        />
        {element.type === "rectangle" && (
          <NumberField
            label="Radius"
            value={element.borderRadius}
            onChange={(borderRadius) => update({ borderRadius })}
            onChangeLive={(borderRadius) => updateLive({ borderRadius })}
            min={0}
            max={50}
          />
        )}
        {element.type === "text" && (
          <NumberField
            label="Radius"
            value={element.borderRadius ?? 0}
            onChange={(borderRadius) => update({ borderRadius })}
            onChangeLive={(borderRadius) => updateLive({ borderRadius })}
            min={0}
            max={50}
          />
        )}

        {/* Text-specific: font size/weight/style/align + text color */}
        {element.type === "text" && (
          <>
            <Separator orientation="vertical" className="mx-0.5" />
            <NumberField
              label="Size"
              value={element.fontSize}
              onChange={(fontSize) => update({ fontSize })}
              onChangeLive={(fontSize) => updateLive({ fontSize })}
              min={8}
              max={200}
            />
            <TextPresetPicker
              fontSize={element.fontSize}
              fontWeight={element.fontWeight}
              onChange={(fontSize, fontWeight) => update({ fontSize, fontWeight })}
            />
            <div className="flex gap-0.5">
              <Toggle
                size="sm"
                pressed={element.fontWeight === "bold"}
                onPressedChange={(p) =>
                  update({ fontWeight: p ? "bold" : "normal" })
                }
                aria-label="Bold"
                title="Bold"
              >
                <Bold className="size-3.5" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={element.fontStyle === "italic"}
                onPressedChange={(p) =>
                  update({ fontStyle: p ? "italic" : "normal" })
                }
                aria-label="Italic"
                title="Italic"
              >
                <Italic className="size-3.5" />
              </Toggle>
            </div>
            <TextAlignPicker
              value={element.textAlign}
              onChange={(textAlign) => update({ textAlign })}
            />
            <VerticalAlignPicker
              value={element.verticalAlign ?? "top"}
              onChange={(verticalAlign) => update({ verticalAlign })}
            />
            <ColorPickerField
              compact
              label="Text color"
              value={element.color}
              onChange={(color) => update({ color })}
              onChangeLive={(color) => updateLive({ color })}
            />
          </>
        )}

        {/* Line / Arrow: path style + heads */}
        {(element.type === "arrow") && (
          <>
            <Separator orientation="vertical" className="mx-0.5" />
            <LineStylePicker
              value={(element.lineStyle || "straight") as LineStyle}
              onChange={(lineStyle) =>
                update({
                  lineStyle,
                  cx: undefined,
                  cy: undefined,
                  elbowMidRatio: undefined,
                  elbowCorners: undefined,
                } as Partial<EditorElement>)
              }
            />
            <div className="flex items-center gap-0.5">
              <ArrowEndPicker
                side="left"
                value={element.tailStyle}
                onChange={(tailStyle) => update({ tailStyle })}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                title="Swap direction"
                aria-label="Swap arrow direction"
                onClick={() =>
                  update({
                    headStyle: element.tailStyle,
                    tailStyle: element.headStyle,
                  })
                }
              >
                <ArrowLeftRight className="size-3.5" />
              </Button>
              <ArrowEndPicker
                side="right"
                value={element.headStyle}
                onChange={(headStyle) => update({ headStyle })}
              />
            </div>
          </>
        )}

        {/* Connector labels */}
        {(element.type === "arrow") && editingConnectorLabel?.id !== element.id && (
          <>
            <Separator orientation="vertical" className="mx-0.5" />
            {element.type === "arrow" && (
              <input
                type="text"
                placeholder="Source label"
                value={(element as ArrowElementType).sourceLabel ?? ""}
                onChange={(e) =>
                  updateLive({
                    sourceLabel: e.target.value || undefined,
                  } as Partial<EditorElement>)
                }
                onBlur={(e) =>
                  update({
                    sourceLabel: e.target.value || undefined,
                  } as Partial<EditorElement>)
                }
                className="h-7 w-[72px] rounded-md border bg-background px-1.5 text-xs"
              />
            )}
            <input
              type="text"
              placeholder="Label"
              value={(element as ArrowElementType).label ?? ""}
              onChange={(e) =>
                updateLive({
                  label: e.target.value || undefined,
                } as Partial<EditorElement>)
              }
              onBlur={(e) =>
                update({
                  label: e.target.value || undefined,
                } as Partial<EditorElement>)
              }
              className="h-7 w-[72px] rounded-md border bg-background px-1.5 text-xs"
            />
            {element.type === "arrow" && (
              <input
                type="text"
                placeholder="Target label"
                value={(element as ArrowElementType).targetLabel ?? ""}
                onChange={(e) =>
                  updateLive({
                    targetLabel: e.target.value || undefined,
                  } as Partial<EditorElement>)
                }
                onBlur={(e) =>
                  update({
                    targetLabel: e.target.value || undefined,
                  } as Partial<EditorElement>)
                }
                className="h-7 w-[72px] rounded-md border bg-background px-1.5 text-xs"
              />
            )}
          </>
        )}

        {/* Icon: color tint */}
        {element.type === "icon" && (
          <>
            <Separator orientation="vertical" className="mx-0.5" />
            <ColorPickerField
              compact
              label="Icon color"
              value={element.color}
              onChange={(color) => update({ color })}
              onChangeLive={(color) => updateLive({ color })}
            />
          </>
        )}

        <Separator orientation="vertical" className="mx-0.5" />

        {/* Swap the element for a different icon or shape, keeping the
            current bounding box. Only shown for replaceable types. */}
        {isReplaceable(element) && <ReplacePopover element={element} />}

        {/* Layer + quick actions */}
        <Button
          variant="ghost"
          size="icon-sm"
          title="Bring to front"
          onClick={() => bringToFront(element.id)}
        >
          <ArrowUpToLine className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Send to back"
          onClick={() => sendToBack(element.id)}
        >
          <ArrowDownToLine className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Duplicate"
          onClick={() => duplicateElement(element.id)}
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Delete"
          onClick={() => deleteElement(element.id)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

type AlignAxis =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

/** Multi-select variant of the floating toolbar. Surfaces the alignment +
 *  distribution actions standard in Figma / Canva / similar — operating on
 *  the selection's combined bbox without requiring a parent frame. */
function MultiSelectToolbar({
  ids,
  onAlign,
  onDistribute,
  onTidy,
  onDelete,
}: {
  ids: string[];
  onAlign: (axis: AlignAxis) => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
  onTidy: () => void;
  onDelete: () => void;
}) {
  // Distribution needs at least 3 elements (two endpoints + at least one
  // interior to spread). With 2, the buttons go inert — they'd no-op.
  const canDistribute = ids.length >= 3;
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-10 -translate-x-1/2">
      <div className="flex items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_8px_24px_-8px_rgb(0_0_0/0.18),0_2px_6px_-2px_rgb(0_0_0/0.08)] backdrop-blur">
        <span className="px-1.5 text-[11px] font-medium text-muted-foreground">
          {ids.length} selected
        </span>
        <Separator orientation="vertical" className="mx-0.5 h-5" />

        <Button
          variant="ghost"
          size="icon-sm"
          title="Align left"
          onClick={() => onAlign("left")}
        >
          <AlignLeft className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Align center horizontally"
          onClick={() => onAlign("center-x")}
        >
          <AlignCenter className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Align right"
          onClick={() => onAlign("right")}
        >
          <AlignRight className="size-3.5" />
        </Button>

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        <Button
          variant="ghost"
          size="icon-sm"
          title="Align top"
          onClick={() => onAlign("top")}
        >
          <AlignStartHorizontal className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Align middle vertically"
          onClick={() => onAlign("center-y")}
        >
          <AlignCenterHorizontal className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Align bottom"
          onClick={() => onAlign("bottom")}
        >
          <AlignEndHorizontal className="size-3.5" />
        </Button>

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        <Button
          variant="ghost"
          size="icon-sm"
          title="Distribute horizontally (need 3+)"
          onClick={() => onDistribute("horizontal")}
          disabled={!canDistribute}
        >
          <AlignHorizontalJustifyCenter className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Distribute vertically (need 3+)"
          onClick={() => onDistribute("vertical")}
          disabled={!canDistribute}
        >
          <AlignVerticalJustifyCenter className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Even spacing both axes (need 3+)"
          onClick={onTidy}
          disabled={!canDistribute}
        >
          <LayoutGrid className="size-3.5" />
        </Button>

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        <Button
          variant="ghost"
          size="icon-sm"
          title="Delete selection"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
