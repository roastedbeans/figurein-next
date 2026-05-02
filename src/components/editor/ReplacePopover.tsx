"use client";

import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Replace, Search } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { searchIcons, getIconUrl } from "@/components/icons";
import { FLOWCHART_SHAPES } from "@/lib/flowchart-shapes";
import type { EditorElement } from "@/types/editor";
import { cn } from "@/lib/utils";

// Replaceable types — everything that has a meaningful "look" the user
// might want to swap. Connectors (line/arrow) are excluded because
// "replacing" an arrow doesn't have a natural UX beyond toggling its
// head/tail (which the toolbar already exposes).
export function isReplaceable(el: EditorElement): boolean {
  return (
    el.type === "icon" ||
    el.type === "rectangle" ||
    el.type === "circle" ||
    el.type === "path"
  );
}

type TileProps = {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function Tile({ active, label, onClick, children }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-10 cursor-pointer items-center justify-center rounded-md border transition-colors",
        active
          ? "border-primary/40 bg-accent text-accent-foreground"
          : "border-transparent hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

function ShapeTilePreview({
  viewBox,
  pathData,
}: {
  viewBox: string;
  pathData: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none size-7 text-foreground"
      aria-hidden
    >
      <path
        d={pathData}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ICON_RESULT_CAP = 120;

export function ReplacePopover({ element }: { element: EditorElement }) {
  const replaceElement = useEditorStore((s) => s.replaceElement);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Cap the visible icon grid — the popover is a picker, not a full browser,
  // and rendering 1.3k tiles inside a Radix popover is measurably laggy.
  const icons = useMemo(
    () => searchIcons(query).slice(0, ICON_RESULT_CAP),
    [query]
  );

  const close = () => setOpen(false);

  const currentIconId = element.type === "icon" ? element.iconId : null;
  const currentPathData = element.type === "path" ? element.pathData : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Replace element"
        title="Replace with…"
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-accent"
      >
        <Replace className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80 p-3">
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-foreground/70">
              Shapes
            </p>
            <div className="grid grid-cols-7 gap-1">
              <Tile
                active={element.type === "rectangle"}
                label="Rectangle"
                onClick={() => {
                  replaceElement(element.id, { kind: "rectangle" });
                  close();
                }}
              >
                <svg
                  viewBox="0 0 100 60"
                  className="pointer-events-none size-7 text-foreground"
                  aria-hidden
                >
                  <rect
                    x="8"
                    y="10"
                    width="84"
                    height="40"
                    rx="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                  />
                </svg>
              </Tile>
              <Tile
                active={element.type === "circle"}
                label="Circle"
                onClick={() => {
                  replaceElement(element.id, { kind: "circle" });
                  close();
                }}
              >
                <svg
                  viewBox="0 0 100 60"
                  className="pointer-events-none size-7 text-foreground"
                  aria-hidden
                >
                  <ellipse
                    cx="50"
                    cy="30"
                    rx="38"
                    ry="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                  />
                </svg>
              </Tile>
              {FLOWCHART_SHAPES.map((shape) => (
                <Tile
                  key={shape.id}
                  active={currentPathData === shape.pathData}
                  label={shape.label}
                  onClick={() => {
                    replaceElement(element.id, {
                      kind: "flowchart",
                      pathData: shape.pathData,
                      viewBox: shape.viewBox,
                    });
                    close();
                  }}
                >
                  <ShapeTilePreview
                    viewBox={shape.viewBox}
                    pathData={shape.pathData}
                  />
                </Tile>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-foreground/70">
              Icons
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search icons..."
                className="h-7 pl-7 text-xs"
                autoFocus
              />
            </div>
            <div className="grid max-h-60 grid-cols-7 gap-1 overflow-y-auto">
              {icons.map((icon) => (
                <Tile
                  key={icon.id}
                  active={icon.id === currentIconId}
                  label={icon.label}
                  onClick={() => {
                    replaceElement(element.id, {
                      kind: "icon",
                      iconId: icon.id,
                    });
                    close();
                  }}
                >
                  <img
                    src={getIconUrl(icon.id)}
                    alt={icon.label}
                    width={24}
                    height={24}
                    loading="lazy"
                    className="pointer-events-none dark:invert"
                  />
                </Tile>
              ))}
              {icons.length === 0 && (
                <p className="col-span-7 py-4 text-center text-xs text-muted-foreground">
                  No icons match &ldquo;{query}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
