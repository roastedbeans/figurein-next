# FigureIn Research: Scientific Figure Generation Architecture

## FigureLabs (figurelabs.ai)

"The World's First AI Agent for Scientific Illustration" — launched August 2025, founded by University of Oxford alumni.

### How It Works

- **Text-to-Figure** — LLM generates figures from natural language descriptions or PDF extraction
- **Sketch-to-Figure** — transforms hand-drawn sketches into professional scientific illustrations via AI
- **Figure Refiner** — enhances resolution, corrects color, reduces noise for journal-quality output
- **Image Vectorization** — converts raster images to SVG
- Chat-based interface (`chat.figurelabs.ai`), ~8 seconds per first draft
- SVG/vector export gated behind premium tiers (~$19/mo)

### Weaknesses

- Label accuracy issues (71% for long terms vs 97% for short terms)
- Pixelation problems requiring redos
- No manual editing canvas — purely AI-driven, no post-generation editing

---

## Comparable Tools

| Tool | Approach | Rendering | Strength | Weakness |
| --- | --- | --- | --- | --- |
| **BioRender** | Drag-and-drop, 50K+ curated SVG icons | Skia (Canvas) | 100% label accuracy, peer-reviewed icons | Slow (~18 min/figure), expensive ($45-75/mo), biology-only |
| **SciDraw** | AI text-to-figure, SVG-native output | AI pipeline | Best AI label accuracy (97% short), multi-discipline | Smaller icon library |
| **AutoFigure** | 5-stage AI pipeline (LLM -> SAM3 -> SVG layout -> assembly) | SVG | Most advanced automated pipeline | Research-stage, not production |
| **Excalidraw** | Two-canvas architecture (static + interactive) | Canvas (RoughJS) | Hand-drawn aesthetic, open source | Not scientific-focused |
| **tldraw** | SDK-first, signals-based state | WebGL + SVG hybrid | Best for embedding/extending, $10M Series A | General-purpose, no science icons |
| **draw.io** | mxGraph library | SVG + HTML DOM | Open source, mature | Dated architecture |
| **Bioicons** | Open-source SVG icon library (2,700+ icons) | SVG files | Free, CC0/CC-BY/MIT licensed | Not an editor, just icons |

### BioRender Tech Stack

React, Vue.js, AngularJS, Node.js, TypeScript, MongoDB, AWS, Heroku, NGINX, Cloudflare. Uses Skia for 2D rendering. Testing with Jest, Cypress, Mocha, Selenium.

---

## Rendering Approaches

### Canvas/WebGL (Figma)

Figma built a custom rendering engine using WebGL — a "browser inside a browser" with its own DOM, compositor, and text layout engine. All rendering is GPU-based and fully anti-aliased. Rejected HTML/SVG due to DOM overhead and zoom-related re-tessellation. Highest performance but requires enormous engineering investment.

### Two-Canvas Architecture (Excalidraw)

Two HTML5 canvases — a static canvas for drawing elements (rendered via RoughJS) and an interactive canvas for selections, cursors, and in-progress drawing. The static canvas is cached and only redrawn when elements change. Practical middle ground.

### SVG DOM (draw.io / React Flow)

SVG and HTML elements rendered directly in the DOM. Simplest approach — you get browser hit-testing, accessibility, and CSS styling for free. Performance walls with thousands of elements.

### Hybrid WebGL + SVG (tldraw)

WebGL rendering for performance at scale with GLSL shaders, while maintaining a React component model for the UI layer.

### Recommendation for FigureIn

**Start with SVG DOM rendering.** Scientific figures typically contain hundreds (not millions) of elements. SVG gives native text handling, easy export to PDF/publication formats, CSS-based theming, and direct element addressability. Migrate to Canvas if performance becomes an issue while keeping SVG as the serialization format.

---

## SVG Icon Generation

### Parametric React SVG Components

Use SVGR (`@svgr/cli`) to convert SVG files into React components with configurable props. The `--icon` flag sets width/height to `1em`, preserves `viewBox`, and replaces colors with `currentColor`. Libraries like Lucide exemplify this pattern — each icon accepts `size`, `color`, `strokeWidth` props.

### AI-Based SVG Generation

- **AutoFigure** — 5-stage pipeline: LLM generates raster draft -> SAM3 segments icons/text -> constructs SVG layout template -> injects vectorized icons
- **StarVector** (CVPR 2025) — foundation model generating SVG code from images/text
- **Chat2SVG** — combines LLMs with image diffusion for vector graphics generation

### Recommendation

Use Lucide for standard UI icons. Build domain-specific scientific icons as parametric React SVG components where each icon (cell, molecule, apparatus) accepts props controlling size, color, orientation, labels. Integrate an LLM pipeline for on-demand AI icon generation.

---

## AI Figure Generation Pipeline (AutoFigure-style)

1. **Raw Generation** — LLM generates a raster draft from method text / user description
2. **SAM3 Segmentation** — detects and segments distinct icons and text regions
3. **SVG Layout Template** — constructs a structural SVG wireframe with placeholders
4. **Final Assembly** — high-quality cropped icons and vectorized text injected into the template

