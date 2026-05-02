import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildSketchAnalysisPrompt } from "@/lib/ai-prompt";
import {
  DEFAULT_FONT_FAMILY,
  GRID_SIZE,
  TEXT_VARIANTS,
  type TextVariant,
} from "@/lib/constants";

const client = new Anthropic();

/**
 * Classify an element into its nearest variant. Matches bold/plain first,
 * then picks the variant whose canonical fontSize is closest to the
 * element's declared size. AI output is allowed to drift by a few pixels
 * from the canonical preset (e.g., emitting 22 instead of 20 for a
 * subheading); this classifier rounds that drift away so the element uses
 * its preset typography.
 */
function variantFor(
  fontSize: number,
  fontWeight: string | undefined
): TextVariant {
  const isBold =
    fontWeight === "bold" ||
    (typeof fontWeight === "string" && Number(fontWeight) >= 600);
  const weightKey: "bold" | "normal" = isBold ? "bold" : "normal";
  let best: TextVariant = "body";
  let bestDiff = Infinity;
  for (const name of Object.keys(TEXT_VARIANTS) as TextVariant[]) {
    const v = TEXT_VARIANTS[name];
    if (v.fontWeight !== weightKey) continue;
    const diff = Math.abs(v.fontSize - fontSize);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = name;
    }
  }
  return best;
}

const SNAP = GRID_SIZE / 4;
const POS_KEYS = ["x", "y", "x2", "y2"];
const SIZE_KEYS = ["width", "height"];
const snapPos = (v: unknown): number | undefined =>
  typeof v === "number" ? Math.round(v / SNAP) * SNAP : undefined;
const snapSize = (v: unknown): number | undefined =>
  typeof v === "number" ? Math.ceil(v / SNAP) * SNAP : undefined;

/**
 * Apply the full batch post-processing pipeline: grid snap, text variant
 * resolution, text dedup, rect+text merge, and edge-snap. Runs on a
 * cohesive batch of elements — a full new canvas or an addition set.
 */
