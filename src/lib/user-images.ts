/** Saved `image` elements use `upload:<uuid>` into `custom_images` (see custom-images server). */

export const UPLOAD_IMAGE_PREFIX = "upload:";

export function isUploadImageId(imageId: string): boolean {
  return imageId.startsWith(UPLOAD_IMAGE_PREFIX);
}

export function uploadImageIdFromUuid(uuid: string): string {
  return `${UPLOAD_IMAGE_PREFIX}${uuid}`;
}

export function uuidFromUploadImageId(imageId: string): string {
  return imageId.slice(UPLOAD_IMAGE_PREFIX.length);
}

/** Default box when width/height are unknown (e.g. legacy SVG rows). */
export const DEFAULT_CUSTOM_IMAGE_CANVAS_SIZE = 160;

/** Canvas element size: use stored pixel dimensions when present, else a square fallback. */
export function dimensionsForCustomImageElement(
  width: number | null,
  height: number | null,
  fallbackSide = DEFAULT_CUSTOM_IMAGE_CANVAS_SIZE
): { width: number; height: number } {
  if (
    width != null &&
    height != null &&
    width > 0 &&
    height > 0 &&
    Number.isFinite(width) &&
    Number.isFinite(height)
  ) {
    return { width, height };
  }
  return { width: fallbackSide, height: fallbackSide };
}
