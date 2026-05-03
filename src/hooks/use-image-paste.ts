"use client";

import { useEffect } from "react";
import {
  useEditorStore,
  getCanvasCursorPos,
} from "@/stores/editor-store";
import { useCustomImagesStore } from "@/stores/custom-images-store";
import { uploadCustomImage } from "@/app/editor/custom-images";
import {
  dimensionsForCustomImageElement,
  uploadImageIdFromUuid,
} from "@/lib/user-images";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "@/lib/constants";

function collectImageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    if (!/^image\/(gif|webp|png|jpe?g)$/i.test(item.type)) continue;
    const f = item.getAsFile();
    if (f) files.push(f);
  }
  return files;
}

export function useImagePaste() {
  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
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

      const cursor = getCanvasCursorPos();
      const baseX = cursor?.x ?? CANVAS_WIDTH / 2;
      const baseY = cursor?.y ?? CANVAS_HEIGHT / 2;

      const { addImage } = useCustomImagesStore.getState();
      const { addElement, selectElement } = useEditorStore.getState();

      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const form = new FormData();
        form.append("file", file);
        const result = await uploadCustomImage(form);
        if ("error" in result) {
          console.error("Paste upload failed:", result.error);
          continue;
        }

        addImage(result.image);

        const { width: w, height: h } = dimensionsForCustomImageElement(
          result.image.width,
          result.image.height
        );

        const offset = idx * 20;
        const id = crypto.randomUUID();
        addElement({
          id,
          parentId: null,
          type: "image",
          x: baseX - w / 2 + offset,
          y: baseY - h / 2 + offset,
          width: w,
          height: h,
          rotation: 0,
          fill: "none",
          stroke: "none",
          strokeWidth: 0,
          opacity: 1,
          zIndex: useEditorStore.getState().elements.length,
          imageId: uploadImageIdFromUuid(result.image.id),
        });
        selectElement(id);
      }
    };

    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);
}