function normalizeElements(
  input: Record<string, unknown>[],
  existingFrameIds: Set<string> = new Set()
): Record<string, unknown>[] {
  let elements = input;

  // Snap to the editor grid. Position uses nearest-round (drift in either
  // direction is equally fine); size uses ceil so a text box never loses
  // pixels that would cause its content to wrap — wrap-induced height
  // growth is the root cause of the ghost-overlap / arrow-through-text
  // class of layout bugs downstream.
  const usedIds = new Set<string>();
  elements = elements.map((el) => {
    for (const key of POS_KEYS) {
      const snapped = snapPos(el[key]);
      if (snapped !== undefined) el[key] = snapped;
    }
    for (const key of SIZE_KEYS) {
      const snapped = snapSize(el[key]);
      if (snapped !== undefined) el[key] = snapped;
    }

    if ((el.type === "arrow" || el.type === "line") && !el.lineStyle) {
      el.lineStyle = "straight";
    }
    if (el.type === "line") {
      if (!el.headStyle) el.headStyle = "none";
      if (!el.tailStyle) el.tailStyle = "none";
    }
    // Circles must be round. If the AI emits an ellipse-style width/height,
    // widen the shorter side to match the longer one (snapped to the grid)
    // so the result is always a perfect circle.
    if (el.type === "circle") {
      const w = typeof el.width === "number" ? el.width : 0;
      const h = typeof el.height === "number" ? el.height : 0;
      if (w !== h) {
        const side = Math.ceil(Math.max(w, h) / SNAP) * SNAP;
        el.width = side;
        el.height = side;
      }
      el.aspectLocked = true;
    }
    let id = el.id as string;
    if (!id || usedIds.has(id)) {
      id = `el_${Math.random().toString(36).substring(2, 11)}`;
    }
    usedIds.add(id);
    el.id = id;
    // Hierarchy is opt-in — the model emits `parentId` only when it wants
    // an element to live inside a frame. Everything else defaults to the
    // page root, matching the flat shape the editor expects today.
    if (el.parentId === undefined) el.parentId = null;
    return el;
  });

  // Text variant resolution — fills fontSize / fontWeight / width from
  // TEXT_VARIANTS presets so the AI only has to emit `variant` + content.
  for (const el of elements) {
    if (el.type !== "text") continue;
    const declaredVariant =
      typeof el.variant === "string" &&
      (el.variant === "heading" ||
        el.variant === "subheading" ||
        el.variant === "body" ||
        el.variant === "caption")
        ? (el.variant as TextVariant)
        : null;
    const variant: TextVariant =
      declaredVariant ??
      variantFor(
        typeof el.fontSize === "number" ? el.fontSize : 16,
        typeof el.fontWeight === "string" ? el.fontWeight : undefined
      );
    const preset = TEXT_VARIANTS[variant];
    el.fontSize = preset.fontSize;
    el.fontWeight = preset.fontWeight;
    if (typeof el.width !== "number") {
      el.width = preset.width;
    }
    // Force the canonical fontFamily stack so the rendered font matches the
    // one the server's width coefficients (SF Pro Display) are calibrated
    // against.
    el.fontFamily = DEFAULT_FONT_FAMILY;
    el.variant = variant;
  }

  // Dedupe overlapping text elements. Content relation + spatial proximity
  // together flag a stacked-span pair; drop the shorter / less-styled one.
  type TextEl = Record<string, unknown> & {
    type: "text";
    content?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fontWeight?: string;
    color?: string;
    fontSize?: number;
  };
  const isText = (el: Record<string, unknown>): el is TextEl =>
    el.type === "text";
  const textEls = elements.filter(isText);
  const toRemove = new Set<string>();

  const stripHtml = (s: string) =>
    s
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
  const normalize = (s: string) =>
    stripHtml(s).trim().toLowerCase().replace(/\s+/g, " ");
  const wholeWordContains = (hay: string, needle: string) => {
    if (!needle) return false;
    const re = new RegExp(
      `(^|\\W)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`,
      "i"
    );
    return re.test(hay);
  };

  for (let i = 0; i < textEls.length; i++) {
    for (let j = i + 1; j < textEls.length; j++) {
      const a = textEls[i];
      const b = textEls[j];
      if (toRemove.has(a.id as string) || toRemove.has(b.id as string))
        continue;
      const ac = normalize(a.content ?? "");
      const bc = normalize(b.content ?? "");
      if (!ac || !bc) continue;

      const equal = ac === bc;
      const aContainsB = ac.length > bc.length && wholeWordContains(ac, bc);
      const bContainsA = bc.length > ac.length && wholeWordContains(bc, ac);
      if (!equal && !aContainsB && !bContainsA) continue;

      const ax = typeof a.x === "number" ? a.x : 0;
      const ay = typeof a.y === "number" ? a.y : 0;
      const aw = typeof a.width === "number" ? a.width : 0;
      const ah = typeof a.height === "number" ? a.height : 0;
      const bx = typeof b.x === "number" ? b.x : 0;
      const by = typeof b.y === "number" ? b.y : 0;
      const bw = typeof b.width === "number" ? b.width : 0;
      const bh = typeof b.height === "number" ? b.height : 0;
      const acx = ax + aw / 2;
      const acy = ay + ah / 2;
      const bcx = bx + bw / 2;
      const bcy = by + bh / 2;
      const fs = Math.max(
        typeof a.fontSize === "number" ? a.fontSize : 12,
        typeof b.fontSize === "number" ? b.fontSize : 12
      );
      const dy = Math.abs(acy - bcy);
      const dxCenters = Math.abs(acx - bcx);
      const centersClose = dxCenters <= fs * 2 && dy <= fs * 1.5;
      const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
      const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
      const overlaps = ix > 0 && iy > 0;
      const shorterInsideLonger = (() => {
        const shorter = ac.length < bc.length ? a : b;
        const longer = shorter === a ? b : a;
        const sx = typeof shorter.x === "number" ? shorter.x : 0;
        const sy = typeof shorter.y === "number" ? shorter.y : 0;
        const sw = typeof shorter.width === "number" ? shorter.width : 0;
        const sh = typeof shorter.height === "number" ? shorter.height : 0;
        const lx = typeof longer.x === "number" ? longer.x : 0;
        const ly = typeof longer.y === "number" ? longer.y : 0;
        const lw = typeof longer.width === "number" ? longer.width : 0;
        const lh = typeof longer.height === "number" ? longer.height : 0;
        const cx = sx + sw / 2;
        const cy = sy + sh / 2;
        return cx >= lx && cx <= lx + lw && cy >= ly - fs && cy <= ly + lh + fs;
      })();
      if (!centersClose && !overlaps && !shorterInsideLonger) continue;

      let loser: TextEl;
      if (equal) {
        const score = (t: TextEl) =>
          (t.fontWeight === "bold" ? 2 : 0) +
          (t.color && t.color !== "#475569" && t.color !== "#1e293b" ? 1 : 0);
        loser = score(a) >= score(b) ? b : a;
      } else {
        loser = ac.length < bc.length ? a : b;
      }
      toRemove.add(loser.id as string);
    }
  }
  if (toRemove.size > 0) {
    elements = elements.filter((el) => !toRemove.has(el.id as string));
  }

  // Merge (rectangle + text) pairs sharing a groupId into ONE text element.
  // Text elements render their own background, border, AND rounded corners —
  // a rectangle behind a text is always redundant when exactly one rectangle
  // and one text share a groupId.
  type Any = Record<string, unknown>;
  const byGroup = new Map<string, Any[]>();
  for (const el of elements) {
    const gid = el.groupId;
    if (typeof gid !== "string" || !gid) continue;
    const bucket = byGroup.get(gid) ?? [];
    bucket.push(el);
    byGroup.set(gid, bucket);
  }
  const mergedIds = new Set<string>();
  for (const [, group] of byGroup) {
    if (group.length !== 2) continue;
    const rect = group.find((e) => e.type === "rectangle") as Any | undefined;
    const text = group.find((e) => e.type === "text") as Any | undefined;
    if (!rect || !text) continue;
    text.x = rect.x;
    text.y = rect.y;
    text.width = rect.width;
    text.height = rect.height;
    text.fill = rect.fill;
    text.stroke = rect.stroke;
    text.strokeWidth = rect.strokeWidth;
    text.borderRadius = rect.borderRadius ?? 0;
    delete text.groupId;
    mergedIds.add(rect.id as string);
  }

  // Geometric fallback: catch rect+text shims the AI emitted without a
  // shared groupId. Pill-sized rectangle (height <= 120, width <= 500)
  // hosting exactly one text of comparable height → merge.
  const rectHostsPoint = (px: number, py: number, r: Any) => {
    const rx = r.x as number;
    const ry = r.y as number;
    const rw = r.width as number;
    const rh = r.height as number;
    return (
      px >= rx - 1 && py >= ry - 1 && px <= rx + rw + 1 && py <= ry + rh + 1
    );
  };
  const elemOverlapsRect = (e: Any, r: Any) => {
    const ex = e.x as number;
    const ey = e.y as number;
    const ew = (e.width as number) || 0;
    const eh = (e.height as number) || 0;
    return (
      rectHostsPoint(ex, ey, r) ||
      rectHostsPoint(ex + ew, ey + eh, r) ||
      rectHostsPoint(ex + ew / 2, ey + eh / 2, r)
    );
  };
  for (const rect of elements as Any[]) {
    if (rect.type !== "rectangle") continue;
    if (mergedIds.has(rect.id as string)) continue;
    const rw = rect.width as number;
    const rh = rect.height as number;
    if (rh > 120 || rw > 500) continue;
    const hosted = (elements as Any[]).filter(
      (e) =>
        e !== rect &&
        !mergedIds.has(e.id as string) &&
        elemOverlapsRect(e, rect)
    );
    if (hosted.length !== 1) continue;
    const text = hosted[0];
    if (text.type !== "text") continue;
    const th = (text.height as number) || 0;
    if (th > 0 && rh / th > 1.8) continue;
    text.x = rect.x;
    text.y = rect.y;
    text.width = rect.width;
    text.height = rect.height;
    text.fill = rect.fill;
    text.stroke = rect.stroke;
    text.strokeWidth = rect.strokeWidth;
    text.borderRadius = rect.borderRadius ?? 0;
    if (typeof text.groupId === "string" && text.groupId === rect.groupId) {
      delete text.groupId;
    }
    mergedIds.add(rect.id as string);
  }

  if (mergedIds.size > 0) {
    elements = elements.filter((el) => !mergedIds.has(el.id as string));
  }

  // Text content cleanup: strip trailing whitespace / <br> / &nbsp; that
  // would render as a phantom blank line. Drop the generation-side `variant`
  // helper field.
  for (const el of elements) {
    if (el.type !== "text") continue;
    if (typeof el.content === "string") {
      el.content = el.content.replace(/(\s|<br\s*\/?>|&nbsp;)+$/gi, "");
    }
    delete el.variant;
  }

  // Edge-snap pass — arrow/line endpoints snap to any point on a nearby
  // element edge within SNAP_TOL (= 5px, one grid tick).
  const SNAP_TOL = SNAP;
  type Rect = { id: string; l: number; t: number; r: number; b: number };
  const rects: Rect[] = [];
  for (const el of elements) {
    if (el.type === "arrow") continue;
    if (typeof el.x !== "number" || typeof el.y !== "number") continue;
    if (el.type === "line") {
      const x = el.x as number;
      const y = el.y as number;
      const x2 = typeof el.x2 === "number" ? el.x2 : x;
      const y2 = typeof el.y2 === "number" ? el.y2 : y;
      rects.push({
        id: el.id as string,
        l: Math.min(x, x2),
        t: Math.min(y, y2),
        r: Math.max(x, x2),
        b: Math.max(y, y2),
      });
      continue;
    }
    const w = typeof el.width === "number" ? el.width : 0;
    const h = typeof el.height === "number" ? el.height : 0;
    rects.push({
      id: el.id as string,
      l: el.x,
      t: el.y,
      r: el.x + w,
      b: el.y + h,
    });
  }
  type EdgeHit = {
    x: number;
    y: number;
    dir: "up" | "right" | "down" | "left";
    elementId: string;
  };
  const snapAlong = (v: number, lo: number, hi: number): number => {
    const clamped = Math.max(lo, Math.min(hi, v));
    const snapped = Math.round(clamped / SNAP) * SNAP;
    return Math.max(lo, Math.min(hi, snapped));
  };
  const snapEndpoint = (
    px: number,
    py: number,
    selfId: string
  ): EdgeHit | null => {
    let best: EdgeHit | null = null;
    let bestDist = Infinity;
    for (const r of rects) {
      if (r.id === selfId) continue;
      const candidates: Array<EdgeHit & { perp: number }> = [
        {
          x: snapAlong(px, r.l, r.r),
          y: r.t,
          dir: "up",
          elementId: r.id,
          perp: Math.abs(py - r.t),
        },
        {
          x: r.r,
          y: snapAlong(py, r.t, r.b),
          dir: "right",
          elementId: r.id,
          perp: Math.abs(px - r.r),
        },
        {
          x: snapAlong(px, r.l, r.r),
          y: r.b,
          dir: "down",
          elementId: r.id,
          perp: Math.abs(py - r.b),
        },
        {
          x: r.l,
          y: snapAlong(py, r.t, r.b),
          dir: "left",
          elementId: r.id,
          perp: Math.abs(px - r.l),
        },
      ];
      for (const c of candidates) {
        const withinExtent =
          c.dir === "up" || c.dir === "down"
            ? px >= r.l - SNAP_TOL && px <= r.r + SNAP_TOL
            : py >= r.t - SNAP_TOL && py <= r.b + SNAP_TOL;
        if (!withinExtent) continue;
        if (c.perp > SNAP_TOL) continue;
        const d = Math.hypot(px - c.x, py - c.y);
        if (d <= SNAP_TOL && d < bestDist) {
          bestDist = d;
          best = { x: c.x, y: c.y, dir: c.dir, elementId: c.elementId };
        }
      }
    }
    return best;
  };
  for (const el of elements) {
    if (el.type !== "arrow" && el.type !== "line") continue;
    if (typeof el.x !== "number" || typeof el.y !== "number") continue;
    if (typeof el.x2 !== "number" || typeof el.y2 !== "number") continue;

    const selfId = el.id as string;
    const startHit = snapEndpoint(el.x as number, el.y as number, selfId);
    if (startHit) {
      el.x = startHit.x;
      el.y = startHit.y;
      el.startDir = startHit.dir;
    }
    const endHit = snapEndpoint(el.x2 as number, el.y2 as number, selfId);
    if (endHit) {
      el.x2 = endHit.x;
      el.y2 = endHit.y;
      el.endDir = endHit.dir;
    }
  }

  // Merge chained straight arrows into one elbow. The prompt forbids this
  // pattern but the model still emits it for flowchart-style turns — fake
  // elbow = two/three short straights whose endpoints meet mid-air. Signal:
  // arrow A ends where arrow B starts, neither endpoint is edge-snapped
  // (mid-air joint, not both pointing at one target), they share style.
  // Collapsing into one elbow matches the user-visible intent and preserves
  // interactivity (drag / select / delete behave as one connector).
  const EPS = 1;
  const sameSnap = (ax: number, ay: number, bx: number, by: number) =>
    Math.abs(ax - bx) < EPS && Math.abs(ay - by) < EPS;
  const isConnector = (el: Record<string, unknown>) =>
    el.type === "arrow" || el.type === "line";
  const connectorShareStyle = (
    a: Record<string, unknown>,
    b: Record<string, unknown>
  ) =>
    a.type === b.type &&
    a.stroke === b.stroke &&
    a.strokeWidth === b.strokeWidth &&
    a.zIndex === b.zIndex;

  let mergedThisPass = true;
  let safety = 0;
  while (mergedThisPass && safety++ < 20) {
    mergedThisPass = false;
    outer: for (let i = 0; i < elements.length; i++) {
      const a = elements[i];
      if (!isConnector(a)) continue;
      if (typeof a.x2 !== "number" || typeof a.y2 !== "number") continue;
      // Only merge when A's END is a mid-air joint — an edge-snapped end
      // means A is pointing at an element, not continuing to another arrow.
      if (a.endDir !== undefined) continue;

      for (let j = 0; j < elements.length; j++) {
        if (i === j) continue;
        const b = elements[j];
        if (!isConnector(b)) continue;
        if (typeof b.x !== "number" || typeof b.y !== "number") continue;
        if (typeof b.x2 !== "number" || typeof b.y2 !== "number") continue;
        if (b.startDir !== undefined) continue;
        if (!connectorShareStyle(a, b)) continue;
        if (
          !sameSnap(a.x2 as number, a.y2 as number, b.x as number, b.y as number)
        ) {
          continue;
        }

        // Skip if A and B are collinear in the same direction — that's a
        // split-in-half straight, not an elbow. Collapsing it would still
        // be correct visually, but keeping the conservative scope avoids
        // accidentally chewing up intentional segments.
        const aHoriz = Math.abs((a.y as number) - (a.y2 as number)) < EPS;
        const aVert = Math.abs((a.x as number) - (a.x2 as number)) < EPS;
        const bHoriz = Math.abs((b.y as number) - (b.y2 as number)) < EPS;
        const bVert = Math.abs((b.x as number) - (b.x2 as number)) < EPS;
        const collinearHoriz =
          aHoriz && bHoriz && Math.abs((a.y as number) - (b.y as number)) < EPS;
        const collinearVert =
          aVert && bVert && Math.abs((a.x as number) - (b.x as number)) < EPS;
        if (collinearHoriz || collinearVert) continue;

        // Merge A + B into one elbow connector. A's start becomes the
        // merged start, B's end becomes the merged end, tail/head styles
        // come from the outer ends, lineStyle becomes "elbow" so the
        // renderer routes a minimum-corner path.
        a.x2 = b.x2;
        a.y2 = b.y2;
        a.lineStyle = "elbow";
        a.headStyle = b.headStyle;
        if (b.endDir !== undefined) {
          a.endDir = b.endDir;
        } else {
          delete a.endDir;
        }
        elements.splice(j, 1);
        mergedThisPass = true;
        break outer;
      }
    }
  }

  // Hierarchy normalization (runs last so it sees the post-dedup, post-merge
  // element set). The model emits `parentId` on each child; we own the
  // reverse index so it can't drift. A parentId pointing at a missing or
  // non-frame element drops back to `null` (page-root) rather than leaving
  // a dangling ref that would trip later tree walks. Frames also get their
  // required fields filled with inert defaults — the renderer reads every
  // field on FrameElement, so a missing one would crash the type guard
  // when the payload hits the store.
  {
    const byId = new Map<string, Record<string, unknown>>();
    for (const el of elements) byId.set(el.id as string, el);
    const frameIds = new Set<string>();
    for (const el of elements) {
      if (el.type === "frame") frameIds.add(el.id as string);
    }
    const childIdsByFrame = new Map<string, string[]>();
    for (const el of elements) {
      const pid = el.parentId;
      if (typeof pid !== "string" || pid === "") {
        el.parentId = null;
        continue;
      }
      // Keep parentId iff it names a frame in THIS batch or an existing
      // frame already on the canvas (add_to_canvas case — the child rides
      // along the new batch but joins a frame the user already had).
      const inBatch = byId.has(pid) && frameIds.has(pid);
      const inExisting = existingFrameIds.has(pid);
      if (!inBatch && !inExisting) {
        el.parentId = null;
        continue;
      }
      if (inBatch) {
        const bucket = childIdsByFrame.get(pid) ?? [];
        bucket.push(el.id as string);
        childIdsByFrame.set(pid, bucket);
      }
    }
    for (const el of elements) {
      if (el.type !== "frame") continue;
      el.childIds = childIdsByFrame.get(el.id as string) ?? [];
      if (
        el.layoutMode !== "none" &&
        el.layoutMode !== "vertical" &&
        el.layoutMode !== "horizontal"
      ) {
        el.layoutMode = "none";
      }
      if (typeof el.gap !== "number") el.gap = 0;
      if (!el.padding || typeof el.padding !== "object") {
        el.padding = { top: 0, right: 0, bottom: 0, left: 0 };
      } else {
        const p = el.padding as Record<string, unknown>;
        el.padding = {
          top: typeof p.top === "number" ? p.top : 0,
          right: typeof p.right === "number" ? p.right : 0,
          bottom: typeof p.bottom === "number" ? p.bottom : 0,
          left: typeof p.left === "number" ? p.left : 0,
        };
      }
      if (
        el.mainAxisAlign !== "start" &&
        el.mainAxisAlign !== "center" &&
        el.mainAxisAlign !== "end" &&
        el.mainAxisAlign !== "space-between"
      ) {
        el.mainAxisAlign = "start";
      }
      if (
        el.crossAxisAlign !== "start" &&
        el.crossAxisAlign !== "center" &&
        el.crossAxisAlign !== "end" &&
        el.crossAxisAlign !== "stretch"
      ) {
        el.crossAxisAlign = "start";
      }
      if (typeof el.clipContent !== "boolean") el.clipContent = false;
    }
  }

  return elements;
}

