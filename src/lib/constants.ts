export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

/** Pan that centers the fixed artboard (`CANVAS_*`) in the viewport at the
 *  given zoom — same math as the editor’s first paint (see Canvas mount). */
export function centeredPanForViewport(
  viewportWidth: number,
  viewportHeight: number,
  zoom: number
): { panX: number; panY: number } {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { panX: 0, panY: 0 };
  }
  return {
    panX: (viewportWidth - CANVAS_WIDTH * zoom) / 2,
    panY: (viewportHeight - CANVAS_HEIGHT * zoom) / 2,
  };
}

export const GRID_SIZE = 20;
export const GRID_MAJOR = 5; // Major line every N minor lines (20*5 = 100px)
/** Snap interval used for drag placement/resize. Number-field step values
 *  mirror this so typed edits also land on the same grid. */
export const SNAP_SIZE = GRID_SIZE / 4;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.1;
export const HISTORY_LIMIT = 50;
export const HANDLE_SIZE = 8;

export const DEFAULT_FILL = "#ffffff";
export const DEFAULT_STROKE = "#1a1a1a";
export const DEFAULT_STROKE_WIDTH = 1;

/** Fallback dimensions when the user places a shape with a single click
 *  (no drag). Rect/circle inflate to this box; lines/arrows extend this far
 *  horizontally. Users can still drag for a custom size. */
export const DEFAULT_SHAPE_WIDTH = 120;
export const DEFAULT_SHAPE_HEIGHT = 80;
export const DEFAULT_LINE_LENGTH = 120;
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_FONT_FAMILY =
  "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

export type TextVariant = "heading" | "subheading" | "body" | "caption";

export const TEXT_VARIANTS: Record<
  TextVariant,
  {
    label: string;
    content: string;
    fontSize: number;
    fontWeight: "normal" | "bold";
    width: number;
  }
> = {
  heading: { label: "Heading", content: "Heading", fontSize: 24, fontWeight: "bold", width: 280 },
  subheading: { label: "Subheading", content: "Subheading", fontSize: 20, fontWeight: "bold", width: 240 },
  body: { label: "Body text", content: "Body text", fontSize: 16, fontWeight: "normal", width: 240 },
  caption: { label: "Caption", content: "Caption", fontSize: 12, fontWeight: "normal", width: 160 },
};

export const COLOR_PRESETS = [
  "#1a1a1a",
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
  "#f3f4f6",
  "none",
];
