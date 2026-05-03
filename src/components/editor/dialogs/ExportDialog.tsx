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
  Frame,
  MousePointer2,
  Square,
  SquareDashed,
} from "lucide-react";
import {
  exportAsSvg,
  exportAsPng,
  type ExportFit,
  type ExportBackground,
} from "@/lib/export";
import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";

const MARGIN_OPTIONS = [
  { value: 0, label: "0", description: "No padding" },
  { value: 16, label: "16", description: "Default" },
  { value: 32, label: "32", description: "" },
  { value: 64, label: "64", description: "Loose" },
];

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [fit, setFit] = useState<ExportFit>("figure");
  const [background, setBackground] = useState<ExportBackground>("white");
  const [margin, setMargin] = useState(16);

  const hasSelection = useEditorStore((s) => s.selectedElementIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Figure</DialogTitle>
          <DialogDescription>
            Choose framing, margin, background, and file format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Section label="Framing">
            <OptionCard
              active={fit === "figure"}
              onClick={() => setFit("figure")}
              icon={<Frame className="size-4" />}
              label="All figures"
              description="Crop to all elements"
            />
            <OptionCard
              active={fit === "selection"}
              onClick={() => { if (hasSelection) setFit("selection"); }}
              disabled={!hasSelection}
              icon={<MousePointer2 className="size-4" />}
              label="Selection"
              description={hasSelection ? "Crop to selected" : "Nothing selected"}
            />
          </Section>

          <Section label="Margin (px)">
            <div className="col-span-2 flex gap-1.5">
              {MARGIN_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMargin(value)}
                  className={cn(
                    "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors",
                    margin === value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
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
                exportAsSvg(fit, background, margin);
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
                exportAsPng(fit, background, margin);
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
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-border opacity-40"
          : active
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