/** Light patch normalization for modify_elements — snap position/size
 *  fields to the grid, but leave content / color / style alone. Skips the
 *  heavier dedup / merge / edge-snap passes since they need a full batch. */
function normalizePatch(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  for (const key of POS_KEYS) {
    const snapped = snapPos(out[key]);
    if (snapped !== undefined) out[key] = snapped;
  }
  for (const key of SIZE_KEYS) {
    const snapped = snapSize(out[key]);
    if (snapped !== undefined) out[key] = snapped;
  }
  return out;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_canvas",
    description:
      "Create a brand-new canvas page populated with a complete figure. Use when the canvas context is empty, when the user asks for a 'new figure' / 'new page', or when the request is about a different topic than the existing canvas. Do NOT use this for small additions to an existing figure — use add_to_canvas for those.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description:
            "Short title for the new page (2–6 words, e.g. 'Protocol Overview').",
        },
        elements: {
          type: "array",
          description:
            "The full set of elements that make up the figure. Each element follows the Element Type Reference from the system prompt — id, type, x, y, width, height, and any type-specific fields.",
          items: { type: "object", additionalProperties: true },
        },
      },
      required: ["title", "elements"],
    },
  },
  {
    name: "add_to_canvas",
    description:
      "Append new elements to the user's CURRENT canvas. Use when the user asks to add / insert / append / include / also show something alongside what is already there. Do NOT re-emit existing elements — only emit the new ones. Place the new elements in free canvas space without overlapping the existing element bounding boxes from the <canvas> block.",
    input_schema: {
      type: "object",
      properties: {
        elements: {
          type: "array",
          description:
            "New elements to append. Follow the Element Type Reference — every element needs a fresh id not already in the canvas context.",
          items: { type: "object", additionalProperties: true },
        },
      },
      required: ["elements"],
    },
  },
  {
    name: "modify_elements",
    description:
      "Edit existing elements on the current canvas — move, resize, recolor, rename, restyle, etc. Each update references an existing id from the <canvas> block and provides a patch with ONLY the fields that change. Do NOT re-emit unchanged fields. Do NOT invent ids.",
    input_schema: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description:
                  "The id of the existing element to modify. Must match an id in the canvas context.",
              },
              patch: {
                type: "object",
                description:
                  "Partial element with only the fields that change (e.g. { x: 200, y: 150 } to move, { content: '...' } to retitle, { fill: '#...' } to recolor).",
                additionalProperties: true,
              },
            },
            required: ["id", "patch"],
          },
        },
      },
      required: ["updates"],
    },
  },
  {
    name: "delete_elements",
    description:
      "Delete one or more elements from the current canvas. Use when the user asks to remove / delete / erase. Reference existing ids from the <canvas> block.",
    input_schema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          description: "Ids of elements to remove.",
          items: { type: "string" },
        },
      },
      required: ["ids"],
    },
  },
];

