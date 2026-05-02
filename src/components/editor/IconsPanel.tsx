"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search, X, Upload, Loader2, Trash2 } from "lucide-react";
import {
  searchIcons,
  getIconUrl,
  customIconIdFromUuid,
  type IconEntry,
} from "@/components/icons";
import { useCustomIconsStore } from "@/stores/custom-icons-store";
import {
  uploadCustomIcon,
  deleteCustomIcon,
  type CustomIconRow,
} from "@/app/editor/custom-icons";
import { cn } from "@/lib/utils";

const BATCH_SIZE = 60;
const ACCEPTED_MIMES = "image/svg+xml,image/png,image/jpeg";

function IconGrid({ icons }: { icons: IconEntry[] }) {
  const [state, setState] = useState<{ icons: IconEntry[]; visibleCount: number }>(
    () => ({ icons, visibleCount: BATCH_SIZE })
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  if (state.icons !== icons) {
    setState({ icons, visibleCount: BATCH_SIZE });
  }
  const visibleCount = state.visibleCount;
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
  }, [state.icons]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < icons.length) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, icons.length));
        }
      },
      { root: scrollRef.current, rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, icons.length]);

  const visible = icons.slice(0, visibleCount);

  // Drag preview should be the icon glyph alone — no label, no card
  // background, and sized to match the 48px canvas drop target instead of
  // the tile's 28px thumbnail. setDragImage requires the element to be in
  // the DOM at snapshot time, so park a transparent-background <img> off
  // the viewport and strip it after the browser has taken its snapshot.
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, iconId: string) => {
    e.dataTransfer.setData("application/figurein-icon", iconId);
    e.dataTransfer.effectAllowed = "copy";

    const preview = document.createElement("img");
    preview.src = getIconUrl(iconId);
    preview.width = 48;
    preview.height = 48;
    preview.style.position = "fixed";
    preview.style.top = "-1000px";
    preview.style.left = "-1000px";
    preview.style.background = "transparent";
    document.body.appendChild(preview);
    e.dataTransfer.setDragImage(preview, 24, 24);
    // The snapshot happens synchronously after this handler returns; a
    // zero-delay timeout is enough to remove the node without racing it.
    setTimeout(() => preview.remove(), 0);
  };

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <p className="mb-2 text-[10px] text-muted-foreground">
        Drag icons onto the canvas
      </p>
      <div className="grid grid-cols-3 gap-1.5 pb-4">
        {visible.map((icon) => (
          <div
            key={icon.id}
            draggable
            onDragStart={(e) => handleDragStart(e, icon.id)}
            className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-transparent p-2 transition-colors hover:bg-muted active:cursor-grabbing"
            title={icon.label}
          >
            <img
              src={getIconUrl(icon.id)}
              alt={icon.label}
              width={28}
              height={28}
              loading="lazy"
              className="pointer-events-none dark:invert"
            />
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
              {icon.label}
            </span>
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {visibleCount < icons.length && (
        <p className="pb-4 text-center text-xs text-muted-foreground">
          Showing {visibleCount} of {icons.length}
        </p>
      )}
    </div>
  );
}

function CustomIconTile({ icon }: { icon: CustomIconRow }) {
  const removeIcon = useCustomIconsStore((s) => s.removeIcon);
  const iconId = customIconIdFromUuid(icon.id);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("application/figurein-icon", iconId);
    e.dataTransfer.effectAllowed = "copy";
    const preview = document.createElement("img");
    preview.src = icon.url;
    preview.width = 48;
    preview.height = 48;
    preview.style.position = "fixed";
    preview.style.top = "-1000px";
    preview.style.left = "-1000px";
    preview.style.background = "transparent";
    document.body.appendChild(preview);
    e.dataTransfer.setDragImage(preview, 24, 24);
    setTimeout(() => preview.remove(), 0);
  };

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic remove — if the server call fails the user can retry; the
    // alternative (waiting for the roundtrip) makes the library feel sluggish
    // on spotty connections.
    removeIcon(icon.id);
    await deleteCustomIcon(icon.id);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group relative flex cursor-grab flex-col items-center gap-1 rounded-md border border-transparent p-2 transition-colors hover:bg-muted active:cursor-grabbing"
      title={icon.name}
    >
      <img
        src={icon.url}
        alt={icon.name}
        width={28}
        height={28}
        loading="lazy"
        className="pointer-events-none"
      />
      <span className="w-full truncate text-center text-[10px] text-muted-foreground">
        {icon.name}
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${icon.name}`}
        className="absolute -top-1 -right-1 hidden size-5 items-center justify-center rounded-full bg-background text-muted-foreground shadow ring-1 ring-foreground/10 hover:text-destructive group-hover:flex"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

function UploadButton({
  onPicked,
  uploading,
  error,
}: {
  onPicked: (file: File) => void;
  uploading: boolean;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground transition-colors",
          uploading
            ? "cursor-not-allowed"
            : "hover:border-foreground/30 hover:bg-muted hover:text-foreground"
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="size-3.5" />
            Upload icon (SVG, PNG, JPG)
          </>
        )}
      </button>
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
      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </>
  );
}

export function IconsPanel() {
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const customIcons = useCustomIconsStore((s) => s.icons);
  const loaded = useCustomIconsStore((s) => s.loaded);
  const load = useCustomIconsStore((s) => s.load);
  const addIcon = useCustomIconsStore((s) => s.addIcon);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const filteredBuiltin = useMemo(() => searchIcons(query), [query]);
  const filteredCustom = useMemo(() => {
    if (!query.trim()) return customIcons;
    const q = query.toLowerCase();
    return customIcons.filter((i) => i.name.toLowerCase().includes(q));
  }, [customIcons, query]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    const result = await uploadCustomIcon(form);
    setUploading(false);
    if ("error" in result) {
      setUploadError(result.error);
      return;
    }
    addIcon(result.icon);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-foreground/70">Icons</h3>
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons..."
          className="h-8 pl-7 pr-7 text-xs"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-col gap-1">
        <UploadButton
          onPicked={handleUpload}
          uploading={uploading}
          error={uploadError}
        />
      </div>

      {filteredCustom.length > 0 && (
        <>
          <p className="mb-1.5 text-[11px] font-semibold text-foreground/70">
            Your icons
          </p>
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {filteredCustom.map((icon) => (
              <CustomIconTile key={icon.id} icon={icon} />
            ))}
          </div>
          <Separator className="mb-2" />
        </>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filteredBuiltin.length} built-in icon
          {filteredBuiltin.length !== 1 ? "s" : ""}
        </p>
      </div>
      <Separator className="mb-2" />
      {filteredBuiltin.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No icons found for &ldquo;{query}&rdquo;
        </p>
      ) : (
        <IconGrid icons={filteredBuiltin} />
      )}
    </div>
  );
}
