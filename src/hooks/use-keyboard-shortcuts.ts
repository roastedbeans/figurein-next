"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/stores/editor-store";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Let the browser handle shortcuts inside text fields natively.
      const target = e.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      const state = useEditorStore.getState();
      // Normalize both ways: e.code is Shift/layout-immune (KeyZ), e.key is
      // lowercase letter. Match either — belt-and-suspenders for layouts where
      // one or the other misreports.
      const code = e.code;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const isLetter = (letter: string) =>
        code === `Key${letter.toUpperCase()}` || key === letter.toLowerCase();

      // Toggle Figurin chat panel (Cmd/Ctrl+B)
      if (mod && isLetter("b")) {
        e.preventDefault();
        e.stopPropagation();
        state.toggleSmartFigure();
        return;
      }

      // Undo / Redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
      if (mod && isLetter("z")) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }

      // Delete / Backspace removes the current selection
      if (
        (key === "Delete" || key === "Backspace") &&
        state.selectedElementIds.length > 0
      ) {
        e.preventDefault();
        e.stopPropagation();
        state.deleteElements(state.selectedElementIds);
        return;
      }

      // Escape: exit group-edit mode first (so a single Escape leaves the
      // group without clearing the selection); otherwise deselect and drop
      // back to the select tool.
      if (key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (state.editingGroupId) {
          state.setEditingGroupId(null);
        } else {
          state.selectElement(null);
          state.setTool("select");
        }
        return;
      }

      // Duplicate: Cmd/Ctrl+D — snapshot ids first because duplicateElement
      // replaces the selection as it runs.
      if (mod && isLetter("d") && state.selectedElementIds.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const ids = [...state.selectedElementIds];
        for (const id of ids) state.duplicateElement(id);
        return;
      }

      // Cut / Copy / Paste
      if (mod && isLetter("x") && state.selectedElementIds.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        state.cutSelection();
        return;
      }
      if (mod && isLetter("c") && state.selectedElementIds.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        state.copySelection();
        return;
      }
      if (mod && isLetter("v") && state.clipboard.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        state.pasteClipboard();
        return;
      }

      // Select all
      if (mod && isLetter("a")) {
        e.preventDefault();
        e.stopPropagation();
        state.selectAll();
        return;
      }

      // Ungroup: Cmd/Ctrl+Shift+G — check before Group since both match KeyG
      // and shift is the only discriminator.
      if (
        mod &&
        e.shiftKey &&
        isLetter("g") &&
        state.selectedElementIds.length > 0
      ) {
        const first = state.elements.find(
          (el) => el.id === state.selectedElementIds[0]
        );
        if (first?.groupId) {
          e.preventDefault();
          e.stopPropagation();
          state.ungroupElement(first.id);
        }
        return;
      }

      // Group: Cmd/Ctrl+G — requires 2+ selected elements. groupElements
      // no-ops when they're already in the same group, so no need to check.
      if (mod && isLetter("g") && state.selectedElementIds.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        state.groupElements(state.selectedElementIds);
        return;
      }

      // Toggle grid: Shift+` (Backquote)
      if (e.shiftKey && !mod && code === "Backquote") {
        e.preventDefault();
        e.stopPropagation();
        state.toggleGrid();
        return;
      }

      // Default view — centered artboard at 100% zoom: Shift+1
      if (e.shiftKey && !mod && (code === "Digit1" || key === "!")) {
        e.preventDefault();
        e.stopPropagation();
        state.resetToDefaultView();
        return;
      }

      // Fit all to view: Shift+2
      if (e.shiftKey && !mod && (code === "Digit2" || key === "@")) {
        e.preventDefault();
        e.stopPropagation();
        state.fitView();
        return;
      }
    };

    // Register on BOTH document and window, capture phase, so we run before
    // anything the browser, React event system, or a floating-ui popup might
    // install. The non-passive default lets preventDefault block the browser's
    // native action (Cmd+A, Cmd+V, browser history, etc.).
    document.addEventListener("keydown", handler, { capture: true });
    window.addEventListener("keydown", handler, { capture: true });
    return () => {
      document.removeEventListener("keydown", handler, { capture: true });
      window.removeEventListener("keydown", handler, { capture: true });
    };
  }, []);
}
