# notemorp – Complete Architectural Specification & Project Plan

## 1. Executive Summary & Vision
**notemorp** is a local-first, hybrid **spreadsheet + infinite whiteboard canvas** web application. It bridges the gap between structured tabular data computation (Excel/Google Sheets) and spatial visual thinking (Excalidraw, Miro, Apple Freeform). 

### Key Capabilities
1. **Hybrid Surface**: An infinite canvas where users can manipulate a structured spreadsheet grid, draw free-form diagrams, annotate data, and attach vector shapes.
2. **Formula Engine**: Excel-compatible spreadsheet calculations powered by a headless directed acyclic graph (DAG) engine.
3. **Local-First & Collaborative**: True offline-first operation with IndexedDB persistence and instant peer synchronization via Conflict-free Replicated Data Types (CRDTs / Yjs) and ephemeral awareness protocols.
4. **Intelligent Ingestion (OCR)**: In-browser PDF & image parsing via Web Workers that automatically clusters extracted text bounding boxes into structured rows/columns or free-floating text cards.
5. **Instant Stroke-to-Shape Recognition**: Real-time geometric heuristic & template matching that snaps hand-drawn sketches (lines, arrows, rectangles, circles, triangles) into vector primitives without heavy ML inference latency.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------------------+
|                                 USER INTERFACE                                    |
|   Next.js App (Client SPA Shell) | Tailwind CSS | shadcn/ui | Radix UI Primitives  |
+-----------------------------------------------------------------------------------+
                               |                         |
        +----------------------+                         +----------------------+
        |                                                                       |
        v                                                                       v
+-----------------------------------+                 +-----------------------------------+
|          CANVAS ENGINE            |                 |         SPREADSHEET ENGINE        |
|  - Infinite Pan/Zoom Viewport     |                 |  - HyperFormula Headless DAG      |
|  - CSS SVG Pattern Background Grid|                 |  - Cell Matrix Virtualization     |
|  - Fabric.js / Konva Object Model | <-------------> |  - Dependency Graph Evaluator     |
|  - perfect-freehand Stroke Render |   Coordinates   |  - Formula Parser (=SUM, =A1+B1)  |
|  - $1 / Heuristic Shape Recognizer|                 |  - Fast Key-Value Access (rX:cY)  |
+-----------------------------------+                 +-----------------------------------+
        |                                                                       |
        +----------------------+                         +----------------------+
                               |                         |
                               v                         v
+-----------------------------------------------------------------------------------+
|                        COLLABORATIVE STATE LAYER (CRDT)                           |
|  Yjs Document (y-indexeddb + y-websocket / WebRTC):                               |
|   - cells: Y.Map<string, CellRecord>      - shapes: Y.Map<string, ShapeRecord>    |
|   - shapeOrder: Y.Array<string>           - meta: Y.Map<string, any>              |
|  Awareness Protocol (y-protocols/awareness):                                      |
|   - User Cursors, Selection Highlights, Ephemeral State (NOT persisted)           |
|  Undo Manager (Y.UndoManager):                                                    |
|   - Scoped by trackedOrigins to isolate local edits from remote sync               |
+-----------------------------------------------------------------------------------+
        |                                                                       |
        v                                                                       v
