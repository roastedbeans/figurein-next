import type { CircleElement as CircleElementType } from "@/types/editor";
import { strokeDashArray, strokeLineCap } from "@/lib/stroke";

export function CircleElement({ element }: { element: CircleElementType }) {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  // Rotate the whole group so hit area + visible ellipse stay aligned.
  // For a perfect circle rotation is invisible, but non-round circles
  // (aspectLocked=false or imported ellipses) need proper rotation.
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation}, ${cx}, ${cy})`
    : undefined;
  const dashArray = strokeDashArray(element.strokeStyle, element.strokeWidth);

  return (
    <g data-element-id={element.id} className="cursor-move" transform={rotateTransform}>
      {/* Transparent hit area */}
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill="transparent"
        stroke="none"
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={element.width / 2}
        ry={element.height / 2}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        strokeDasharray={dashArray}
        strokeLinecap={strokeLineCap(element.strokeStyle)}
        opacity={element.opacity}
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
}
