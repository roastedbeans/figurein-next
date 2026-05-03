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

// Theme palette — named color tokens the model can emit instead of raw hex.
// The resolver walks each element's color-bearing fields (fill / stroke /
// color) and swaps a token for its hex value. Anything not in the map (a
// hex literal, "none", a Tailwind name, an unknown string) passes through
// unchanged, so existing hex-based generations keep working.
const THEME_TOKENS: Record<string, string> = {
  // Typography
  text: "#1e293b",
  "text-muted": "#64748b",
  "text-subtle": "#94a3b8",
  // Surfaces
  surface: "#ffffff",
  "surface-subtle": "#f8fafc",
  "surface-muted": "#f1f5f9",
  // Borders / strokes
  border: "#cbd5e1",
  "border-strong": "#475569",
  // Accents (brand + semantic)
  blue: "#3b82f6",
  "blue-subtle": "#93c5fd",
  "blue-bg": "#eff6ff",
  amber: "#f59e0b",
  "amber-subtle": "#fcd34d",
  "amber-bg": "#fef3c7",
  green: "#22c55e",
  "green-subtle": "#86efac",
  red: "#ef4444",
  "red-subtle": "#f9a8d4",
  "purple-subtle": "#c4b5fd",
};

const COLOR_FIELDS = ["fill", "stroke", "color"] as const;

function resolveTokens(
  input: Record<string, unknown>[]
): Record<string, unknown>[] {
  return input.map((el) => {
    let next: Record<string, unknown> | null = null;
    for (const field of COLOR_FIELDS) {
      const v = el[field];
      if (typeof v !== "string") continue;
      const hex = THEME_TOKENS[v];
      if (!hex) continue;
      if (!next) next = { ...el };
      next[field] = hex;
    }
    return next ?? el;
  });
}

// Connector binding expansion. The model expresses "this arrow goes from
// element A to element B" by emitting `from` / `to` (plus optional
// `fromSide` / `toSide`), and we resolve to the (x, y, x2, y2) endpoints
// the renderer uses, plus the structural startConnectedTo / endConnectedTo
// bindings so the connector reroutes when the target moves later. Only
// elements within this generation batch are bindable — there is no
// pre-existing canvas to reference.
type EdgeSide = "up" | "right" | "down" | "left";

type Bounds = {
  l: number;
  t: number;
  r: number;
  b: number;
  cx: number;
  cy: number;
  type: string;
};

function elementBounds(el: Record<string, unknown>): Bounds | null {
  const x = typeof el.x === "number" ? el.x : null;
  const y = typeof el.y === "number" ? el.y : null;
  if (x === null || y === null) return null;
  if (el.type === "line" || el.type === "arrow") {
    const x2 = typeof el.x2 === "number" ? el.x2 : x;
    const y2 = typeof el.y2 === "number" ? el.y2 : y;
    const l = Math.min(x, x2);
    const r = Math.max(x, x2);
    const t = Math.min(y, y2);
    const b = Math.max(y, y2);
    return {
      l,
      r,
      t,
      b,
      cx: (l + r) / 2,
      cy: (t + b) / 2,
      type: String(el.type),
    };
  }
  const w = typeof el.width === "number" ? el.width : 0;
  const h = typeof el.height === "number" ? el.height : 0;
  return {
    l: x,
    r: x + w,
    t: y,
    b: y + h,
    cx: x + w / 2,
    cy: y + h / 2,
    type: String(el.type),
  };
}

function pointOnSide(b: Bounds, side: EdgeSide): { x: number; y: number } {
  switch (side) {
    case "up":
      return { x: b.cx, y: b.t };
    case "down":
      return { x: b.cx, y: b.b };
    case "left":
      return { x: b.l, y: b.cy };
    case "right":
      return { x: b.r, y: b.cy };
  }
}

// Heuristic: when fromSide / toSide are not specified, pick the axis with
// the larger center delta — horizontal layouts use left/right, vertical
// layouts use up/down. The two sides face each other.
function autoSides(from: Bounds, to: Bounds): { from: EdgeSide; to: EdgeSide } {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { from: "right", to: "left" }
      : { from: "left", to: "right" };
  }
  return dy >= 0 ? { from: "down", to: "up" } : { from: "up", to: "down" };
}

