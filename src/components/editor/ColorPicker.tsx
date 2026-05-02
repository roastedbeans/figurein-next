"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type RefObject,
} from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLOR_PRESETS } from "@/lib/constants";
import { useEditorStore } from "@/stores/editor-store";

// ---------------------------------------------------------------------------
// Color math — HSV <-> RGB <-> Hex (no dependencies)
// ---------------------------------------------------------------------------
type HSV = { h: number; s: number; v: number; a: number };
type RGB = { r: number; g: number; b: number; a: number };

function hsvToRgb({ h, s, v, a }: HSV): RGB {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
    a,
  };
}

function rgbToHsv({ r, g, b, a }: RGB): HSV {
  const r1 = r / 255,
    g1 = g / 255,
    b1 = b / 255;
  const max = Math.max(r1, g1, b1),
    min = Math.min(r1, g1, b1);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r1) h = ((g1 - b1) / d + 6) % 6;
    else if (max === g1) h = (b1 - r1) / d + 2;
    else h = (r1 - g1) / d + 4;
    h *= 60;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max, a };
}

function rgbToHex({ r, g, b, a }: RGB): string {
  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  if (a < 1) {
    return hex + Math.round(a * 255).toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const a = h.length === 8 ? (parseInt(h.slice(6, 8), 16) || 0) / 255 : 1;
  return { r, g, b, a };
}

function parseColor(color: string): HSV {
  if (!color || color === "none" || color === "transparent") {
    return { h: 0, s: 0, v: 1, a: 1 };
  }
  const rgbaMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (rgbaMatch) {
    return rgbToHsv({
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    });
  }
  if (color.startsWith("#")) return rgbToHsv(hexToRgb(color));
  return { h: 0, s: 0, v: 0, a: 1 };
}

function hsvToHex(hsv: HSV): string {
  return rgbToHex(hsvToRgb(hsv));
}

// ---------------------------------------------------------------------------
// Drag hook — shared by square, hue bar, opacity bar
// ---------------------------------------------------------------------------
function useDrag(
  onDrag: (x: number, y: number) => void,
  containerRef: RefObject<HTMLDivElement | null>,
  onEnd?: () => void
) {
  const dragging = useRef(false);

  const getPos = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onDrag(x, y);
    },
    [onDrag, containerRef]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      getPos(e as unknown as MouseEvent);

      const move = (ev: MouseEvent) => {
        if (dragging.current) getPos(ev);
      };
      const up = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        onEnd?.();
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [getPos, onEnd]
  );

  return handleMouseDown;
}