+-----------------------------------+                 +-----------------------------------+
|      STORAGE & PERSISTENCE        |                 |        OFF-THREAD PIPELINES       |
|  - IndexedDB (Binary Yjs Updates) |                 |  - PDF.js Web Worker (Rendering)  |
|  - Snapshot Archival / Export     |                 |  - Tesseract.js Worker (OCR WASM) |
|  - Local File System Access API   |                 |  - Spatial Table Clustering Alg.  |
+-----------------------------------+                 +-----------------------------------+
```

---

## 3. Core Component Design & Technical Decisions

### 3.1 Infinite Canvas & Coordinate Space
* **Layer Separation**:
  - **Grid Layer**: Rendered as dynamic CSS SVG background patterns on the canvas viewport wrapper rather than individual canvas stroke objects. This keeps DOM node count and canvas draw calls at $O(1)$ regardless of zoom level.
  - **Drawing / Object Layer**: Fabric.js / 2D Canvas managed with strict viewport culling (`calcViewportBoundaries()`).
  - **Spreadsheet Overlay**: Virtualized interactive cell overlay synced with canvas transform matrix $\begin{bmatrix} s & 0 & tx \\ 0 & s & ty \end{bmatrix}$.
* **Performance Throttling**:
  - Wheel and pointer interactions decoupled from canvas re-renders via `requestAnimationFrame` loops.

### 3.2 Spreadsheet Engine: HyperFormula
* **Engine Choice**: **HyperFormula** (by Handsontable).
* **Rationale**:
  - Headless, ultra-fast calculation engine with zero UI dependencies.
  - Supports 400+ Excel functions (`SUM`, `AVERAGE`, `IF`, `VLOOKUP`, mathematical & statistical formulas).
  - Built-in Dependency Graph (DAG) for instant reactive recalculations.
  - Serialization and deserialization directly maps to Yjs transactions.

### 3.3 Geometric Stroke & Shape Recognition Engine
* **Replacement of `sketchRNN`**:
  - `sketchRNN` is a generative doodle synthesizer, NOT a shape recognizer. It has been replaced by a deterministic, zero-latency hybrid recognition engine:
* **The 2-Stage Recognition Pipeline**:
  1. **Stage 1: Geometric Feature Extraction**:
     - **Path Simplification**: Douglas-Peucker algorithm ($\epsilon = 3.0\text{px}$) reduces raw pointer stream to salient vertices.
     - **Closure Test**: If $\text{dist}(\mathbf{p}_{\text{start}}, \mathbf{p}_{\text{end}}) < 0.15 \times \text{Perimeter}$, candidate is classified as a closed polygon or circle/ellipse.
     - **Circularity Test**: Evaluates isoperimetric quotient $Q = \frac{4\pi \cdot \text{Area}}{\text{Perimeter}^2}$. If $Q \ge 0.78$, snaps to **Circle / Ellipse**.
     - **Corner Count**: Identifies sharp turns where $|\Delta\theta| > 50^\circ$.
       - 0 corners + high circularity $\rightarrow$ **Circle**.
       - 3 corners $\rightarrow$ **Triangle**.
       - 4 corners + opposing parallel sides $\rightarrow$ **Rectangle / Square**.
     - **Linearity Test**: Evaluates maximum perpendicular deviation from the line segment $\overline{\mathbf{p}_{\text{start}}\mathbf{p}_{\text{end}}}$. If deviation $< 5\%$, snaps to **Straight Line** (or **Arrow** if endpoint has retraced arrowhead hooks).
  2. **Stage 2: \$1 / \$P Unistroke Recognizer Fallback**:
     - For ambiguous strokes, the \$P Point-Cloud Recognizer compares the normalized stroke cloud to geometric templates via Euclidean minimum distance matching.
  3. **Stroke Smoothing**: Prior to snapping, raw strokes are rendered using `perfect-freehand` for natural, pressure-sensitive calligraphy.

### 3.4 In-Browser OCR & Table Structure Extraction
* **PDF Ingestion**: `pdfjs-dist` loads the document in a Web Worker, rendering requested pages to offscreen canvases at $150\text{ DPI}$ (scale 1.5–2.0) for optimal OCR quality.
* **Text Extraction**: `tesseract.js` worker processes image buffers off the main thread, yielding character, word, and block bounding boxes:
  $$\text{Box} = \{ \text{text}, x_0, y_0, x_1, y_1, \text{confidence} \}$$
* **Spatial Table Clustering Algorithm**:
  1. **Row Clustering**: Sort text blocks by $y_0$. Group into the same horizontal line if $|y_{0, a} - y_{0, b}| \le 0.5 \times \bar{h}$ (where $\bar{h}$ is median line height).
  2. **Column Projection**: Project all bounding box $x$-intervals across clustered rows onto the horizontal axis. Identify distinct column delimiter gaps.
  3. **Grid Mapping**: Assign each text cluster to grid cell coordinate $(R_i, C_j)$.
  4. **Fallback Option**: User can toggle between **"Import to Grid"** (auto-tabular) and **"Import as Text Cards"** (free-floating spatial notes on the canvas).

### 3.5 CRDT Synchronization & Collaboration Architecture
* **Yjs Data Representation**:
  - `doc.getMap('cells')`: Stores sparse cell records keyed by `"r{row}:c{col}"`. Guarantees concurrent cell writes never conflict.
  - `doc.getMap('shapes')`: Stores vector shapes keyed by `UUID`. Allows simultaneous modification of position and styling.
  - `doc.getArray('shapeOrder')`: Maintains canvas z-index ordering.
* **Transient User Presence**:
  - Handled exclusively via `y-protocols/awareness`.
  - Cursors, active cell focus, and selection boxes are broadcast directly over WebRTC/WebSocket without persisting to IndexedDB or bloating document history.
* **History & Undo Scoping**:
  - Local `Y.UndoManager` configured with `trackedOrigins: new Set([localSessionId])` to prevent undoing actions executed by remote collaborators.

---

## 4. TypeScript Data Schemas

```typescript
/** Cell representation in the spreadsheet grid */
export interface CellRecord {
  id: string;              // "r1:c3"
  row: number;
  col: number;
  raw: string;             // Raw text or formula: "=SUM(A1:A5)"
  computed?: string;       // Calculated result from HyperFormula
  format?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    background?: string;
    align?: "left" | "center" | "right";
  };
  comment?: string;
  updatedAt: number;
}

