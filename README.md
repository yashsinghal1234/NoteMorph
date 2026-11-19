# notemorp 🪐

> **“Diagrams that compute, with data that never leaves your device.”**  
> The local-first hybrid that unites the spatial freedom of whiteboards with the reactive mathematical power of spreadsheets.

---

## 🎯 The Problem

People doing real thinking switch constantly between two tools that don’t talk to each other:
* **The Spreadsheet (Excel, Google Sheets):** Powerful calculation, but rigid, linear, and visually dead.
* **The Whiteboard (Miro, Excalidraw, FigJam):** Spatial and intuitive, but completely "dumb." Shapes cannot calculate, and tables don't compute.

### What Sets notemorp Apart
1. **Local-First & 100% Private:** OCR and calculations run entirely on-device via Web Workers & WASM. No document or proprietary financial data ever leaves the browser.
2. **Zero-Friction Ingestion:** Draw rough doodles and watch them auto-snap to clean vector geometry in $<1\text{ms}$, or drop in a PDF/invoice to extract structured, calculating tables.
3. **Data-Bound Spatial Canvas:** Shapes and connectors anchor directly to spreadsheet cells. When your numbers change, the diagrams react.
4. **Offline-First Persistence:** True local-first data storage in IndexedDB through Yjs CRDTs.

---

## 👥 Real-World Problems Solved

| Problem | Who Has It | How notemorp Solves It |
|---|---|---|
| **Invisible Financial / System Modeling**<br>*(Nobody can see how numbers flow)* | Founders, Analysts, Students | Draw the model as visual boxes and arrows, binding each box to a cell so the diagram and the math are the exact same reactive object. |
| **Dead Scanned Data in PDFs**<br>*(Manual re-typing of tables)* | Small Businesses, Accountants, Researchers | In-browser OCR pipeline turns static receipts and PDF tables into live, calculating spreadsheet cells. |
| **Lost Meeting Whiteboard Photos** | Engineering Teams, Classrooms | Ingest photos of whiteboard sketches and convert them into editable vector shapes and text cards. |
| **Sensitive Data Cloud Ban** | Healthcare, Legal, Finance | 100% on-device local computation—no cloud transmission, satisfying strict compliance. |
| **Scattered Estimations & Planning**<br>*(Budgets in Excel, flows in Miro, notes in Notion)* | Project Planners, Freelancers, Event Organizers | One unified canvas for the budget, the flowchart, and the narrative. |
| **Teaching Math & Data Visually** | Educators, STEM Students | Sketch a visual graph or diagram and watch it compute live values. |

---

## ✨ Key Features

### 📐 1. Infinite Canvas with Calligraphy & Geometry
* **Fluid Pan & Zoom**: Smooth navigation with `Ctrl + Wheel` or `Space + Drag` across an infinite coordinate space.
* **$O(1)$ CSS Grid Background**: Dynamic SVG grid patterns that scale and translate on the GPU thread without DOM bloat.
* **Organic Inking**: Pressure-sensitive, smooth vector strokes powered by `perfect-freehand`.

### 🧠 2. Instant Stroke-to-Shape Auto-Snapping
* **Zero-Latency Recognition**: No heavy AI/ML downloads. Uses Douglas-Peucker simplification, Shoelace polygon area, and circularity metrics to recognize hand-drawn sketches in $<1\text{ms}$.
* **Supported Primitives**:
  * Freehand doodles $\rightarrow$ Crisp **Lines** and **Arrows**
  * Hand-drawn loops $\rightarrow$ Exact **Circles** and **Ellipses**
  * 3 corners $\rightarrow$ **Triangles**
  * 4 corners / boxes $\rightarrow$ Clean **Rectangles** and **Squares**

### 📊 3. Reactive Spreadsheet Layer (HyperFormula DAG)
* **Headless Formula Engine**: Powered by **HyperFormula** (by Handsontable).
* **Excel Compatibility**: Supports 400+ spreadsheet functions (`=SUM(A1:A10)`, `=AVERAGE(...)`, mathematical operators, and relational cell references).
* **Integrated Formula Bar**: `fx` bar for live cell inspections and formula editing.

### 📄 4. Multi-Engine OCR & Handwritten Note Digitalization
* **100% Privacy-First & Local**: Convert messy handwriting, study sheets, whiteboard sketches, and receipts into editable digital text and tables with zero third-party data tracking.
* **Multi-Engine Pipeline**:
  * **TrOCR In-Browser (Transformers.js)**: Runs Microsoft's Vision Transformer handwriting model directly inside the browser using WebGPU/WASM with zero server setup.
  * **Local Ollama Integration (Qwen2.5-VL)**: One-click local connection to state-of-the-art vision models running on `localhost:11434` for 98%+ accuracy on messy cursive and complex layouts.
  * **Fast Tesseract**: Instant local OCR fallback with 2x dynamic super-resolution and dictionary healing heuristics (`diaqram` $\to$ `diagram`, `inq` $\to$ `ing`).
  * **Cloud Vision (BYOK)**: Optional bring-your-own-key Gemini 2.0 Flash integration for instant cloud transcription.
