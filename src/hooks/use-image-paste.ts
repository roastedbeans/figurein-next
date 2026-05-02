"use client";

import { useEffect } from "react";
import {
  useEditorStore,
  getCanvasCursorPos,
} from "@/stores/editor-store";
import { useCustomIconsStore } from "@/stores/custom-icons-store";
import { uploadCustomIcon } from "@/app/editor/custom-icons";
import { customIconIdFromUuid } from "@/components/icons";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_STROKE,
} from "@/lib/constants";

// Canva-style paste: when the user pastes an image from outside (browser,
// screenshot, etc), upload it to the custom-icon library and drop it onto
// the canvas. Keyboard shortcut Cmd/Ctrl+V still routes through the editor
// clipboard via use-keyboard-shortcuts; this hook listens on the actual
// `paste` ClipboardEvent, which fires only when real clipboard data is
// available (the keyboard handler doesn't preventDefault unless there's an
// internal clipboard, so both paths coexist cleanly).

const DEFAULT_PASTE_SIZE = 160;

function collectImageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    if (!/^image\/(svg\+xml|png|jpe?g)$/i.test(item.type)) continue;
    const f = item.getAsFile();
    if (f) files.push(f);
  }
  return files;
}

export function useImagePaste() {
  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Never swallow paste inside text inputs / the text element editor —
      // the user is editing content there, not dropping an image.
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const files = collectImageFiles(e.clipboardData);
      if (files.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      // Capture the insertion point once — the cursor may move while the
      // uploads resolve, and we want every image in a single paste to land
      // around the same spot (offset so they don't fully overlap).
      const cursor = getCanvasCursorPos();
      const baseX = cursor?.x ?? CANVAS_WIDTH / 2;
      const baseY = cursor?.y ?? CANVAS_HEIGHT / 2;

      const { addIcon } = useCustomIconsStore.getState();
      const state = useEditorStore.getState();

      files.forEach(async (file, idx) => {
        const form = new FormData();
        form.append("file", file);
        const result = await uploadCustomIcon(form);
        if ("error" in result) {
          console.error("Paste upload failed:", result.error);
          return;
        }

        addIcon(result.icon);

        // Size: preserve aspect ratio when we know it (rasters report width
        // and height post-optimization; SVGs don't — fall back to square).
        const aspect =
          result.icon.width && result.icon.height
            ? result.icon.width / result.icon.height
            : 1;
        const w = aspect >= 1
          ? DEFAULT_PASTE_SIZE
          : DEFAULT_PASTE_SIZE * aspect;
        const h = aspect >= 1
          ? DEFAULT_PASTE_SIZE / aspect
          : DEFAULT_PASTE_SIZE;

        const offset = idx * 20;
        const id = crypto.randomUUID();
        const zIndex = useEditorStore.getState().elements.length;
        state.addElement({
          id,
          parentId: null,
          type: "icon",
          x: baseX - w / 2 + offset,
          y: baseY - h / 2 + offset,
          width: w,
          height: h,
          rotation: 0,
          fill: "none",
          stroke: "none",
          strokeWidth: 0,
          opacity: 1,
          zIndex,
          iconId: customIconIdFromUuid(result.icon.id),
          color: DEFAULT_STROKE,
        });
        useEditorStore.getState().selectElement(id);
      });
    };

    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);
}
