export type ElementType =
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "text"
  | "icon"
  | "path"
  | "frame";

export type Tool =
  | "select"
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "text"
  | "path";

export type StrokeStyle = "solid" | "dashed" | "dotted";

export type BaseElement = {
  id: string;
  type: ElementType;
  /** Hierarchical parent reference. `null` means "page root" — today every
   *  element lives directly on the page. Once the `frame` type lands, a
   *  non-null parentId addresses the containing frame node, and the element's
   *  x/y become relative to that frame. Step 1 of the Figma-style hierarchy
   *  migration keeps the field in the type without changing any render or
   *  edit behavior — all existing call sites default it to `null`. */
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeStyle?: StrokeStyle;
  opacity: number;
  zIndex: number;
  groupId?: string;
  /** When true, resize handles always maintain the element's original
   *  width/height ratio regardless of the Shift key. Shift always forces
   *  aspect lock too — this flag is the sticky form. */
  aspectLocked?: boolean;
};

export type RectangleElement = BaseElement & {
  type: "rectangle";
  borderRadius: number;
};

export type CircleElement = BaseElement & {
  type: "circle";
};

export type LineElement = BaseElement & {
  type: "line";
  x2: number;
  y2: number;
  headStyle: "triangle" | "open" | "none";
  tailStyle: "none" | "triangle" | "open";
  lineStyle: "straight" | "curved" | "elbow";
  cx?: number;
  cy?: number;
  elbowMidRatio?: number;
  elbowCorners?: [number, number][];
  startDir?: EdgeDir;
  endDir?: EdgeDir;
  /** Element ID that the start point is connected to */
  startConnectedTo?: string;
  /** Element ID that the end point is connected to */
  endConnectedTo?: string;
};

export type EdgeDir = "up" | "down" | "left" | "right";

export type ArrowElement = BaseElement & {
  type: "arrow";
  x2: number;
  y2: number;
  headStyle: "triangle" | "open" | "none";
  tailStyle: "none" | "triangle" | "open";
  lineStyle: "straight" | "curved" | "elbow";
  /** Bezier control point for curved lines (user-overridable) */
  cx?: number;
  cy?: number;
  /** Elbow bend position for elbow lines (user-overridable, 0-1 ratio along primary axis) */
  elbowMidRatio?: number;
  /** Explicit elbow turning points between start and end (Canva-style dynamic segments) */
  elbowCorners?: [number, number][];
  /** Direction the arrow exits from the start point (set when snapped to an element edge) */
  startDir?: EdgeDir;
  /** Direction the arrow enters the end point (set when snapped to an element edge) */
  endDir?: EdgeDir;
  /** Element ID that the start point is connected to */
  startConnectedTo?: string;
  /** Element ID that the end point is connected to */
  endConnectedTo?: string;
};

export type TextElement = BaseElement & {
  type: "text";
  content: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontFamily: string;
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  /** Vertical alignment of text within the declared height. Optional for
   *  backward compatibility with documents saved before this field existed;
   *  the renderer defaults to "top" when missing. */
  verticalAlign?: "top" | "middle" | "bottom";
  color: string;
  /** Corner radius applied to the text element's own background + border.
   *  Lets a text act as a rounded pill/container without a separate rect. */
  borderRadius: number;
};

export type IconElement = BaseElement & {
  type: "icon";
  iconId: string;
  color: string;
};

export type PathElement = BaseElement & {
  type: "path";
  pathData: string; // SVG path d attribute
  viewBox: string; // e.g. "0 0 200 100"
};

/** Main-axis packing when layoutMode !== "none". Ignored otherwise — elements
 *  with an inert layoutMode keep their absolute child coords. */
export type FrameMainAxisAlign =
  | "start"
  | "center"
  | "end"
  | "space-between";

/** Cross-axis alignment; "stretch" makes children fill the cross dimension. */
export type FrameCrossAxisAlign = "start" | "center" | "end" | "stretch";

/** Hierarchical container. Children are addressed by id in `childIds`, with
 *  array order = z-order *within* the frame (independent of the top-level
 *  `zIndex` that orders frames and page-root elements against each other).
 *
 *  Step-2 semantics: `layoutMode` is always "none" in practice — children
 *  keep absolute coords and the frame renders without a transform. The
 *  layout fields exist so later steps can flip individual frames into
 *  auto-layout mode without another schema migration. */
export type FrameElement = BaseElement & {
  type: "frame";
  childIds: string[];
  layoutMode: "none" | "vertical" | "horizontal";
  /** Main-axis gap between children (auto-layout only). */
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  mainAxisAlign: FrameMainAxisAlign;
  crossAxisAlign: FrameCrossAxisAlign;
  /** Clip overflowing children to the frame bounds. */
  clipContent: boolean;
  /** Rounded corners on the frame background. */
  cornerRadius?: number;
};

export type EditorElement =
  | RectangleElement
  | CircleElement
  | LineElement
  | ArrowElement
  | TextElement
  | IconElement
  | PathElement
  | FrameElement;

export type CanvasState = {
  zoom: number;
  panX: number;
  panY: number;
  /** SVG viewport size in CSS pixels. Written by the Canvas component on
   *  mount and on resize so the store's pan clamp can convert world
   *  coordinates to screen bounds. Zero before the first measurement —
   *  consumers treat that as "clamp disabled." */
  viewportWidth: number;
  viewportHeight: number;
};
