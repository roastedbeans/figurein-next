/** draw.io registers diagram shapes as a flat stencil list (mxGraph: name +
 *  geometry). Each entry maps to one PathElement preset: stencil-space `d`
 *  plus optional `pathGenerator(bounds)` — same role as parameterized mx
 *  `shape`/aspect handlers — and optional `detailPath` for stroked overlays. */
export type ShapeStencil = {
  id: string;
  label: string;
  viewBox: string;
  pathData: string;
  /** Default canvas size when stamped (px). */
  width: number;
  height: number;
  /** Bounds-local `d` in [0..w] × [0..h]; skips uniform path scale. */
  pathGenerator?: (w: number, h: number) => string;
  /** Stroke-only overlay in stencil coordinates (paired with pathData only). */
  detailPath?: string;
  /** Stroke-only overlay in [0..w] × [0..h]; use with pathGenerator when the
   *  rim/lip must stay correct at non‑uniform scale (e.g. cylinder). */
  detailPathGenerator?: (w: number, h: number) => string;
};

/** Cylinder silhouette in [0,w]×[0,h]; caps span full width (no 2–98 side gutter). */
function cylinderBodyPath(w: number, h: number): string {
  const sy = h / 100;
  const rx = w / 2;
  const ry = 12 * sy;
  const yCap = 15 * sy;
  const yBase = 85 * sy;
  return (
    `M 0 ${yCap} A ${rx} ${ry} 0 0 1 ${w} ${yCap} ` +
      `L ${w} ${yBase} A ${rx} ${ry} 0 0 1 0 ${yBase} Z`
  );
}

function cylinderLipPath(w: number, h: number): string {
  const sy = h / 100;
  const rx = w / 2;
  const ry = 12 * sy;
  const yCap = 15 * sy;
  return `M 0 ${yCap} A ${rx} ${ry} 0 0 0 ${w} ${yCap}`;
}

const _r3 = (n: number) => String(Math.round(n * 1000) / 1000);

/** Waving ribbon: straight vertical left/right edges; top and bottom are the same
 *  wave vertically offset — constant thickness (fills); one dip then one crest along x. */
function waveSlugPath(w: number, h: number): string {
  const segs = Math.max(36, Math.round(Math.min(w, h) / 2));
  const inset = Math.min(w, h) * 0.022;
  const xl = inset;
  const xr = w - inset;

  /** Prototype extents in stencil space (aspect ~ width/height of final box). */
  const amp = h * 0.11;
  const band = h * 0.4;
  const y0 = h * 0.18;
  const yt0 = (u: number) => y0 + amp * Math.sin(2 * Math.PI * u);
  const yb0 = (u: number) => yt0(u) + band;
  const ymin = y0 - amp;
  const ymax = y0 + amp + band;
  /** Fit tight vertically in bounds — removes excess empty space below/above path. */
  const padY = h * 0.02;
  const innerH = h - 2 * padY;
  const sy = ymax > ymin ? innerH / (ymax - ymin) : 1;
  const mapY = (y: number) => padY + (y - ymin) * sy;

  const yt = (u: number) => mapY(yt0(u));
  const yb = (u: number) => mapY(yb0(u));

  let d = "";
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const x = xl + (xr - xl) * u;
    const y = yt(u);
    d += `${i === 0 ? "M" : "L"} ${_r3(x)} ${_r3(y)} `;
  }
  for (let i = segs; i >= 0; i--) {
    const u = i / segs;
    const x = xl + (xr - xl) * u;
    d += `L ${_r3(x)} ${_r3(yb(u))} `;
  }
  return `${d.trim()} Z`;
}

/** Horizontal ribbon / banner: arched top and bottom plus scooped vertical sides —
 *  stronger curves than flat-top slab; parameterized in stencil bounds [0,w]×[0,h]. */
function ribbonSlugPath(w: number, h: number): string {
  const m = Math.min(w, h) * 0.032;
  const lx = m;
  const rx = w - m;
  const topY = h * 0.06;
  const botY = h * 0.94;
  const midY = h * 0.5;
  const cx = (lx + rx) / 2;
  const spanX = rx - lx;
  /** How far the vertical sides tuck inward at mid-height */
  const sideBulge = Math.max(spanX * 0.2, Math.min(w, h) * 0.095);
  const rCtrlX = rx - sideBulge;
  const lCtrlX = lx + sideBulge;
  /** Arc depth for crowned top / bottom rails */
  const arch = Math.min(h * 0.14, spanX * 0.09);
  const topArchY = Math.max(h * 0.012, topY - arch);
  const botArchY = Math.min(h * 0.988, botY + arch);

  return (
    `M ${_r3(lx)} ${_r3(topY)} Q ${_r3(cx)} ${_r3(topArchY)} ${_r3(rx)} ${_r3(topY)} ` +
      `Q ${_r3(rCtrlX)} ${_r3(midY)} ${_r3(rx)} ${_r3(botY)} ` +
      `Q ${_r3(cx)} ${_r3(botArchY)} ${_r3(lx)} ${_r3(botY)} ` +
      `Q ${_r3(lCtrlX)} ${_r3(midY)} ${_r3(lx)} ${_r3(topY)} Z`
  );
}