// ---------------------------------------------------------------------------
// Saturation/brightness square
// ---------------------------------------------------------------------------
function SaturationSquare({
  hsv,
  onChange,
  onEnd,
  width,
  height,
}: {
  hsv: HSV;
  onChange: (s: number, v: number) => void;
  onEnd?: () => void;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Paint the gradient
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d", {
      willReadFrequently: true,
    });
    if (!ctx) return;
    ctx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
    ctx.fillRect(0, 0, width, height);
    const white = ctx.createLinearGradient(0, 0, width, 0);
    white.addColorStop(0, "rgba(255,255,255,1)");
    white.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, width, height);
    const black = ctx.createLinearGradient(0, 0, 0, height);
    black.addColorStop(0, "rgba(0,0,0,0)");
    black.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, width, height);
  }, [hsv.h, width, height]);

  const handleDrag = useCallback(
    (x: number, y: number) => onChange(x, 1 - y),
    [onChange]
  );
  const onMouseDown = useDrag(handleDrag, containerRef, onEnd);

  const thumbX = hsv.s * width;
  const thumbY = (1 - hsv.v) * height;

  return (
    <div
      ref={containerRef}
      className="relative cursor-crosshair overflow-hidden rounded"
      style={{ width, height }}
      onMouseDown={onMouseDown}
    >
      <canvas ref={canvasRef} width={width} height={height} className="block" />
      <div
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          left: thumbX,
          top: thumbY,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hue bar
// ---------------------------------------------------------------------------
function HueBar({
  hue,
  onChange,
  onEnd,
  width,
}: {
  hue: number;
  onChange: (h: number) => void;
  onEnd?: () => void;
  width: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 360; i += 30) {
      gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 12);
  }, [width]);

  const handleDrag = useCallback(
    (x: number) => onChange(x * 360),
    [onChange]
  );
  const onMouseDown = useDrag(handleDrag, containerRef, onEnd);

  const left = (hue / 360) * width;

  return (
    <div
      ref={containerRef}
      className="relative cursor-ew-resize"
      style={{ width, height: 12 }}
      onMouseDown={onMouseDown}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={12}
        className="block rounded-full"
      />
      <div
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          left,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.25)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Opacity bar
// ---------------------------------------------------------------------------
function OpacityBar({
  hsv,
  onChange,
  onEnd,
  width,
}: {
  hsv: HSV;
  onChange: (a: number) => void;
  onEnd?: () => void;
  width: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback(
    (x: number) => onChange(Math.round(x * 100) / 100),
    [onChange]
  );
  const onMouseDown = useDrag(handleDrag, containerRef, onEnd);

  const { r, g, b } = hsvToRgb({ ...hsv, a: 1 });
  const left = hsv.a * width;

  return (
    <div
      ref={containerRef}
      className="relative cursor-ew-resize overflow-hidden rounded-full"
      style={{ width, height: 12 }}
      onMouseDown={onMouseDown}
    >
      {/* Checkered background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%), linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%)",
          backgroundSize: "8px 8px",
          backgroundPosition: "0 0, 4px 4px",
        }}
      />
      {/* Color gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, rgba(${r},${g},${b},0) 0%, rgba(${r},${g},${b},1) 100%)`,
        }}
      />
      {/* Thumb */}
      <div
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          left,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.25)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color swatch button
// ---------------------------------------------------------------------------
const NONE_PATTERN =
  "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)";

function ColorSwatch({
  color,
  selected,
  size = 20,
  onClick,
}: {
  color: string;
  selected: boolean;
  size?: number;
  onClick: () => void;
}) {
  const isNone = color === "none";
  return (
    <button
      className={`cursor-pointer rounded-sm border border-border transition-all ${
        selected
          ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
          : "hover:ring-1 hover:ring-muted-foreground/40"
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: isNone ? "transparent" : color,
        backgroundImage: isNone ? NONE_PATTERN : undefined,
        backgroundSize: isNone ? "6px 6px" : undefined,
        backgroundPosition: isNone ? "0 0, 3px 3px" : undefined,
      }}
      onClick={onClick}
    />
  );
}

// ---------------------------------------------------------------------------
// Document colors — derived from canvas elements
// ---------------------------------------------------------------------------
const SKIP_COLORS = new Set(["none", "transparent", ""]);
const PRESET_SET = new Set(COLOR_PRESETS.map((c) => c.toLowerCase()));

function useDocumentColors(): string[] {
  const elements = useEditorStore((s) => s.elements);
  return useMemo(() => {
    const seen = new Set<string>();
    const colors: string[] = [];
    for (const el of elements) {
      const candidates = [el.fill, el.stroke];
      if ("color" in el && typeof el.color === "string") {
        candidates.push(el.color);
      }
      for (const raw of candidates) {
        if (!raw || SKIP_COLORS.has(raw)) continue;
        const normalized = raw.toLowerCase();
        if (PRESET_SET.has(normalized) || seen.has(normalized)) continue;
        seen.add(normalized);
        colors.push(normalized);
      }
    }
    return colors;
  }, [elements]);
}

// ---------------------------------------------------------------------------
// Main color picker field
// ---------------------------------------------------------------------------
const PICKER_WIDTH = 240;
const PICKER_HEIGHT = 140;

interface ColorPickerFieldProps {
  label: string;
  value: string;
  /** Called on preset click, hex commit, and drag end (with history). */
  onChange: (color: string) => void;
  /** Called on every drag tick for instant preview (no history). Falls back to onChange if not provided. */
  onChangeLive?: (color: string) => void;
  allowNone?: boolean;
  /** Swatch-only trigger for floating toolbars — hides the label and hex text. */
  compact?: boolean;
}

export function ColorPickerField({
  label,
  value,
  onChange,
  onChangeLive,
  allowNone = false,
  compact = false,
}: ColorPickerFieldProps) {
  const [hsv, setHsv] = useState<HSV>(() => parseColor(value));
  const [hexInput, setHexInput] = useState(value);
  const docColors = useDocumentColors();
  const isDragging = useRef(false);

  const liveEmit = onChangeLive ?? onChange;

  // Sync from external value changes
  useEffect(() => {
    setHsv(parseColor(value));
    setHexInput(value);
  }, [value]);

  // Immediate color emit during drag — no debounce, no history
  const emitLive = useCallback(
    (newHsv: HSV) => {
      const hex = hsvToHex(newHsv);
      setHexInput(hex);
      if (!isDragging.current) {
        // First tick of a new drag — snapshot history before mutating
        isDragging.current = true;
        useEditorStore.getState().pushHistory();
      }
      liveEmit(hex);
    },
    [liveEmit]
  );

  // Called when drag ends
  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleSatChange = useCallback(
    (s: number, v: number) => {
      const next = { ...hsv, s, v };
      setHsv(next);
      emitLive(next);
    },
    [hsv, emitLive]
  );

  const handleHueChange = useCallback(
    (h: number) => {
      const next = { ...hsv, h };
      setHsv(next);
      emitLive(next);
    },
    [hsv, emitLive]
  );

  const handleOpacityChange = useCallback(
    (a: number) => {
      const next = { ...hsv, a };
      setHsv(next);
      emitLive(next);
    },
    [hsv, emitLive]
  );

  const handleHexCommit = useCallback(() => {
    let v = hexInput.trim();
    if (v && !v.startsWith("#")) v = "#" + v;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
      const newHsv = parseColor(v);
      setHsv(newHsv);
      onChange(hsvToHex(newHsv));
    } else {
      setHexInput(value);
    }
  }, [hexInput, value, onChange]);

  const selectPreset = useCallback(
    (c: string) => {
      if (c === "none") {
        onChange("none");
        setHexInput("none");
        return;
      }
      const newHsv = parseColor(c);
      setHsv(newHsv);
      onChange(c);
      setHexInput(c);
    },
    [onChange]
  );

  const isNone = value === "none" || value === "transparent";
  const displayColor = isNone ? "transparent" : value;

  const trigger = compact ? (
    <PopoverTrigger
      title={label}
      aria-label={label}
      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border bg-background p-0.5 hover:bg-accent"
    >
      <span
        className="block size-full rounded-[3px] border border-border/60"
        style={{
          backgroundColor: displayColor,
          backgroundImage: isNone ? NONE_PATTERN : undefined,
          backgroundSize: isNone ? "6px 6px" : undefined,
          backgroundPosition: isNone ? "0 0, 3px 3px" : undefined,
        }}
      />
    </PopoverTrigger>
  ) : (
    <PopoverTrigger className="flex h-7 w-full cursor-pointer items-center gap-2 rounded border bg-background px-2 text-xs hover:bg-accent">
      <span
        className="inline-block size-4 shrink-0 rounded-sm border"
        style={{
          backgroundColor: displayColor,
          backgroundImage: isNone ? NONE_PATTERN : undefined,
          backgroundSize: isNone ? "6px 6px" : undefined,
          backgroundPosition: isNone ? "0 0, 3px 3px" : undefined,
        }}
      />
      <span className="flex-1 truncate font-mono">
        {isNone ? "None" : value}
      </span>
    </PopoverTrigger>
  );

  const popoverContent = (
    <PopoverContent side={compact ? "bottom" : "left"} sideOffset={8} className="w-[264px] p-0">
            <div className="flex flex-col">
              {/* Saturation square */}
              <div className="p-3 pb-2">
                <SaturationSquare
                  hsv={hsv}
                  onChange={handleSatChange}
                  onEnd={handleDragEnd}
                  width={PICKER_WIDTH}
                  height={PICKER_HEIGHT}
                />
                {/* Hue bar */}
                <div className="mt-3">
                  <HueBar
                    hue={hsv.h}
                    onChange={handleHueChange}
                    onEnd={handleDragEnd}
                    width={PICKER_WIDTH}
                  />
                </div>
                {/* Opacity bar */}
                <div className="mt-2">
                  <OpacityBar
                    hsv={hsv}
                    onChange={handleOpacityChange}
                    onEnd={handleDragEnd}
                    width={PICKER_WIDTH}
                  />
                </div>
              </div>

              {/* Hex input */}
              <div className="border-t px-3 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-7 shrink-0 rounded border"
                    style={{
                      backgroundColor: isNone ? "transparent" : value,
                    }}
                  />
                  <Input
                    value={hexInput}
                    onChange={(e) => setHexInput(e.target.value)}
                    onBlur={handleHexCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleHexCommit();
                    }}
                    className="h-7 font-mono text-xs"
                    placeholder="#000000"
                  />
                </div>
              </div>

              {/* Preset colors */}
              <div className="border-t px-3 py-2">
                <span className="text-[11px] font-semibold text-foreground/70">
                  Presets
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {COLOR_PRESETS.filter((c) =>
                    allowNone ? true : c !== "none"
                  ).map((c) => (
                    <ColorSwatch
                      key={c}
                      color={c}
                      selected={value === c}
                      onClick={() => selectPreset(c)}
                    />
                  ))}
                </div>
              </div>

              {/* Document colors */}
              {docColors.length > 0 && (
                <div className="border-t px-3 py-2">
                  <span className="text-[11px] font-semibold text-foreground/70">
                    Document colors
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {docColors.map((c) => (
                      <ColorSwatch
                        key={c}
                        color={c}
                        selected={value.toLowerCase() === c}
                        onClick={() => selectPreset(c)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No color button */}
              {allowNone && (
                <div className="border-t px-3 py-2">
                  <button
                    className={`flex h-7 w-full items-center justify-center rounded border text-xs transition-colors ${
                      isNone
                        ? "border-primary bg-primary/5 font-medium text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                    onClick={() => selectPreset("none")}
                  >
                    No color
                  </button>
                </div>
              )}
            </div>
    </PopoverContent>
  );

  if (compact) {
    return (
      <Popover>
        {trigger}
        {popoverContent}
      </Popover>
    );
  }

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">
        <Popover>
          {trigger}
          {popoverContent}
        </Popover>
      </div>
    </div>
  );
}
