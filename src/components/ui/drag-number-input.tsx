"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DragNumberInputProps = {
  value: number;
  onChange: (next: number) => void;
  /** Called on every mouse-move tick during drag — useful for live previews */
  onChangeLive?: (next: number) => void;
  /** Label shown to the left of the value. Dragging the label adjusts the
   *  value just like dragging the input — gives a bigger drag target. */
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Multiplier applied to pixel delta → value delta (default 1) */
  sensitivity?: number;
  className?: string;
  "aria-label"?: string;
};

/**
 * Number field you adjust by dragging — no spinner buttons. Hover shows a
 * grab hand; press-and-drag (any direction, left/right or up/down) changes
 * the value; a click without movement enters text-edit mode. When a label
 * is supplied it sits inside the field and shares the drag target.
 */
export function DragNumberInput({
  value,
  onChange,
  onChangeLive,
  label,
  min,
  max,
  step = 1,
  sensitivity = 1,
  className,
  ...rest
}: DragNumberInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [editing, setEditing] = React.useState(false);
  const [pressing, setPressing] = React.useState(false);

  const clamp = React.useCallback(
    (n: number) => {
      if (min !== undefined) n = Math.max(min, n);
      if (max !== undefined) n = Math.min(max, n);
      return n;
    },
    [min, max]
  );

  const decimals = React.useMemo(() => {
    const s = String(step);
    const i = s.indexOf(".");
    return i === -1 ? 0 : s.length - i - 1;
  }, [step]);

  const quantize = React.useCallback(
    (n: number) => {
      const s = step || 1;
      const snapped = Math.round(n / s) * s;
      return clamp(Number(snapped.toFixed(decimals)));
    },
    [clamp, step, decimals]
  );

  // Coerce non-finite / missing input to 0. The prop is typed as `number`,
  // but stale store reads or partially-initialized elements can produce
  // undefined or NaN at runtime — better to render a 0 the user can see and
  // edit than to crash the whole toolbar.
  const safeValue = Number.isFinite(value) ? value : 0;

  const formatted = React.useMemo(
    () =>
      decimals > 0
        ? safeValue.toFixed(decimals)
        : String(Math.round(safeValue)),
    [safeValue, decimals]
  );

  const [text, setText] = React.useState<string>(formatted);

  React.useEffect(() => {
    if (!editing) setText(formatted);
  }, [formatted, editing]);

  // Single drag handler on the wrapper so label + input both accept drag.
  // mousedown on the inner input bubbles up here too, so we don't need a
  // second handler — one source of truth.
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editing) return;
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startV = safeValue;
    let moved = false;

    const prevBodyCursor = document.body.style.cursor;
    const prevBodyUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    setPressing(true);

    const compute = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = startY - ev.clientY; // up = positive
      return startV + (dx + dy) * sensitivity * step;
    };

    const onMove = (ev: MouseEvent) => {
      const raw = compute(ev);
      const delta = Math.abs(raw - startV);
      if (!moved && delta < step) return;
      if (!moved) moved = true;
      onChangeLive?.(quantize(raw));
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevBodyCursor;
      document.body.style.userSelect = prevBodyUserSelect;
      setPressing(false);

      if (moved) {
        onChange(quantize(compute(ev)));
      } else {
        setEditing(true);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const commit = () => {
    const n = Number(text);
    if (!Number.isNaN(n) && text.trim() !== "") {
      onChange(quantize(n));
    } else {
      setText(formatted);
    }
    setEditing(false);
  };

  const cursorClass = editing
    ? "cursor-text"
    : pressing
    ? "cursor-grabbing"
    : "cursor-grab";

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "inline-flex h-7 items-center rounded-md border border-input bg-transparent transition-colors",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40",
        !editing && "hover:border-ring/50",
        cursorClass,
        className
      )}
    >
      {label && (
        <span
          className={cn(
            "select-none pl-2 pr-1 text-[11px] font-medium text-muted-foreground",
            cursorClass
          )}
          aria-hidden
        >
          {label}
        </span>
      )}
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={editing ? text : formatted}
        readOnly={!editing}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            setText(formatted);
            setEditing(false);
            inputRef.current?.blur();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(quantize(value + step));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(quantize(value - step));
          }
        }}
        className={cn(
          "h-full w-12 min-w-0 flex-1 border-0 bg-transparent pr-2 text-xs outline-none",
          label ? "pl-0" : "pl-2",
          cursorClass
        )}
      />
    </div>
  );
}
