"use client";

import { memo } from "react";
import { elementById, useEditorStore } from "@/stores/editor-store";
import { RectElement } from "./elements/RectElement";
import { CircleElement } from "./elements/CircleElement";
import { LineElement } from "./elements/LineElement";
import { ArrowElement } from "./elements/ArrowElement";
import { TextElement } from "./elements/TextElement";
import { IconElement } from "./elements/IconElement";
import { PathElement } from "./elements/PathElement";
import { FrameElement } from "./elements/FrameElement";

// Subscribe-by-id: each CanvasElement pulls its own element data out of the
// store so the parent Canvas can skip re-renders on localized mutations (the
// dragged element replaces its own object reference; everyone else's `===`
// check against prior store state returns the same reference, so their
// subscribers short-circuit without re-rendering). This moves the N-children
// reconciliation cost out of every drag frame.
function CanvasElementImpl({
  id,
  rendersAsChild = false,
}: {
  id: string;
  /** True when a FrameElement is rendering this as one of its children. In
   *  that case we skip the "hide nested nodes from the top-level map" guard
   *  below — the frame is already responsible for placing us inside its
   *  <g>, so returning null would leave the node unrendered entirely. */
  rendersAsChild?: boolean;
}) {
  const element = useEditorStore((s) => elementById(s.elements, id));
  if (!element) return null;
  // Top-level render skips any element that belongs to a frame. Those
  // children are rendered from within the frame's own component so they
  // inherit its clipping and (in a later step) its transform. Without
  // this guard every nested child would draw twice — once at top level,
  // once inside the frame.
  if (!rendersAsChild && element.parentId !== null) return null;
  switch (element.type) {
    case "rectangle":
      return <RectElement element={element} />;
    case "circle":
      return <CircleElement element={element} />;
    case "line":
      return <LineElement element={element} />;
    case "arrow":
      return <ArrowElement element={element} />;
    case "text":
      return <TextElement element={element} />;
    case "icon":
      return <IconElement element={element} />;
    case "path":
      return <PathElement element={element} />;
    case "frame":
      return <FrameElement element={element} />;
  }
}

// Memoized so identity on `id` is sufficient to skip the inner selector setup
// when Canvas re-renders for unrelated reasons (add/delete, selection, etc.).
export const CanvasElement = memo(CanvasElementImpl);