/** Optics silhouette: horizontal parallel chords; convex left rim, inward concave right —
 *  parallel Bézier approximation (fills). */
function concaveLensPath(w: number, h: number): string {
  /** Small vertical gutter only — silhouette uses most of the bbox height */
  const padY = Math.max(h * 0.022, Math.min(w, h) * 0.022);
  const ty = padY;
  const by = h - padY;
  const midY = h / 2;
  const lx = w * 0.1;
  const rx = w - lx;
  const chord = rx - lx;
  /** Matching depth on left (−x bulge) and right (bend toward −x) for even edge spacing */
  const bend = Math.min(chord * 0.36, Math.max(w, h) * 0.22);
  const lCtrlX = lx - bend;
  const rCtrlX = rx - bend;

  return (
    `M ${_r3(lx)} ${_r3(ty)} L ${_r3(rx)} ${_r3(ty)} ` +
      `Q ${_r3(rCtrlX)} ${_r3(midY)} ${_r3(rx)} ${_r3(by)} ` +
      `L ${_r3(lx)} ${_r3(by)} ` +
      `Q ${_r3(lCtrlX)} ${_r3(midY)} ${_r3(lx)} ${_r3(ty)} Z`
  );
}

/** Semicircle: vertical flat at xFlat, bulge toward +x, centered in [0,w]×[0,h].
 *  Two cubics (no 180° arc ambiguity in SVG engines). */
function halfCircleSlugPath(w: number, h: number): string {
  const r = Math.min(h / 2, w);
  const xFlat = (w - r) / 2;
  const yMid = h / 2;
  const y0 = yMid - r;
  const y1 = yMid + r;
  const xRight = xFlat + r;
  const k = 0.5522847498 * r;
  return (
    `M ${_r3(xFlat)} ${_r3(y0)} ` +
      `C ${_r3(xFlat + k)} ${_r3(y0)} ${_r3(xRight)} ${_r3(yMid - k)} ${_r3(xRight)} ${_r3(yMid)} ` +
      `C ${_r3(xRight)} ${_r3(yMid + k)} ${_r3(xFlat + k)} ${_r3(y1)} ${_r3(xFlat)} ${_r3(y1)} ` +
      `L ${_r3(xFlat)} ${_r3(y0)} Z`
  );
}

/** Fits legacy terminator art (see `pathData`) inside [0,w]×[0,h] with uniform scale
 *  (+ margin letterboxing when aspect differs). PathElement renders 1:1 at element size — no sideways squash. */
function terminatorSlugPath(w: number, h: number): string {
  const refW = 120;
  const refH = 60;
  const s = Math.min(w / refW, h / refH);
  const ox = (w - refW * s) / 2;
  const oy = (h - refH * s) / 2;
  const P = (x: number, y: number) => `${_r3(x * s + ox)} ${_r3(y * s + oy)}`;
  const r = 28 * s;
  return (
    `M ${P(30, 2)} L ${P(90, 2)} A ${_r3(r)} ${_r3(r)} 0 0 1 ${P(90, 58)} ` +
      `L ${P(30, 58)} A ${_r3(r)} ${_r3(r)} 0 0 1 ${P(30, 2)} Z`
  );
}

/** Cloud Bézier stencil (120×64 ref) — shorter profile than legacy 120×80. */
function cloudSlugPath(w: number, h: number): string {
  const refW = 120;
  const refH = 64;
  const s = Math.min(w / refW, h / refH);
  const ox = (w - refW * s) / 2;
  const oy = (h - refH * s) / 2;
  const P = (x: number, y: number) => `${_r3(x * s + ox)} ${_r3(y * s + oy)}`;
  return (
    `M ${P(30, 63)} Q ${P(4, 63)} ${P(10, 45)} Q ${P(2, 30)} ${P(26, 30)} ` +
      `Q ${P(30, 15)} ${P(54, 21)} Q ${P(74, 10.5)} ${P(86, 27)} ` +
      `Q ${P(116, 28.5)} ${P(110, 45)} Q ${P(118, 63)} ${P(90, 63)} Z`
  );
}

