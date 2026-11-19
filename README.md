# notemorp 🪐

> **The local-first, hybrid spreadsheet + infinite whiteboard canvas.**  
> Bridging the gap between computational data modeling (Excel/Sheets) and spatial visual thinking (Miro/Excalidraw).

---

## 💡 The Problem

Historically, knowledge workers have been trapped between two incompatible mental models:
* **The Rigid Spreadsheet (Excel, Google Sheets):** Unbeatable for structured formulas, dependency graphs, and data modeling, but confined to a rigid 2D grid. You cannot sketch diagrams, draw arrows across ideas, or visually map workflows around your numbers.
* **The Free-form Whiteboard (Miro, Excalidraw, FigJam):** Fantastic for spatial brainstorming and architecture sketches, but fundamentally "dumb." Drawn tables have no calculation engine—numbers don't sum, formulas don't compute, and data is completely disconnected.

**notemorp breaks this barrier.** It combines an infinite spatial canvas with a live, calculating spreadsheet engine, backed by on-device OCR and instant stroke-to-shape recognition.

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

### 📄 4. In-Browser OCR & Table Ingestion
* **Privacy-First / 100% On-Device**: Upload PDFs, scans, receipts, or meeting whiteboard photos.
* **Zero Server Uploads**: `pdfjs-dist` renders pages into WebAssembly-powered `tesseract.js` Web Workers directly inside your browser.
* **Spatial Table Clustering**: Automatically groups word bounding boxes by horizontal line overlap and vertical gutters to reconstruct structured table rows and columns.
* **Flexible Destination**: Choose between importing directly into **Spreadsheet Grid Cells** or as **Spatial Text Cards** on the canvas.

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
