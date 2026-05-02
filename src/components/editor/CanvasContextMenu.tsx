"use client";

import { useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore, setCanvasCursorPos } from "@/stores/editor-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ReplaceIconDialog } from "./dialogs/ReplaceIconDialog";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  Group,
  MousePointerSquareDashed,
  Replace,
  Scissors,
  SquareStack,
  Trash2,
  Ungroup,
} from "lucide-react";

/** Walks up from a DOM node to find the nearest element that exposes a
 *  data-element-id (canvas SVG node, foreignObject, etc). */
function findElementId(target: EventTarget | null): string | null {
  let el = target as HTMLElement | SVGElement | null;
  while (el) {
    const id = el.getAttribute?.("data-element-id");
    if (id) return id;
    el = el.parentElement;
  }
  return null;
}

/** Right-click menu for the canvas — Canva-style: clicking on an element
 *  selects it first, then shows actions for the (now-current) selection.
 *  Empty-canvas right-click shows a smaller menu (paste / select all). */
export function CanvasContextMenu({ children }: { children: React.ReactNode }) {
  const {
    selectedElementIds,
    elements,
    clipboard,
    selectElement,
    selectAll,
    copySelection,
    cutSelection,
    pasteClipboard,
    duplicateElement,
    deleteElements,
    bringToFront,
    sendToBack,
    groupElements,
    ungroupElement,
  } = useEditorStore(
    useShallow((s) => ({
      selectedElementIds: s.selectedElementIds,
      elements: s.elements,
      clipboard: s.clipboard,
      selectElement: s.selectElement,
      selectAll: s.selectAll,
      copySelection: s.copySelection,
      cutSelection: s.cutSelection,
      pasteClipboard: s.pasteClipboard,
      duplicateElement: s.duplicateElement,
      deleteElements: s.deleteElements,
      bringToFront: s.bringToFront,
      sendToBack: s.sendToBack,
      groupElements: s.groupElements,
      ungroupElement: s.ungroupElement,
    }))
  );

  const [replaceOpen, setReplaceOpen] = useState(false);

  const hasSelection = selectedElementIds.length > 0;
  const isMulti = selectedElementIds.length > 1;
  const canPaste = clipboard.length > 0;
  // Group/ungroup visibility is gated on actual group membership of the
  // current selection, not just count.
  const selectedSet = new Set(selectedElementIds);
  const selected = elements.filter((el) => selectedSet.has(el.id));
  const allGrouped =
    selected.length > 0 && selected.every((el) => el.groupId);
  const sameGroup =
    allGrouped && new Set(selected.map((el) => el.groupId)).size === 1;
  // "Replace icon" only makes sense for a single icon selection — multi-select
  // replacement would silently overwrite mixed element types.
  const singleIconSelected =
    selected.length === 1 && selected[0].type === "icon";
  const singleIconId = singleIconSelected ? selected[0].id : null;

  // Pre-open: select the element under the pointer if it isn't already in
  // the selection, and capture the cursor in canvas coords so paste lands
  // exactly where the menu opened (mousemove doesn't necessarily fire right
  // before a right-click on a static cursor).
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const svg = document.getElementById(
        "figurein-canvas"
      ) as SVGSVGElement | null;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const { zoom, panX, panY } = useEditorStore.getState().canvas;
        setCanvasCursorPos({
          x: (e.clientX - rect.left - panX) / zoom,
          y: (e.clientY - rect.top - panY) / zoom,
        });
      }

      const id = findElementId(e.target);
      if (id) {
        if (!useEditorStore.getState().selectedElementIds.includes(id)) {
          selectElement(id);
        }
      } else {
        selectElement(null);
      }
    },
    [selectElement]
  );

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger
        onContextMenu={onContextMenu}
        className="h-full w-full"
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-52">
        {hasSelection ? (
          <>
            <ContextMenuItem onClick={() => cutSelection()}>
              <Scissors />
              Cut
              <ContextMenuShortcut>⌘X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copySelection()}>
              <Copy />
              Copy
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => pasteClipboard()}
              disabled={!canPaste}
            >
              <ClipboardPaste />
              Paste
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                for (const id of selectedElementIds) duplicateElement(id);
              }}
            >
              <SquareStack />
              Duplicate
              <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>

            {singleIconSelected && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => setReplaceOpen(true)}>
                  <Replace />
                  Replace icon…
                </ContextMenuItem>
              </>
            )}

            <ContextMenuSeparator />

            <ContextMenuItem
              onClick={() => {
                for (const id of selectedElementIds) bringToFront(id);
              }}
            >
              <ArrowUpToLine />
              Bring to front
              <ContextMenuShortcut>⌘]</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                for (const id of selectedElementIds) sendToBack(id);
              }}
            >
              <ArrowDownToLine />
              Send to back
              <ContextMenuShortcut>⌘[</ContextMenuShortcut>
            </ContextMenuItem>

            {(isMulti || sameGroup) && <ContextMenuSeparator />}
            {isMulti && !sameGroup && (
              <ContextMenuItem
                onClick={() => groupElements(selectedElementIds)}
              >
                <Group />
                Group
                <ContextMenuShortcut>⌘G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {sameGroup && (
              <ContextMenuItem
                onClick={() => ungroupElement(selectedElementIds[0])}
              >
                <Ungroup />
                Ungroup
                <ContextMenuShortcut>⇧⌘G</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            <ContextMenuSeparator />

            <ContextMenuItem
              variant="destructive"
              onClick={() => deleteElements(selectedElementIds)}
            >
              <Trash2 />
              Delete
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem
              onClick={() => pasteClipboard()}
              disabled={!canPaste}
            >
              <ClipboardPaste />
              Paste
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => selectAll()}>
              <MousePointerSquareDashed />
              Select all
              <ContextMenuShortcut>⌘A</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
    <ReplaceIconDialog
      open={replaceOpen}
      onOpenChange={setReplaceOpen}
      elementId={singleIconId}
    />
    </>
  );
}
