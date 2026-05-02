/** Preset flowchart / diagram shapes rendered as PathElements. Each entry
 *  carries an SVG `d` path + viewBox so the renderer can scale it to any
 *  size the user drops on the canvas. Multi-subpath strings (e.g. the
 *  cylinder's top lip or the predefined-process internal lines) are
 *  intentional — they render as a single PathElement. */
export type FlowchartShape = {
  id: string;
  label: string;
  viewBox: string;
  pathData: string;
  /** Default width × height (canvas px) when dropped. Chosen so shapes
   *  look balanced without the user having to resize. */
  width: number;
  height: number;
};

export const FLOWCHART_SHAPES: FlowchartShape[] = [
  {
    id: "diamond",
    label: "Decision",
    viewBox: "0 0 100 100",
    pathData: "M 50 2 L 98 50 L 50 98 L 2 50 Z",
    width: 120,
    height: 100,
  },
  {
    id: "parallelogram",
    label: "Input / Output",
    viewBox: "0 0 100 60",
    pathData: "M 15 2 L 98 2 L 85 58 L 2 58 Z",
    width: 140,
    height: 80,
  },
  {
    id: "hexagon",
    label: "Preparation",
    viewBox: "0 0 100 60",
    pathData: "M 20 2 L 80 2 L 98 30 L 80 58 L 20 58 L 2 30 Z",
    width: 140,
    height: 80,
  },
  {
    id: "trapezoid",
    label: "Manual Op",
    viewBox: "0 0 100 60",
    pathData: "M 2 2 L 98 2 L 80 58 L 20 58 Z",
    width: 140,
    height: 80,
  },
  {
    id: "terminator",
    label: "Start / End",
    viewBox: "0 0 120 60",
    pathData:
      "M 30 2 H 90 A 28 28 0 0 1 90 58 H 30 A 28 28 0 0 1 30 2 Z",
    width: 140,
    height: 60,
  },
  {
    id: "triangle",
    label: "Merge",
    viewBox: "0 0 100 100",
    pathData: "M 50 2 L 98 98 L 2 98 Z",
    width: 100,
    height: 100,
  },
  {
    id: "document",
    label: "Document",
    viewBox: "0 0 100 80",
    pathData:
      "M 2 2 H 98 V 62 Q 75 78 50 64 T 2 62 Z",
    width: 140,
    height: 100,
  },
  {
    id: "predefined-process",
    label: "Predefined",
    viewBox: "0 0 100 60",
    pathData:
      "M 2 2 H 98 V 58 H 2 Z M 14 2 V 58 M 86 2 V 58",
    width: 140,
    height: 80,
  },
  {
    id: "cylinder",
    label: "Database",
    viewBox: "0 0 100 100",
    pathData:
      "M 2 15 A 48 12 0 0 1 98 15 V 85 A 48 12 0 0 1 2 85 Z M 2 15 A 48 12 0 0 0 98 15",
    width: 100,
    height: 120,
  },
  {
    id: "cloud",
    label: "Cloud",
    viewBox: "0 0 120 80",
    pathData:
      "M 30 70 Q 4 70 10 48 Q 2 28 26 28 Q 30 8 54 16 Q 74 2 86 24 Q 116 26 110 48 Q 118 70 90 70 Z",
    width: 140,
    height: 100,
  },
  {
    id: "pentagon",
    label: "Off-page",
    viewBox: "0 0 100 100",
    pathData: "M 2 2 L 98 2 L 98 70 L 50 98 L 2 70 Z",
    width: 100,
    height: 110,
  },
  {
    id: "arrow-right",
    label: "Arrow Block",
    viewBox: "0 0 120 60",
    pathData:
      "M 2 18 H 80 V 2 L 118 30 L 80 58 V 42 H 2 Z",
    width: 140,
    height: 70,
  },
];
