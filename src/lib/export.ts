import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./constants";
import { useEditorStore } from "@/stores/editor-store";
import { getIconUrl, getIconFormat } from "@/components/icons";
import { resolveConnectorWithMap } from "./connector-geometry";
import type {
  ArrowElement,
  EditorElement,
  TextElement,
} from "@/types/editor";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Export framing mode.
 *  - "figure": tight crop around all drawn elements, with a configurable margin.
 *  - "selection": tight crop around the currently selected elements (falls back to all).
 */
export type ExportFit = "figure" | "selection";

/** Background behind the exported content. Transparent SVGs read cleanly on
 *  dark backgrounds; transparent PNGs render as checker in most viewers, so
 *  "white" is the safer default there. */
export type ExportBackground = "white" | "transparent";

const PNG_SCALE = 2;

/** True when the element draws nothing the user can see — used to keep the
 *  tight-figure bbox from being inflated by structural-only nodes. The
 *  prototypical case is an AI-emitted "section" frame: a near-canvas-sized
 *  group container with `fill: "none"` and `stroke: "none"`. It's invisible,
 *  but its width/height would otherwise force the export bbox out to the
 *  whole canvas. Children of the frame still contribute through their own
 *  branches in elementsBbox, so skipping the wrapper here loses no visible
 *  geometry — only the empty space it claimed. */
function isInvisibleContainer(el: EditorElement): boolean {
  if (el.type !== "frame") return false;
  const hasFill = el.fill && el.fill !== "none";
  const hasStroke =
    el.stroke && el.stroke !== "none" && (el.strokeWidth ?? 0) > 0;
  return !hasFill && !hasStroke;
}

function elementsBbox(
  elements: EditorElement[]
): { x: number; y: number; w: number; h: number } | null {
  if (elements.length === 0) return null;
  // Built lazily — only created when the loop hits a connector that needs to
  // resolve a binding. Using `resolveConnectorWithMap` here means the export
  // bbox follows where the arrow actually RENDERS, including binding-driven
  // attach points that may differ from the stored (x, y, x2, y2) when the
  // bound target has been resized since the arrow was last edited.
  let byId: Map<string, EditorElement> | null = null;
  const idMap = () => {
    if (byId) return byId;
    byId = new Map();
    for (const e of elements) byId.set(e.id, e);
    return byId;
  };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let counted = 0;
  for (const el of elements) {
    if (isInvisibleContainer(el)) continue;
    counted++;
    const half = (el.strokeWidth ?? 0) / 2;
    if (el.type === "arrow") {
      const r = resolveConnectorWithMap(
        el as ArrowElement,
        idMap()
      );
      // Arrowheads extend beyond the line's stroke envelope: the triangle's
      // base fans out perpendicular to the line direction by up to
      // ~headSize * sin(halfAngle). Pad both endpoints by headSize on every
      // axis when a head/tail is drawn — overcounts a bit at angles other
      // than 0/90° but keeps the head from being clipped at any orientation.
      const hasHead = r.headStyle && r.headStyle !== "none";
      const hasTail = r.tailStyle && r.tailStyle !== "none";
      const headSize = Math.max(half * 8, 8); // matches ArrowElement's headSize
      const tailPad = hasTail ? Math.max(half, headSize) : half;
      const headPad = hasHead ? Math.max(half, headSize) : half;
      minX = Math.min(minX, r.x - tailPad, r.x2 - headPad);
      maxX = Math.max(maxX, r.x + tailPad, r.x2 + headPad);
      minY = Math.min(minY, r.y - tailPad, r.y2 - headPad);
      maxY = Math.max(maxY, r.y + tailPad, r.y2 + headPad);
      if (r.elbowCorners) {
        for (const [cx, cy] of r.elbowCorners) {
          minX = Math.min(minX, cx - half);
          maxX = Math.max(maxX, cx + half);
          minY = Math.min(minY, cy - half);
          maxY = Math.max(maxY, cy + half);
        }
      }
    } else {
      minX = Math.min(minX, el.x - half);
      minY = Math.min(minY, el.y - half);
      maxX = Math.max(maxX, el.x + el.width + half);
      maxY = Math.max(maxY, el.y + el.height + half);
    }
  }
  if (counted === 0) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Clone the live canvas SVG and prepare it for serialization. Strips the
 *  pan/zoom transform and every `[data-no-export]` element (grid, backdrop,
 *  selection overlays, sheet shadow). Sets viewBox + width/height to either
 *  the full canvas (expanded to include any element that spills past the
 *  sheet) or the element bbox with padding. */
function getCleanedSvg(
  fit: ExportFit,
  margin: number = 16
): { svg: SVGSVGElement; width: number; height: number } | null {
  const svg = document.getElementById(
    "figurin-canvas"
  ) as SVGSVGElement | null;
  if (!svg) return null;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-no-export]").forEach((el) => el.remove());

  // Drop the viewport transform — elements are already in canvas coords.
  // Pan/zoom is applied imperatively via `style.transform` on the live <g>
  // (Canvas.tsx writes it directly for GPU layer promotion). cloneNode copies
  // the inline style attribute, so removing the SVG `transform` attribute
  // alone leaves the CSS transform behind and the rasterized export is
  // shifted/scaled by whatever pan/zoom the user happened to have at export
  // time. Strip both the attribute and the inline style.
  const viewportG = clone.querySelector("g");
  if (viewportG) {
    viewportG.removeAttribute("transform");
    viewportG.removeAttribute("style");
  }

  const state = useEditorStore.getState();
  const allElements = state.elements;

  let bboxElements: typeof allElements;
  if (fit === "selection") {
    const selIds = new Set(state.selectedElementIds);
    bboxElements = allElements.filter((el) => selIds.has(el.id));
    if (bboxElements.length === 0) bboxElements = allElements; // fallback to all

    // Remove every top-level element node whose element (or ancestor group)
    // is not part of the selection. A tight viewBox alone isn't enough —
    // elements that happen to overlap the cropped area but were not selected
    // would still render inside that viewBox.
    if (selIds.size > 0 && viewportG) {
      const keepIds = new Set(selIds);
      const elementMap = new Map(allElements.map((el) => [el.id, el]));
      // Walk up the parent chain so that selected children of a group also
      // implicitly keep their ancestor group wrapper in the DOM.
      for (const id of selIds) {
        let parentId = elementMap.get(id)?.parentId ?? null;
        while (parentId) {
          keepIds.add(parentId);
          parentId = elementMap.get(parentId)?.parentId ?? null;
        }
      }
      for (const child of Array.from(viewportG.children)) {
        const wrapId = child.getAttribute("data-drag-wrapper");
        if (wrapId && !keepIds.has(wrapId)) {
          child.remove();
        }
      }
    }
  } else {
    bboxElements = allElements;
  }

  const bbox = elementsBbox(bboxElements);

  let vx = 0;
  let vy = 0;
  let vw = CANVAS_WIDTH;
  let vh = CANVAS_HEIGHT;

  if (bbox && bbox.w > 0 && bbox.h > 0) {
    vx = Math.floor(bbox.x - margin);
    vy = Math.floor(bbox.y - margin);
    vw = Math.ceil(bbox.w + margin * 2);
    vh = Math.ceil(bbox.h + margin * 2);
  }

  clone.setAttribute("viewBox", `${vx} ${vy} ${vw} ${vh}`);
  clone.setAttribute("width", String(vw));
  clone.setAttribute("height", String(vh));
  // xmlns is required for standalone SVG files; cloning from the live DOM
  // sometimes omits it depending on the browser.
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", SVG_NS);
  }

  return { svg: clone, width: vw, height: vh };
}