/** Vector shape on the infinite canvas */
export interface ShapeRecord {
  id: string;              // UUID
  type: "line" | "arrow" | "rect" | "circle" | "triangle" | "freehand" | "textCard" | "sticky";
  x: number;               // World coordinate X
  y: number;               // World coordinate Y
  width: number;
  height: number;
  rotation?: number;       // In radians or degrees
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  points?: [number, number][]; // Freehand trajectory points
  text?: string;           // Label or text card content
  ocrConfidence?: number;
  anchoredCellId?: string; // Optional anchor to a spreadsheet cell
  updatedAt: number;
}

/** Ephemeral user awareness state (never persisted to disk) */
export interface ClientPresence {
  user: {
    id: string;
    name: string;
    color: string;
    avatar?: string;
  };
  cursor: { x: number; y: number } | null;
  viewport: { x: number; y: number; zoom: number };
  focusedCellId: string | null;
  selectedShapeIds: string[];
}
```

---

## 5. Implementation Roadmap (Sprints)

| Sprint | Deliverables | Key Milestones |
|---|---|---|
| **Sprint 0: Project Foundation & Architecture** | Scaffold Next.js + TypeScript + Tailwind CSS; configure Yjs + IndexedDB provider; set up infinite canvas viewport with CSS SVG grid; establish HyperFormula engine wrapper. | - Working zoom/pan canvas (60 FPS)<br>- Reactive cell editing with formula evaluation<br>- Local-first IndexedDB persistence |
| **Sprint 1: OCR Ingestion & Table Reconstruction** | Integrate `pdfjs-dist` + `tesseract.js` Web Workers; implement spatial row/column clustering algorithm; create "Drop PDF" UI and review modal. | - Import PDF/image and extract text<br>- Auto-populate spreadsheet cells or text cards<br>- Background worker execution without UI freeze |
| **Sprint 2: Intelligent Stroke-to-Shape Engine** | Implement pointer-stream capture with `perfect-freehand`; build geometric heuristic classifier (line, arrow, rect, circle, triangle); build $1 template matcher fallback; snap strokes to vector shapes. | - Freehand drawing mode<br>- Instant shape auto-snapping on pointer release<br>- Vector shape selection, transform, and move |
| **Sprint 3: Real-Time Sync & Presence** | Implement `y-protocols/awareness` cursors and selection halos; configure WebRTC/WebSocket sync provider; wire `Y.UndoManager` with scoped tracked origins. | - Multi-tab / multi-user real-time sync<br>- Isolated undo/redo across peers<br>- Smooth peer cursor interpolation |
| **Sprint 4: Exporting, Cards & Polish** | Support CSV/Excel export from grid; rasterize canvas + grid to PNG/PDF; build floating Sticky Notes / Text Cards; dark/light mode toggle. | - Full canvas snapshot export<br>- Excel/CSV import and export<br>- Responsive keyboard shortcuts |
| **Sprint 5: Production Readiness & Quality Assurance** | Comprehensive unit & E2E tests (Vitest + Playwright); WebAssembly caching; performance profiling with 5,000+ cells. | - Sub-5s OCR processing<br>- <10ms stroke recognition latency<br>- Offline PWA capability |

---

## 6. Risk Matrix & Mitigations

| Risk | Impact | Likelihood | Mitigation Strategy |
|---|---|---|---|
| **Large OCR Model Download & Latency** | High | High | Lazy-load `tesseract.js` worker only on first PDF upload; cache WASM binaries & trained language data in CacheStorage/IndexedDB; display progress indicator. |
| **Canvas Pan/Zoom Degradation with High Object Count** | High | Medium | Implement viewport culling so off-screen shapes are omitted from render passes; keep grid lines in CSS background; throttle redraws with `requestAnimationFrame`. |
| **Formula Recalculation Overhead** | Medium | Low | HyperFormula uses a reactive DAG; only dependent cells are recalculated when a cell value changes. |
| **CRDT Memory Bloat with Continuous Pointer Streams** | High | High | **Crucial:** Never broadcast raw stroke coordinate events through persistent `Y.Doc`. Only commit the final vectorized shape to the `Y.Doc` on pointer up. Use ephemeral awareness for live stroke previews. |
| **Next.js SSR Hydration Mismatch with Canvas/WASM** | Medium | Low | Encapsulate canvas, PDF.js, and Tesseract within dedicated client-only modules loaded via `next/dynamic` with `{ ssr: false }`. |

---

*Specification verified for Notemorp.*
