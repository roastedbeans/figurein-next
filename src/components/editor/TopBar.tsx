"use client";

import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Undo2,
  Redo2,
  Download,
  Grid3x3,
  Maximize2,
  LandPlot,
  Check,
  Loader2,
  CircleAlert,
  Save,
} from "lucide-react";
import { ExportDialog } from "./dialogs/ExportDialog";
import { useState } from "react";
import type { SaveStatus } from "@/hooks/use-project-persistence";

const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "",
  loading: "Loading…",
  ready: "Saved",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

function SaveIndicator({ status }: { status: SaveStatus }) {
  const label = SAVE_STATUS_LABEL[status];
  if (!label) return null;

  const Icon =
    status === "saving" || status === "loading"
      ? Loader2
      : status === "error"
      ? CircleAlert
      : Check;
  const spin = status === "saving" || status === "loading";
  const tone =
    status === "error" ? "text-destructive" : "text-muted-foreground";

  return (
    <span className={`flex items-center gap-1 text-[11px] ${tone}`} aria-live="polite">
      <Icon className={`size-3 ${spin ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

export function TopBar({
  saveStatus,
  onSave,
}: {
  saveStatus?: SaveStatus | null;
  onSave?: () => void | Promise<void>;
}) {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl+";
  const shift = isMac ? "⇧" : "Shift+";

  const {
    projectTitle,
    setProjectTitle,
    undo,
    redo,
    history,
    future,
    showGrid,
    toggleGrid,
    fitView,
    resetToDefaultView,
  } = useEditorStore(
    useShallow((s) => ({
      projectTitle: s.projectTitle,
      setProjectTitle: s.setProjectTitle,
      undo: s.undo,
      redo: s.redo,
      history: s.history,
      future: s.future,
      showGrid: s.showGrid,
      toggleGrid: s.toggleGrid,
      fitView: s.fitView,
      resetToDefaultView: s.resetToDefaultView,
    }))
  );
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <TooltipProvider delay={600}>
      <div className="flex h-12 items-center border-b bg-background px-4 gap-2">
        <Link
          href="/dashboard"
          className="mr-4 text-sm font-semibold tracking-tight transition-opacity hover:opacity-70"
          title="Back to dashboard"
        >
          FigurIn
        </Link>

        <Separator orientation="vertical" className="mx-1 my-2" />

        <Input
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          aria-label="Project title"
          className="h-7 w-48 border-none bg-transparent text-sm font-medium shadow-none focus-visible:ring-1"
        />

        {saveStatus && <SaveIndicator status={saveStatus} />}

        {onSave && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void onSave()}
                  disabled={saveStatus === "saving" || saveStatus === "loading"}
                  aria-label={`Save (${mod}S)`}
                />
              }
            >
              <Save className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Save ({mod}S)</TooltipContent>
          </Tooltip>
        )}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={undo}
                disabled={history.length === 0}
                aria-label={`Undo (${mod}Z)`}
              />
            }
          >
            <Undo2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Undo ({mod}Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={redo}
                disabled={future.length === 0}
                aria-label={`Redo (${mod}${shift}Z)`}
              />
            }
          >
            <Redo2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Redo ({mod}{shift}Z)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 my-2" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size="icon-sm"
                pressed={showGrid}
                onPressedChange={toggleGrid}
                aria-label={`${showGrid ? "Hide grid" : "Show grid"} (${shift}\u0060)`}
              />
            }
          >
            <Grid3x3 className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">{`Grid (${shift}\u0060)`}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={resetToDefaultView}
                aria-label={`Default view (${shift}1)`}
              />
            }
          >
            <LandPlot className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Default view ({shift}1)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={fitView}
                aria-label={`Fit to view (${shift}2)`}
              />
            }
          >
            <Maximize2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Fit to view ({shift}2)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 my-2" />

        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="size-3.5" />
          Export
        </Button>

        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      </div>
    </TooltipProvider>
  );
}