/** Stick figure stencil (60×100) uniformly inset — stroke-only on canvas (`fill:none`). */
function actorSlugPath(w: number, h: number): string {
  const refW = 60;
  const refH = 100;
  const s = Math.min(w / refW, h / refH);
  const ox = (w - refW * s) / 2;
  const oy = (h - refH * s) / 2;
  const P = (x: number, y: number) => `${_r3(x * s + ox)} ${_r3(y * s + oy)}`;
  const ra = 12 * s;
  return (
    `M ${P(18, 14)} A ${_r3(ra)} ${_r3(ra)} 0 1 0 ${P(42, 14)} ` +
      `A ${_r3(ra)} ${_r3(ra)} 0 1 0 ${P(18, 14)} Z ` +
      `M ${P(30, 26)} L ${P(30, 60)} ` +
      `M ${P(8, 42)} L ${P(52, 42)} ` +
      `M ${P(30, 60)} L ${P(10, 90)} ` +
      `M ${P(30, 60)} L ${P(50, 90)}`
  );
}

/** Flat registry — single stencil list (draw.io sidebar order varies; panel
 *  order stays in ShapesPanel.ENTRIES). */
export const SHAPES: ShapeStencil[] = [
  {
    id: "diamond",
    label: "Decision",
    viewBox: "0 0 100 100",
    pathData: "M 50 0 L 100 50 L 50 100 L 0 50 Z",
    width: 120,
    height: 100,
  },
  {
    id: "parallelogram",
    label: "Input / Output",
    viewBox: "0 0 100 60",
    pathData: "M 13.5 0 L 100 0 L 86.5 60 L 0 60 Z",
    width: 140,
    height: 80,
  },
  {
    id: "hexagon",
    label: "Preparation",
    viewBox: "0 0 100 60",
    pathData:
      "M 18.75 0 L 81.25 0 L 100 30 L 81.25 60 L 18.75 60 L 0 30 Z",
    width: 140,
    height: 80,
  },
  {
    id: "trapezoid",
    label: "Manual Op",
    viewBox: "0 0 100 60",
    pathData: "M 0 0 L 100 0 L 81.25 60 L 18.75 60 Z",
    width: 140,
    height: 80,
  },
  {
    id: "terminator",
    label: "Start / End",
    viewBox: "0 0 140 60",
    pathData: terminatorSlugPath(140, 60),
    width: 140,
    height: 60,
    pathGenerator: terminatorSlugPath,
  },
  {
    id: "triangle",
    label: "Merge",
    viewBox: "0 0 100 100",
    pathData: "M 50 0 L 100 100 L 0 100 Z",
    width: 100,
    height: 100,
  },
  {
    id: "document",
    label: "Document",
    viewBox: "0 0 100 80",
    pathData:
      "M 0 0 H 100 V 63.158 Q 76.042 80 50 65.263 T 0 63.158 Z",
    width: 140,
    height: 100,
  },
  {
    id: "predefined-process",
    label: "Predefined",
    viewBox: "0 0 100 60",
    pathData:
      "M 0 0 H 100 V 60 H 0 Z M 12.5 0 V 60 M 87.5 0 V 60",
    width: 140,
    height: 80,
  },
  {
    id: "cylinder",
    label: "Database",
    viewBox: "0 0 100 100",
    pathData:
      "M 0 15 A 50 12 0 0 1 100 15 L 100 85 A 50 12 0 0 1 0 85 Z",
    width: 100,
    height: 120,
    pathGenerator: cylinderBodyPath,
    detailPathGenerator: cylinderLipPath,
  },
  {
    id: "cloud",
    label: "Cloud",
    viewBox: "0 0 140 72",
    pathData: cloudSlugPath(140, 72),
    width: 140,
    height: 72,
    pathGenerator: cloudSlugPath,
  },
  {
    id: "pentagon",
    label: "Off-page",
    viewBox: "0 0 100 100",
    pathData: "M 0 0 L 100 0 L 100 70.833 L 50 100 L 0 70.833 Z",
    width: 100,
    height: 110,
  },
  {
    id: "arrow-right",
    label: "Arrow Block",
    viewBox: "0 0 120 60",
    pathData:
      "M 0 18 H 80 V 0 L 120 30 L 80 60 V 42 H 0 Z",
    width: 140,
    height: 70,
    pathGenerator(w: number, h: number): string {
      const headW = Math.min(h * (38 / 56), w * 0.6);
      const bodyRight = w - headW;
      const bodyTop    = h * (18 / 60);
      const bodyBottom = h * (42 / 60);
      const headTop    = h * ( 2 / 60);
      const headBottom = h * (58 / 60);
      return (
        `M 0 ${bodyTop} H ${bodyRight} V ${headTop} ` +
        `L ${w} ${h / 2} L ${bodyRight} ${headBottom} ` +
        `V ${bodyBottom} H 0 Z`
      );
    },
  },
  {
    id: "right-triangle",
    label: "Play",
    viewBox: "0 0 100 100",
    pathData: "M 0 0 L 100 50 L 0 100 Z",
    width: 80,
    height: 80,
  },
  {
    id: "cross",
    label: "Cross",
    viewBox: "0 0 100 100",
    pathData:
      "M 34.375 0 H 65.625 V 34.375 H 100 V 65.625 H 65.625 V 100 H 34.375 V 65.625 H 0 V 34.375 H 34.375 Z",
    width: 80,
    height: 80,
  },
  {
    id: "cube",
    label: "Cube",
    viewBox: "0 0 100 100",
    pathData:
      "M 5 32 L 70 32 L 70 88 L 5 88 Z " +
      "M 5 32 L 25 10 L 90 10 L 70 32 Z " +
      "M 70 32 L 90 10 L 90 65 L 70 88 Z",
    width: 110,
    height: 100,
  },
  {
    id: "wave",
    label: "Wave",
    viewBox: "0 0 120 104",
    pathData: waveSlugPath(120, 104),
    width: 120,
    height: 104,
    pathGenerator: waveSlugPath,
  },
  {
    id: "note",
    label: "Note",
    viewBox: "0 0 100 110",
    pathData:
      "M 0 0 L 76.042 0 L 100 23.868 L 100 110 L 0 110 Z M 76.042 0 L 76.042 23.868 L 100 23.868",
    width: 100,
    height: 110,
  },
  {
    id: "actor",
    label: "Actor",
    viewBox: "0 0 60 100",
    pathData: actorSlugPath(60, 100),
    width: 60,
    height: 100,
    pathGenerator: actorSlugPath,
  },
  {
    id: "half-circle",
    label: "Half Circle",
    viewBox: "0 0 80 100",
    pathData: halfCircleSlugPath(80, 100),
    width: 80,
    height: 100,
    pathGenerator: halfCircleSlugPath,
  },
  {
    id: "concave-lens",
    label: "Concave Lens",
    viewBox: "0 0 100 100",
    pathData: concaveLensPath(100, 100),
    width: 170,
    height: 100,
    pathGenerator: concaveLensPath,
  },
  {
    id: "ribbon",
    label: "Ribbon",
    viewBox: "0 0 168 104",
    pathData: ribbonSlugPath(168, 104),
    width: 168,
    height: 104,
    pathGenerator: ribbonSlugPath,
  },
  {
    id: "crescent",
    label: "Crescent",
    viewBox: "0 0 100 100",
    pathData:
      "M 70 5 C 35 5 10 25 10 50 C 10 75 35 95 70 95 " +
      "C 55 80 48 66 48 50 C 48 34 55 20 70 5 Z",
    width: 100,
    height: 100,
  },
  {
    id: "callout",
    label: "Callout",
    viewBox: "0 0 120 90",
    pathData: "M 2 2 H 118 V 65 H 45 L 28 85 L 40 65 H 2 Z",
    width: 140,
    height: 80,
    pathGenerator(w: number, h: number): string {
      const boxH = h * (65 / 90);
      const tailTipX = w * (28 / 120);
      const tailTipY = h;
      const tailL = w * (40 / 120);
      const tailR = w * (50 / 120);
      return (
        `M 0 0 H ${w} V ${boxH} H ${tailR} ` +
        `L ${tailTipX} ${tailTipY} L ${tailL} ${boxH} H 0 Z`
      );
    },
  },
  {
    id: "callout-round",
    label: "Callout Round",
    viewBox: "0 0 120 90",
    pathData:
      "M 10 2 H 110 Q 118 2 118 10 V 55 Q 118 65 110 65 H 45 L 28 85 L 40 65 H 10 Q 2 65 2 55 V 10 Q 2 2 10 2 Z",
    width: 140,
    height: 80,
    pathGenerator(w: number, h: number): string {
      const r = Math.min(10, h * 0.12, w * 0.08);
      const boxH = h * (65 / 90);
      const tailTipX = w * (28 / 120);
      const tailTipY = h;
      const tailL = w * (40 / 120);
      const tailR = w * (50 / 120);
      return (
        `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} ` +
        `V ${boxH - r} Q ${w} ${boxH} ${w - r} ${boxH} ` +
        `H ${tailR} L ${tailTipX} ${tailTipY} L ${tailL} ${boxH} ` +
        `H ${r} Q 0 ${boxH} 0 ${boxH - r} V ${r} Q 0 0 ${r} 0 Z`
      );
    },
  },
  {
    id: "callout-oval",
    label: "Callout Oval",
    viewBox: "0 0 120 100",
    pathData:
      "M 60 2 A 58 38 0 1 1 60 78 L 25 98 L 50 72 A 58 38 0 0 1 60 2 Z",
    width: 130,
    height: 90,
  },
];

export const SHAPES_BY_ID: Record<string, ShapeStencil> = Object.fromEntries(
  SHAPES.map((s) => [s.id, s])
);
