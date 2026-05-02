"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore, type SmartFigureMessage } from "@/stores/editor-store";
import { Textarea } from "@/components/ui/textarea";
import {
  X,
  ArrowUp,
  Paperclip,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorElement } from "@/types/editor";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function generateMsgId() {
  return Math.random().toString(36).substring(2, 11);
}

type ToolCall =
  | { tool: "create_canvas"; title: string; elements: EditorElement[] }
  | { tool: "add_to_canvas"; elements: EditorElement[] }
  | {
      tool: "modify_elements";
      updates: Array<{ id: string; patch: Partial<EditorElement> }>;
    }
  | { tool: "delete_elements"; ids: string[] };

/** Strip default/derived fields from an element before sending it to the AI
 *  as canvas context. Keeps the tokens low without losing info the model
 *  needs to reason about placement, style, or identity. */
function compressElement(el: EditorElement): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: el.id,
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    zIndex: el.zIndex,
  };
  if (el.rotation !== 0) out.rotation = el.rotation;
  if (el.opacity !== 1) out.opacity = el.opacity;
  if (el.fill && el.fill !== "none") out.fill = el.fill;
  if (el.stroke && el.stroke !== "none") out.stroke = el.stroke;
  if (el.strokeWidth && el.strokeWidth > 0) out.strokeWidth = el.strokeWidth;
  if (el.strokeStyle && el.strokeStyle !== "solid")
    out.strokeStyle = el.strokeStyle;
  if (el.groupId) out.groupId = el.groupId;
  // Only forward parentId when the element actually nests — page-root
  // elements are the common case and keeping the field out of the wire
  // payload saves a few tokens per element on large canvases.
  if (el.parentId) out.parentId = el.parentId;

  switch (el.type) {
    case "text":
      out.content = el.content;
      out.color = el.color;
      if (el.fontSize) out.fontSize = el.fontSize;
      if (el.fontWeight !== "normal") out.fontWeight = el.fontWeight;
      if (el.fontStyle !== "normal") out.fontStyle = el.fontStyle;
      if (el.textAlign !== "left") out.textAlign = el.textAlign;
      if (el.verticalAlign && el.verticalAlign !== "top")
        out.verticalAlign = el.verticalAlign;
      if (el.borderRadius) out.borderRadius = el.borderRadius;
      break;
    case "icon":
      out.iconId = el.iconId;
      out.color = el.color;
      break;
    case "rectangle":
      if (el.borderRadius) out.borderRadius = el.borderRadius;
      break;
    case "arrow":
    case "line":
      out.x2 = el.x2;
      out.y2 = el.y2;
      if (el.lineStyle !== "straight") out.lineStyle = el.lineStyle;
      if (el.headStyle && el.headStyle !== "triangle")
        out.headStyle = el.headStyle;
      if (el.tailStyle && el.tailStyle !== "none") out.tailStyle = el.tailStyle;
      break;
    case "path":
      // Omit pathData/viewBox — the AI can reference paths by id for
      // move/delete but doesn't meaningfully edit path geometry. Dropping
      // the blob saves ~1KB per path element in large canvases.
      break;
    case "frame":
      // Frames carry the section structure the AI needs to reason about
      // when adding / modifying children. Emit childIds so the AI can
      // see which elements already belong here; omit the inert layout
      // defaults (layoutMode "none", zero gap/padding, start alignment)
      // that the server always fills back in on the return trip.
      if (el.childIds.length > 0) out.childIds = el.childIds;
      if (el.cornerRadius) out.cornerRadius = el.cornerRadius;
      if (el.clipContent) out.clipContent = el.clipContent;
      break;
  }
  return out;
}

function summarizeToolCalls(calls: ToolCall[]): string {
  const parts: string[] = [];
  for (const call of calls) {
    if (call.tool === "create_canvas") {
      parts.push(
        `Created canvas "${call.title}" with ${call.elements.length} element${call.elements.length === 1 ? "" : "s"}.`
      );
    } else if (call.tool === "add_to_canvas") {
      parts.push(
        `Added ${call.elements.length} element${call.elements.length === 1 ? "" : "s"} to the canvas.`
      );
    } else if (call.tool === "modify_elements") {
      parts.push(
        `Updated ${call.updates.length} element${call.updates.length === 1 ? "" : "s"}.`
      );
    } else if (call.tool === "delete_elements") {
      parts.push(
        `Deleted ${call.ids.length} element${call.ids.length === 1 ? "" : "s"}.`
      );
    }
  }
  return parts.join(" ");
}

/** Chat-style bottom panel for the AI figure assistant. Input accepts a
 *  prompt + optional image, then routes the generated elements to whichever
 *  canvas (page) is currently active so the user can iterate in place. */
