"use client";

import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Plus, X, Copy } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

export function PageBar() {
  const { pages, currentPageId, switchPage, addPage, deletePage, duplicatePage, renamePage } =
    useEditorStore(
      useShallow((s) => ({
        pages: s.pages,
        currentPageId: s.currentPageId,
        switchPage: s.switchPage,
        addPage: s.addPage,
        deletePage: s.deletePage,
        duplicatePage: s.duplicatePage,
        renamePage: s.renamePage,
      }))
    );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const updateFades = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 0);
    // -1 tolerance: browsers occasionally leave scrollLeft fractional pixels
    // short of scrollWidth - clientWidth at the end of a scroll.
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  // Keep the gradients in sync with scroll position AND container/content
  // resize — adding or deleting a page changes scrollWidth without a scroll
  // event, so a ResizeObserver is necessary.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFades);
      ro.disconnect();
    };
  }, [updateFades]);

  useEffect(() => {
    updateFades();
  }, [pages.length, updateFades]);

  // Let vertical wheel scroll translate to horizontal — without this the
  // user has to hold shift to pan through tabs, which isn't discoverable
  // once the scrollbar is hidden.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (e.deltaY !== 0 && e.deltaX === 0) {
      el.scrollLeft += e.deltaY;
    }
  };

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditValue(currentTitle);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      renamePage(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="relative h-9 border-t bg-background">
      <div
        ref={scrollerRef}
        onWheel={onWheel}
        className="flex h-full items-center gap-1 px-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page, idx) => {
          const isActive = page.id === currentPageId;
          const isEditing = editingId === page.id;

          return (
            <div
              key={page.id}
              className={`group flex h-7 items-center gap-1 rounded-md px-2 text-xs cursor-pointer shrink-0 border ${
                isActive
                  ? "bg-muted border-border text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
              onClick={() => switchPage(page.id)}
              onDoubleClick={() => startRename(page.id, page.title)}
            >
              <span className="text-[10px] text-muted-foreground/60 font-medium">
                {idx + 1}
              </span>
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-28 bg-transparent text-xs outline-none border-b border-foreground/30"
                />
              ) : (
                <span className="max-w-32 truncate">{page.title}</span>
              )}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <button
                  className="rounded p-0.5 hover:bg-muted-foreground/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicatePage(page.id);
                  }}
                  title="Duplicate canvas"
                >
                  <Copy className="size-3" />
                </button>
                {pages.length > 1 && (
                  <button
                    className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePage(page.id);
                    }}
                    title="Delete canvas"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 size-7"
          onClick={() => addPage()}
          title="Add canvas"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Edge fades: absolute overlays, pointer-events-none so they don't
          intercept clicks on the tabs underneath. Toggled via opacity so the
          scroll-in/out transition stays smooth. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-background to-transparent transition-opacity duration-150 ${
          showLeftFade ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-background to-transparent transition-opacity duration-150 ${
          showRightFade ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