// Icon source SVGs are fetched once per session. The cache stores the in-flight
// Promise so concurrent exports don't double-fetch the same asset.
const iconSvgCache = new Map<string, Promise<string>>();

function loadIconSvgText(iconId: string): Promise<string> {
  const cached = iconSvgCache.get(iconId);
  if (cached) return cached;
  const p = fetch(getIconUrl(iconId)).then((r) => {
    if (!r.ok) throw new Error(`Failed to load icon ${iconId}`);
    return r.text();
  });
  iconSvgCache.set(iconId, p);
  return p;
}

// Raster icon bytes cached as base64 data URLs. Embedding the pixels inline
// keeps the exported SVG self-contained and avoids a cross-origin taint on
// PNG rasterization (Supabase's CDN doesn't match the app origin).
const iconDataUrlCache = new Map<string, Promise<string>>();

function loadIconDataUrl(iconId: string, mime: string): Promise<string> {
  const cached = iconDataUrlCache.get(iconId);
  if (cached) return cached;
  const p = fetch(getIconUrl(iconId))
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load icon ${iconId}`);
      return r.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(
            mime && blob.type === "" ? new Blob([blob], { type: mime }) : blob
          );
        })
    );
  iconDataUrlCache.set(iconId, p);
  return p;
}

/** Replaces every `[data-icon-id]` group's `<foreignObject>` (which uses a CSS
 *  mask-image URL — breaks standalone SVG files and taints the PNG canvas) with
 *  an inline `<svg>` containing the icon's paths, color baked in. */
async function inlineIcons(svg: SVGSVGElement): Promise<void> {
  const groups = Array.from(
    svg.querySelectorAll<SVGGElement>("[data-icon-id]")
  );
  if (groups.length === 0) return;

  const parser = new DOMParser();
  await Promise.all(
    groups.map(async (g) => {
      const iconId = g.getAttribute("data-icon-id");
      if (!iconId) return;
      const format = g.getAttribute("data-icon-format") ?? getIconFormat(iconId);
      const color = g.getAttribute("data-icon-color") ?? "#000";
      const size = Number(g.getAttribute("data-icon-size") ?? "0");
      const x = Number(g.getAttribute("data-icon-x") ?? "0");
      const y = Number(g.getAttribute("data-icon-y") ?? "0");
      const opacity = g.getAttribute("data-icon-opacity") ?? "1";

      let replacement: SVGElement;
      if (format === "png" || format === "jpg") {
        // Raster path: swap the live `<image href>` (cross-origin URL) for
        // an inline data URL so the PNG canvas rasterizes without tainting.
        let dataUrl: string;
        try {
          dataUrl = await loadIconDataUrl(
            iconId,
            format === "png" ? "image/png" : "image/jpeg"
          );
        } catch {
          return;
        }
        const image = document.createElementNS(SVG_NS, "image");
        image.setAttribute("x", String(x));
        image.setAttribute("y", String(y));
        image.setAttribute("width", String(size));
        image.setAttribute("height", String(size));
        image.setAttribute("preserveAspectRatio", "xMidYMid meet");
        image.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "href",
          dataUrl
        );
        image.setAttribute("href", dataUrl);
        if (opacity !== "1") image.setAttribute("opacity", opacity);
        replacement = image;
      } else {
        // SVG path: fetch the source, rewrite as inline <svg> with the
        // element's color baked in.
        let text: string;
        try {
          text = await loadIconSvgText(iconId);
        } catch {
          return;
        }
        const doc = parser.parseFromString(text, "image/svg+xml");
        const sourceSvg = doc.documentElement;
        const viewBox = sourceSvg.getAttribute("viewBox") ?? "0 0 32 32";

        const wrapper = document.createElementNS(SVG_NS, "svg");
        wrapper.setAttribute("x", String(x));
        wrapper.setAttribute("y", String(y));
        wrapper.setAttribute("width", String(size));
        wrapper.setAttribute("height", String(size));
        wrapper.setAttribute("viewBox", viewBox);
        // Source paths use `fill="currentColor"` (on the root). Setting both
        // `fill` and `color` covers SVG fill inheritance and CSS currentColor.
        wrapper.setAttribute("fill", color);
        wrapper.setAttribute("color", color);
        if (opacity !== "1") wrapper.setAttribute("opacity", opacity);
        for (const child of Array.from(sourceSvg.childNodes)) {
          wrapper.appendChild(svg.ownerDocument.importNode(child, true));
        }
        replacement = wrapper;
      }

      // Strip the live preview (foreignObject for SVG icons, <image> for
      // raster) and splice in our export-safe equivalent. Using
      // getElementsByTagNameNS avoids CSS selector case quirks on
      // `foreignObject`, and also catches the live `<image>` uniformly.
      const fos = Array.from(g.getElementsByTagNameNS(SVG_NS, "foreignObject"));
      const imgs = Array.from(g.getElementsByTagNameNS(SVG_NS, "image"));
      const preview = fos[0] ?? imgs[0];
      if (preview) {
        preview.replaceWith(replacement);
        for (let i = 1; i < fos.length; i++) fos[i].remove();
        for (const img of imgs) if (img !== preview) img.remove();
      } else {
        g.appendChild(replacement);
      }
    })
  );
}

const XLINK_NS = "http://www.w3.org/1999/xlink";

const httpImageDataUrlCache = new Map<string, Promise<string>>();

function loadHttpHrefAsDataUrl(url: string): Promise<string> {
  const cached = httpImageDataUrlCache.get(url);
  if (cached) return cached;
  const p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed image ${url}`);
      return r.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        })
    );
  httpImageDataUrlCache.set(url, p);
  return p;
}

