"use client";

import { useId } from "react";
import type { FrameElement as FrameElementType } from "@/types/editor";
import { strokeDashArray, strokeLineCap } from "@/lib/stroke";
import { CanvasElement } from "@/components/editor/CanvasElement";

/**
 * Hierarchy container. Renders an optional background (fill/stroke/rounded
 * corners), then its children via `<CanvasElement id={childId} />`. Children
 * use absolute coordinates in the current step — the frame is a grouping
 * node with NO transform. A later step will flip individual frames into
 * auto-layout mode (layoutMode !== "none") and switch those children to
 * frame-relative coords; the renderer will grow a `translate(x, y)` wrapper
 * at that point.
 *
 * `clipContent` applies an SVG clipPath to the frame bounds so overflowing
 * children are masked. `useId` keeps the clipPath id unique across multiple
 * frames on the same page without threading element.id into a global ns.
 */
export function FrameElement({ element }: { element: FrameElementType }) {
  const clipId = useId();
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation}, ${element.x + element.width / 2}, ${element.y + element.height / 2})`
    : undefined;

  const hasFill = element.fill && element.fill !== "none";
  const hasStroke =
    element.stroke && element.stroke !== "none" && element.strokeWidth > 0;
  const hasBackground = hasFill || hasStroke;
  const radius = element.cornerRadius ?? 0;
  const dashArray = strokeDashArray(element.strokeStyle, element.strokeWidth);

  return (
    <g
      data-element-id={element.id}
      className="cursor-move"
      transform={rotateTransform}
    >
      {/* Transparent hit area — frames without a fill are still clickable
          on their empty interior so selection works the Figma way (click
          empty frame → select frame, click a child → select the child via
          the inner data-element-id winning in findElementId). */}
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rx={radius}
        ry={radius}
        fill="transparent"
        stroke="none"
      />
      {hasBackground && (
        <rect
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rx={radius}
          ry={radius}
          fill={hasFill ? element.fill : "none"}
          stroke={hasStroke ? element.stroke : "none"}
          strokeWidth={hasStroke ? element.strokeWidth : 0}
          strokeDasharray={dashArray}
          strokeLinecap={strokeLineCap(element.strokeStyle)}
          vectorEffect="non-scaling-stroke"
          opacity={element.opacity}
          style={{ pointerEvents: "none" }}
        />
      )}
      {element.clipContent && (
        <defs>
          <clipPath id={clipId}>
            <rect
              x={element.x}
              y={element.y}
              width={element.width}
              height={element.height}
              rx={radius}
              ry={radius}
            />
          </clipPath>
        </defs>
      )}
      <g clipPath={element.clipContent ? `url(#${clipId})` : undefined}>
        {element.childIds.map((cid) => (
          <CanvasElement key={cid} id={cid} rendersAsChild />
        ))}
      </g>
    </g>
  );
}
