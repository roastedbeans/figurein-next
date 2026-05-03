"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { Canvas } from "./Canvas";
import { CanvasContextMenu } from "./CanvasContextMenu";
import { FloatingToolbar } from "./FloatingToolbar";
import { PageBar } from "./PageBar";
import { SmartFigurePanel } from "./SmartFigurePanel";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useImagePaste } from "@/hooks/use-image-paste";
import { useCustomImagesStore } from "@/stores/custom-images-store";
import { useProjectPersistence } from "@/hooks/use-project-persistence";

export function EditorLayout() {
  useKeyboardShortcuts();
  useImagePaste();

  // Prefetch the user's uploaded images (`upload:<uuid>`) before the sidebar opens.
  const loadCustomImages = useCustomImagesStore((s) => s.load);
  useEffect(() => {
    loadCustomImages();
  }, [loadCustomImages]);

  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");

  const { status: saveStatus, saveNow } = useProjectPersistence(projectId);

  // Cmd/Ctrl+S → force-save. Capture phase so we preempt the browser's
  // native "Save Page As" dialog and any lower-priority listeners.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      if (e.key !== "s" && e.key !== "S") return;
      e.preventDefault();
      e.stopPropagation();
      void saveNow();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [saveNow]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TopBar saveStatus={saveStatus} onSave={saveNow} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="relative flex flex-1 flex-col overflow-hidden bg-muted">
          <div className="flex-1 overflow-hidden">
            <CanvasContextMenu>
              <Canvas />
            </CanvasContextMenu>
          </div>
          <FloatingToolbar />
          <SmartFigurePanel />
          <PageBar />
        </div>
      </div>
    </div>
  );
}
