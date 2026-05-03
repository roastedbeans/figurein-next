import { memo } from "react";
import type { ImageElement as ImageEl } from "@/types/editor";
import { isUploadImageId, uuidFromUploadImageId } from "@/lib/user-images";
import { useCustomImagesStore } from "@/stores/custom-images-store";

function ImageElementImpl({ element }: { element: ImageEl }) {
  const customEntry = useCustomImagesStore((s) =>
    isUploadImageId(element.imageId)
      ? s.getById(uuidFromUploadImageId(element.imageId))
      : undefined
  );
  const url = customEntry?.url ?? "";
  const rotateTransform = element.rotation
    ? `rotate(${element.rotation}, ${element.x + element.width / 2}, ${element.y + element.height / 2})`
    : undefined;

  return (
    <g
      data-element-id={element.id}
      data-upload-image-id={element.imageId}
      data-upload-image-format={customEntry?.format ?? ""}
      data-upload-image-opacity={element.opacity}
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
      {url ? (
        <image
          href={url}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          opacity={element.opacity}
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: "none" }}
        />
      ) : null}
    </g>
  );
}

export const ImageElement = memo(ImageElementImpl);
