"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { COLOR_PRESETS } from "@/lib/constants";
import { Bold, Italic, Underline, Strikethrough, Palette } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Run an execCommand without disturbing the contentEditable's selection.
 *  Callers invoke this from `onMouseDown` with `e.preventDefault()`, which
 *  keeps focus on the text div. */
function exec(command: string, value?: string) {
  try {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
  } catch {
    // Some browsers throw if the command isn't supported — silently ignore.
  }
}

/** Inspects the current selection and returns a flag set for the active
 *  formatting commands, so the toolbar buttons render a pressed state that
 *  matches where the caret sits. */
function useActiveFormats(editingTextId: string | null) {
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  });
  useEffect(() => {
    if (!editingTextId) return;
    const update = () => {
      try {
        setActive({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strike: document.queryCommandState("strikeThrough"),
        });
      } catch {
        // queryCommandState throws when there's no selection in some
        // browsers — leave the last known state.
      }
    };
    document.addEventListener("selectionchange", update);
    update();
    return () => document.removeEventListener("selectionchange", update);
  }, [editingTextId]);
  return active;
}

/** Floating rich-text toolbar rendered outside the SVG, pinned above the
 *  text element being edited. Buttons call execCommand on the selection:
 *  bold/italic/underline/strikethrough plus per-selection color. Uses
 *  onMouseDown with preventDefault so the text's selection survives the
 *  click — otherwise focus would jump to the button and the command would
 *  apply to an empty range. */
export function TextFormatToolbar() {
  // Gate on `editingTextId` alone so the common pan/idle case never
  // subscribes to `canvas` or `elements` — subscribing to canvas here
  // made every pan frame re-render this component (just to return null)
  // which added up on long pan sessions.
  const editingTextId = useEditorStore((s) => s.editingTextId);
  if (!editingTextId) return null;
  return <TextFormatToolbarInner editingTextId={editingTextId} />;
}

function TextFormatToolbarInner({ editingTextId }: { editingTextId: string }) {
  const elements = useEditorStore((s) => s.elements);
  const canvas = useEditorStore((s) => s.canvas);
  const active = useActiveFormats(editingTextId);
  const [colorOpen, setColorOpen] = useState(false);

  const el = elements.find((e) => e.id === editingTextId);
  if (!el || el.type !== "text") return null;

  // Toolbar sits above the text box in screen space (not scaled with zoom),
  // so it always renders at normal UI size. 40px of vertical room above.
  const left = el.x * canvas.zoom + canvas.panX;
  const top = el.y * canvas.zoom + canvas.panY - 40;

  const btnClass =
    "inline-flex size-7 cursor-pointer items-center justify-center rounded hover:bg-accent text-foreground transition-colors";
  const pressedClass = "bg-accent text-accent-foreground";

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left, top }}
    >
      <div
        className="pointer-events-auto flex items-center gap-0.5 rounded-md border bg-background px-1 py-1 shadow-md"
        onMouseDown={(e) => e.preventDefault()}
      >
        <button
          type="button"
          title="Bold (⌘B)"
          aria-label="Bold"
          className={cn(btnClass, active.bold && pressedClass)}
          onMouseDown={(e) => {
            e.preventDefault();
            exec("bold");
          }}
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          title="Italic (⌘I)"
          aria-label="Italic"
          className={cn(btnClass, active.italic && pressedClass)}
          onMouseDown={(e) => {
            e.preventDefault();
            exec("italic");
          }}
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          title="Underline (⌘U)"
          aria-label="Underline"
          className={cn(btnClass, active.underline && pressedClass)}
          onMouseDown={(e) => {
            e.preventDefault();
            exec("underline");
          }}
        >
          <Underline className="size-3.5" />
        </button>
        <button
          type="button"
          title="Strikethrough"
          aria-label="Strikethrough"
          className={cn(btnClass, active.strike && pressedClass)}
          onMouseDown={(e) => {
            e.preventDefault();
            exec("strikeThrough");
          }}
        >
          <Strikethrough className="size-3.5" />
        </button>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger
            title="Text color"
            aria-label="Text color"
            className={btnClass}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Palette className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent
            side="top"
            className="w-auto p-1.5"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="grid grid-cols-6 gap-1">
              {COLOR_PRESETS.filter((c) => c !== "none").map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={`Set color ${color}`}
                  className="size-6 cursor-pointer rounded border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    exec("foreColor", color);
                  }}
                />
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                type="color"
                aria-label="Custom text color"
                className="h-6 w-8 cursor-pointer rounded border p-0"
                onMouseDown={(e) => e.preventDefault()}
                onInput={(e) => exec("foreColor", (e.target as HTMLInputElement).value)}
              />
              <span className="text-[10px] text-muted-foreground">Custom</span>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