Uses GPT-4V or Gemini-2.5-Pro for semantic parsing and layout reasoning, with D3-style layout planners for geometry. Dual-agent system (generator + critic) with iterative refinement.

---

## State Management for Editors

### Approaches

| Pattern | Used By | Pros | Cons |
| --- | --- | --- | --- |
| **Reactive signals** | tldraw (`@tldraw/state`) | Auto-updating computed values, transactional batching | Custom implementation |
| **Zustand + Immer** | React Flow (Zustand internally) | Simple mental model, framework-standard | Manual optimization needed |
| **Custom state + Jotai** | Excalidraw | Fine-grained control | Complex, harder to maintain |

### Undo/Redo Strategies

| Strategy | Description | Best For |
| --- | --- | --- |
| **Snapshot-based** | Store full state snapshots in an array | Small state, simple implementation |
| **Patch-based** | Store only diffs (JSON Patches RFC 6902). Library: **Travels** by Mutative | Large state, memory efficiency |
| **Command pattern** | Each action has `execute()` and `undo()` methods | Complex operations, most flexible |

### Serialization

State must stay JSON-serializable. Store shapes as plain objects with `type`, `props`, `transform` fields. Avoid class instances, Date objects, or functions in state.

---

## Recommended Libraries for FigureIn

| Purpose | Library | Why |
| --- | --- | --- |
| Canvas engine | **tldraw SDK** | Most modern, SDK-first, extensible via custom `ShapeUtil` classes |
| Alternative canvas | **react-konva** | More low-level control, multi-layer canvas |
| Node diagrams | **React Flow** | Best for pathway diagrams, flowcharts, connected nodes |
| State management | **Zustand + Immer** | Simple, performant, framework-standard |
| Undo/redo | **Travels** (mutativejs) | Patch-based, memory efficient |
| Data visualization | **D3.js** or **visx** (Airbnb) | Charts and plots within figures |
| UI icons | **Lucide React** | Already installed, configurable |
| Scientific icons | Custom parametric SVG components | Domain-specific, prop-driven |
| AI generation | LLM pipeline -> structured JSON -> renderer | Text-to-figure workflow |

---

## Recommended Project Structure

```
src/
  editor/
    core/
      store.ts            # Zustand store with Immer middleware
      history.ts          # Undo/redo via patch-based approach (Travels)
      types.ts            # Shape, Figure, Scene types (JSON-serializable)
    shapes/
      ShapeBase.tsx       # Base shape component
      ScientificIcon.tsx  # Parametric scientific icon shape
      TextBlock.tsx       # Editable text element
      Connector.tsx       # Lines/arrows between shapes
    tools/
      SelectTool.ts       # Selection, move, resize
      DrawTool.ts         # Freehand drawing
      IconTool.ts         # Place icons from library
    canvas/
      Canvas.tsx          # Main SVG/Canvas rendering surface
      Viewport.tsx        # Pan/zoom handling
    panels/
      IconLibrary.tsx     # Searchable icon browser
      Properties.tsx      # Selected shape properties editor
      Layers.tsx          # Z-order management
    ai/
      generateFigure.ts   # LLM text -> scene JSON
      generateIcon.ts     # Text -> SVG icon
  lib/
    icons/                # Parametric SVG icon components
    templates/            # Figure layout templates
```

---

## Market Gap & Opportunity

**FigureLabs** = AI-only generation, no post-generation editing canvas.
**BioRender** = Manual drag-and-drop only, slow, expensive, biology-only.

**FigureIn** can combine:

- AI-powered figure generation (text/sketch -> editable figure)
- A proper editable SVG canvas for post-generation refinement
- SVG-native output for publication quality
- Multi-discipline support (not just biology)
- Parametric, configurable scientific icon library

---

## References

- [FigureLabs](https://www.figurelabs.ai/)
- [BioRender](https://www.biorender.com/)
- [SciDraw](https://sci-draw.com/)
- [AutoFigure](https://autofigure.org/) / [GitHub](https://github.com/ResearAI/AutoFigure-Edit)
- [StarVector (CVPR 2025)](https://openaccess.thecvf.com/content/CVPR2025/papers/Rodriguez_StarVector_Generating_Scalable_Vector_Graphics_Code_from_Images_and_Text_CVPR_2025_paper.pdf)
- [Bioicons](https://bioicons.com/) / [GitHub](https://github.com/duerrsimon/bioicons)
- [tldraw SDK](https://tldraw.dev/) / [Architecture](https://deepwiki.com/tldraw/tldraw)
- [Figma Rendering](https://madebyevan.com/figma/)
- [Excalidraw Architecture](https://deepwiki.com/zsviczian/excalidraw/3-core-excalidraw-library)
- [React Flow](https://reactflow.dev/)
- [Konva.js](https://konvajs.org/)
- [Fabric.js](http://fabricjs.com/)
- [Polotno SDK](https://polotno.com/)
- [Travels (undo/redo)](https://github.com/mutativejs/travels)
- [draw.io](https://github.com/jgraph/drawio)
- [Lucide React](https://lucide.dev/)
- [visx (Airbnb)](https://airbnb.io/visx/)
