import type { StrokeStyle } from "@/types/editor";

/** Map strokeStyle → SVG stroke-dasharray, scaled by strokeWidth so the
 *  dash rhythm reads consistently across thin and thick strokes. Returns
 *  `undefined` for solid so we can omit the attribute entirely. */
export function strokeDashArray(
  style: StrokeStyle | undefined,
  strokeWidth: number,
): string | undefined {
  if (!style || style === "solid") return undefined;
  const w = Math.max(strokeWidth, 1);
  switch (style) {
    case "dashed":
      return `${w * 3} ${w * 2}`;
    case "dotted":
      return `${w * 0.5} ${w * 2}`;
    default:
      return undefined;
  }
}

/** stroke-linecap that pairs well with each dash style. Dotted reads as
 *  round dots; dashed/solid stay butt so corners don't look fuzzy. */
export function strokeLineCap(style: StrokeStyle | undefined): "butt" | "round" {
  return style === "dotted" ? "round" : "butt";
}