type CanvasContext = {
  pageTitle?: string;
  elements?: unknown[];
};

type ToolCall =
  | { tool: "create_canvas"; title: string; elements: unknown[] }
  | { tool: "add_to_canvas"; elements: unknown[] }
  | {
      tool: "modify_elements";
      updates: Array<{ id: string; patch: Record<string, unknown> }>;
    }
  | { tool: "delete_elements"; ids: string[] };

function parseCanvasContext(raw: unknown): CanvasContext | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as CanvasContext;
    if (!Array.isArray(obj.elements) || obj.elements.length === 0) {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let prompt: string;
    let imageBase64: string | null = null;
    let imageMediaType: string | null = null;
    let canvas: CanvasContext | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      prompt = (formData.get("prompt") as string) || "";
      const file = formData.get("image") as File | null;
      canvas = parseCanvasContext(formData.get("canvas"));

      if (file) {
        const buffer = await file.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString("base64");
        imageMediaType = file.type;
      }

      if (!prompt && !file) {
        return Response.json(
          { error: "A prompt or image is required" },
          { status: 400 }
        );
      }
    } else {
      const body = await request.json();
      prompt = body.prompt || "";
      imageBase64 = body.image || null;
      imageMediaType = body.imageMediaType || null;
      canvas = parseCanvasContext(body.canvas);

      if (!prompt && !imageBase64) {
        return Response.json(
          { error: "A prompt or image is required" },
          { status: 400 }
        );
      }
    }

    const userContent: Anthropic.MessageCreateParams["messages"][0]["content"] =
      [];

    if (imageBase64 && imageMediaType) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: imageMediaType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: imageBase64,
        },
      });
    }

    // Canvas context block — parsed by the model via the <canvas> tags in
    // the system prompt's tool-selection rules. Omit entirely when the
    // page is empty so the model's decision logic (empty → create_canvas)
    // fires unambiguously.
    if (canvas) {
      const canvasBlock = `<canvas>
<page_title>${canvas.pageTitle ?? "Untitled"}</page_title>
<elements>${JSON.stringify(canvas.elements)}</elements>
</canvas>`;
      userContent.push({ type: "text", text: canvasBlock });
    } else {
      userContent.push({
        type: "text",
        text: "<canvas><empty /></canvas>",
      });
    }

    const hasImage = !!imageBase64;
    let textContent: string;
    if (hasImage && prompt) {
      textContent = `Analyze this sketch/image and create a professional figure based on it. Additional instructions: ${prompt}`;
    } else if (hasImage) {
      textContent =
        "Analyze this sketch/image and reproduce it as a clean, professional, publication-ready scientific figure. Preserve the structure, connections, labels, and meaning from the sketch.";
    } else {
      textContent = prompt;
    }
    userContent.push({ type: "text", text: textContent });

    const systemPrompt = hasImage
      ? buildSketchAnalysisPrompt()
      : buildSystemPrompt();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      // Prompt caching on the large system prompt (~15k tokens of layout
      // rules + icon catalog). Ephemeral TTL is 5 minutes — plenty for a
      // burst of iterative edits during a single figure session.
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: TOOLS,
      messages: [{ role: "user", content: userContent }],
    });

    // Collect existing frame ids from the canvas context so add_to_canvas can
    // emit children whose parentId points at a frame the user already has —
    // the normalizer preserves those refs instead of stranding them at root.
    const existingFrameIds = new Set<string>();
    if (canvas?.elements) {
      for (const raw of canvas.elements) {
        if (!raw || typeof raw !== "object") continue;
        const e = raw as { id?: unknown; type?: unknown };
        if (e.type === "frame" && typeof e.id === "string") {
          existingFrameIds.add(e.id);
        }
      }
    }

    const toolCalls: ToolCall[] = [];
    let text = "";
    for (const block of message.content) {
      if (block.type === "text") {
        text += block.text;
        continue;
      }
      if (block.type !== "tool_use") continue;
      const input = (block.input ?? {}) as Record<string, unknown>;

      if (block.name === "create_canvas") {
        const elements = Array.isArray(input.elements)
          ? normalizeElements(input.elements as Record<string, unknown>[])
          : [];
        const title =
          typeof input.title === "string" && input.title.trim()
            ? input.title.trim()
            : "Untitled";
        toolCalls.push({ tool: "create_canvas", title, elements });
      } else if (block.name === "add_to_canvas") {
        const elements = Array.isArray(input.elements)
          ? normalizeElements(
              input.elements as Record<string, unknown>[],
              existingFrameIds
            )
          : [];
        if (elements.length > 0) {
          toolCalls.push({ tool: "add_to_canvas", elements });
        }
      } else if (block.name === "modify_elements") {
        const rawUpdates = Array.isArray(input.updates) ? input.updates : [];
        const updates: Array<{ id: string; patch: Record<string, unknown> }> =
          [];
        for (const raw of rawUpdates) {
          if (!raw || typeof raw !== "object") continue;
          const u = raw as { id?: unknown; patch?: unknown };
          if (typeof u.id !== "string" || !u.id) continue;
          if (!u.patch || typeof u.patch !== "object") continue;
          updates.push({
            id: u.id,
            patch: normalizePatch(u.patch as Record<string, unknown>),
          });
        }
        if (updates.length > 0) {
          toolCalls.push({ tool: "modify_elements", updates });
        }
      } else if (block.name === "delete_elements") {
        const rawIds = Array.isArray(input.ids) ? input.ids : [];
        const ids = rawIds.filter(
          (v): v is string => typeof v === "string" && !!v
        );
        if (ids.length > 0) {
          toolCalls.push({ tool: "delete_elements", ids });
        }
      }
    }

    return Response.json({ text: text.trim(), toolCalls });
  } catch (error) {
    console.error("AI generation error:", error);
    return Response.json(
      { error: "Failed to generate figure" },
      { status: 500 }
    );
  }
}
