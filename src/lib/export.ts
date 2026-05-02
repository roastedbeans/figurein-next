import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./constants";
import { useEditorStore } from "@/stores/editor-store";
import { getIconUrl, getIconFormat } from "@/components/icons";
import type {
  ArrowElement,
  EditorElement,
  LineElement,
  TextElement,
} from "@/types/editor";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Export framing mode.
 *  - "canvas": full 1200×800 sheet regardless of where elements sit.
 *  - "figure": tight crop around the drawn elements, with a small padding.
 */
export type ExportFit = "canvas" | "figure";

/** Background behind the exported content. Transparent SVGs read cleanly on
 *  dark backgrounds; transparent PNGs render as checker in most viewers, so
 *  "white" is the safer default there. */
export type ExportBackground = "white" | "transparent";

const FIGURE_PADDING = 16;
const PNG_SCALE = 2;

function elementsBbox(
  elements: EditorElement[]
): { x: number; y: number; w: number; h: number } | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const half = (el.strokeWidth ?? 0) / 2;
    if (el.type === "line" || el.type === "arrow") {
      const c = el as LineElement | ArrowElement;
      const xs = [c.x, c.x2];
      const ys = [c.y, c.y2];
      if (c.elbowCorners) {
        for (const [cx, cy] of c.elbowCorners) {
          xs.push(cx);
          ys.push(cy);
        }
      }
      for (const v of xs) {
        minX = Math.min(minX, v - half);
        maxX = Math.max(maxX, v + half);
      }
      for (const v of ys) {
        minY = Math.min(minY, v - half);
        maxY = Math.max(maxY, v + half);
      }
    } else {
      minX = Math.min(minX, el.x - half);
      minY = Math.min(minY, el.y - half);
      maxX = Math.max(maxX, el.x + el.width + half);
      maxY = Math.max(maxY, el.y + el.height + half);
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Clone the live canvas SVG and prepare it for serialization. Strips the
 *  pan/zoom transform and every `[data-no-export]` element (grid, backdrop,
 *  selection overlays, sheet shadow). Sets viewBox + width/height to either
 *  the full canvas (expanded to include any element that spills past the
 *  sheet) or the element bbox with padding. */
function getCleanedSvg(
  fit: ExportFit
): { svg: SVGSVGElement; width: number; height: number } | null {
  const svg = document.getElementById(
    "figurein-canvas"
  ) as SVGSVGElement | null;
  if (!svg) return null;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-no-export]").forEach((el) => el.remove());

  // Drop the viewport transform — elements are already in canvas coords.
  const viewportG = clone.querySelector("g");
  if (viewportG) viewportG.removeAttribute("transform");

  const elements = useEditorStore.getState().elements;
  const bbox = elementsBbox(elements);

  let vx = 0;
  let vy = 0;
  let vw = CANVAS_WIDTH;
  let vh = CANVAS_HEIGHT;

  if (fit === "figure") {
    if (bbox && bbox.w > 0 && bbox.h > 0) {
      vx = Math.floor(bbox.x - FIGURE_PADDING);
      vy = Math.floor(bbox.y - FIGURE_PADDING);
      vw = Math.ceil(bbox.w + FIGURE_PADDING * 2);
      vh = Math.ceil(bbox.h + FIGURE_PADDING * 2);
    }
    // Empty canvas falls through to the default full-canvas viewBox.
  } else if (bbox) {
    // Canvas mode: keep the full 1200×800 sheet visible, but extend the
    // viewBox outward whenever elements spill past it so nothing gets
    // clipped. Elements that sit fully inside the sheet don't change
    // anything — the viewBox stays at 0,0,CANVAS_WIDTH,CANVAS_HEIGHT.
    const minX = Math.min(0, Math.floor(bbox.x));
    const minY = Math.min(0, Math.floor(bbox.y));
    const maxX = Math.max(CANVAS_WIDTH, Math.ceil(bbox.x + bbox.w));
    const maxY = Math.max(CANVAS_HEIGHT, Math.ceil(bbox.y + bbox.h));
    vx = minX;
    vy = minY;
    vw = maxX - minX;
    vh = maxY - minY;
  }

  clone.setAttribute("viewBox", `${vx} ${vy} ${vw} ${vh}`);
  clone.setAttribute("width", String(vw));
  clone.setAttribute("height", String(vh));
  // xmlns is required for standalone SVG files; cloning from the live DOM
  // sometimes omits it depending on the browser.
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
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

/** Extract visible lines from contentEditable HTML. Treats `<br>`, `<div>`,
 *  and `<p>` as line breaks — matches what the user sees in the editor for
 *  the common case. Inline formatting (bold/italic spans) is flattened. */
function extractTextLines(html: string): string[] {
  const raw = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p)>/gi, "\n")
    .replace(/<(div|p)[^>]*>/gi, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = raw;
  const text = tmp.textContent ?? "";
  const lines = text.split("\n");
  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines.length === 0 ? [""] : lines;
}

/** Replaces each text element's `<foreignObject>` (HTML contentEditable — taints
 *  the PNG canvas on drawImage) with an SVG `<text>` approximation. Line breaks
 *  are preserved via `<tspan dy>`; inline rich formatting is flattened. */
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

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(anchorX));
    text.setAttribute("y", String(el.y + padding + el.fontSize));
    text.setAttribute("font-family", el.fontFamily);
    text.setAttribute("font-size", String(el.fontSize));
    text.setAttribute("font-weight", String(el.fontWeight));
    text.setAttribute("font-style", el.fontStyle);
    text.setAttribute("text-anchor", anchor);
    text.setAttribute("fill", el.color);
    if (el.opacity !== 1) text.setAttribute("opacity", String(el.opacity));

    const lines = extractTextLines(el.content);
    lines.forEach((line, i) => {
      const tspan = document.createElementNS(SVG_NS, "tspan");
      tspan.setAttribute("x", String(anchorX));
      if (i > 0) tspan.setAttribute("dy", String(lineHeight));
      // Empty lines still need to advance the dy, but would collapse without
      // some glyph — a zero-width space keeps the line height intact.
      tspan.textContent = line === "" ? "\u200B" : line;
      text.appendChild(tspan);
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
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", String(vx));
  bg.setAttribute("y", String(vy));
  bg.setAttribute("width", String(vw));
  bg.setAttribute("height", String(vh));
  bg.setAttribute("fill", "white");
  svg.insertBefore(bg, svg.firstChild);
}

export async function exportAsSvg(
  fit: ExportFit = "canvas",
  background: ExportBackground = "transparent"
) {
  const out = getCleanedSvg(fit);
  if (!out) return;

  await inlineIcons(out.svg);
  inlineTextElements(out.svg);
  if (background === "white") paintSvgWhiteBackground(out.svg);

  const svgString = new XMLSerializer().serializeToString(out.svg);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, fit === "figure" ? "figure-tight.svg" : "figure.svg");
}

export async function exportAsPng(
  fit: ExportFit = "canvas",
  background: ExportBackground = "white"
) {
  const out = getCleanedSvg(fit);
  if (!out) return;

  await inlineIcons(out.svg);
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
        downloadBlob(blob, fit === "figure" ? "figure-tight.png" : "figure.png");
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}