export function SmartFigurePanel() {
  const smartFigureOpen = useEditorStore((s) => s.smartFigureOpen);
  const setSmartFigureOpen = useEditorStore((s) => s.setSmartFigureOpen);
  const messages = useEditorStore((s) => s.smartFigureMessages);
  const appendMessage = useEditorStore((s) => s.appendSmartFigureMessage);
  const addElementsToCurrentPage = useEditorStore(
    (s) => s.addElementsToCurrentPage
  );
  const addPageWithElements = useEditorStore((s) => s.addPageWithElements);
  const updateElement = useEditorStore((s) => s.updateElement);
  const deleteElements = useEditorStore((s) => s.deleteElements);

  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shadows `smartFigureOpen` but trails behind on close so the exit
  // animation has time to finish before we unmount.
  const [panelMounted, setPanelMounted] = useState(smartFigureOpen);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!smartFigureOpen) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, smartFigureOpen]);

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
    const sendImagePreview = imagePreview;
    const sendImageFile = imageFile;

    const userMsg: SmartFigureMessage = {
      id: generateMsgId(),
      role: "user",
      text: sendPrompt,
      image: sendImagePreview || undefined,
      timestamp: Date.now(),
    };
    appendMessage(userMsg);

    setPrompt("");
    clearImage();
    setLoading(true);
    setError(null);

    // Snapshot the canvas at send time so the model sees exactly what the
    // user sees right now. Read the store imperatively — subscribing would
    // re-render the panel on every edit.
    const snapshot = useEditorStore.getState();
    const currentPage = snapshot.pages.find(
      (p) => p.id === snapshot.currentPageId
    );
    const canvas =
      snapshot.elements.length > 0
        ? {
            pageTitle: currentPage?.title ?? "Untitled",
            elements: snapshot.elements.map(compressElement),
          }
        : null;

    try {
      let res: Response;
      if (sendImageFile) {
        const formData = new FormData();
        formData.append("image", sendImageFile);
        formData.append("prompt", sendPrompt);
        if (canvas) formData.append("canvas", JSON.stringify(canvas));
        res = await fetch("/api/generate", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: sendPrompt, canvas }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate");
      }

      const data = (await res.json()) as {
        text?: string;
        toolCalls?: ToolCall[];
      };
      const toolCalls = data.toolCalls ?? [];

      // Dispatch in the order the model emitted them. Each store action
      // updates history independently, which is fine — "undo" will unwind
      // multi-tool turns one step at a time rather than as one atomic edit.
      for (const call of toolCalls) {
        if (call.tool === "create_canvas") {
          addPageWithElements(call.title, call.elements);
        } else if (call.tool === "add_to_canvas") {
          addElementsToCurrentPage(call.elements);
        } else if (call.tool === "modify_elements") {
          for (const update of call.updates) {
            updateElement(update.id, update.patch);
          }
        } else if (call.tool === "delete_elements") {
          deleteElements(call.ids);
        }
      }

      const summary = summarizeToolCalls(toolCalls);
      const replyText = [data.text?.trim(), summary].filter(Boolean).join(" ");
      appendMessage({
        id: generateMsgId(),
        role: "assistant",
        text: replyText || "No changes made.",
        timestamp: Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      appendMessage({
        id: generateMsgId(),
        role: "assistant",
        text: `Error: ${msg}`,
        timestamp: Date.now(),
      });
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
          <div className={`pointer-events-auto flex w-[640px] max-w-[calc(100vw-2rem)] origin-bottom-right ${animClass} flex-col overflow-hidden rounded-xl border border-black/5 bg-background/95 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_8px_24px_-8px_rgb(0_0_0/0.18),0_2px_6px_-2px_rgb(0_0_0/0.08)] duration-180`}>
            <div className="flex h-9 items-center gap-2 border-b border-black/5 px-3">
              <span className="text-xs font-medium">Figurin</span>
              <span className="text-[10px] text-muted-foreground">
                · edits the current canvas
              </span>
            </div>

        {messages.length > 0 && (
          <div
            ref={scrollRef}
            className="max-h-64 flex-1 overflow-y-auto px-3 py-2"
          >
            <div className="flex flex-col gap-2">
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              {loading && (
                <div className="flex items-center gap-1.5 self-start rounded-2xl bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Generating…
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-black/5 p-2">
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
              placeholder={
                messages.length === 0
                  ? "Describe the figure or attach a sketch…"
                  : "Ask for adjustments…"
              }
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

function MessageBubble({ msg }: { msg: SmartFigureMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      {msg.image && (
        <img
          src={msg.image}
          alt="Attached sketch"
          className="max-h-32 max-w-[70%] rounded-lg border object-contain bg-muted"
        />
      )}
      {msg.text && (
        <div
          className={cn(
            "max-w-[80%] rounded-2xl px-3 py-1.5 text-xs",
            isUser
              ? "bg-foreground text-background"
              : "bg-muted text-foreground"
          )}
        >
          {msg.text}
        </div>
      )}
      {!msg.text && !msg.image && isUser && (
        <div className="flex items-center gap-1 rounded-2xl bg-foreground px-3 py-1.5 text-xs text-background">
          <ImageIcon className="size-3" />
          <span>Image</span>
        </div>
      )}
    </div>
  );
}
