import { create } from "zustand";
import type {
  ArrowElement,
  EditorElement,
  LineElement,
  Tool,
  CanvasState,
} from "@/types/editor";
import {
  HISTORY_LIMIT,
  MIN_ZOOM,
  MAX_ZOOM,
  type TextVariant,
} from "@/lib/constants";
import type { FlowchartShape } from "@/lib/flowchart-shapes";
import { applyCascadeReflow, type PlannedSnapshot } from "@/lib/reflow";
import { resolveConnectorWithMap } from "@/lib/connector-geometry";

export type MarqueeRect = { x: number; y: number; w: number; h: number };

// Cursor position in canvas (pre-pan, pre-zoom) coordinates. Updated by the
// canvas mousemove handler and by the right-click context menu trigger so
// that paste can place elements where the user is actually pointing.
let lastCanvasCursor: { x: number; y: number } | null = null;
export function setCanvasCursorPos(p: { x: number; y: number } | null) {
  lastCanvasCursor = p;
}
export function getCanvasCursorPos() {
  return lastCanvasCursor;
}

// Selection sync helpers: selectedElementId mirrors selectedElementIds when the
// set has exactly one entry, and is null otherwise. Single-selection consumers
// (editing UI, SelectionHandles, FloatingToolbar) can keep reading the single
// field; multi-select-aware code uses the array directly.
function withSel(ids: string[]) {
  return {
    selectedElementIds: ids,
    selectedElementId: ids.length === 1 ? ids[0] : null,
  };
}

export type Page = {
  id: string;
  title: string;
  elements: EditorElement[];
  history: EditorElement[][];
  future: EditorElement[][];
};

export type SmartFigureMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  image?: string;
  timestamp: number;
};

type EditorStore = {
  // Pages
  pages: Page[];
  currentPageId: string;

  // Current page state (synced with active page)
  elements: EditorElement[];
  selectedElementId: string | null;
  selectedElementIds: string[];
  tool: Tool;
  canvas: CanvasState;
  /** Title of the *project* (shown in the top bar). Each page/canvas has its
   *  own `title` field; project title is separate and stored alongside it. */
  projectTitle: string;
  marquee: MarqueeRect | null;

  // History (per page, synced)
  history: EditorElement[][];
  future: EditorElement[][];

  // Element CRUD
  addElement: (element: EditorElement) => void;
  updateElement: (id: string, updates: Partial<EditorElement>) => void;
  updateElementLive: (id: string, updates: Partial<EditorElement>) => void;
  /** Bulk live-update: applies multiple per-element partials in a single
   *  set() so a drag frame that moves a group + its attached connectors
   *  only fires one subscriber notification, not N. Mutators that used to
   *  loop `updateElementLive` should collect their updates and call this
   *  once per frame. */
  updateElementsLive: (updates: Map<string, Partial<EditorElement>>) => void;
  pushHistory: () => void;
  deleteElement: (id: string) => void;
  deleteElements: (ids: string[]) => void;
  setElements: (elements: EditorElement[]) => void;

  // Selection
  selectElement: (id: string | null) => void;
  toggleSelectElement: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  selectAll: () => void;
  setMarquee: (rect: MarqueeRect | null) => void;

  // Clipboard
  clipboard: EditorElement[];
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: () => void;

  // Tool
  setTool: (tool: Tool) => void;

  // Canvas
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  /** Canvas writes its measured SVG rect here on mount and on resize so
   *  the pan/zoom clamp knows how much viewport we're panning within.
   *  Also re-clamps the current pan — a shrinking window can push the
   *  existing pan out of bounds. */
  setViewportSize: (width: number, height: number) => void;
  fitView: () => void;
  showGrid: boolean;
  toggleGrid: () => void;

  // History
  undo: () => void;
  redo: () => void;

  // Bulk
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  duplicateElement: (id: string) => void;
  /** Swap an element's identity (icon ↔ icon, shape ↔ shape, icon ↔ shape)
   *  while preserving its bounding box, rotation, z-order, group, and
   *  aspect-lock flag. Color/stroke carry over too; template-specific
   *  fields (iconId, pathData, borderRadius, …) come from the template. */
  replaceElement: (id: string, template: ReplaceTemplate) => void;

  // Title
  setProjectTitle: (title: string) => void;

  // Snap target highlight (shown when dragging arrow/line endpoint near an element)
  snapTargetId: string | null;
  setSnapTargetId: (id: string | null) => void;

  // Element currently being rotated via its rotation handle — surfaced so
  // the selection UI can light up the handle's glow only while the user is
  // actively holding it (not persistently whenever rotation is 0/45/90/…).
  rotatingElementId: string | null;
  setRotatingElementId: (id: string | null) => void;

  // Hovered element (shown when pointer is over an element on the canvas)
  hoveredElementId: string | null;
  setHoveredElementId: (id: string | null) => void;

  // Grouping
  groupElements: (ids: string[]) => void;
  ungroupElement: (id: string) => void;
  /** The group currently "entered" for individual-member editing (via
   *  double-click). While set, click/drag on its members acts per-member
   *  instead of group-as-a-unit. Cleared by Escape, tool change, page
   *  switch, or clicking outside the group. */
  editingGroupId: string | null;
  setEditingGroupId: (id: string | null) => void;
  /** The text element currently in rich-text edit mode. Set by TextElement
   *  on double-click, cleared on blur or tool change. Drives the floating
   *  text-format toolbar overlay. */
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  editingConnectorId: string | null;
  setEditingConnectorId: (id: string | null) => void;
  /** One-shot signal: the text element whose id matches should auto-enter
   *  edit mode on mount with its entire content selected, so the user can
   *  type and immediately replace the placeholder. TextElement clears this
   *  the moment it consumes it. */
  autoEditTextId: string | null;
  setAutoEditTextId: (id: string | null) => void;
  /** Variant used when placing a new text element — heading / subheading /
   *  body / caption. Chosen from the sidebar; persists across placements so
   *  the user can drop several of the same kind in a row. */
  textVariant: TextVariant;
  setTextVariant: (v: TextVariant) => void;
  /** Flowchart shape awaiting placement. When non-null and tool is "path",
   *  mouse-down on the canvas starts drawing this shape exactly like the
   *  rectangle/circle tools — drag to size, click to stamp default size. */
  pendingPathShape: FlowchartShape | null;
  setPendingPathShape: (shape: FlowchartShape | null) => void;

  // Page management
  addPage: (title?: string) => string;
  deletePage: (id: string) => void;
  switchPage: (id: string) => void;
  renamePage: (id: string, title: string) => void;
  duplicatePage: (id: string) => void;
  /** Add a new page with pre-populated elements (used by AI generate) */
  addPageWithElements: (title: string, elements: EditorElement[]) => string;
  /** Append AI-generated elements to the current page. Offsets are left as
   *  emitted by the model — it's up to the caller to place them sensibly. */
  addElementsToCurrentPage: (elements: EditorElement[]) => void;

  /** Set of text element IDs waiting to report their rendered height after
   *  an AI generate. Non-null only while a generation is still finalizing
   *  its layout. The canvas overlay is shown while this is non-null. */
  pendingMeasure: {
    textIds: Set<string>;
    /** Snapshot of every element's emitted position + size at generation
     *  time. The cascade reflow compares measured heights against this
     *  snapshot's heights to derive deltas, and uses the snapshot's
     *  coordinates so one text's shift doesn't contaminate another's
     *  follower check. */
    originals: Map<string, PlannedSnapshot>;
  } | null;
  /** Called by TextElement once it has measured its `scrollHeight` after
   *  first mount. Writes the measured height into the element, removes the
   *  id from `pendingMeasure.textIds`, and — when the set empties — fires
   *  the cascade reflow so downstream elements snap to the real layout. */
  reportMeasuredHeight: (id: string, height: number) => void;

  // Smart Figure panel (bottom chat)
  smartFigureOpen: boolean;
  toggleSmartFigure: () => void;
  setSmartFigureOpen: (open: boolean) => void;
  smartFigureMessages: SmartFigureMessage[];
  appendSmartFigureMessage: (msg: SmartFigureMessage) => void;

  // Persistence — dirty tracking lets the auto-save hook serialize and send
  // only the pages that actually changed since the last successful save
  // instead of the whole project on every keystroke. History/future are
  // intentionally dropped from the wire payload: undo is client-only session
  // state, and persisting it would bloat rows with no user value.
  dirtyPageIds: Set<string>;
  deletedPageIds: Set<string>;
  projectDirty: boolean;
  getDirtyDelta: () => DirtyDelta;
  markSaved: (saved: SavedSignatures) => void;
  loadProject: (projectTitle: string, snapshot: SerializedProject) => void;
};

