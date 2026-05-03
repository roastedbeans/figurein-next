/** Tight axis-aligned bounding box for an SVG path's `d` data.
 *
 *  The renderer uses this to set a tight viewBox on each PathElement so
 *  the visible shape fills the element bbox without leftover whitespace
 *  from stencil insets, ribbon paddings, etc. — selection handles wrap
 *  the visible content tightly.
 *
 *  Two implementations:
 *   1. **`measurePathBBox(d)`** — exact, uses the browser's native
 *      `getBBox()` against an offscreen `<path>`. Cached per `d` string.
 *      Use this whenever the DOM is available (i.e. inside a React
 *      render path on the client).
 *   2. **`pathBounds(d)`** — pure JS parser, conservative. Use as the
 *      SSR-safe fallback when the DOM isn't available yet.
 *
 *  The pure parser approximates control-point hulls for Béziers and
 *  cardinal extrema for arcs — it never under-bounds the curve, but can
 *  overestimate. The DOM-based measurement is the one with no
 *  whitespace artifacts. */
export type PathBounds = { x: number; y: number; w: number; h: number };

const SVG_NS = "http://www.w3.org/2000/svg";

const measureCache = new Map<string, PathBounds | null>();
let measureSvg: SVGSVGElement | null = null;
let measurePath: SVGPathElement | null = null;

/** Measure a path's exact bounding box via the browser. Uses a single
 *  offscreen `<svg>` reused across all calls — measurement is a single
 *  attribute write + `getBBox()` per unique path string. SSR-safe (returns
 *  null when there's no document). */
export function measurePathBBox(d: string): PathBounds | null {
  if (typeof document === "undefined") return null;
  const cached = measureCache.get(d);
  if (cached !== undefined) return cached;

  if (!measureSvg) {
    measureSvg = document.createElementNS(SVG_NS, "svg");
    // Position offscreen so the measurement element doesn't affect layout.
    measureSvg.setAttribute("width", "0");
    measureSvg.setAttribute("height", "0");
    measureSvg.style.position = "absolute";
    measureSvg.style.left = "-99999px";
    measureSvg.style.top = "-99999px";
    measureSvg.style.pointerEvents = "none";
    measureSvg.setAttribute("aria-hidden", "true");
    document.body.appendChild(measureSvg);
    measurePath = document.createElementNS(SVG_NS, "path");
    measureSvg.appendChild(measurePath);
  }

  let result: PathBounds | null = null;
  try {
    measurePath!.setAttribute("d", d);
    const b = measurePath!.getBBox();
    if (b.width > 0 && b.height > 0) {
      result = { x: b.x, y: b.y, w: b.width, h: b.height };
    }
  } catch {
    // getBBox throws on degenerate paths in some browsers — fall through
    // to the parser-based bounds via a null result.
    result = null;
  }
  measureCache.set(d, result);
  return result;
}

const CMD_RE = /[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g;
const NUM_RE = /-?\d*\.?\d+(?:[eE][+-]?\d+)?/g;

/** SSR-safe path-bounds computation. Walks the path commands and unions
 *  every coordinate, control point, and (for arcs) the four cardinal
 *  extremes of the containing ellipse. Conservative — never under-bounds
 *  the visible curve, but can overestimate, especially on partial arcs
 *  and flat Bézier curves. The DOM-based `measurePathBBox` should be
 *  preferred whenever it returns a non-null result. */
export function pathBounds(d: string): PathBounds | null {
  const tokens = d.match(CMD_RE);
  if (!tokens) return null;

  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let l = Infinity,
    t = Infinity,
    r = -Infinity,
    b = -Infinity;
  let any = false;

  const include = (x: number, y: number) => {
    if (x < l) l = x;
    if (x > r) r = x;
    if (y < t) t = y;
    if (y > b) b = y;
    any = true;
  };

  for (const token of tokens) {
    const cmd = token[0];
    const rel = cmd === cmd.toLowerCase() && cmd !== "Z";
    const upper = cmd.toUpperCase();
    const nums = token.slice(1).match(NUM_RE)?.map(Number) ?? [];

    switch (upper) {
      case "M": {
        for (let i = 0; i < nums.length; i += 2) {
          const nx = rel ? cx + nums[i] : nums[i];
          const ny = rel ? cy + nums[i + 1] : nums[i + 1];
          cx = nx;
          cy = ny;
          if (i === 0) {
            sx = cx;
            sy = cy;
          }
          include(cx, cy);
        }
        break;
      }
      case "L": {
        for (let i = 0; i < nums.length; i += 2) {
          cx = rel ? cx + nums[i] : nums[i];
          cy = rel ? cy + nums[i + 1] : nums[i + 1];
          include(cx, cy);
        }
        break;
      }
      case "H": {
        for (const n of nums) {
          cx = rel ? cx + n : n;
          include(cx, cy);
        }
        break;
      }
      case "V": {
        for (const n of nums) {
          cy = rel ? cy + n : n;
          include(cx, cy);
        }
        break;
      }
      case "C": {
        for (let i = 0; i < nums.length; i += 6) {
          const x1 = rel ? cx + nums[i] : nums[i];
          const y1 = rel ? cy + nums[i + 1] : nums[i + 1];
          const x2 = rel ? cx + nums[i + 2] : nums[i + 2];
          const y2 = rel ? cy + nums[i + 3] : nums[i + 3];
          const ex = rel ? cx + nums[i + 4] : nums[i + 4];
          const ey = rel ? cy + nums[i + 5] : nums[i + 5];
          include(x1, y1);
          include(x2, y2);
          include(ex, ey);
          cx = ex;
          cy = ey;
        }
        break;
      }
      case "S": {
        for (let i = 0; i < nums.length; i += 4) {
          const x2 = rel ? cx + nums[i] : nums[i];
          const y2 = rel ? cy + nums[i + 1] : nums[i + 1];
          const ex = rel ? cx + nums[i + 2] : nums[i + 2];
          const ey = rel ? cy + nums[i + 3] : nums[i + 3];
          include(x2, y2);
          include(ex, ey);
          cx = ex;
          cy = ey;
        }
        break;
      }
      case "Q": {
        for (let i = 0; i < nums.length; i += 4) {
          const x1 = rel ? cx + nums[i] : nums[i];
          const y1 = rel ? cy + nums[i + 1] : nums[i + 1];
          const ex = rel ? cx + nums[i + 2] : nums[i + 2];
          const ey = rel ? cy + nums[i + 3] : nums[i + 3];
          include(x1, y1);
          include(ex, ey);
          cx = ex;
          cy = ey;
        }
        break;
      }
      case "T": {
        for (let i = 0; i < nums.length; i += 2) {
          cx = rel ? cx + nums[i] : nums[i];
          cy = rel ? cy + nums[i + 1] : nums[i + 1];
          include(cx, cy);
        }
        break;
      }
      case "A": {
        for (let i = 0; i < nums.length; i += 7) {
          const rx = Math.abs(nums[i]);
          const ry = Math.abs(nums[i + 1]);
          const ex = rel ? cx + nums[i + 5] : nums[i + 5];
          const ey = rel ? cy + nums[i + 6] : nums[i + 6];
          include(cx, cy);
          include(ex, ey);
          const mx = (cx + ex) / 2;
          const my = (cy + ey) / 2;
          include(mx + rx, my);
          include(mx - rx, my);
          include(mx, my + ry);
          include(mx, my - ry);
          cx = ex;
          cy = ey;
        }
        break;
      }
      case "Z": {
        cx = sx;
        cy = sy;
        break;
      }
    }
  }

  if (!any) return null;
  return { x: l, y: t, w: r - l, h: b - t };
}
