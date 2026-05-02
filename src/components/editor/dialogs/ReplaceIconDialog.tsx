"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { searchIcons, getIconUrl } from "@/components/icons";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elementId: string | null;
};

// Cap at 200 tiles — bigger than the toolbar popover (120) since we have more
// space here, but still below the point where grid layout starts to jank.
const ICON_RESULT_CAP = 200;

export function ReplaceIconDialog({ open, onOpenChange, elementId }: Props) {
  const replaceElement = useEditorStore((s) => s.replaceElement);
  const element = useEditorStore((s) =>
    elementId ? s.elements.find((e) => e.id === elementId) : undefined
  );
  const currentIconId =
    element && element.type === "icon" ? element.iconId : null;

  const [query, setQuery] = useState("");

  // Reset the search each time the dialog reopens so a stale query from the
  // previous session doesn't hide results for a freshly-selected icon.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const icons = useMemo(
    () => searchIcons(query).slice(0, ICON_RESULT_CAP),
    [query]
  );

  const handlePick = (iconId: string) => {
    if (!elementId) return;
    replaceElement(elementId, { kind: "icon", iconId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Replace icon</DialogTitle>
          <DialogDescription>
            Pick a new icon. Size, color, and position carry over from the
            current icon.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons..."
            className="h-9 pl-9"
            autoFocus
          />
        </div>

        <div className="-mx-1 grid max-h-[55vh] grid-cols-8 gap-1 overflow-y-auto px-1 pb-1">
          {icons.map((icon) => {
            const active = icon.id === currentIconId;
            return (
              <button
                key={icon.id}
                type="button"
                onClick={() => handlePick(icon.id)}
                title={icon.label}
                aria-label={icon.label}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border transition-colors",
                  active
                    ? "border-primary/50 bg-accent text-accent-foreground"
                    : "border-transparent hover:bg-muted"
                )}
              >
                <img
                  src={getIconUrl(icon.id)}
                  alt={icon.label}
                  width={28}
                  height={28}
                  loading="lazy"
                  className="pointer-events-none dark:invert"
                />
              </button>
            );
          })}
          {icons.length === 0 && (
            <p className="col-span-8 py-8 text-center text-sm text-muted-foreground">
              No icons match &ldquo;{query}&rdquo;
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