/** Templates consumed by `replaceElement`. Each variant names the target
 *  shape or asset; everything positional (x/y/width/height/rotation/zIndex)
 *  is copied from the element being replaced. */
export type ReplaceTemplate =
  | { kind: "icon"; iconId: string }
  | { kind: "rectangle" }
  | { kind: "circle" }
  | { kind: "flowchart"; pathData: string; viewBox: string; shapeId?: string };

export type SerializedPage = {
  id: string;
  title: string;
  elements: EditorElement[];
};

export type SerializedProject = {
  projectTitle: string;
  pages: SerializedPage[];
  currentPageId: string;
};

/** Per-page payload sent by `getDirtyDelta`. Only pages in the store's
 *  `dirtyPageIds` set appear here; each entry carries the page's current
 *  title and elements. `currentPageId` is forwarded so the server can
 *  persist which page the user had open for a later reload. */
export type DirtyDelta = {
  projectTitle: string;
  projectDirty: boolean;
  pages: SerializedPage[];
  deletedIds: string[];
  currentPageId: string;
};

/** What `markSaved` is told. Page signatures let the store clear dirty
 *  flags only for pages whose content still matches what was persisted —
 *  preserves mid-save mutations so the next save round picks them up. */
export type SavedSignatures = {
  pageSignatures: Array<[pageId: string, sentHash: string]>;
  deletedIds: string[];
  projectSignature?: string;
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Page IDs must be DB-compatible UUIDs because each page round-trips to one
// row in the `figures` table. Element IDs stay short since they live inside
// JSONB and never cross the row boundary.
function generatePageId(): string {
  return crypto.randomUUID();
}

function createPage(title: string): Page {
  return {
    id: generatePageId(),
    title,
    elements: [],
    history: [],
    future: [],
  };
}

/** Add a pageId to the dirty set without churning identity when it's
 *  already present. Called by every mutator that touches saveable state
 *  (elements, page title, page add/delete). Returning the same Set when
 *  already-dirty lets the persistence hook's subscribe short-circuit. */
function addDirty(set: Set<string>, id: string): Set<string> {
  if (set.has(id)) return set;
  const next = new Set(set);
  next.add(id);
  return next;
}

/** Serialize one page's saveable shape for signature comparison. Kept in
 *  the store module so the shape stays consistent with what the hook
 *  hashes and with what the server action ultimately writes. */
function pageSignature(page: { title: string; elements: EditorElement[] }): string {
  return JSON.stringify({ title: page.title, elements: page.elements });
}


/** Module-level cache for `sortedElementIds`. Keyed by `elements` identity so
 *  a content-only mutation (element moved/resized) can still short-circuit to
 *  the prior array reference when the id/zIndex order is unchanged — that's
 *  what lets the Canvas subscription skip the per-frame re-render. */
let sortedIdsCache: {
  elements: EditorElement[] | null;
  ids: string[];
} = { elements: null, ids: [] };

/** IDs of all elements sorted by zIndex, with stable reference semantics:
 *  returns the previous array when the ID list is content-identical to last
 *  invocation. That way a Zustand selector like `s => sortedElementIds(s.elements)`
 *  keeps `===` on element content mutations, only returning a fresh array
 *  when something was added/removed or zIndex changed. */
export function sortedElementIds(elements: EditorElement[]): string[] {
  if (elements === sortedIdsCache.elements) return sortedIdsCache.ids;
  // Sort by zIndex, then by index as a tie-breaker so the order is stable.
  const indexed = elements.map((e, i) => ({ id: e.id, z: e.zIndex, i }));
  indexed.sort((a, b) => a.z - b.z || a.i - b.i);
  const next = indexed.map((x) => x.id);
  const prev = sortedIdsCache.ids;
  if (next.length === prev.length) {
    let same = true;
    for (let i = 0; i < next.length; i++) {
      if (next[i] !== prev[i]) {
        same = false;
        break;
      }
    }
    if (same) {
      sortedIdsCache = { elements, ids: prev };
      return prev;
    }
  }
  sortedIdsCache = { elements, ids: next };
  return next;
}

/** Module-level cache for `elementsById`. Keyed by `elements` identity — one
 *  Map per array instance. Built lazily on first lookup so subscribers that
 *  never ask for a specific id skip the O(N) index build. */
const elementByIdCache = new WeakMap<EditorElement[], Map<string, EditorElement>>();

/** O(1) lookup of an element by id, with an index cache keyed on the elements
 *  array. Much cheaper than `elements.find()` when multiple subscribers are
 *  looking up by id in the same frame. */
export function elementById(
  elements: EditorElement[],
  id: string
): EditorElement | undefined {
  let map = elementByIdCache.get(elements);
  if (!map) {
    map = new Map();
    for (const el of elements) map.set(el.id, el);
    elementByIdCache.set(elements, map);
  }
  return map.get(id);
}


/** Save current working state into the pages array. Only copies `elements`
 *  (and history snapshots) — page title edits go through `renamePage` which
 *  writes straight into the pages array, so there's no mirror to flush. */
function saveCurrentPageState(state: EditorStore): Page[] {
  return state.pages.map((p) =>
    p.id === state.currentPageId
      ? {
          ...p,
          elements: state.elements,
          history: state.history,
          future: state.future,
        }
      : p
  );
}

export const useEditorStore = create<EditorStore>((set, get) => {
  const firstPage = createPage("Canvas 1");

  return {
    // Pages
    pages: [firstPage],
    currentPageId: firstPage.id,

    // Current state
    elements: [],
    selectedElementId: null,
    selectedElementIds: [],
    tool: "select",
    canvas: { zoom: 1, panX: 0, panY: 0, viewportWidth: 0, viewportHeight: 0 },
    projectTitle: "Untitled Project",
    marquee: null,
    clipboard: [],
    history: [],
    future: [],
    snapTargetId: null,
    rotatingElementId: null,
    hoveredElementId: null,
    editingGroupId: null,
    editingTextId: null,
    editingConnectorId: null,
    autoEditTextId: null,
    textVariant: "body",
    showGrid: true,
    pendingPathShape: null,
    smartFigureOpen: false,
    smartFigureMessages: [],
    pendingMeasure: null,
    dirtyPageIds: new Set<string>(),
    deletedPageIds: new Set<string>(),
    projectDirty: false,

    // ---------------------------------------------------------------
    // Element CRUD (all operate on current page's elements)
    // ---------------------------------------------------------------

    addElement: (element) => {
      const state = get();
      const newHistory = [
        ...state.history.slice(-HISTORY_LIMIT),
        state.elements,
      ];
      set({
        elements: [...state.elements, element],
        history: newHistory,
        future: [],
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    updateElement: (id, updates) => {
      const state = get();
      const newHistory = [
        ...state.history.slice(-HISTORY_LIMIT),
        state.elements,
      ];
      set({
        elements: state.elements.map((el) =>
          el.id === id ? ({ ...el, ...updates } as EditorElement) : el
        ),
        history: newHistory,
        future: [],
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    updateElementLive: (id, updates) => {
      set((state) => ({
        elements: state.elements.map((el) =>
          el.id === id ? ({ ...el, ...updates } as EditorElement) : el
        ),
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      }));
    },

    updateElementsLive: (updates) => {
      if (updates.size === 0) return;
      set((state) => ({
        elements: state.elements.map((el) => {
          const u = updates.get(el.id);
          return u ? ({ ...el, ...u } as EditorElement) : el;
        }),
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      }));
    },

    pushHistory: () => {
      const state = get();
      set({
        history: [...state.history.slice(-HISTORY_LIMIT), state.elements],
        future: [],
      });
    },

    deleteElement: (id) => {
      const state = get();
      const newHistory = [
        ...state.history.slice(-HISTORY_LIMIT),
        state.elements,
      ];
      const remainingIds = state.selectedElementIds.filter((sid) => sid !== id);
      set({
        elements: state.elements.filter((el) => el.id !== id),
        history: newHistory,
        future: [],
        ...withSel(remainingIds),
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    deleteElements: (ids) => {
      if (ids.length === 0) return;
      const state = get();
      const idSet = new Set(ids);
      const newHistory = [
        ...state.history.slice(-HISTORY_LIMIT),
        state.elements,
      ];
      const remainingIds = state.selectedElementIds.filter(
        (sid) => !idSet.has(sid)
      );
      set({
        elements: state.elements.filter((el) => !idSet.has(el.id)),
        history: newHistory,
        future: [],
        ...withSel(remainingIds),
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    setElements: (elements) => {
      const state = get();
      const newHistory = [
        ...state.history.slice(-HISTORY_LIMIT),
        state.elements,
      ];
      set({
        elements,
        history: newHistory,
        future: [],
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    selectElement: (id) => set(withSel(id ? [id] : [])),

    toggleSelectElement: (id) => {
      const cur = get().selectedElementIds;
      const next = cur.includes(id)
        ? cur.filter((i) => i !== id)
        : [...cur, id];
      set(withSel(next));
    },

    selectMultiple: (ids) => set(withSel(ids)),

    selectAll: () => {
      const ids = get().elements.map((el) => el.id);
      set(withSel(ids));
    },

    setMarquee: (rect) => set({ marquee: rect }),

    copySelection: () => {
      const state = get();
      if (state.selectedElementIds.length === 0) return;
      const idSet = new Set(state.selectedElementIds);
      // Snapshot — strip groupId so the paste creates standalone elements,
      // not invisible group ghosts pointing at the originals' group.
      const snapshot = state.elements
        .filter((el) => idSet.has(el.id))
        .map((el) => ({ ...el, groupId: undefined }) as EditorElement);
      set({ clipboard: snapshot });
    },

    cutSelection: () => {
      const state = get();
      if (state.selectedElementIds.length === 0) return;
      get().copySelection();
      get().deleteElements(state.selectedElementIds);
    },

    pasteClipboard: () => {
      const state = get();
      if (state.clipboard.length === 0) return;

      // Compute clipboard bbox so we can center the paste on the cursor (or
      // fall back to a +20 shift if the cursor has never entered the canvas).
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of state.clipboard) {
        if (el.type === "line" || el.type === "arrow") {
          const c = el as EditorElement & { x2: number; y2: number };
          minX = Math.min(minX, c.x, c.x2);
          minY = Math.min(minY, c.y, c.y2);
          maxX = Math.max(maxX, c.x, c.x2);
          maxY = Math.max(maxY, c.y, c.y2);
        } else {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width);
          maxY = Math.max(maxY, el.y + el.height);
        }
      }

      let dx = 20;
      let dy = 20;
      const cursor = getCanvasCursorPos();
      if (cursor) {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        // Snap the offset to the canvas's quarter-grid (5px) so pasted
        // elements stay aligned with everything else.
        const SNAP = 5;
        dx = Math.round((cursor.x - cx) / SNAP) * SNAP;
        dy = Math.round((cursor.y - cy) / SNAP) * SNAP;
      }

      const baseZ = state.elements.length;
      const fresh = state.clipboard.map((el, i) => {
        const next = {
          ...el,
          id: generateId(),
          x: el.x + dx,
          y: el.y + dy,
          zIndex: baseZ + i,
        } as EditorElement;
        if (next.type === "line" || next.type === "arrow") {
          (next as EditorElement & { x2: number; y2: number }).x2 =
            (el as EditorElement & { x2: number }).x2 + dx;
          (next as EditorElement & { x2: number; y2: number }).y2 =
            (el as EditorElement & { y2: number }).y2 + dy;
        }
        return next;
      });
      const newHistory = [
        ...state.history.slice(-HISTORY_LIMIT),
        state.elements,
      ];
      set({
        elements: [...state.elements, ...fresh],
        history: newHistory,
        future: [],
        ...withSel(fresh.map((el) => el.id)),
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    setTool: (tool) =>
      set((state) => ({
        tool,
        ...withSel([]),
        editingGroupId: null,
        editingConnectorId: null,
        editingTextId: null,
        autoEditTextId: null,
        // Switching to any tool other than "path" drops the pending shape so
        // the next "path" activation must re-select which flowchart to stamp.
        pendingPathShape: tool === "path" ? state.pendingPathShape : null,
      })),

    setPendingPathShape: (shape) => set({ pendingPathShape: shape }),

    setZoom: (zoom) =>
      set((state) => ({ canvas: { ...state.canvas, zoom } })),

    setPan: (panX, panY) =>
      set((state) => ({ canvas: { ...state.canvas, panX, panY } })),

    setViewportSize: (viewportWidth, viewportHeight) =>
      set((state) => ({
        canvas: { ...state.canvas, viewportWidth, viewportHeight },
      })),

    fitView: () => {
      const { elements, canvas } = get();
      const { viewportWidth, viewportHeight } = canvas;
      if (viewportWidth === 0 || viewportHeight === 0 || elements.length === 0) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of elements) {
        const half = (el.strokeWidth ?? 0) / 2;
        if (el.type === "line" || el.type === "arrow") {
          const c = el as ArrowElement | LineElement;
          minX = Math.min(minX, c.x - half, c.x2 - half);
          minY = Math.min(minY, c.y - half, c.y2 - half);
          maxX = Math.max(maxX, c.x + half, c.x2 + half);
          maxY = Math.max(maxY, c.y + half, c.y2 + half);
        } else {
          minX = Math.min(minX, el.x - half);
          minY = Math.min(minY, el.y - half);
          maxX = Math.max(maxX, el.x + el.width + half);
          maxY = Math.max(maxY, el.y + el.height + half);
        }
      }

      const MARGIN = 60;
      const zoom = Math.max(MIN_ZOOM, Math.min(
        (viewportWidth - MARGIN * 2) / (maxX - minX),
        (viewportHeight - MARGIN * 2) / (maxY - minY),
        MAX_ZOOM
      ));
      const panX = viewportWidth / 2 - ((minX + maxX) / 2) * zoom;
      const panY = viewportHeight / 2 - ((minY + maxY) / 2) * zoom;
      set((s) => ({ canvas: { ...s.canvas, zoom, panX, panY } }));
    },

    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

    undo: () => {
      const state = get();
      if (state.history.length === 0) return;
      const previous = state.history[state.history.length - 1];
      set({
        elements: previous,
        history: state.history.slice(0, -1),
        future: [state.elements, ...state.future],
        ...withSel([]),
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    redo: () => {
      const state = get();
      if (state.future.length === 0) return;
      const next = state.future[0];
      set({
        elements: next,
        history: [...state.history, state.elements],
        future: state.future.slice(1),
        ...withSel([]),
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    bringToFront: (id) => {
      const state = get();
      const maxZ = Math.max(...state.elements.map((el) => el.zIndex), 0);
      set({
        elements: state.elements.map((el) =>
          el.id === id ? { ...el, zIndex: maxZ + 1 } : el
        ) as EditorElement[],
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    sendToBack: (id) => {
      const state = get();
      const minZ = Math.min(...state.elements.map((el) => el.zIndex), 0);
      set({
        elements: state.elements.map((el) =>
          el.id === id ? { ...el, zIndex: minZ - 1 } : el
        ) as EditorElement[],
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    replaceElement: (id, template) => {
      const state = get();
      const el = state.elements.find((e) => e.id === id);
      if (!el) return;
      // Carry over every field that describes WHERE the element sits and HOW
      // it's styled; per-type content fields (iconId, pathData, …) are
      // overwritten from the template below.
      const base = {
        id: el.id,
        parentId: el.parentId,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        fill: el.fill,
        stroke: el.stroke,
        strokeWidth: el.strokeWidth,
        strokeStyle: el.strokeStyle,
        opacity: el.opacity,
        zIndex: el.zIndex,
        groupId: el.groupId,
        aspectLocked: el.aspectLocked,
      };

      // color lives on icon + text elements; reuse it when the source had one
      // so swapping two icons preserves the tint the user picked.
      const priorColor =
        "color" in el && typeof (el as { color?: unknown }).color === "string"
          ? (el as { color: string }).color
          : "#1a1a1a";
      // borderRadius lives on rectangle; reuse so a rectangle→rectangle
      // replace (e.g. swapping the fill-holding container of a composite)
      // keeps the rounded corners.
      const priorRadius =
        el.type === "rectangle" ? el.borderRadius : 0;

      let replacement: EditorElement;
      switch (template.kind) {
        case "icon":
          replacement = {
            ...base,
            type: "icon",
            iconId: template.iconId,
            color: priorColor,
          };
          break;
        case "rectangle":
          replacement = {
            ...base,
            type: "rectangle",
            borderRadius: priorRadius,
          };
          break;
        case "circle":
          // CircleElement renders as an ellipse when width ≠ height, so a
          // non-square source stays visually intact until the user resizes.
          replacement = { ...base, type: "circle" };
          break;
        case "flowchart":
          replacement = {
            ...base,
            type: "path",
            pathData: template.pathData,
            viewBox: template.viewBox,
            shapeId: template.shapeId,
          };
          break;
      }

      const newHistory = [
        ...state.history.slice(-HISTORY_LIMIT),
        state.elements,
      ];
      set({
        elements: state.elements.map((e) => (e.id === id ? replacement : e)),
        history: newHistory,
        future: [],
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    duplicateElement: (id) => {
      const state = get();
      const element = state.elements.find((el) => el.id === id);
      if (!element) return;
      const newElement = {
        ...element,
        id: generateId(),
        x: element.x + 20,
        y: element.y + 20,
      } as EditorElement;
      const newHistory = [
        ...state.history.slice(-HISTORY_LIMIT),
        state.elements,
      ];
      set({
        elements: [...state.elements, newElement],
        history: newHistory,
        future: [],
        ...withSel([newElement.id]),
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    setProjectTitle: (title) =>
      set((state) => ({
        projectTitle: title,
        projectDirty: state.projectDirty || title !== state.projectTitle,
      })),

    setSnapTargetId: (id) => set({ snapTargetId: id }),

    setRotatingElementId: (id) => set({ rotatingElementId: id }),
    setHoveredElementId: (id) => set({ hoveredElementId: id }),

    groupElements: (ids) => {
      if (ids.length < 2) return;
      const state = get();
      const groupId = generateId();
      const newHistory = [...state.history.slice(-HISTORY_LIMIT), state.elements];
      set({
        elements: state.elements.map((el) =>
          ids.includes(el.id) ? { ...el, groupId } as EditorElement : el
        ),
        history: newHistory,
        future: [],
        editingGroupId: null,
        editingConnectorId: null,
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    ungroupElement: (id) => {
      const state = get();
      const el = state.elements.find((e) => e.id === id);
      if (!el?.groupId) return;
      const gid = el.groupId;
      const newHistory = [...state.history.slice(-HISTORY_LIMIT), state.elements];
      set({
        elements: state.elements.map((e) =>
          e.groupId === gid ? { ...e, groupId: undefined } as EditorElement : e
        ),
        history: newHistory,
        future: [],
        editingGroupId: state.editingGroupId === gid ? null : state.editingGroupId,
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
      });
    },

    setEditingGroupId: (id) => set({ editingGroupId: id }),

    setEditingTextId: (id) => set({ editingTextId: id }),

    setEditingConnectorId: (id) => set({ editingConnectorId: id }),

    setAutoEditTextId: (id) => set({ autoEditTextId: id }),

    setTextVariant: (v) => set({ textVariant: v }),

    // ---------------------------------------------------------------
    // Page management
    // ---------------------------------------------------------------

    addPage: (title) => {
      const state = get();
      const updatedPages = saveCurrentPageState(state);
      const newPage = createPage(title || `Canvas ${state.pages.length + 1}`);
      set({
        pages: [...updatedPages, newPage],
        currentPageId: newPage.id,
        elements: [],
        ...withSel([]),
        history: [],
        future: [],
        canvas: { ...state.canvas, zoom: 1, panX: 0, panY: 0 },
        tool: "select",
        dirtyPageIds: addDirty(state.dirtyPageIds, newPage.id),
      });
      return newPage.id;
    },

    addElementsToCurrentPage: (incoming) => {
      if (incoming.length === 0) return;
      const state = get();
      const baseZ = state.elements.reduce(
        (m, el) => Math.max(m, el.zIndex),
        0
      );
      // Re-key IDs and re-stack zIndex so the new batch lands on top
      // without colliding with existing ids. parentId / childIds are
      // rewritten through the same id map so AI-emitted hierarchy survives
      // the id churn; parentIds that point at pre-existing canvas frames
      // pass through untouched.
      const idRemap = new Map<string, string>();
      for (const el of incoming) idRemap.set(el.id, generateId());
      const existingIds = new Set(state.elements.map((el) => el.id));
      const stamped = incoming.map((el, i) => {
        const newId = idRemap.get(el.id)!;
        let newParentId: string | null = null;
        if (typeof el.parentId === "string") {
          if (idRemap.has(el.parentId)) {
            newParentId = idRemap.get(el.parentId)!;
          } else if (existingIds.has(el.parentId)) {
            newParentId = el.parentId;
          }
        }
        const next = {
          ...el,
          id: newId,
          zIndex: baseZ + i + 1,
          parentId: newParentId,
        } as EditorElement;
        if (next.type === "frame") {
          next.childIds = next.childIds
            .map((cid) => idRemap.get(cid))
            .filter((cid): cid is string => typeof cid === "string");
        }
        return next;
      }) as EditorElement[];
      // Existing frames pick up any new children that claimed them via
      // parentId — grow their childIds so rendering walks descendant
      // correctly and delete-cascade logic later can find them.
      const joinersByFrame = new Map<string, string[]>();
      for (const el of stamped) {
        if (el.parentId && existingIds.has(el.parentId)) {
          const bucket = joinersByFrame.get(el.parentId) ?? [];
          bucket.push(el.id);
          joinersByFrame.set(el.parentId, bucket);
        }
      }
      const mergedExisting =
        joinersByFrame.size === 0
          ? state.elements
          : (state.elements.map((el) => {
              const adds = joinersByFrame.get(el.id);
              if (!adds || el.type !== "frame") return el;
              return { ...el, childIds: [...el.childIds, ...adds] };
            }) as EditorElement[]);
      const newHistory = [
        ...state.history.slice(-HISTORY_LIMIT),
        state.elements,
      ];

      // Same pendingMeasure machinery as addPageWithElements: stamp every
      // new text id so its first-mount handler in TextElement runs the
      // intrinsic-height measurement (strip minHeight, read scrollHeight).
      // Without this, an AI-overestimated height on an `add_to_canvas`
      // element stayed unchallenged — the synchronous useLayoutEffect is
      // grow-only and never shrinks an over-tall box, so the box rendered
      // with empty space below the content. `originals` snapshots only the
      // new elements; the cascade reflow uses it to shift only NEW followers
      // (existing canvas elements were not part of this generation).
      const newOriginals = new Map<string, PlannedSnapshot>();
      const newTextIds = new Set<string>();
      for (const el of stamped) {
        newOriginals.set(el.id, {
          x: el.x,
          y: el.y,
          x2: "x2" in el ? (el as { x2?: number }).x2 : undefined,
          y2: "y2" in el ? (el as { y2?: number }).y2 : undefined,
          width: el.width,
          height: el.height,
        });
        if (el.type === "text") newTextIds.add(el.id);
      }
      // Merge with whatever pending batch is already in flight (a
      // create_canvas could be mid-measure when an add_to_canvas lands in
      // the same response). Both batches' ids stay flagged until each
      // text reports its measurement; reportMeasuredHeight clears the set
      // once empty.
      let nextPendingMeasure = state.pendingMeasure;
      if (newTextIds.size > 0) {
        const mergedTextIds = state.pendingMeasure
          ? new Set([...state.pendingMeasure.textIds, ...newTextIds])
          : newTextIds;
        const mergedOriginals = state.pendingMeasure
          ? new Map([
              ...state.pendingMeasure.originals,
              ...newOriginals,
            ])
          : newOriginals;
        nextPendingMeasure = {
          textIds: mergedTextIds,
          originals: mergedOriginals,
        };
      }

      set({
        elements: [...mergedExisting, ...stamped],
        history: newHistory,
        future: [],
        dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
        pendingMeasure: nextPendingMeasure,
      });

      // Mirror the safety timeout from addPageWithElements: if any text
      // fails to report its measurement (mount race, render skip), force-
      // clear our pending entries after 2 s. The identity check on
      // `originals` prevents this stale timer from wiping out a later
      // pending batch.
      if (newTextIds.size > 0) {
        const ourOriginals = newOriginals;
        setTimeout(() => {
          const cur = get();
          if (
            cur.pendingMeasure &&
            // Only clear if NONE of our originals' ids are still in flight
            // — i.e., we're either part of the active batch (intersection
            // non-empty) or already fully reported (intersection empty).
            // We force-clear only the active-and-stuck case.
            Array.from(ourOriginals.keys()).some((id) =>
              cur.pendingMeasure!.textIds.has(id)
            )
          ) {
            console.warn(
              `[FigurIn] addElementsToCurrentPage pendingMeasure timeout; force-clearing overlay`
            );
            set({ pendingMeasure: null });
          }
        }, 2000);
      }
    },

    toggleSmartFigure: () =>
      set((state) => ({ smartFigureOpen: !state.smartFigureOpen })),

    setSmartFigureOpen: (open) => set({ smartFigureOpen: open }),

    appendSmartFigureMessage: (msg) =>
      set((state) => ({
        smartFigureMessages: [...state.smartFigureMessages, msg],
      })),

    addPageWithElements: (title, elements) => {
      const state = get();
      const updatedPages = saveCurrentPageState(state);
      const newPage = createPage(title);
      newPage.elements = elements;
      // Snapshot every element's emitted geometry + collect every text id
      // whose height we need the browser to confirm. The cascade reflow
      // uses the snapshot as its "planned" coordinate baseline.
      const originals = new Map<string, PlannedSnapshot>();
      const textIds = new Set<string>();
      for (const el of elements) {
        originals.set(el.id, {
          x: el.x,
          y: el.y,
          x2: "x2" in el ? (el as { x2?: number }).x2 : undefined,
          y2: "y2" in el ? (el as { y2?: number }).y2 : undefined,
          width: el.width,
          height: el.height,
        });
        if (el.type === "text") textIds.add(el.id);
      }
      set({
        pages: [...updatedPages, newPage],
        currentPageId: newPage.id,
        elements,
        ...withSel([]),
        history: [],
        future: [],
        canvas: { ...state.canvas, zoom: 1, panX: 0, panY: 0 },
        tool: "select",
        pendingMeasure:
          textIds.size > 0 ? { textIds, originals } : null,
        dirtyPageIds: addDirty(state.dirtyPageIds, newPage.id),
      });

      // Safety net: if any text element fails to report its measured height
      // (parented to a frame whose childIds drift, render skipped, mount
      // race, etc.), the overlay would otherwise stay visible forever. By
      // 2 seconds after the page commit, every TextElement that's going to
      // mount will have run its first-mount layout effect — anything still
      // pending is permanently stuck. Force-clear, but only if the SAME
      // pending set is still active (the `originals === ourOriginals`
      // identity check); a follow-up generation that installs a new
      // pendingMeasure must not be wiped out by a stale timer from this one.
      if (textIds.size > 0) {
        const ourOriginals = originals;
        setTimeout(() => {
          const cur = get();
          if (
            cur.pendingMeasure &&
            cur.pendingMeasure.originals === ourOriginals
          ) {
            const stuck = cur.pendingMeasure.textIds.size;
            console.warn(
              `[FigurIn] pendingMeasure timeout: ${stuck} text(s) didn't report; force-clearing overlay`
            );
            set({ pendingMeasure: null });
          }
        }, 2000);
      }

      return newPage.id;
    },

    reportMeasuredHeight: (id, height) => {
      set((state) => {
        if (!state.pendingMeasure) return state;
        if (!state.pendingMeasure.textIds.has(id)) return state;

        // Write the measured height onto the element, then remove the id.
        // Map the update first (height write) so the follow-up cascade sees
        // the authoritative value when it runs.
        const nextElements = state.elements.map((el) =>
          el.id === id ? ({ ...el, height } as EditorElement) : el
        );
        const nextTextIds = new Set(state.pendingMeasure.textIds);
        nextTextIds.delete(id);

        // While any text is still pending, keep pendingMeasure populated so
        // the overlay stays up and the first-mount report in TextElement
        // still matches. Once the set empties we fire the cascade reflow
        // using the snapshot as the baseline.
        if (nextTextIds.size > 0) {
          return {
            elements: nextElements,
            pendingMeasure: {
              ...state.pendingMeasure,
              textIds: nextTextIds,
            },
          };
        }

        // applyCascadeReflow returns a new array. Shifted elements get new
        // object references so Zustand's selector equality check (Object.is)
        // detects the change and triggers CanvasElement re-renders immediately,
        // without requiring a page refresh.
        const reflowedElements = applyCascadeReflow(
          nextElements,
          state.pendingMeasure.originals
        );

        // Commit the reflowed elements into both the working state AND the
        // current page's snapshot so the persist / switch-page flow sees
        // the finalized layout, not the pre-reflow state. Reset history
        // to make undo start from the final-layout baseline (we don't want
        // Ctrl+Z to roll back to the pre-measured positions, which never
        // existed on screen — the user saw the overlay the whole time).
        const pages = state.pages.map((p) =>
          p.id === state.currentPageId
            ? { ...p, elements: reflowedElements, history: [], future: [] }
            : p
        );

        return {
          elements: reflowedElements,
          pages,
          history: [],
          future: [],
          pendingMeasure: null,
          dirtyPageIds: addDirty(state.dirtyPageIds, state.currentPageId),
        };
      });
    },

    deletePage: (id) => {
      const state = get();
      if (state.pages.length <= 1) return; // Keep at least one canvas
      const updatedPages = saveCurrentPageState(state).filter((p) => p.id !== id);

      // Dirty-tracking: the deleted id leaves `dirtyPageIds` (nothing to
      // upsert for it anymore) and enters `deletedPageIds` so the next save
      // round tells the server to drop the row. If the page was only ever
      // dirtied during this session and never saved, the server still needs
      // the delete (the row could have been inserted by an earlier save).
      const nextDirty = new Set(state.dirtyPageIds);
      nextDirty.delete(id);
      const nextDeleted = new Set(state.deletedPageIds);
      nextDeleted.add(id);

      // If deleting current page, switch to the nearest page
      if (state.currentPageId === id) {
        const idx = state.pages.findIndex((p) => p.id === id);
        const target = updatedPages[Math.min(idx, updatedPages.length - 1)];
        set({
          pages: updatedPages,
          currentPageId: target.id,
          elements: target.elements,
          history: target.history,
          future: target.future,
          canvas: { ...state.canvas, zoom: 1, panX: 0, panY: 0 },
          tool: "select",
          ...withSel([]),
          dirtyPageIds: nextDirty,
          deletedPageIds: nextDeleted,
        });
      } else {
        set({
          pages: updatedPages,
          dirtyPageIds: nextDirty,
          deletedPageIds: nextDeleted,
        });
      }
    },

    switchPage: (id) => {
      const state = get();
      if (id === state.currentPageId) return;
      const updatedPages = saveCurrentPageState(state);
      const target = updatedPages.find((p) => p.id === id);
      if (!target) return;
      set({
        pages: updatedPages,
        currentPageId: target.id,
        elements: target.elements,
        history: target.history,
        future: target.future,
        canvas: { ...state.canvas, zoom: 1, panX: 0, panY: 0 },
        tool: "select",
        ...withSel([]),
        editingGroupId: null,
        editingConnectorId: null,
        editingTextId: null,
        autoEditTextId: null,
        // pendingMeasure is page-scoped: it tracks text ids that need first-
        // mount measurement on the page that was just generated. Switching
        // away unmounts those texts before they can report, leaving the
        // overlay stuck on whatever page the user lands on next. Drop it on
        // page switch — the abandoned page won't get its cascade reflow,
        // but it can do its first-mount measurement on revisit and the
        // current page is unblocked.
        pendingMeasure: null,
      });
    },

    renamePage: (id, title) => {
      const state = get();
      const existing = state.pages.find((p) => p.id === id);
      if (!existing || existing.title === title) return;
      set({
        pages: state.pages.map((p) => (p.id === id ? { ...p, title } : p)),
        dirtyPageIds: addDirty(state.dirtyPageIds, id),
      });
    },

    getDirtyDelta: () => {
      const s = get();
      // Flush the working elements for the current page into the delta even
      // when pages[current].elements is a stale mirror — the hook wants to
      // ship what the user sees.
      const pages: SerializedPage[] = [];
      for (const pageId of s.dirtyPageIds) {
        const page = s.pages.find((p) => p.id === pageId);
        if (!page) continue; // deleted before save; caught by deletedPageIds
        const elements =
          pageId === s.currentPageId ? s.elements : page.elements;
        pages.push({ id: pageId, title: page.title, elements });
      }
      return {
        projectTitle: s.projectTitle,
        projectDirty: s.projectDirty,
        pages,
        deletedIds: Array.from(s.deletedPageIds),
        currentPageId: s.currentPageId,
      };
    },

    markSaved: ({ pageSignatures, deletedIds, projectSignature }) => {
      set((state) => {
        // For each page the hook reports it just persisted, clear the dirty
        // flag ONLY if the page's current content still matches the hash
        // that was sent. A mid-save mutation produces a different hash, so
        // the flag stays set and the hook's pending-re-fire picks up the
        // new content on the next round.
        let nextDirty: Set<string> = state.dirtyPageIds;
        for (const [pageId, sentHash] of pageSignatures) {
          if (!nextDirty.has(pageId)) continue;
          const page = state.pages.find((p) => p.id === pageId);
          if (!page) continue;
          const elements =
            pageId === state.currentPageId ? state.elements : page.elements;
          if (pageSignature({ title: page.title, elements }) !== sentHash) {
            continue; // content moved on; stay dirty
          }
          if (nextDirty === state.dirtyPageIds) {
            nextDirty = new Set(state.dirtyPageIds);
          }
          nextDirty.delete(pageId);
        }

        // Deleted ids are acknowledged unconditionally — once the server
        // drops the row it can't come back from our side.
        let nextDeleted: Set<string> = state.deletedPageIds;
        for (const id of deletedIds) {
          if (!nextDeleted.has(id)) continue;
          if (nextDeleted === state.deletedPageIds) {
            nextDeleted = new Set(state.deletedPageIds);
          }
          nextDeleted.delete(id);
        }

        const nextProjectDirty =
          projectSignature !== undefined &&
          projectSignature === state.projectTitle
            ? false
            : state.projectDirty;

        return {
          dirtyPageIds: nextDirty,
          deletedPageIds: nextDeleted,
          projectDirty: nextProjectDirty,
        };
      });
    },

    loadProject: (projectTitle, snapshot) => {
      const prevCanvas = get().canvas;
      // Backfill parentId on elements saved before hierarchy existed.
      // JSONB keeps unknown fields as `undefined` on read — normalizing to
      // `null` here means every downstream consumer can rely on the
      // parentId field being present. No cost on current-shape documents
      // (the map still runs but spreads identical fields).
      const hydrateElements = (els: EditorElement[]): EditorElement[] =>
        els.map((el) =>
          el.parentId === undefined
            ? ({ ...el, parentId: null } as EditorElement)
            : el
        );
      const incoming: Page[] =
        snapshot.pages.length > 0
          ? snapshot.pages.map((p) => ({
              id: p.id,
              title: p.title,
              elements: hydrateElements(p.elements),
              history: [],
              future: [],
            }))
          : [createPage("Canvas 1")];
      const current =
        incoming.find((p) => p.id === snapshot.currentPageId) ?? incoming[0];
      set({
        pages: incoming,
        currentPageId: current.id,
        elements: current.elements,
        projectTitle,
        history: [],
        future: [],
        clipboard: [],
        ...withSel([]),
        tool: "select",
        canvas: { ...prevCanvas, zoom: 1, panX: 0, panY: 0 },
        marquee: null,
        editingGroupId: null,
        editingConnectorId: null,
        editingTextId: null,
        autoEditTextId: null,
        snapTargetId: null,
        hoveredElementId: null,
        pendingPathShape: null,
        dirtyPageIds: new Set<string>(),
        deletedPageIds: new Set<string>(),
        projectDirty: false,
      });
    },

    duplicatePage: (id) => {
      const state = get();
      const updatedPages = saveCurrentPageState(state);
      const source = updatedPages.find((p) => p.id === id);
      if (!source) return;
      const newPage: Page = {
        ...source,
        id: generatePageId(),
        title: `${source.title} (Copy)`,
        elements: source.elements.map((el) => ({ ...el, id: generateId() }) as EditorElement),
        history: [],
        future: [],
      };
      set({
        pages: [...updatedPages, newPage],
        currentPageId: newPage.id,
        elements: newPage.elements,
        history: [],
        future: [],
        canvas: { ...state.canvas, zoom: 1, panX: 0, panY: 0 },
        tool: "select",
        ...withSel([]),
        dirtyPageIds: addDirty(state.dirtyPageIds, newPage.id),
      });
    },
  };
});

/** Exported so the persistence hook can hash seeded pages right after
 *  `loadProject` (same shape the store uses internally for `markSaved`). */
export { pageSignature };
