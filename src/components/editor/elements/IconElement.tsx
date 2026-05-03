import { memo } from "react";
import type { IconElement as IconElementType } from "@/types/editor";
import { getIconUrl } from "@/components/icons";

function IconElementImpl({ element }: { element: IconElementType }) {
  const url = getIconUrl(element.iconId);
  const size = Math.min(element.width, element.height);
  const iconX = element.x + (element.width - size) / 2;
  const iconY = element.y + (element.height - size) / 2;
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation}, ${element.x + element.width / 2}, ${element.y + element.height / 2})`
    : undefined;

  return (
    <g
      data-element-id={element.id}
      data-icon-id={element.iconId}
      data-icon-format="svg"
      data-icon-color={element.color}
      data-icon-size={size}
      data-icon-x={iconX}
      data-icon-y={iconY}
      data-icon-opacity={element.opacity}
      className="cursor-move"
      transform={rotateTransform}
    >
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill="transparent"
        stroke="none"
      />
      <foreignObject
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        opacity={element.opacity}
        className="overflow-visible"
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            aria-label={element.iconId}
            style={{
              width: size,
              height: size,
              backgroundColor: element.color,
              WebkitMaskImage: `url(${url})`,
              maskImage: `url(${url})`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              pointerEvents: "none",
            }}
          />
        </div>
      </foreignObject>
    </g>
  );
}

export const IconElement = memo(IconElementImpl);
