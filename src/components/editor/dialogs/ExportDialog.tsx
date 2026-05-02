"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileImage,
  FileCode,
  LayoutDashboard,
  Frame,
  Square,
  SquareDashed,
} from "lucide-react";
import {
  exportAsSvg,
  exportAsPng,
  type ExportFit,
  type ExportBackground,
} from "@/lib/export";
import { cn } from "@/lib/utils";

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [fit, setFit] = useState<ExportFit>("canvas");
  const [background, setBackground] = useState<ExportBackground>("white");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Figure</DialogTitle>
          <DialogDescription>
            Choose framing, background, and file format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Section label="Framing">
            <OptionCard
              active={fit === "canvas"}
              onClick={() => setFit("canvas")}
              icon={<LayoutDashboard className="size-4" />}
              label="Canvas"
              description="Full 1200×800 sheet"
            />
            <OptionCard
              active={fit === "figure"}
              onClick={() => setFit("figure")}
              icon={<Frame className="size-4" />}
              label="Figure only"
              description="Crop to elements"
            />
          </Section>

          <Section label="Background">
            <OptionCard
              active={background === "white"}
              onClick={() => setBackground("white")}
              icon={<Square className="size-4" />}
              label="White"
              description="Solid white fill"
            />
            <OptionCard
              active={background === "transparent"}
              onClick={() => setBackground("transparent")}
              icon={<SquareDashed className="size-4" />}
              label="Transparent"
              description="No background"
            />
          </Section>

          <Section label="Format">
            <Button
              variant="outline"
              className="col-span-2 justify-start gap-2"
              onClick={() => {
                exportAsSvg(fit, background);
                onOpenChange(false);
              }}
            >
              <FileCode className="size-4" />
              Export as SVG
            </Button>
            <Button
              variant="outline"
              className="col-span-2 justify-start gap-2"
              onClick={() => {
                exportAsPng(fit, background);
                onOpenChange(false);
              }}
            >
              <FileImage className="size-4" />
              Export as PNG (2×)
            </Button>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function OptionCard({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </div>
      <span className="text-[11px] text-muted-foreground">{description}</span>
    </button>
  );
}