async function inlineUploadedImages(svg: SVGSVGElement): Promise<void> {
  const groups = Array.from(
    svg.querySelectorAll<SVGGElement>("[data-upload-image-id]")
  );
  if (groups.length === 0) return;

  await Promise.all(
    groups.map(async (g) => {
      const imgs = Array.from(g.getElementsByTagNameNS(SVG_NS, "image"));
      const preview = imgs[0];
      if (!preview) return;
      const href =
        preview.getAttribute("href") ||
        preview.getAttributeNS(XLINK_NS, "href") ||
        "";
      if (!href) return;

      const opacity =
        preview.getAttribute("opacity") ??
        g.getAttribute("data-upload-image-opacity") ??
        "1";

      let dataUrl: string;
      try {
        dataUrl = await loadHttpHrefAsDataUrl(href);
      } catch {
        return;
      }

      const image = document.createElementNS(SVG_NS, "image");
      image.setAttribute("x", preview.getAttribute("x") ?? "0");
      image.setAttribute("y", preview.getAttribute("y") ?? "0");
      image.setAttribute("width", preview.getAttribute("width") ?? "0");
      image.setAttribute("height", preview.getAttribute("height") ?? "0");
      image.setAttribute("preserveAspectRatio", "xMidYMid meet");
      image.setAttributeNS(XLINK_NS, "href", dataUrl);
      image.setAttribute("href", dataUrl);
      if (opacity !== "1") image.setAttribute("opacity", opacity);

      preview.replaceWith(image);
      for (let i = 1; i < imgs.length; i++) imgs[i].remove();
    })
  );
}

/** A run of text that shares a single style. The text-format toolbar emits
 *  inline tags + style attributes via `document.execCommand` — the parser
 *  below normalizes them into this shape so the exporter can map each run
 *  onto an SVG `<tspan>` with matching attributes. */
type StyledSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  lineThrough?: boolean;
  color?: string;
  /** Rendered width of this segment in canvas (= SVG user) units, measured
   *  from the live DOM via `Range.getBoundingClientRect`. When set, the
   *  exporter emits `textLength` + `lengthAdjust="spacingAndGlyphs"` on the
   *  tspan, forcing the SVG renderer to lay this run out at exactly this
   *  width. That eliminates the entire class of "looks fine in CSS, overflows
   *  in SVG export" bugs caused by the SVG renderer measuring fonts even a
   *  few percent differently than the HTML/CSS renderer. */
  canvasWidth?: number;
};
type LineBreak = { br: true };
type ParsedNode = StyledSegment | LineBreak;