function expandConnectors(
  input: Record<string, unknown>[]
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const el of input) {
    if (typeof el.id === "string") byId.set(el.id, el);
  }
  return input.map((el) => {
    if (el.type !== "arrow" && el.type !== "line") return el;
    const fromId = typeof el.from === "string" ? el.from : null;
    const toId = typeof el.to === "string" ? el.to : null;
    if (!fromId && !toId) return el;

    const fromTarget = fromId ? byId.get(fromId) : undefined;
    const toTarget = toId ? byId.get(toId) : undefined;
    // Bindings to other connectors aren't structural — fall through and let
    // edge-snap (or the AI's own coords) decide.
    const fromBounds =
      fromTarget &&
      fromTarget.type !== "arrow" &&
      fromTarget.type !== "line"
        ? elementBounds(fromTarget)
        : null;
    const toBounds =
      toTarget &&
      toTarget.type !== "arrow" &&
      toTarget.type !== "line"
        ? elementBounds(toTarget)
        : null;

    let fromSide: EdgeSide | undefined =
      typeof el.fromSide === "string"
        ? (el.fromSide as EdgeSide)
        : undefined;
    let toSide: EdgeSide | undefined =
      typeof el.toSide === "string" ? (el.toSide as EdgeSide) : undefined;
    if (fromBounds && toBounds && (!fromSide || !toSide)) {
      const auto = autoSides(fromBounds, toBounds);
      fromSide = fromSide ?? auto.from;
      toSide = toSide ?? auto.to;
    }

    const next: Record<string, unknown> = { ...el };
    if (fromBounds && fromSide) {
      const p = pointOnSide(fromBounds, fromSide);
      next.x = p.x;
      next.y = p.y;
      next.startDir = fromSide;
      next.startConnectedTo = fromId;
    }
    if (toBounds && toSide) {
      const p = pointOnSide(toBounds, toSide);
      next.x2 = p.x;
      next.y2 = p.y;
      next.endDir = toSide;
      next.endConnectedTo = toId;
    }
    // Backstop — if the AI emitted a from/to referencing an unknown id (typo
    // or dropped element) AND emitted no fallback coords, fill the missing
    // endpoints with zeros so downstream code (toolbar number inputs, snap
    // pass, renderer) never sees undefined coordinates. The connector ends
    // up degenerate but visible, which is better than a runtime crash when
    // the user selects it.
    if (typeof next.x !== "number") next.x = 0;
    if (typeof next.y !== "number") next.y = 0;
    if (typeof next.x2 !== "number") next.x2 = typeof next.x === "number" ? next.x : 0;
    if (typeof next.y2 !== "number") next.y2 = typeof next.y === "number" ? next.y : 0;
    delete next.from;
    delete next.to;
    delete next.fromSide;
    delete next.toSide;
    return next;
  });
}

// Arrow presets — shorthand for the field cluster (lineStyle / headStyle /
// tailStyle / strokeWidth / stroke) that defines a connector's visual role.
// The model picks ONE preset; individual fields it also emits override the
// preset's defaults (so a "flow" arrow with explicit `stroke: "#ef4444"` ends
// up red but otherwise inherits flow defaults).
const ARROW_PRESETS = {
  flow: {
    lineStyle: "elbow",
    headStyle: "triangle",
    tailStyle: "none",
    strokeWidth: 1.5,
    stroke: "#475569",
  },
  sequence: {
    lineStyle: "straight",
    headStyle: "triangle",
    tailStyle: "none",
    strokeWidth: 1.5,
    stroke: "#1e293b",
  },
  data: {
    lineStyle: "straight",
    headStyle: "triangle",
    tailStyle: "none",
    strokeWidth: 2,
    stroke: "#3b82f6",
  },
  annotation: {
    lineStyle: "curved",
    headStyle: "open",
    tailStyle: "none",
    strokeWidth: 1,
    stroke: "#94a3b8",
  },
} as const;

type ArrowPreset = keyof typeof ARROW_PRESETS;

