import type { RectangleElement } from "@/types/editor";
import { strokeDashArray, strokeLineCap } from "@/lib/stroke";

export function RectElement({ element }: { element: RectangleElement }) {
  // Rotate the whole group (hit area + visible rect) around the element's
  // center so a rotated shape stays clickable along its rotated outline,
  // not just its unrotated bounding box.
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation}, ${element.x + element.width / 2}, ${element.y + element.height / 2})`
    : undefined;
  const dashArray = strokeDashArray(element.strokeStyle, element.strokeWidth);
  return (
    <g data-element-id={element.id} className="cursor-move" transform={rotateTransform}>
      {/* Transparent hit area — makes unfilled/stroke-only rects clickable */}
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rx={element.borderRadius}
        ry={element.borderRadius}
        fill="transparent"
        stroke="none"
      />
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rx={element.borderRadius}
        ry={element.borderRadius}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        strokeDasharray={dashArray}
        strokeLinecap={strokeLineCap(element.strokeStyle)}
        vectorEffect="non-scaling-stroke"
        opacity={element.opacity}
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
}
