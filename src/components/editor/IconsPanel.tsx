"use client";

import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search, X } from "lucide-react";
import { searchIcons, getIconUrl, type IconEntry } from "@/components/icons";
import { cn } from "@/lib/utils";

const BATCH_SIZE = 60;

export function IconGrid({
  icons,
  className,
  hideHint,
}: {
  icons: IconEntry[];
  className?: string;
  hideHint?: boolean;
}) {
  const [state, setState] = useState<{
    icons: IconEntry[];
    visibleCount: number;
  }>(() => ({ icons, visibleCount: BATCH_SIZE }));
  const [hoverPopup, setHoverPopup] = useState<{
    icon: IconEntry;
    rect: DOMRect;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const iconsCapRef = useRef(icons.length);
  iconsCapRef.current = icons.length;

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

  /** IntersectionObserver can skip frames on fast scroll; keep observer stable & sentinel at scroll bottom. */
  useLayoutEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((prev) => {
          const cap = iconsCapRef.current;
          return prev >= cap ? prev : Math.min(prev + BATCH_SIZE, cap);
        });
      },
      { root, rootMargin: "0px 0px 400px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [icons]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const pane = scrollRef.current;
        if (!pane) return;
        const { scrollTop, clientHeight, scrollHeight } = pane;
        if (scrollHeight - scrollTop - clientHeight > 200) return;
        setVisibleCount((prev) => {
          const cap = iconsCapRef.current;
          return prev >= cap ? prev : Math.min(prev + BATCH_SIZE, cap);
        });
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const visible = icons.slice(0, visibleCount);

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    iconId: string
  ) => {
    e.dataTransfer.setData("application/figurin-icon", iconId);
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
    setTimeout(() => preview.remove(), 0);
  };

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex min-h-0 flex-1 basis-0 flex-col overflow-y-auto overscroll-contain",
        className
      )}
    >
      {!hideHint && (
        <p className="mb-2 shrink-0 text-[10px] text-muted-foreground">
          Drag icons onto the canvas
        </p>
      )}
      <div className="grid shrink-0 grid-cols-5 gap-1 pb-4">
        {visible.map((icon) => (
          <div
            key={icon.id}
            draggable
            onDragStart={(e) => handleDragStart(e, icon.id)}
            onMouseEnter={(e) =>
              setHoverPopup({
                icon,
                rect: e.currentTarget.getBoundingClientRect(),
              })
            }
            onMouseLeave={() => setHoverPopup(null)}
            className="flex cursor-grab items-center justify-center rounded-md border border-transparent p-1 transition-colors hover:bg-muted active:cursor-grabbing"
            aria-label={icon.label}
          >
            <img
              src={getIconUrl(icon.id)}
              alt={icon.label}
              width={22}
              height={22}
              loading="lazy"
              className="pointer-events-none dark:invert"
            />
          </div>
        ))}
      </div>
      {visibleCount < icons.length ? (
        <p className="shrink-0 pb-2 text-center text-xs text-muted-foreground">
          Showing {visibleCount} of {icons.length}
        </p>
      ) : null}
      <div
        ref={sentinelRef}
        className="h-px w-full shrink-0"
        aria-hidden
      />
      {hoverPopup &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: hoverPopup.rect.right + 8,
              top: Math.min(hoverPopup.rect.top, window.innerHeight - 100),
              zIndex: 9999,
            }}
            className="pointer-events-none flex flex-col items-center gap-1.5 rounded-lg border bg-background p-3 shadow-md"
          >
            <img
              src={getIconUrl(hoverPopup.icon.id)}
              alt={hoverPopup.icon.label}
              width={48}
              height={48}
              className="dark:invert"
            />
            <span className="text-xs font-medium text-foreground">
              {hoverPopup.icon.label}
            </span>
          </div>,
          document.body
        )}
    </div>
  );
}

export function IconsPanel() {
  const [query, setQuery] = useState("");
  const filteredBuiltin = useMemo(() => searchIcons(query), [query]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-3">
      <div className="relative mb-2 shrink-0">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons..."
          className="h-8 w-full pl-7 pr-7 text-xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <Separator className="mb-2 shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col">
        {filteredBuiltin.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No icons found for &ldquo;{query}&rdquo;
          </p>
        ) : (
          <IconGrid icons={filteredBuiltin} />
        )}
      </div>
    </div>
  );
}