/** Pull a CSS property value out of an inline `style="..."` string without
 *  paying for a real CSSOM round-trip. Case-insensitive on the property
 *  name, returns the first match (CSSOM cascade rules don't apply inside a
 *  single declaration string anyway). */
function readStyleProp(decl: string, prop: string): string | null {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i");
  const m = decl.match(re);
  return m ? m[1].trim() : null;
}

function walkStyledNode(
  node: Node,
  inherited: Omit<StyledSegment, "text">,
  out: ParsedNode[]
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text) out.push({ ...inherited, text });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") {
    out.push({ br: true });
    return;
  }

  // Block-level wrappers are line-terminating by definition; the editor's
  // execCommand sometimes wraps a return-key insertion in `<div>` instead of
  // `<br>`. Recurse first, append a break afterward — same behavior as the
  // old `extractTextLines` regex pass.
  if (tag === "div" || tag === "p") {
    for (const child of Array.from(el.childNodes)) {
      walkStyledNode(child, inherited, out);
    }
    out.push({ br: true });
    return;
  }

  // Carry the parent's style downward, then layer this element's contribution
  // on top. We DO NOT support unsetting (e.g., a child with font-weight:normal
  // inside a parent <b>) — execCommand never produces that combination, and
  // implementing it would require parsing CSS specificity for an edge case
  // that doesn't exist in our editor's output.
  const style: Omit<StyledSegment, "text"> = { ...inherited };
  if (tag === "b" || tag === "strong") style.bold = true;
  else if (tag === "i" || tag === "em") style.italic = true;
  else if (tag === "u") style.underline = true;
  else if (tag === "s" || tag === "strike" || tag === "del")
    style.lineThrough = true;
  else if (tag === "font") {
    const c = el.getAttribute("color");
    if (c) style.color = c;
  }

  // execCommand with `styleWithCSS=true` (set by TextElement on edit-mode
  // entry) emits inline `style="..."` instead of legacy tags. Parse the
  // properties we render so toolbar-applied formatting comes through.
  const inlineStyle = el.getAttribute("style");
  if (inlineStyle) {
    const fw = readStyleProp(inlineStyle, "font-weight");
    if (fw && (fw === "bold" || Number(fw) >= 600)) style.bold = true;
    const fs = readStyleProp(inlineStyle, "font-style");
    if (fs === "italic" || fs === "oblique") style.italic = true;
    const td = readStyleProp(inlineStyle, "text-decoration");
    if (td) {
      if (td.includes("underline")) style.underline = true;
      if (td.includes("line-through")) style.lineThrough = true;
    }
    const c = readStyleProp(inlineStyle, "color");
    if (c) style.color = c;
  }

  for (const child of Array.from(el.childNodes)) {
    walkStyledNode(child, style, out);
  }
}

/** Parse contentEditable HTML into a flat sequence of styled runs separated
 *  by line breaks. Replaces the old `extractTextLines` (which dropped all
 *  formatting on the floor); the exporter now has enough information to
 *  emit `<tspan font-weight="bold">` etc. instead of plain `<text>`.
 *
 *  Trailing line breaks are trimmed so a `<div>foo</div>` doesn't produce
 *  a phantom empty line after "foo" — same trim semantics the previous
 *  `extractTextLines` had. */
function parseStyledSegments(html: string): ParsedNode[] {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const out: ParsedNode[] = [];
  walkStyledNode(tmp, {}, out);
  while (out.length > 0 && (out[out.length - 1] as LineBreak).br) out.pop();
  return out;
}

function styleEquals(
  a: Omit<StyledSegment, "text">,
  b: Omit<StyledSegment, "text">
): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.lineThrough === !!b.lineThrough &&
    (a.color ?? null) === (b.color ?? null)
  );
}

// Shared canvas + 2D context used purely to call `measureText` for word-wrap.
// One per session is plenty — `font` is reset per measurement.
let wrapMeasureCanvas: HTMLCanvasElement | null = null;
let wrapMeasureCtx: CanvasRenderingContext2D | null = null;
function getWrapMeasureCtx(): CanvasRenderingContext2D | null {
  if (wrapMeasureCtx) return wrapMeasureCtx;
  if (!wrapMeasureCanvas) wrapMeasureCanvas = document.createElement("canvas");
  wrapMeasureCtx = wrapMeasureCanvas.getContext("2d");
  return wrapMeasureCtx;
}

/** Greedy word-wrap for a sequence of styled segments. Mirrors CSS
 *  `word-wrap: break-word`: prefers space boundaries; falls back to
 *  character-level breaks for tokens that don't fit. Each input segment
 *  carries its own style; the wrapper measures using a per-segment font
 *  (bold / italic widen most fonts measurably, so a plain measureText with
 *  the BASE font would underwrap bold-heavy content). The output preserves
 *  styling in the resulting line splits — a styled run that crosses a wrap
 *  point becomes two runs of the same style on consecutive lines. */
