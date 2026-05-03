"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, ImagePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomImagesStore } from "@/stores/custom-images-store";
import { uploadImageIdFromUuid } from "@/lib/user-images";
import {
  uploadCustomImage,
  deleteCustomImage,
  type CustomImageRow,
} from "@/app/editor/custom-images";

const CUSTOM_IMAGES_BATCH = 40;
const ACCEPTED_MIMES =
  "image/svg+xml,image/png,image/jpeg,image/gif,image/webp";

function UploadedImagesRow({ images }: { images: CustomImageRow[] }) {
  const [state, setState] = useState<{
    images: CustomImageRow[];
    visibleCount: number;
  }>(() => ({ images, visibleCount: CUSTOM_IMAGES_BATCH }));

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  if (state.images !== images) {
    setState({ images, visibleCount: CUSTOM_IMAGES_BATCH });
  }

  const { visibleCount } = state;
  const setVisibleCount = (
    updater: number | ((prev: number) => number)
  ) =>
    setState((prev) => ({
      ...prev,
      visibleCount:
        typeof updater === "function" ? updater(prev.visibleCount) : updater,
    }));

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [state.images]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < images.length) {
          setVisibleCount((prev) =>
            Math.min(prev + CUSTOM_IMAGES_BATCH, images.length)
          );
        }
      },
      { root: scrollRef.current, rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, images.length]);

  const visible = images.slice(0, visibleCount);

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      <div className="grid shrink-0 grid-cols-3 gap-1.5 pb-4">
        {visible.map((img) => (
          <UploadedImageTile key={img.id} image={img} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {visibleCount < images.length && (
        <p className="pb-4 text-center text-xs text-muted-foreground">
          Showing {visibleCount} of {images.length}
        </p>
      )}
    </div>
  );
}

export function UploadedImageTile({
  image,
  className,
  imgClassName,
  showDelete = false,
}: {
  image: CustomImageRow;
  className?: string;
  imgClassName?: string;
  showDelete?: boolean;
}) {
  const removeImage = useCustomImagesStore((s) => s.removeImage);
  const imageId = uploadImageIdFromUuid(image.id);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("application/figurin-image", imageId);
    e.dataTransfer.effectAllowed = "copy";
    const preview = document.createElement("img");
    preview.src = image.url;
    preview.width = 48;
    preview.height = 48;
    preview.style.position = "fixed";
    preview.style.top = "-1000px";
    preview.style.left = "-1000px";
    preview.style.background = "transparent";
    preview.style.objectFit = "contain";
    document.body.appendChild(preview);
    e.dataTransfer.setDragImage(preview, 24, 24);
    setTimeout(() => preview.remove(), 0);
  };

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    removeImage(image.id);
    await deleteCustomImage(image.id);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "group relative flex cursor-grab items-center justify-center rounded-md border border-transparent p-2 transition-colors hover:bg-muted active:cursor-grabbing",
        className
      )}
      aria-label={image.name}
    >
      <img
        src={image.url}
        alt={image.name}
        width={28}
        height={28}
        loading="lazy"
        className={cn("pointer-events-none object-contain", imgClassName)}
      />
      {showDelete && (
        <button
          type="button"
          onClick={onDelete}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={`Delete ${image.name}`}
          className="pointer-events-none absolute top-1 right-1 z-10 hidden size-[18px] items-center justify-center rounded-full bg-background text-muted-foreground shadow ring-1 ring-foreground/10 group-hover:pointer-events-auto group-hover:flex hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-2.5" />
        </button>
      )}
    </div>
  );
}

function UploadImageButton({
  onPicked,
  uploading,
  error,
}: {
  onPicked: (file: File) => void;
  uploading: boolean;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const HELP =
    "Upload SVG, PNG, JPEG, GIF, or WebP. Rasters stay as-is. Drag onto the canvas.";

  return (
    <div className="flex flex-col gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={uploading}
              aria-label={uploading ? "Uploading image" : "Upload image"}
              className={cn(
                "size-8 shrink-0 rounded-lg border-dashed transition-colors",
                uploading
                  ? "cursor-not-allowed"
                  : "hover:border-foreground/30 hover:bg-muted"
              )}
              onClick={() => inputRef.current?.click()}
            />
          }
        >
          {uploading ? (
            <Loader2
              className="size-3.5 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : (
            <ImagePlus className="size-3.5 text-muted-foreground" aria-hidden />
          )}
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-[240px] text-left leading-snug"
        >
          {HELP}
        </TooltipContent>
      </Tooltip>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIMES}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPicked(f);
        }}
      />
      {error ? (
        <p className="text-[11px] leading-snug text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

export function ImagesPanel() {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const customImages = useCustomImagesStore((s) => s.images);
  const loaded = useCustomImagesStore((s) => s.loaded);
  const load = useCustomImagesStore((s) => s.load);
  const addImage = useCustomImagesStore((s) => s.addImage);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    const result = await uploadCustomImage(form);
    setUploading(false);
    if ("error" in result) {
      setUploadError(result.error);
      return;
    }
    addImage(result.image);
  };

  return (
    <TooltipProvider delay={250}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-3">
        <div className="mb-2 shrink-0">
          <UploadImageButton
            onPicked={handleUpload}
            uploading={uploading}
            error={uploadError}
          />
        </div>

        <p className="mb-2 shrink-0 text-[10px] text-muted-foreground">
          Drag images onto the canvas
        </p>

        <div className="flex min-h-0 flex-1 flex-col">
          {customImages.length > 0 ? (
            <UploadedImagesRow images={customImages} />
          ) : (
            <p className="py-6 text-center text-[11px] leading-snug text-muted-foreground">
              No images yet. Upload files here — they are stored without
              recompressing or resizing.
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