function expandPresets(
  input: Record<string, unknown>[]
): Record<string, unknown>[] {
  return input.map((el) => {
    if (el.type !== "arrow" && el.type !== "line") return el;
    const preset = el.preset;
    if (typeof preset !== "string" || !(preset in ARROW_PRESETS)) {
      // No preset (or unknown one) — strip the field so it doesn't leak into
      // the editor element shape, leave the rest untouched.
      if ("preset" in el) {
        const { preset: _drop, ...rest } = el;
        void _drop;
        return rest;
      }
      return el;
    }
    const defaults = ARROW_PRESETS[preset as ArrowPreset];
    const { preset: _drop, ...rest } = el;
    void _drop;
    // Explicit fields on `rest` win over preset defaults.
    return { ...defaults, ...rest };
  });
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
  input: Record<string, unknown>[]
): Record<string, unknown>[] {
  let elements = input;

  // Migrate legacy `type: "line"` to `type: "arrow"` with no head/tail.
  // The connector type was unified — all downstream code sees `arrow` only.
  // Default the head/tail to "none" so the result still looks like a line.
  for (const el of elements) {
    if (el.type === "line") {
      el.type = "arrow";
      if (typeof el.headStyle !== "string") el.headStyle = "none";
      if (typeof el.tailStyle !== "string") el.tailStyle = "none";
    }
  }

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
  // Connectors live in `rects` so endpoints can snap to a line's bounding box
  // (line-to-line crossings) — but they're NOT valid bind targets, only solid
  // elements are. Track the type separately so the binding pass can filter.
  const elementTypeById = new Map<string, string>();
  for (const el of elements) {
    if (el.type === "arrow") continue;
    if (typeof el.x !== "number" || typeof el.y !== "number") continue;
    if (typeof el.id === "string") {
      elementTypeById.set(el.id, String(el.type));
    }
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
      // Bind the endpoint to the matched element so the renderer can
      // recompute the attach point when the target moves / resizes. Skip
      // when the matched element is itself a connector — connector-to-
      // connector snaps are positional only, never structural.
      const targetType = elementTypeById.get(startHit.elementId);
      if (targetType && targetType !== "arrow" && targetType !== "line") {
        el.startConnectedTo = startHit.elementId;
      }
    }
    const endHit = snapEndpoint(el.x2 as number, el.y2 as number, selfId);
    if (endHit) {
      el.x2 = endHit.x;
      el.y2 = endHit.y;
      el.endDir = endHit.dir;
      const targetType = elementTypeById.get(endHit.elementId);
      if (targetType && targetType !== "arrow" && targetType !== "line") {
        el.endConnectedTo = endHit.elementId;
      }
    }
  }

  // Sequence-diagram alignment pass. Protocol diagrams have a strict
  // invariant the prompt spells out (ai-prompt.ts: "x == lifeline_x[A]
  // exactly, x2 == lifeline_x[B] exactly"), but the model still drifts on it
  // ~10–20% of the time — emitting `x = lifeline_x[A] + 24` or sourcing the
  // x from the actor icon's edge instead of the lifeline anchor. The general
  // edge-snap above only catches drift up to SNAP_TOL=5px, which isn't
  // enough; this pass extends the snap with a wider tolerance, but ONLY
  // when both endpoints land on distinct lifelines (the unambiguous
  // signature of a message arrow between two actors). Self-loops, diagonal
  // annotation arrows, and arrows in non-sequence figures are skipped.
  {
    type Lifeline = { id: string; x: number; topY: number; botY: number };
    const lifelines: Lifeline[] = [];
    for (const el of elements) {
      if (el.type !== "line") continue;
      if (typeof el.x !== "number" || typeof el.x2 !== "number") continue;
      if (typeof el.y !== "number" || typeof el.y2 !== "number") continue;
      // Lifeline = vertical line of non-trivial length. Anything shorter
      // than 50px is more likely a divider or short connector.
      if (Math.abs((el.x as number) - (el.x2 as number)) > 1) continue;
      const topY = Math.min(el.y as number, el.y2 as number);
      const botY = Math.max(el.y as number, el.y2 as number);
      if (botY - topY < 50) continue;
      lifelines.push({
        id: el.id as string,
        x: el.x as number,
        topY,
        botY,
      });
    }

    // Need ≥2 lifelines to invoke alignment — below that we can't
    // distinguish "sequence diagram" from "incidental vertical line."
    if (lifelines.length >= 2) {
      const lifelineIds = new Set(lifelines.map((l) => l.id));
      const anchors = Array.from(
        new Set(lifelines.map((l) => l.x))
      ).sort((a, b) => a - b);

      // Wider than SNAP_TOL=5 — covers the +24-style miss the prompt warns
      // about and the icon-bbox-derived endpoint pattern. Capped at 80px so
      // we don't pull in entirely unrelated arrows that happen to be near
      // a lifeline.
      const ANCHOR_SNAP_TOL = 80;
      const nearestAnchor = (cx: number): number | null => {
        let best: number | null = null;
        let bestDist = Infinity;
        for (const ax of anchors) {
          const d = Math.abs(cx - ax);
          if (d <= ANCHOR_SNAP_TOL && d < bestDist) {
            bestDist = d;
            best = ax;
          }
        }
        return best;
      };

      for (const el of elements) {
        if (el.type !== "arrow" && el.type !== "line") continue;
        if (lifelineIds.has(el.id as string)) continue;
        if (typeof el.x !== "number" || typeof el.x2 !== "number") continue;
        if (typeof el.y !== "number" || typeof el.y2 !== "number") continue;

        const dx = Math.abs((el.x2 as number) - (el.x as number));
        const dy = Math.abs((el.y2 as number) - (el.y as number));
        // Mostly-horizontal only. Rejects vertical lines (more lifelines)
        // and diagonal annotation arrows. Floor at 10px slope so a tiny
        // y-drift on a long horizontal arrow still passes.
        if (dy > Math.max(dx * 0.3, 10)) continue;

        const newX = nearestAnchor(el.x as number);
        const newX2 = nearestAnchor(el.x2 as number);
        // Snap only when BOTH endpoints land on lifelines AND on DIFFERENT
        // ones — the signature of a message between two actors. Skips
        // single-endpoint cases (annotation pointing at one lifeline) and
        // both-on-same-lifeline cases (self-loops, which already have the
        // correct x by construction since the model emits them as elbows).
        if (newX !== null && newX2 !== null && newX !== newX2) {
          el.x = newX;
          el.x2 = newX2;
          // A message arrow's two endpoints share y. Average to the nearest
          // grid-snapped row so a small per-endpoint y-drift doesn't tilt
          // the arrow.
          const avgY =
            Math.round(
              ((el.y as number) + (el.y2 as number)) / 2 / SNAP
            ) * SNAP;
          el.y = avgY;
          el.y2 = avgY;
        }
      }

      // Equalize lifeline bottoms. The prompt requires every lifeline to
      // share y2; the model often agrees within ±5px but occasionally
      // drifts further. Picking the max keeps every attached message
      // visible (no lifeline cut short).
      let maxBotY = -Infinity;
      for (const l of lifelines) {
        if (l.botY > maxBotY) maxBotY = l.botY;
      }
      // Also extend to cover horizontal message arrows on lifeline anchors.
      // When the model underestimates y2 for ALL lifelines (a common drift),
      // the lifeline-only max is still too short — the arrows end up below
      // the line's bottom. Apply the prompt's own rule: last_message_y + 40.
      for (const el of elements) {
        if (el.type !== "arrow" && el.type !== "line") continue;
        if (lifelineIds.has(el.id as string)) continue;
        if (typeof el.x !== "number" || typeof el.x2 !== "number") continue;
        if (typeof el.y !== "number" || typeof el.y2 !== "number") continue;
        const dx = Math.abs((el.x2 as number) - (el.x as number));
        const dy = Math.abs((el.y2 as number) - (el.y as number));
        if (dy > Math.max(dx * 0.3, 10)) continue;
        const a1 = nearestAnchor(el.x as number);
        const a2 = nearestAnchor(el.x2 as number);
        if (a1 === null && a2 === null) continue;
        const arrowY = Math.max(el.y as number, el.y2 as number);
        const neededBot = Math.round((arrowY + 40) / 5) * 5;
        if (neededBot > maxBotY) maxBotY = neededBot;
      }
      for (const el of elements) {
        if (!lifelineIds.has(el.id as string)) continue;
        // Also normalize the (y, y2) order in case the model emitted them
        // backwards — top stays as min, bottom becomes the shared max.
        const origTop = Math.min(el.y as number, el.y2 as number);
        el.y = origTop;
        el.y2 = maxBotY;
      }
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
      // Keep parentId iff it names a frame in THIS batch — create_canvas is
      // a fresh page, so there are no pre-existing frames to inherit.
      const inBatch = byId.has(pid) && frameIds.has(pid);
      if (!inBatch) {
        el.parentId = null;
        continue;
      }
      const bucket = childIdsByFrame.get(pid) ?? [];
      bucket.push(el.id as string);
      childIdsByFrame.set(pid, bucket);
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

  // Final defensive sweep — fill any still-missing fields with safe
  // defaults so the editor never receives undefined where the type expects
  // a value. Earlier passes handle most cases (snap fills numeric coords,
  // text-variant resolution fills font fields, etc.); this catches whatever
  // slipped through, including elements the AI emitted with sparse fields
  // that the loose-by-design type-specific schema didn't reject.
  for (const el of elements) {
    if (typeof el.rotation !== "number") el.rotation = 0;
    if (typeof el.opacity !== "number") el.opacity = 1;
    if (typeof el.zIndex !== "number") el.zIndex = 1;
    if (typeof el.fill !== "string") el.fill = "none";
    if (typeof el.stroke !== "string") el.stroke = "none";
    if (typeof el.strokeWidth !== "number") el.strokeWidth = 0;
    if (el.type === "arrow" || el.type === "line") {
      if (typeof el.x !== "number") el.x = 0;
      if (typeof el.y !== "number") el.y = 0;
      if (typeof el.x2 !== "number") el.x2 = el.x;
      if (typeof el.y2 !== "number") el.y2 = el.y;
      if (typeof el.width !== "number") el.width = 0;
      if (typeof el.height !== "number") el.height = 0;
      if (typeof el.lineStyle !== "string") el.lineStyle = "straight";
      if (typeof el.headStyle !== "string") {
        el.headStyle = el.type === "arrow" ? "triangle" : "none";
      }
      if (typeof el.tailStyle !== "string") el.tailStyle = "none";
    } else {
      if (typeof el.x !== "number") el.x = 0;
      if (typeof el.y !== "number") el.y = 0;
      if (typeof el.width !== "number") el.width = 0;
      if (typeof el.height !== "number") el.height = 0;
    }
    if (el.type === "text") {
      if (typeof el.content !== "string") el.content = "";
      if (typeof el.color !== "string") el.color = "#1e293b";
      if (typeof el.textAlign !== "string") el.textAlign = "left";
      if (typeof el.fontStyle !== "string") el.fontStyle = "normal";
      if (typeof el.borderRadius !== "number") el.borderRadius = 0;
    }
    if (el.type === "rectangle" && typeof el.borderRadius !== "number") {
      el.borderRadius = 0;
    }
    if (el.type === "icon") {
      if (typeof el.iconId !== "string") el.iconId = "";
      if (typeof el.color !== "string") el.color = "#1a1a1a";
    }
    if (el.type === "path") {
      if (typeof el.pathData !== "string") el.pathData = "";
      if (typeof el.viewBox !== "string") el.viewBox = "0 0 1 1";
    }
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Tool input schema — discriminated per element type so the API rejects
// malformed elements before they reach normalizeElements.
// ---------------------------------------------------------------------------

// Fields every element shares. Position is required; everything else has
// either a sane server default or is optional.
const COMMON_PROPS = {
  id: { type: "string" },
  x: { type: "number" },
  y: { type: "number" },
  width: { type: "number" },
  height: { type: "number" },
  rotation: { type: "number" },
  opacity: { type: "number" },
  zIndex: { type: "number" },
  fill: { type: "string" },
  stroke: { type: "string" },
  strokeWidth: { type: "number" },
  strokeStyle: { enum: ["solid", "dashed", "dotted"] },
  parentId: { type: ["string", "null"] },
  groupId: { type: "string" },
  aspectLocked: { type: "boolean" },
} as const;

const COMMON_REQUIRED = ["id", "type", "x", "y"] as const;

// Connectors don't use width/height — endpoints are (x, y) → (x2, y2),
// optionally derived from `from` / `to` element bindings.
const SIDE_ENUM = { enum: ["up", "right", "down", "left"] } as const;
const CONNECTOR_COMMON = {
  id: COMMON_PROPS.id,
  x: COMMON_PROPS.x,
  y: COMMON_PROPS.y,
  x2: { type: "number" },
  y2: { type: "number" },
  from: { type: "string" },
  to: { type: "string" },
  fromSide: SIDE_ENUM,
  toSide: SIDE_ENUM,
  rotation: COMMON_PROPS.rotation,
  opacity: COMMON_PROPS.opacity,
  zIndex: COMMON_PROPS.zIndex,
  fill: COMMON_PROPS.fill,
  stroke: COMMON_PROPS.stroke,
  strokeWidth: COMMON_PROPS.strokeWidth,
  strokeStyle: COMMON_PROPS.strokeStyle,
  parentId: COMMON_PROPS.parentId,
  groupId: COMMON_PROPS.groupId,
  width: COMMON_PROPS.width,
  height: COMMON_PROPS.height,
  lineStyle: { enum: ["straight", "curved", "elbow"] },
  headStyle: { enum: ["triangle", "open", "none"] },
  tailStyle: { enum: ["none", "triangle", "open"] },
  label: { type: "string" },
} as const;

const ELEMENT_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [...COMMON_REQUIRED, "width", "height"],
      properties: {
        ...COMMON_PROPS,
        type: { const: "rectangle" },
        borderRadius: { type: "number" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...COMMON_REQUIRED, "width", "height"],
      properties: {
        ...COMMON_PROPS,
        type: { const: "circle" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "type"],
      properties: {
        ...CONNECTOR_COMMON,
        type: { const: "arrow" },
        preset: { enum: ["flow", "sequence", "data", "annotation"] },
        sourceLabel: { type: "string" },
        targetLabel: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...COMMON_REQUIRED, "content", "color"],
      properties: {
        ...COMMON_PROPS,
        type: { const: "text" },
        content: { type: "string" },
        color: { type: "string" },
        variant: { enum: ["heading", "subheading", "body", "caption"] },
        fontSize: { type: "number" },
        fontWeight: { enum: ["normal", "bold"] },
        fontStyle: { enum: ["normal", "italic"] },
        textAlign: { enum: ["left", "center", "right"] },
        verticalAlign: { enum: ["top", "middle", "bottom"] },
        borderRadius: { type: "number" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...COMMON_REQUIRED, "iconId", "color"],
      properties: {
        ...COMMON_PROPS,
        type: { const: "icon" },
        iconId: { type: "string" },
        color: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...COMMON_REQUIRED, "width", "height"],
      properties: {
        ...COMMON_PROPS,
        type: { const: "frame" },
        cornerRadius: { type: "number" },
        clipContent: { type: "boolean" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...COMMON_REQUIRED, "width", "height", "pathData", "viewBox"],
      properties: {
        ...COMMON_PROPS,
        type: { const: "path" },
        pathData: { type: "string" },
        viewBox: { type: "string" },
      },
    },
  ],
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_canvas",
    description:
      "Create a brand-new canvas page populated with a complete figure based on the user's request.",
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
            "The full set of elements that make up the figure. Each element follows the Element Type Reference from the system prompt.",
          items: ELEMENT_SCHEMA,
        },
      },
      required: ["title", "elements"],
    },
  },
];

