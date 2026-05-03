"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Textarea } from "@/components/ui/textarea";
import { X, ArrowUp, Paperclip, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorElement } from "@/types/editor";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type CreateCanvasCall = {
  tool: "create_canvas";
  title: string;
  elements: EditorElement[];
};

/** One-shot AI composer. Each send produces a fresh page via `create_canvas`;
 *  no chat history, no canvas context — every generation is independent. */
export function SmartFigurePanel() {
  const smartFigureOpen = useEditorStore((s) => s.smartFigureOpen);
  const setSmartFigureOpen = useEditorStore((s) => s.setSmartFigureOpen);
  const addPageWithElements = useEditorStore((s) => s.addPageWithElements);

  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shadows `smartFigureOpen` but trails behind on close so the exit
  // animation has time to finish before we unmount.
  const [panelMounted, setPanelMounted] = useState(smartFigureOpen);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Upload a PNG, JPEG, WebP, or GIF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be under 10MB.");
      return;
    }
    setError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Open immediately, but delay unmount by the close-animation duration so
  // the `animate-out` pass has time to play before the DOM node goes away.
  useEffect(() => {
    if (smartFigureOpen) {
      setPanelMounted(true);
      return;
    }
    const EXIT_MS = 180;
    const t = setTimeout(() => setPanelMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [smartFigureOpen]);

  // Paste image directly into the chat composer (only while panel open)
  useEffect(() => {
    if (!smartFigureOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
          }
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [smartFigureOpen, handleFile]);

  const handleSend = async () => {
    if (!prompt.trim() && !imageFile) return;
    const sendPrompt = prompt.trim();
    const sendImageFile = imageFile;

    setPrompt("");
    clearImage();
    setLoading(true);
    setError(null);

    try {
      let res: Response;
      if (sendImageFile) {
        const formData = new FormData();
        formData.append("image", sendImageFile);
        formData.append("prompt", sendPrompt);
        res = await fetch("/api/generate", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: sendPrompt }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate");
      }

      const data = (await res.json()) as {
        text?: string;
        toolCall?: CreateCanvasCall | null;
      };
      const toolCall = data.toolCall;

      if (toolCall && toolCall.tool === "create_canvas") {
        addPageWithElements(toolCall.title, toolCall.elements);
      } else {
        throw new Error("No figure was generated.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (prompt.trim().length > 0 || !!imageFile) && !loading;

  // Panel stays mounted during the exit animation; see panelMounted effect
  // above. `smartFigureOpen` drives which animation class to apply.
  const animClass = smartFigureOpen
    ? "animate-in fade-in slide-in-from-bottom-2 slide-in-from-right-24"
    : "animate-out fade-out slide-out-to-bottom-2 slide-out-to-right-24 fill-mode-forwards";

  return (
    <>
      <button
        type="button"
        onClick={() => setSmartFigureOpen(!smartFigureOpen)}
        aria-label={smartFigureOpen ? "Close Figurin" : "Open Figurin"}
        aria-pressed={smartFigureOpen}
        title={smartFigureOpen ? "Close Figurin (⌘B)" : "Open Figurin (⌘B)"}
        className={cn(
          "pointer-events-auto absolute bottom-12 right-3 z-20 inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-black/5 px-3 text-xs font-medium shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_8px_24px_-8px_rgb(0_0_0/0.18),0_2px_6px_-2px_rgb(0_0_0/0.08)] transition-colors",
          smartFigureOpen
            ? "bg-foreground text-background hover:bg-foreground/90"
            : "bg-background/95 hover:bg-background"
        )}
      >
        {smartFigureOpen && (
          <span
            aria-hidden
            className="inline-flex size-1.5 rounded-full bg-emerald-400"
          />
        )}
        Figurin
      </button>

      {panelMounted && (
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-10 -translate-x-1/2">
          <div
            className={`pointer-events-auto flex w-[640px] max-w-[calc(100vw-2rem)] origin-bottom-right ${animClass} flex-col overflow-hidden rounded-xl border border-black/5 bg-background/95 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_8px_24px_-8px_rgb(0_0_0/0.18),0_2px_6px_-2px_rgb(0_0_0/0.08)] duration-180`}
          >
            <div className="flex h-9 items-center gap-2 border-b border-black/5 px-3">
              <span className="text-xs font-medium">Figurin</span>
              <span className="text-[10px] text-muted-foreground">
                · generates a new page
              </span>
            </div>

            <div className="p-2">
              {imagePreview && (
                <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/40 p-1.5">
                  <img
                    src={imagePreview}
                    alt="Attached sketch"
                    className="size-10 rounded object-cover"
                  />
                  <span className="flex-1 truncate text-[11px] text-muted-foreground">
                    {imageFile?.name}
                  </span>
                  <button
                    type="button"
                    onClick={clearImage}
                    aria-label="Remove image"
                    className="inline-flex size-5 cursor-pointer items-center justify-center rounded hover:bg-accent"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  aria-label="Attach image"
                  title="Attach image"
                  className={cn(
                    "inline-flex size-8 cursor-pointer items-center justify-center rounded-md border bg-background hover:bg-accent",
                    loading && "cursor-not-allowed opacity-50"
                  )}
                >
                  <Paperclip className="size-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />

                <Textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Describe the figure or attach a sketch…"
                  rows={1}
                  disabled={loading}
                  className="min-h-8 flex-1 resize-none border bg-background px-2 py-1.5 text-xs shadow-none focus-visible:ring-1"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send"
                  title="Send"
                  className={cn(
                    "inline-flex size-8 cursor-pointer items-center justify-center rounded-md bg-foreground text-background transition-colors hover:bg-foreground/90",
                    !canSend && "cursor-not-allowed opacity-40"
                  )}
                >
                  {loading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="size-3.5" />
                  )}
                </button>
              </div>

              {error && (
                <p className="mt-1.5 text-[11px] text-destructive">{error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
