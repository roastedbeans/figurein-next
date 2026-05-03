"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShapesPanel } from "./ShapesPanel";
import { IconsPanel } from "./IconsPanel";
import { ImagesPanel } from "./ImagesPanel";
import { allIcons } from "@/components/icons";
import { useCustomImagesStore } from "@/stores/custom-images-store";

function AccordionHeader({
  label,
  open,
  onClick,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold tabular-nums text-foreground/70 transition-colors hover:bg-muted/50"
    >
      {label}
      {open ? (
        <ChevronDown className="size-3.5 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

export function Sidebar() {
  const [shapesOpen, setShapesOpen] = useState(true);
  const [iconsOpen, setIconsOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);

  const imageCount = useCustomImagesStore((s) => s.images.length);

  const capShapes =
    iconsOpen || imagesOpen
      ? "max-h-[min(26rem,45dvh)] shrink-0 overflow-y-auto"
      : "";

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[220px] shrink-0 flex-col border-r bg-background",
        iconsOpen || imagesOpen ? "overflow-hidden" : "overflow-y-auto"
      )}
    >
      {/* When Icons or Images is open, cap height + scroll shapes */}
      <div className={cn("flex flex-col", capShapes)}>
        <AccordionHeader
          label="Shapes"
          open={shapesOpen}
          onClick={() => setShapesOpen((v) => !v)}
        />
        {shapesOpen && <ShapesPanel />}
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-col border-t bg-background",
          iconsOpen ? "flex-1 overflow-hidden" : "shrink-0"
        )}
      >
        <AccordionHeader
          label={`Icons (${allIcons.length})`}
          open={iconsOpen}
          onClick={() => setIconsOpen((v) => !v)}
        />
        {iconsOpen && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <IconsPanel />
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-col border-t bg-background",
          imagesOpen ? "flex-1 overflow-hidden" : "shrink-0"
        )}
      >
        <AccordionHeader
          label={`Images (${imageCount})`}
          open={imagesOpen}
          onClick={() => setImagesOpen((v) => !v)}
        />
        {imagesOpen && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <ImagesPanel />
          </div>
        )}
      </div>
    </aside>
  );
}