function buildStyledLines(
  segments: ParsedNode[],
  baseFontWeight: string,
  baseFontStyle: string,
  baseFontSize: number,
  baseFontFamily: string,
  maxWidth: number
): StyledSegment[][] {
  const ctx = getWrapMeasureCtx();
  // No measurement context (server-side render edge case) — fall back to
  // emitting one line per explicit break with no width-driven wrapping.
  if (!ctx || maxWidth <= 0) {
    const lines: StyledSegment[][] = [[]];
    for (const seg of segments) {
      if ("br" in seg) lines.push([]);
      else if (seg.text) lines[lines.length - 1].push(seg);
    }
    return lines;
  }

  const fontFor = (style: Omit<StyledSegment, "text">) => {
    const weight = style.bold ? "bold" : baseFontWeight;
    const fStyle = style.italic ? "italic" : baseFontStyle;
    return `${fStyle} ${weight} ${baseFontSize}px ${baseFontFamily}`;
  };

  const lines: StyledSegment[][] = [[]];
  let currentWidth = 0;

  const pushToken = (token: string, style: Omit<StyledSegment, "text">) => {
    const line = lines[lines.length - 1];
    const last = line[line.length - 1];
    if (last && styleEquals(last, style)) {
      last.text += token;
    } else {
      line.push({ ...style, text: token });
    }
  };

  for (const seg of segments) {
    if ("br" in seg) {
      lines.push([]);
      currentWidth = 0;
      continue;
    }
    if (!seg.text) continue;

    ctx.font = fontFor(seg);
    // `\s+|\S+` keeps whitespace tokens distinct so pre-wrap content doesn't
    // collapse runs of spaces, and so wrap can drop a leading whitespace
    // token at the start of a new line (matching CSS).
    const tokens = seg.text.match(/\s+|\S+/g) ?? [seg.text];
    for (const token of tokens) {
      const w = ctx.measureText(token).width;
      const wouldOverflow = currentWidth > 0 && currentWidth + w > maxWidth;
      if (wouldOverflow) {
        lines.push([]);
        currentWidth = 0;
        if (/^\s/.test(token)) continue;
      }
      // Token fits in maxWidth on its own → place as-is.
      if (w <= maxWidth || currentWidth === 0 && w <= maxWidth) {
        pushToken(token, seg);
        currentWidth += w;
        continue;
      }
      // Token doesn't fit even on a fresh line — char-by-char break
      // (overflow-wrap: break-word).
      let chunk = "";
      let chunkWidth = 0;
      for (const ch of token) {
        const cw = ctx.measureText(ch).width;
        if (chunk && currentWidth + chunkWidth + cw > maxWidth) {
          pushToken(chunk, seg);
          lines.push([]);
          currentWidth = 0;
          chunk = ch;
          chunkWidth = cw;
        } else {
          chunk += ch;
          chunkWidth += cw;
        }
      }
      if (chunk) {
        pushToken(chunk, seg);
        currentWidth += chunkWidth;
      }
    }
  }
  return lines;
}

/** Walk a single text node's characters and record every char index where
 *  the rendered y-position changes — those indices ARE the visual line
 *  breaks the browser computed for this node. Reads `getBoundingClientRect`
 *  per character; trades a series of layout flushes for a guarantee that
 *  the export's wrap matches the editor's wrap exactly. The alternative —
 *  re-implementing wrap with `canvas.measureText` — produced subtly
 *  different break points (font hinting, kerning, fallback metrics) and
 *  shipped overflow as the user-visible bug.
 *
 *  Returns char indices RELATIVE to `node.textContent`, each pointing at
 *  the first character of a NEW visual line (i.e. the break-after-prev). */
function findLineBreaksInTextNode(node: Text): number[] {
  const text = node.textContent ?? "";
  if (text.length === 0) return [];
  const range = document.createRange();
  // Quick-out: a single getClientRects() returns one rect per visual line.
  // No multi-line breaks to find when the count is ≤ 1.
  range.selectNodeContents(node);
  if (range.getClientRects().length <= 1) return [];
  const breaks: number[] = [];
  let lastTop: number | null = null;
  for (let i = 0; i < text.length; i++) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const rect = range.getBoundingClientRect();
    // Whitespace at a line boundary collapses to a zero-rect — ignore those
    // so a trailing space at end-of-line doesn't masquerade as a break.
    if (rect.width === 0 && rect.height === 0) continue;
    const top = Math.round(rect.top);
    if (lastTop !== null && top !== lastTop) breaks.push(i);
    lastTop = top;
  }
  return breaks;
}

/** Measure the rendered width (in canvas/SVG-user units) of a substring of
 *  a text node by selecting it in a Range and dividing the screen width by
 *  the zoom factor. Used to stamp `canvasWidth` onto each emitted segment
 *  so the exporter can force the SVG renderer to lay out at exactly the
 *  CSS-measured width via `textLength`. */
function measureRangeCanvasWidth(
  node: Text,
  start: number,
  end: number,
  zoom: number
): number {
  if (start >= end || zoom <= 0) return 0;
  const r = document.createRange();
  r.setStart(node, start);
  r.setEnd(node, end);
  return r.getBoundingClientRect().width / zoom;
}

function pushSegment(
  line: StyledSegment[],
  inherited: Omit<StyledSegment, "text">,
  text: string,
  canvasWidth: number
): void {
  // Adjacent same-style runs merge into one tspan; same-style canvasWidths
  // are additive (each piece was measured against the same font, so summing
  // is exact for a contiguous range that didn't itself wrap).
  const lastSeg = line[line.length - 1];
  if (lastSeg && styleEquals(lastSeg, inherited)) {
    lastSeg.text += text;
    lastSeg.canvasWidth = (lastSeg.canvasWidth ?? 0) + canvasWidth;
  } else {
    line.push({ ...inherited, text, canvasWidth });
  }
}

