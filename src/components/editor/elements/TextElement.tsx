"use client";

import { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import type { TextElement as TextElementType } from "@/types/editor";
import { useEditorStore } from "@/stores/editor-store";

export function TextElement({ element }: { element: TextElementType }) {
  // Read the auto-edit signal once, synchronously, at mount. This gives us
  // "placed a new text element → it's instantly in edit mode with the
  // placeholder selected" without racing through multiple render cycles.
  // The signal is *not* cleared from here — in React StrictMode dev, the
  // component mounts → fake-unmounts → remounts, which would reset the ref
  // and lose the signal if we had cleared it from inside. setTool (next
  // tool change) and switchPage both clear autoEditTextId, so leaving it
  // set between now and the next user action is harmless.
  const autoEditOnMount = useRef(
    useEditorStore.getState().autoEditTextId === element.id
  );
  const [isEditing, setIsEditing] = useState(autoEditOnMount.current);
  const divRef = useRef<HTMLDivElement>(null);
  const updateElement = useEditorStore((s) => s.updateElement);
  const updateElementLive = useEditorStore((s) => s.updateElementLive);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const setEditingTextId = useEditorStore((s) => s.setEditingTextId);
  const isSelected = selectedElementId === element.id;
  /** When true, the next focus should select the full content rather than
   *  collapse the caret to the end — used by the "just created, replace
   *  placeholder" flow. Seeded from the auto-edit signal at mount. */
  const selectAllOnFocusRef = useRef(autoEditOnMount.current);
  /** Guards the first-mount innerHTML sync. When we start in edit mode,
   *  isEditing is already true during the very first commit so the usual
   *  "sync DOM from store unless editing" branch would skip initialization
   *  and leave the div empty. */
  const didMountRef = useRef(false);
  /** Tracks the previous declared bbox so grow-back can tell which edge the
   *  user pulled in. All three of the following paths land here the same way
   *  (declared height < scrollHeight), but the correct response differs:
   *    - Top-handle shrink  (y increased, height decreased) → preserve the
   *      BOTTOM edge. Grow back by pulling y DOWN (i.e. y decreases toward
   *      the pre-shrink value) so the bottom the user dragged TO stays put.
   *    - Bottom-handle shrink (y unchanged, height decreased) → preserve the
   *      TOP edge. Grow back by extending height downward, y unchanged —
   *      otherwise the whole box slides upward.
   *    - Natural content growth (user typed, font/variant changed, or first
   *      mount) → preserve the TOP edge, same as bottom-handle. */
  const prevDeclaredRef = useRef({ y: element.y, height: element.height });
  /** rAF handle for throttled measurement — coalesces fast keystrokes so
   *  `scrollHeight` (forced layout) + `updateElementLive` fire at most
   *  once per frame. Cleared on unmount. */
  const measureRafRef = useRef(0);
  // Mirror element.y/element.height into refs so measureHeightNow can stay
  // stable across drags. Previously the callback's deps included element.y
  // and element.height, so every drag frame re-created the callback →
  // re-created measureHeight → re-ran the effect below → scheduled a
  // scrollHeight read (layout flush) per frame. Reads via the ref still
  // see the latest committed values because React commits before the rAF
  // fires.
  const elementLayoutRef = useRef({ y: element.y, height: element.height });
  elementLayoutRef.current = { y: element.y, height: element.height };
  const measureHeightNow = useCallback(() => {
    const div = divRef.current;
    if (!div) return;
    const measured = div.scrollHeight;
    if (measured <= 0) return;
    const snapped = Math.ceil(measured / 5) * 5;
    const { y: curY, height: curHeight } = elementLayoutRef.current;
    const prev = prevDeclaredRef.current;
    const heightShrunk = curHeight < prev.height;
    const yIncreased = curY > prev.y;
    const topHandleShrink = heightShrunk && yIncreased;
    prevDeclaredRef.current = { y: curY, height: curHeight };
    if (snapped <= curHeight + 1) return;
    if (topHandleShrink) {
      // Preserve the bottom edge: grow back upward.
      const preservedBottom = curY + curHeight;
      updateElementLive(element.id, {
        y: preservedBottom - snapped,
        height: snapped,
      });
    } else {
      // Preserve the top edge: grow back downward (covers bottom-handle
      // shrink, natural content growth, and first mount).
      updateElementLive(element.id, { height: snapped });
    }
  }, [element.id, updateElementLive]);

  const measureHeight = useCallback(() => {
    if (measureRafRef.current !== 0) return;
    measureRafRef.current = requestAnimationFrame(() => {
      measureRafRef.current = 0;
      measureHeightNow();
    });
  }, [measureHeightNow]);

  useEffect(() => {
    return () => {
      if (measureRafRef.current !== 0) {
        cancelAnimationFrame(measureRafRef.current);
        measureRafRef.current = 0;
      }
    };
  }, []);

  // Measure on mount and whenever content / sizing inputs change, editing
  // or not. Grow-only keeps idle elements stable — measureHeight is a
  // no-op when the declared height already fits.
  useEffect(() => {
    measureHeight();
  }, [measureHeight, element.content, element.width, element.fontSize, element.fontWeight, element.fontFamily]);

  // Exit editing when deselected
  useEffect(() => {
    if (!isSelected && isEditing) {
      setIsEditing(false);
    }
  }, [isSelected, isEditing]);

  // Own the DOM's innerHTML imperatively. React's own children/dangerouslySet-
  // InnerHTML diffing fights contentEditable — any parent re-render during
  // typing can reset the DOM to match the stale store value and wipe the
  // user's in-progress edits. Writing innerHTML here (and ONLY here) gives
  // us a single source of truth: if we're not editing, mirror the store; if
  // we are, leave the DOM alone so contentEditable can mutate it freely.
  useLayoutEffect(() => {
    const div = divRef.current;
    if (!div) return;
    // First mount always seeds the DOM from the store — even if we're
    // starting in edit mode (new text element w/ auto-edit), the div needs
    // its "Text" content so selectNodeContents has something to highlight.
    if (!didMountRef.current) {
      didMountRef.current = true;
      div.innerHTML = element.content;
      return;
    }
    if (isEditing) return;
    if (div.innerHTML !== element.content) {
      div.innerHTML = element.content;
    }
  }, [element.content, isEditing]);

  // First-mount authoritative measurement for AI-generated text. The planner
  // emits approximate heights; the browser's intrinsic measurement is what
  // drives the post-generation cascade reflow that snaps downstream elements
  // to the real layout.
  //
  // Deliberately bypasses the grow-only clamp in `measureHeight` (which
  // exists for editor interactions, where shrinking on every keystroke is
  // visually jarring). The planned height was never painted on its own —
  // the overlay kept the pre-reflow state hidden — so reporting a shorter
  // intrinsic height here is safe and correct.
  //
  // Strips `min-height` during measurement because the declared height sets
  // min-height in the render style. With min-height set, scrollHeight is
  // max(min, intrinsic) — we'd miss shrink cases entirely. The read is
  // bracketed in the same synchronous useLayoutEffect so no paint occurs
  // between strip → measure → restore.
  useLayoutEffect(() => {
    const div = divRef.current;
    if (!div) return;
    const pending = useEditorStore.getState().pendingMeasure;
    if (!pending?.textIds.has(element.id)) return;
    const savedMinHeight = div.style.minHeight;
    div.style.minHeight = "0px";
    const measured = div.scrollHeight;
    div.style.minHeight = savedMinHeight;
    if (measured <= 0) return;
    const snapped = Math.ceil(measured / 5) * 5;
    useEditorStore.getState().reportMeasuredHeight(element.id, snapped);
    // Keep the top-handle-shrink detector in sync so the next measureHeight
    // call doesn't misread this correction as a user drag.
    prevDeclaredRef.current = { y: element.y, height: snapped };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useLayoutEffect (not useEffect) so focus + selection happen synchronously
  // after DOM commit, before the browser has a chance to process queued
  // mouseup/click events from the same interaction that triggered edit mode.
  // If focus ran post-paint, a click could re-focus the div and replace our
  // full selection with a caret at the click point.
  useLayoutEffect(() => {
    if (!isEditing) return;
    // Defer focus + selection to the next animation frame so the browser's
    // default mousedown action (from the click that just created this text
    // element) has finished. Otherwise the default action can steal focus
    // or reset the selection right after we set it.
    //
    // Read + consume selectAllOnFocusRef INSIDE the rAF, not in the effect
    // body. Under React StrictMode this effect is invoked twice on mount
    // (setup → cleanup → setup); consuming the ref outside would flip it
    // to false on the first pass, and the second pass's rAF would then
    // collapse the range to a caret instead of selecting all.
    const raf = requestAnimationFrame(() => {
      if (!divRef.current) return;
      divRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(divRef.current);
      if (!selectAllOnFocusRef.current) {
        range.collapse(false);
      }
      selectAllOnFocusRef.current = false;
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      try {
        document.execCommand("styleWithCSS", false, "true");
      } catch {
        // ignore
      }
      setEditingTextId(element.id);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const handleBlur = () => {
    if (divRef.current) {
      const html = divRef.current.innerHTML || "";
      updateElement(element.id, { content: html });
      // measureHeight internally schedules its own rAF now — no need to
      // double-wrap. Calling through the throttled entry point also
      // dedupes against any pending rAF from a last-keystroke onInput.
      measureHeight();
    }
    setIsEditing(false);
    setEditingTextId(null);
  };

  // Respect the declared height exactly so AI-planned layouts stay stable.
  // A floor at a single line-height keeps brand-new empty text boxes from
  // rendering as 0px tall during the mount → first-measure gap.
  const renderHeight = isEditing
    ? Math.max(element.height, element.fontSize * 1.2 + 8)
    : element.height;

  // Rotate around the element's center so snap-to-45° from the rotation handle
  // lands the text on clean axes (0° / 90° / -90° / …) without drift.
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation}, ${element.x + element.width / 2}, ${element.y + renderHeight / 2})`
    : undefined;

  return (
    <g data-element-id={element.id} className="cursor-move" transform={rotateTransform}>
      {/* Transparent hit area matching measured height */}
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={renderHeight}
        fill="transparent"
        stroke="none"
      />
      <foreignObject
        x={element.x}
        y={element.y}
        width={element.width}
        height={renderHeight}
        opacity={element.opacity}
        style={{ overflow: "visible" }}
      >
        <div
          ref={divRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onDoubleClick={(e) => {
            if (isSelected) {
              e.stopPropagation();
              e.preventDefault();
              setIsEditing(true);
            }
          }}
          onMouseDown={(e) => {
            if (isEditing) {
              // Allow text cursor positioning inside the editor
              e.stopPropagation();
            }
          }}
          onBlur={handleBlur}
          onInput={measureHeight}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              handleBlur();
            }
            // Prevent canvas shortcuts while editing
            e.stopPropagation();
          }}
          style={{
            width: "100%",
            // min-height tracks the declared height so a resized box (drag
            // bottom handle → taller) fills the new bounds with its border
            // and fill. If content is larger than min-height, the div grows
            // under overflow:visible so the styled box still wraps content.
            minHeight: `${renderHeight}px`,
            fontSize: `${element.fontSize}px`,
            fontWeight: element.fontWeight,
            fontFamily: element.fontFamily,
            fontStyle: element.fontStyle,
            textAlign: element.textAlign,
            // Vertical alignment inside the declared box — `align-content` on
            // a block container is the single-property way to stack text at
            // top / middle / bottom without wrapping in a flex parent (which
            // would interfere with contentEditable caret behavior).
            alignContent:
              element.verticalAlign === "middle"
                ? "center"
                : element.verticalAlign === "bottom"
                  ? "end"
                  : "start",
            color: element.color,
            backgroundColor: element.fill === "none" ? "transparent" : element.fill,
            border: element.stroke !== "none"
              ? `${element.strokeWidth}px ${
                  element.strokeStyle === "dashed"
                    ? "dashed"
                    : element.strokeStyle === "dotted"
                      ? "dotted"
                      : "solid"
                } ${element.stroke}`
              : "none",
            borderRadius: `${element.borderRadius ?? 0}px`,
            outline: isEditing ? "2px solid hsl(221 83% 53%)" : "none",
            padding: "4px",
            wordWrap: "break-word",
            overflowWrap: "break-word",
            whiteSpace: "pre-wrap",
            lineHeight: 1.2,
            cursor: isEditing ? "text" : "move",
            userSelect: isEditing ? "text" : "none",
            boxSizing: "border-box",
            // Always allow pointer events so double-click reaches this handler
            pointerEvents: "auto",
          }}
        />
      </foreignObject>
    </g>
  );
}
