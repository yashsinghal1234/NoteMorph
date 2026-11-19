import React, { useState, useEffect, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { SpreadsheetGrid } from './components/SpreadsheetGrid';
import { OCRModal } from './components/OCRModal';
import { StatusBar } from './components/StatusBar';
import { ToolMode, CellRecord, ShapeRecord, ViewportTransform } from './types';
import {
  yCells,
  yShapes,
  yShapeOrder,
  persistence,
  undoManager,
  clearWorkspace,
} from './lib/crdt';
import { formulaEngine } from './lib/hyperformula';

export function App() {
  const [tool, setTool] = useState<ToolMode>('draw');
  const [color, setColor] = useState<string>('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [autoSnap, setAutoSnap] = useState<boolean>(true);
  const [isOCRModalOpen, setIsOCRModalOpen] = useState<boolean>(false);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const [viewport, setViewport] = useState<ViewportTransform>({
    x: 0,
    y: 0,
    zoom: 1.0,
  });

  // Reactive state mirroring Yjs maps
  const [cells, setCells] = useState<Map<string, CellRecord>>(new Map());
  const [shapes, setShapes] = useState<Map<string, ShapeRecord>>(new Map());
  const [shapeOrder, setShapeOrder] = useState<string[]>([]);

  // Synchronize with Yjs CRDT Document & IndexedDB
  useEffect(() => {
    const updateCells = () => {
      const map = new Map<string, CellRecord>();
      yCells.forEach((cell, key) => {
        map.set(key, cell);
        if (cell.raw) {
          formulaEngine.setCell(cell.row, cell.col, cell.raw);
        }
      });
      setCells(map);
    };

    const updateShapes = () => {
      const map = new Map<string, ShapeRecord>();
      yShapes.forEach((shape, key) => {
        map.set(key, shape);
      });
      setShapes(map);
      setShapeOrder(yShapeOrder.toArray());
    };

    const updateUndoStatus = () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    };

    yCells.observe(updateCells);
    yShapes.observe(updateShapes);
    yShapeOrder.observe(updateShapes);
    undoManager.on('stack-item-added', updateUndoStatus);
    undoManager.on('stack-item-popped', updateUndoStatus);

    persistence.on('synced', () => {
      setIsSynced(true);
      updateCells();
      updateShapes();
      updateUndoStatus();
    });

    updateCells();
    updateShapes();

    return () => {
      yCells.unobserve(updateCells);
      yShapes.unobserve(updateShapes);
      yShapeOrder.unobserve(updateShapes);
      undoManager.off('stack-item-added', updateUndoStatus);
      undoManager.off('stack-item-popped', updateUndoStatus);
    };
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          undoManager.redo();
        } else {
          undoManager.undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        undoManager.redo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setTool('select');
          break;
        case 'h':
          setTool('pan');
          break;
        case 'p':
          setTool('draw');
          break;
        case 'r':
          setTool('rect');
          break;
        case 'o':
          setTool('circle');
          break;
        case 'a':
          setTool('arrow');
          break;
        case 'l':
          setTool('line');
          break;
        case 't':
          setTool('text');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Export Grid as CSV
  const handleExportCSV = useCallback(() => {
    let maxRow = 0;
    let maxCol = 0;
    cells.forEach(cell => {
      if (cell.row > maxRow) maxRow = cell.row;
      if (cell.col > maxCol) maxCol = cell.col;
    });

    const rows: string[][] = Array.from({ length: maxRow + 1 }, () =>
      Array.from({ length: maxCol + 1 }, () => '')
    );

    cells.forEach(cell => {
      const val = cell.computed !== undefined && cell.computed !== '' ? cell.computed : cell.raw;
      rows[cell.row][cell.col] = `"${val.replace(/"/g, '""')}"`;
    });

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notemorp-grid-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cells]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Top Floating Toolbar */}
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        onUndo={() => undoManager.undo()}
        onRedo={() => undoManager.redo()}
        canUndo={canUndo}
        canRedo={canRedo}
        onOpenOCR={() => setIsOCRModalOpen(true)}
        onExportPNG={() => window.print()}
        onExportCSV={handleExportCSV}
        onClear={() => {
          if (confirm('Are you sure you want to clear the entire workspace?')) {
            clearWorkspace();
          }
        }}
        zoom={viewport.zoom}
        onZoomIn={() =>
          setViewport(prev => ({
            ...prev,
            zoom: Math.min(prev.zoom * 1.15, 5.0),
          }))
        }
        onZoomOut={() =>
          setViewport(prev => ({
            ...prev,
            zoom: Math.max(prev.zoom * 0.85, 0.15),
          }))
        }
        onResetZoom={() =>
          setViewport({
            x: 0,
            y: 0,
            zoom: 1.0,
          })
        }
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        autoSnap={autoSnap}
        setAutoSnap={setAutoSnap}
      />

      {/* Infinite Canvas with SVG & Perfect-Freehand Engine */}
      <Canvas
        tool={tool}
        setTool={setTool}
        color={color}
        strokeWidth={strokeWidth}
        shapes={shapes}
        shapeOrder={shapeOrder}
        cells={cells}
        autoSnap={autoSnap}
        viewport={viewport}
        setViewport={setViewport}
      />

      {/* Interactive Spreadsheet Grid Layer */}
      {showGrid && (
        <SpreadsheetGrid
          cells={cells}
          onClose={() => setShowGrid(false)}
        />
      )}

      {/* OCR Modal */}
      <OCRModal
        isOpen={isOCRModalOpen}
        onClose={() => setIsOCRModalOpen(false)}
      />

      {/* Bottom Status Bar */}
      <StatusBar
        tool={tool}
        cellCount={cells.size}
        shapeCount={shapes.size}
        zoom={viewport.zoom}
        isSynced={isSynced}
      />
    </div>
  );
}

export default App;