/** Recursive walker that emits styled segments split by both author breaks
 *  (<br>, </div>) and CSS-driven visual wrap breaks (read from the live
 *  rendered DOM via `findLineBreaksInTextNode`). Each emitted segment
 *  carries the exact canvas-unit width its CSS rendering occupies, so the
 *  exporter can later hold the SVG renderer to that width via `textLength`. */
function walkLiveStyledLines(
  node: Node,
  inherited: Omit<StyledSegment, "text">,
  lines: StyledSegment[][],
  zoom: number
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const tnode = node as Text;
    const text = tnode.textContent ?? "";
    if (!text) return;
    const breaks = findLineBreaksInTextNode(tnode);
    let cursor = 0;
    for (const b of breaks) {
      if (b > cursor) {
        const segText = text.substring(cursor, b);
        const segWidth = measureRangeCanvasWidth(tnode, cursor, b, zoom);
        pushSegment(lines[lines.length - 1], inherited, segText, segWidth);
      }
      lines.push([]);
      cursor = b;
    }
    if (cursor < text.length) {
      const tail = text.substring(cursor);
      const tailWidth = measureRangeCanvasWidth(
        tnode,
        cursor,
        text.length,
        zoom
      );
      pushSegment(lines[lines.length - 1], inherited, tail, tailWidth);
    }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") {
    lines.push([]);
    return;
  }

  const blockTag = tag === "div" || tag === "p";

  // Style merging is additive — same convention as the HTML-only parser
  // above so toolbar/legacy formatting converges on the same StyledSegment
  // shape regardless of which path produced it.
  const style: Omit<StyledSegment, "text"> = { ...inherited };
  if (tag === "b" || tag === "strong") style.bold = true;
  else if (tag === "i" || tag === "em") style.italic = true;
  else if (tag === "u") style.underline = true;
  else if (tag === "s" || tag === "strike" || tag === "del")
    style.lineThrough = true;
  else if (tag === "font") {
    const c = el.getAttribute("color");
    if (c) style.color = c;
  }
  const inlineStyle = el.getAttribute("style");
  if (inlineStyle) {
    const fw = readStyleProp(inlineStyle, "font-weight");
    if (fw && (fw === "bold" || Number(fw) >= 600)) style.bold = true;
    const fs = readStyleProp(inlineStyle, "font-style");
    if (fs === "italic" || fs === "oblique") style.italic = true;
    const td = readStyleProp(inlineStyle, "text-decoration");
    if (td) {
      if (td.includes("underline")) style.underline = true;
      if (td.includes("line-through")) style.lineThrough = true;
    }
    const c = readStyleProp(inlineStyle, "color");
    if (c) style.color = c;
  }

  for (const child of Array.from(el.childNodes)) {
    walkLiveStyledLines(child, style, lines, zoom);
  }

  // Block-level wrappers terminate the current line, but only if non-empty
  // (otherwise nested empty divs would multiply blank rows).
  if (blockTag && lines[lines.length - 1].length > 0) {
    lines.push([]);
  }
}

/** Read styled+wrapped lines straight from the editor's live DOM so the
 *  export reuses the browser's actual wrap decisions AND its measured
 *  per-segment widths. Locates the live contentEditable `<div>` for the
 *  given text element id, derives the canvas/screen zoom from the
 *  `foreignObject`'s declared-vs-rendered width, and walks the tree
 *  emitting `StyledSegment`s stamped with `canvasWidth`. Returns null if
 *  the live div can't be located (caller falls back to canvas-measureText
 *  wrap, which still produces correct text but without textLength
 *  enforcement). Trims trailing empty rows. */
function readStyledLinesFromLiveDom(
  elementId: string,
  declaredCanvasWidth: number
): StyledSegment[][] | null {
  const liveSvg = document.getElementById("figurin-canvas");
  if (!liveSvg) return null;
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(elementId)
      : elementId.replace(/[^\w-]/g, "\\$&");
  const liveG = liveSvg.querySelector(`[data-element-id="${escaped}"]`);
  if (!liveG) return null;
  const fos = liveG.getElementsByTagNameNS(SVG_NS, "foreignObject");
  if (fos.length === 0) return null;
  const fo = fos[0];

  // Derive zoom from the foreignObject itself: its `width` attribute is the
  // declared canvas-unit width (= element.width); its rendered screen width
  // is that times the canvas's pan/zoom transform. Computing zoom locally
  // avoids reading the editor store from a pure rendering helper and keeps
  // the math correct under arbitrary panel layouts (sidebar collapses, etc.)
  // that change the canvas's physical size on screen.
  const fosScreenWidth = fo.getBoundingClientRect().width;
  if (fosScreenWidth === 0 || declaredCanvasWidth <= 0) return null;
  const zoom = fosScreenWidth / declaredCanvasWidth;
  if (!Number.isFinite(zoom) || zoom <= 0) return null;

  // The HTML <div> inside <foreignObject> sits in the XHTML namespace.
  // querySelector("div") works across browsers in HTML mode; falling back
  // to getElementsByTagName covers the rare case where the parser put the
  // subtree somewhere querySelector doesn't reach.
  const div =
    fo.querySelector("div") ??
    (fo.getElementsByTagName("div")[0] as HTMLElement | undefined) ??
    null;
  if (!div) return null;
  const lines: StyledSegment[][] = [[]];
  walkLiveStyledLines(div, {}, lines, zoom);
  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines.length > 0 ? lines : [[]];
}