type CreateCanvasCall = {
  tool: "create_canvas";
  title: string;
  elements: unknown[];
};

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let prompt: string;
    let imageBase64: string | null = null;
    let imageMediaType: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      prompt = (formData.get("prompt") as string) || "";
      const file = formData.get("image") as File | null;

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
      tool_choice: { type: "tool", name: "create_canvas" },
      messages: [{ role: "user", content: userContent }],
    });

    let toolCall: CreateCanvasCall | null = null;
    let text = "";
    for (const block of message.content) {
      if (block.type === "text") {
        text += block.text;
        continue;
      }
      if (block.type !== "tool_use") continue;
      if (block.name !== "create_canvas") continue;
      const input = (block.input ?? {}) as Record<string, unknown>;
      const elements = Array.isArray(input.elements)
        ? normalizeElements(
            expandConnectors(
              expandPresets(
                resolveTokens(input.elements as Record<string, unknown>[])
              )
            )
          )
        : [];
      const title =
        typeof input.title === "string" && input.title.trim()
          ? input.title.trim()
          : "Untitled";
      toolCall = { tool: "create_canvas", title, elements };
    }

    return Response.json({ text: text.trim(), toolCall });
  } catch (error) {
    console.error("AI generation error:", error);
    return Response.json(
      { error: "Failed to generate figure" },
      { status: 500 }
    );
  }
}