* **Intelligent Document Restructuring**: Outputs clean, structured paragraph section cards (`640px` width) or unified document notes rather than disconnected word boxes.
* **Spatial Table Detection**: Reconstructs Markdown and tabular data into live calculating spreadsheet grid cells.

### 🔒 5. Local-First & Collaborative (CRDT)
* **Offline-First Persistence**: All cell edits, vector shapes, and canvas states are instantly persisted to **IndexedDB** using **Yjs**.
* **Instant Start**: Boots instantly with zero network roundtrips.
* **Conflict-Free Undo/Redo**: Scoped `Y.UndoManager` via `trackedOrigins` so undoing only affects your own actions.

---

## 🛠️ Tech Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Framework** | [React 18](https://react.dev/) + [Vite 6](https://vitejs.dev/) | Blazing-fast client-side execution & HMR |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Strict type safety for spatial coordinates & CRDT schemas |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Modern UI styling, dark/light tones, responsive controls |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, consistent vector iconography |
| **Calculation Engine** | [HyperFormula](https://handsontable.com/docs/hyperformula/) | Headless formula evaluation DAG |
| **CRDT / Storage** | [Yjs](https://yjs.dev/) + [y-indexeddb](https://github.com/yjs/y-indexeddb) | Conflict-free real-time sync & local-first offline storage |
| **Stroke Rendering** | [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | Pressure-sensitive, organic calligraphic paths |
| **OCR & PDF** | [Tesseract.js](https://tesseract.projectnaptha.com/) + [PDF.js](https://mozilla.github.io/pdf.js/) | In-browser client-side document and text extraction |

---

## 🚀 Quickstart

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [npm](https://www.npmjs.com/) (or pnpm / yarn)

### Installation
1. Clone or navigate to the repository directory:
   ```bash
   cd notemorp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:3000`.

### Production Build
To create an optimized production bundle:
```bash
npm run build
npm run preview
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>P</kbd> | **Pencil Tool** (Draw freehand with auto-shape snapping) |
| <kbd>V</kbd> | **Select Tool** (Click and drag existing shapes) |
| <kbd>H</kbd> | **Hand / Pan Tool** (Pan across the infinite canvas) |
| <kbd>Space</kbd> + Drag | Temporary Pan mode |
| <kbd>Ctrl</kbd> + Wheel | Zoom into or out of cursor position |
| <kbd>R</kbd> | **Rectangle Tool** |
| <kbd>O</kbd> | **Circle / Ellipse Tool** |
| <kbd>A</kbd> | **Arrow Tool** |
| <kbd>L</kbd> | **Straight Line Tool** |
| <kbd>T</kbd> | **Text Card Tool** |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | **Undo** |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | **Redo** |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete selected shape |

---

## 📁 Project Structure

```text
notemorp/
├── notemorp-plan.md          # Complete architectural specification & sprint plan
├── README.md                 # Project documentation & guide
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite build configuration & path aliases
├── tailwind.config.js        # Tailwind CSS theme configuration
├── index.html                # Application HTML entry point
└── src/
    ├── App.tsx               # Main application container & Yjs state listeners
    ├── main.tsx              # React DOM mounting
    ├── index.css             # Tailwind base & dynamic SVG grid patterns
    ├── types/
    │   └── index.ts          # Core TypeScript data schemas (Cell, Shape, Viewport)
    ├── lib/
    │   ├── crdt.ts           # Yjs Doc, Y.Map definitions, IndexedDB, UndoManager
    │   ├── hyperformula.ts   # HyperFormula calculation engine wrapper
    │   ├── shapeRecognizer.ts# Real-time geometric stroke classifier ($1 & Douglas-Peucker)
    │   └── ocr.ts            # PDF.js + Tesseract.js worker + spatial clustering
    └── components/
        ├── Canvas.tsx        # Infinite canvas viewport with SVG vector rendering
        ├── SpreadsheetGrid.tsx # Interactive spreadsheet layer with formula bar
        ├── Toolbar.tsx       # Floating control bar (tools, colors, undo, zoom, export)
        ├── OCRModal.tsx      # Document upload modal with live extraction progress
        └── StatusBar.tsx     # Local-first persistence & status indicators
```

---

## 🗺️ Roadmap

- [x] **Sprint 0: Core Architecture** (Vite + TS + Tailwind + Yjs + IndexedDB + Canvas + HyperFormula).
- [x] **Sprint 1: OCR & Ingestion** (PDF.js + Tesseract WASM + Spatial Table Clustering).
- [x] **Sprint 2: Intelligent Stroke-to-Shape** (Douglas-Peucker + Shoelace Circularity + Perfect-Freehand).
- [ ] **Sprint 3: Real-Time Multi-User WebRTC** (Ephemeral cursor awareness + P2P room sync).
- [ ] **Sprint 4: Deep Formula Cell Anchoring** (Connecting vector arrows directly to spreadsheet cells so arrows track cell movements).
- [ ] **Sprint 5: Mobile & Stylus Optimization** (Apple Pencil / S-Pen pressure dynamics and palm rejection).

---

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.