/** Replaces each text element's `<foreignObject>` (HTML contentEditable — taints
 *  the PNG canvas on drawImage) with an SVG `<text>` approximation. Line breaks
 *  are read from the live rendered DOM so the export's wrap matches the
 *  editor's; inline rich formatting (bold/italic/underline/strike/color) is
 *  preserved via per-segment `<tspan>`. */
function inlineTextElements(svg: SVGSVGElement): void {
  const byId = new Map<string, TextElement>();
  for (const el of useEditorStore.getState().elements) {
    if (el.type === "text") byId.set(el.id, el);
  }
  if (byId.size === 0) return;

  const groups = Array.from(
    svg.querySelectorAll<SVGGElement>("[data-element-id]")
  );
  for (const g of groups) {
    const id = g.getAttribute("data-element-id");
    const el = id ? byId.get(id) : undefined;
    if (!el) continue;

    const fos = Array.from(g.getElementsByTagNameNS(SVG_NS, "foreignObject"));
    if (fos.length === 0) continue;

    const padding = 4;
    const lineHeight = el.fontSize * 1.2;
    const anchor =
      el.textAlign === "center"
        ? "middle"
        : el.textAlign === "right"
          ? "end"
          : "start";
    const anchorX =
      el.textAlign === "center"
        ? el.x + el.width / 2
        : el.textAlign === "right"
          ? el.x + el.width - padding
          : el.x + padding;

    // Read styled+wrapped lines from the editor's live DOM so the export's
    // line breaks match the browser's actual wrap decisions exactly. The
    // canvas-measureText path below is a fallback for the rare case the
    // live div can't be located (e.g., element rendered off-screen by a
    // hidden parent). Without this primary path the wrap diverges from CSS
    // by 1–2 chars per line on bold-heavy or italic content, and the
    // resulting extra line spills out of the styled rectangle drawn at
    // `element.height`.
    const wrapWidth = Math.max(0, el.width - padding * 2);
    const liveLines = readStyledLinesFromLiveDom(el.id, el.width);
    const lines: StyledSegment[][] =
      liveLines ??
      buildStyledLines(
        parseStyledSegments(el.content),
        String(el.fontWeight),
        el.fontStyle,
        el.fontSize,
        el.fontFamily,
        wrapWidth
      );

    // Vertical position of the FIRST line's baseline. CSS positions the
    // line-box top at `el.y + padding`, with the baseline sitting at
    // `(lineHeight - fontSize) / 2 + 0.8 * fontSize` below that
    // (half-leading + ascender). The previous code used `+ fontSize` flat,
    // putting the baseline ~10% of fontSize too low — visible drift on
    // headings (~2.4px at 24px) and the main source of the "exported text
    // doesn't match the canvas" complaint.
    const baselineFromTop =
      (lineHeight - el.fontSize) / 2 + el.fontSize * 0.8;
    const totalLinesHeight =
      (lines.length - 1) * lineHeight + el.fontSize;
    let firstLineTop: number;
    if (el.verticalAlign === "middle") {
      const contentH = el.height - padding * 2;
      firstLineTop =
        el.y + padding + Math.max(0, (contentH - totalLinesHeight) / 2);
    } else if (el.verticalAlign === "bottom") {
      firstLineTop = el.y + el.height - padding - totalLinesHeight;
    } else {
      firstLineTop = el.y + padding;
    }
    const firstBaselineY = firstLineTop + baselineFromTop;

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(anchorX));
    text.setAttribute("y", String(firstBaselineY));
    text.setAttribute("font-family", el.fontFamily);
    text.setAttribute("font-size", String(el.fontSize));
    text.setAttribute("font-weight", String(el.fontWeight));
    text.setAttribute("font-style", el.fontStyle);
    text.setAttribute("text-anchor", anchor);
    text.setAttribute("fill", el.color);
    if (el.opacity !== 1) text.setAttribute("opacity", String(el.opacity));

    lines.forEach((line, lineIdx) => {
      // Empty line: emit one tspan with a zero-width space so the dy still
      // advances. Without that, a deliberate blank row in the editor would
      // disappear in the export.
      if (line.length === 0) {
        const tspan = document.createElementNS(SVG_NS, "tspan");
        tspan.setAttribute("x", String(anchorX));
        if (lineIdx > 0) tspan.setAttribute("dy", String(lineHeight));
        tspan.textContent = "​";
        text.appendChild(tspan);
        return;
      }
      // Styled line: one tspan per styled segment. ONLY the first tspan on
      // each line carries `x` (and `dy` for the line shift) — that starts a
      // new SVG text-chunk anchored at `anchorX`. Subsequent tspans omit `x`
      // and continue inline within the same chunk, so `text-anchor="middle"`
      // / `"end"` apply to the WHOLE line as one run, not per-tspan.
      line.forEach((seg, segIdx) => {
        const tspan = document.createElementNS(SVG_NS, "tspan");
        if (segIdx === 0) {
          tspan.setAttribute("x", String(anchorX));
          if (lineIdx > 0) tspan.setAttribute("dy", String(lineHeight));
        }
        if (seg.bold) tspan.setAttribute("font-weight", "bold");
        if (seg.italic) tspan.setAttribute("font-style", "italic");
        const decorations: string[] = [];
        if (seg.underline) decorations.push("underline");
        if (seg.lineThrough) decorations.push("line-through");
        if (decorations.length > 0) {
          tspan.setAttribute("text-decoration", decorations.join(" "));
        }
        // Per-span color overrides the parent <text>'s base fill.
        if (seg.color) tspan.setAttribute("fill", seg.color);
        // Force the SVG renderer to lay this tspan out at exactly the width
        // CSS rendered it to. Without this the SVG and HTML/CSS pipelines
        // can pick subtly different metrics for the same font (kerning,
        // hinting, fallback), and a line that fit perfectly in the editor
        // can spill 1–4px past the styled rectangle in the export.
        // `lengthAdjust="spacingAndGlyphs"` allows the renderer to stretch
        // both gaps and glyphs to land on the requested width — usually
        // imperceptible, but bounded.
        if (
          typeof seg.canvasWidth === "number" &&
          seg.canvasWidth > 0 &&
          // Pure-whitespace runs at line boundaries collapse in CSS but
          // measure non-zero in some browsers. Skip textLength on those so
          // the renderer doesn't try to "stretch" empty space.
          seg.text.trim().length > 0
        ) {
          tspan.setAttribute("textLength", String(seg.canvasWidth));
          tspan.setAttribute("lengthAdjust", "spacingAndGlyphs");
        }
        tspan.textContent = seg.text;
        text.appendChild(tspan);
      });
    });

    // When the text carries its own background / border (fill or stroke), emit
    // a <rect> before the text so the pill renders in PNG / SVG exports the
    // same way it does in the editor (where foreignObject CSS drew it).
    const hasBackground = el.fill && el.fill !== "none";
    const hasBorder = el.stroke && el.stroke !== "none" && el.strokeWidth > 0;
    const radius = el.borderRadius ?? 0;
    if (hasBackground || hasBorder) {
      const bg = document.createElementNS(SVG_NS, "rect");
      bg.setAttribute("x", String(el.x));
      bg.setAttribute("y", String(el.y));
      bg.setAttribute("width", String(el.width));
      bg.setAttribute("height", String(el.height));
      if (radius > 0) {
        bg.setAttribute("rx", String(radius));
        bg.setAttribute("ry", String(radius));
      }
      bg.setAttribute("fill", hasBackground ? el.fill : "none");
      if (hasBorder) {
        bg.setAttribute("stroke", el.stroke);
        bg.setAttribute("stroke-width", String(el.strokeWidth));
        if (el.strokeStyle === "dashed") {
          bg.setAttribute(
            "stroke-dasharray",
            `${el.strokeWidth * 3} ${el.strokeWidth * 2}`
          );
        } else if (el.strokeStyle === "dotted") {
          bg.setAttribute(
            "stroke-dasharray",
            `${el.strokeWidth * 0.5} ${el.strokeWidth * 2}`
          );
          bg.setAttribute("stroke-linecap", "round");
        }
      }
      if (el.opacity !== 1) bg.setAttribute("opacity", String(el.opacity));
      fos[0].replaceWith(bg);
      bg.after(text);
    } else {
      fos[0].replaceWith(text);
    }
    for (let i = 1; i < fos.length; i++) fos[i].remove();
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Prepends a full-viewBox white rect as the first child of the SVG so the
 *  background renders behind every element. Matches whatever viewBox is
 *  already set on the clone. */
function paintSvgWhiteBackground(svg: SVGSVGElement) {
  const viewBox = svg.getAttribute("viewBox");
  const [vx, vy, vw, vh] = viewBox
    ? viewBox.split(/\s+/).map(Number)
    : [0, 0, CANVAS_WIDTH, CANVAS_HEIGHT];
  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("x", String(vx));
  bg.setAttribute("y", String(vy));
  bg.setAttribute("width", String(vw));
  bg.setAttribute("height", String(vh));
  bg.setAttribute("fill", "white");
  svg.insertBefore(bg, svg.firstChild);
}

export async function exportAsSvg(
  fit: ExportFit = "figure",
  background: ExportBackground = "transparent",
  margin: number = 16
) {
  const out = getCleanedSvg(fit, margin);
  if (!out) return;

  await inlineIcons(out.svg);
  await inlineUploadedImages(out.svg);
  inlineTextElements(out.svg);
  if (background === "white") paintSvgWhiteBackground(out.svg);

  const svgString = new XMLSerializer().serializeToString(out.svg);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, fit === "selection" ? "selection.svg" : "figure.svg");
}

export async function exportAsPng(
  fit: ExportFit = "figure",
  background: ExportBackground = "white",
  margin: number = 16
) {
  const out = getCleanedSvg(fit, margin);
  if (!out) return;

  await inlineIcons(out.svg);
  await inlineUploadedImages(out.svg);
  inlineTextElements(out.svg);

  const svgString = new XMLSerializer().serializeToString(out.svg);
  const svgBlob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = out.width * PNG_SCALE;
    canvas.height = out.height * PNG_SCALE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    if (background === "white") {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob)
        downloadBlob(blob, fit === "selection" ? "selection.png" : "figure.png");
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}
