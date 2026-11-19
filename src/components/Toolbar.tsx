import React from 'react';
import {
  MousePointer,
  Hand,
  Pencil,
  Square,
  Circle,
  Triangle,
  MoveRight,
  Minus,
  Type,
  Table,
  Undo2,
  Redo2,
  FileUp,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { ToolMode } from '../types';

interface ToolbarProps {
  tool: ToolMode;
  setTool: (tool: ToolMode) => void;
  color: string;
  setColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenOCR: () => void;
  onExportPNG: () => void;
  onExportCSV: () => void;
  onClear: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  showGrid: boolean;
  setShowGrid: (show: boolean | ((prev: boolean) => boolean)) => void;
  autoSnap: boolean;
  setAutoSnap: (snap: boolean | ((prev: boolean) => boolean)) => void;
}

const COLORS = [
  '#0f172a', // Slate 900
  '#2563eb', // Blue 600
  '#16a34a', // Green 600
  '#dc2626', // Red 600
  '#9333ea', // Purple 600
  '#ea580c', // Orange 600
];

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenOCR,
  onExportPNG,
  onExportCSV,
  onClear,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  showGrid,
  setShowGrid,
  autoSnap,
  setAutoSnap,
}) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 text-slate-700">
      {/* Selection & Pan */}
      <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg">
        <button
          title="Select (V)"
          onClick={() => setTool('select')}
          className={`p-2 rounded-md transition-all ${
            tool === 'select'
              ? 'bg-white text-blue-600 shadow-sm font-medium'
              : 'hover:bg-slate-200/60 text-slate-600'
          }`}
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <button
          title="Pan (H)"
          onClick={() => setTool('pan')}
          className={`p-2 rounded-md transition-all ${
            tool === 'pan'
              ? 'bg-white text-blue-600 shadow-sm font-medium'
              : 'hover:bg-slate-200/60 text-slate-600'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>
      </div>

      <div className="w-[1px] h-6 bg-slate-200 mx-1" />

      {/* Drawing & Shapes */}
      <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg">
        <button
          title="Pencil (Auto-snaps to geometric shapes!) (P)"
          onClick={() => setTool('draw')}
          className={`p-2 rounded-md transition-all ${
            tool === 'draw'
              ? 'bg-white text-blue-600 shadow-sm font-medium'
              : 'hover:bg-slate-200/60 text-slate-600'
          }`}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          title="Rectangle (R)"
          onClick={() => setTool('rect')}
          className={`p-2 rounded-md transition-all ${
            tool === 'rect'
              ? 'bg-white text-blue-600 shadow-sm font-medium'
              : 'hover:bg-slate-200/60 text-slate-600'
          }`}
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          title="Circle / Ellipse (O)"
          onClick={() => setTool('circle')}
          className={`p-2 rounded-md transition-all ${
            tool === 'circle'
              ? 'bg-white text-blue-600 shadow-sm font-medium'
              : 'hover:bg-slate-200/60 text-slate-600'
          }`}
        >
          <Circle className="w-4 h-4" />
        </button>
        <button
          title="Triangle"
          onClick={() => setTool('triangle')}
          className={`p-2 rounded-md transition-all ${
            tool === 'triangle'
              ? 'bg-white text-blue-600 shadow-sm font-medium'
              : 'hover:bg-slate-200/60 text-slate-600'
          }`}
        >
          <Triangle className="w-4 h-4" />
        </button>
        <button
          title="Arrow (A)"
          onClick={() => setTool('arrow')}
          className={`p-2 rounded-md transition-all ${
            tool === 'arrow'
              ? 'bg-white text-blue-600 shadow-sm font-medium'
              : 'hover:bg-slate-200/60 text-slate-600'
          }`}
        >
          <MoveRight className="w-4 h-4" />
        </button>
        <button
          title="Line (L)"
          onClick={() => setTool('line')}
          className={`p-2 rounded-md transition-all ${
            tool === 'line'
              ? 'bg-white text-blue-600 shadow-sm font-medium'
              : 'hover:bg-slate-200/60 text-slate-600'
          }`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          title="Text Card (T)"
          onClick={() => setTool('text')}
          className={`p-2 rounded-md transition-all ${
            tool === 'text'
              ? 'bg-white text-blue-600 shadow-sm font-medium'
              : 'hover:bg-slate-200/60 text-slate-600'
          }`}
        >
          <Type className="w-4 h-4" />
        </button>
      </div>

      <div className="w-[1px] h-6 bg-slate-200 mx-1" />

      {/* Grid overlay toggle */}
      <button
        title="Toggle Spreadsheet Grid"
        onClick={() => setShowGrid(prev => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          showGrid
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
        }`}
      >
        <Table className="w-3.5 h-3.5" />
        <span>Spreadsheet</span>
      </button>

      {/* Auto-Snap Toggle */}
      <button
        title="Toggle Geometric Shape Auto-Snapping"
        onClick={() => setAutoSnap(prev => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          autoSnap
            ? 'bg-purple-50 text-purple-700 border border-purple-200'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Snap: {autoSnap ? 'ON' : 'OFF'}</span>
      </button>

      <div className="w-[1px] h-6 bg-slate-200 mx-1" />

      {/* Color Palette */}
      <div className="flex items-center gap-1 px-1">
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-5 h-5 rounded-full transition-all ${
              color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
            }`}
            style={{ backgroundColor: c }}
            title={`Color ${c}`}
          />
        ))}
      </div>

      {/* Stroke Width Selector */}
      <div className="flex items-center gap-1 px-1">
        {[2, 4, 8].map(w => (
          <button
            key={w}
            onClick={() => setStrokeWidth(w)}
            className={`px-1.5 py-1 text-xs font-medium rounded transition-all ${
              strokeWidth === w
                ? 'bg-slate-200 text-slate-900 font-bold'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            title={`Stroke width ${w}px`}
          >
            {w === 2 ? 'S' : w === 4 ? 'M' : 'L'}
          </button>
        ))}
      </div>

      <div className="w-[1px] h-6 bg-slate-200 mx-1" />

      {/* Undo & Redo */}
      <div className="flex items-center gap-1">
        <button
          title="Undo (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          title="Redo (Ctrl+Y)"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="w-[1px] h-6 bg-slate-200 mx-1" />

      {/* OCR Import & Exports */}
      <div className="flex items-center gap-1">
        <button
          title="Import PDF / Image via OCR"
          onClick={onOpenOCR}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition-all shadow-xs"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span>Import OCR</span>
        </button>

        <button
          title="Export Grid as CSV"
          onClick={onExportCSV}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          title="Clear Canvas & Grid"
          onClick={onClear}
          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="w-[1px] h-6 bg-slate-200 mx-1" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
        <button
          title="Zoom Out"
          onClick={onZoomOut}
          className="p-1 text-slate-600 hover:bg-slate-100 rounded-md"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span
          onClick={onResetZoom}
          className="cursor-pointer hover:text-blue-600 px-1 py-0.5 rounded"
          title="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          title="Zoom In"
          onClick={onZoomIn}
          className="p-1 text-slate-600 hover:bg-slate-100 rounded-md"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
