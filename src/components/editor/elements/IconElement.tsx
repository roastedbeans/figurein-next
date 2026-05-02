import { memo } from "react";
import type { IconElement as IconElementType } from "@/types/editor";
import {
  getIconUrl,
  getIconFormat,
  isCustomIconId,
  uuidFromCustomIconId,
} from "@/components/icons";
import { useCustomIconsStore } from "@/stores/custom-icons-store";

function IconElementImpl({ element }: { element: IconElementType }) {
  // Subscribe to the custom icons store so a freshly-loaded library (or a
  // just-uploaded icon) triggers re-renders for any elements referencing it.
  // Built-in icons ignore this subscription — their URL is a static path.
  const customEntry = useCustomIconsStore((s) =>
    isCustomIconId(element.iconId)
      ? s.getById(uuidFromCustomIconId(element.iconId))
      : undefined
  );
  const url = customEntry?.url ?? getIconUrl(element.iconId);
  const format = customEntry?.format ?? getIconFormat(element.iconId);
  const size = Math.min(element.width, element.height);
  const iconX = element.x + (element.width - size) / 2;
  const iconY = element.y + (element.height - size) / 2;
  const isRaster = format === "png" || format === "jpg";
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation}, ${element.x + element.width / 2}, ${element.y + element.height / 2})`
    : undefined;

  // `data-icon-*` attributes are the export hooks: lib/export.ts walks every
  // `[data-icon-id]` group and replaces the preview (foreignObject mask or
  // <image>) with an export-safe equivalent so the PNG canvas never taints
  // on a cross-origin resource.
  return (
    <g
      data-element-id={element.id}
      data-icon-id={element.iconId}
      data-icon-format={format}
      data-icon-color={element.color}
      data-icon-size={size}
      data-icon-x={iconX}
      data-icon-y={iconY}
      data-icon-opacity={element.opacity}
      className="cursor-move"
      transform={rotateTransform}
    >
      {/* Transparent hit area */}
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill="transparent"
        stroke="none"
      />
      {isRaster ? (
        <image
          href={url}
          x={iconX}
          y={iconY}
          width={size}
          height={size}
          opacity={element.opacity}
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: "none" }}
        />
      ) : (
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
            {/* CSS mask so `element.color` drives the visible color. Icons loaded
                as <img> can't inherit currentColor from the page — mask-image
                turns the SVG into a stencil and background-color fills it. */}
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
      )}
    </g>
  );
}

export const IconElement = memo(IconElementImpl);
