import type { PathElement as PathElementType } from "@/types/editor";
import { strokeDashArray, strokeLineCap } from "@/lib/stroke";
import { resolvePathElementGeometry } from "@/lib/path-element-geometry";

export function PathElement({ element }: { element: PathElementType }) {
  // preserveAspectRatio="none" lets the stencil path fill its bounding box
  // exactly like a rectangle/circle, so resize handles act as "configure the
  // dimensions" in both axes. vector-effect="non-scaling-stroke" stops the
  // stroke from distorting under non-uniform scale.
  //
  // Rotation is applied to the outer <g> in canvas coordinates, around the
  // element's actual center. If rotation were applied inside the nested
  // <svg>'s viewBox, preserveAspectRatio="none" would stretch the rotated
  // path through the width/height ratio and produce a sheared shape.
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation}, ${cx}, ${cy})`
    : undefined;
  const dashArray = strokeDashArray(element.strokeStyle, element.strokeWidth);
  const lineCap = element.strokeStyle === "dotted" ? strokeLineCap(element.strokeStyle) : "round";

  const { viewBox, pathD, overlayD } = resolvePathElementGeometry(element);
  const pathData = pathD;
  const overlayPath = overlayD;

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
      <svg
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        viewBox={viewBox}
        preserveAspectRatio="none"
        overflow="visible"
        opacity={element.opacity}
        style={{ pointerEvents: "none" }}
      >
        <path
          d={pathData}
          fill={element.fill}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          strokeDasharray={dashArray}
          strokeLinecap={lineCap}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {overlayPath && (
          <path
            d={overlayPath}
            fill="none"
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            strokeDasharray={dashArray}
            strokeLinecap={lineCap}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </g>
  );
}
