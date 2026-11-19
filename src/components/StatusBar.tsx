import React from 'react';
import { Database, ShieldCheck, Sparkles } from 'lucide-react';
import { ToolMode } from '../types';

interface StatusBarProps {
  tool: ToolMode;
  cellCount: number;
  shapeCount: number;
  zoom: number;
  isSynced: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  tool,
  cellCount,
  shapeCount,
  zoom,
  isSynced,
}) => {
  return (
    <footer className="absolute bottom-3 left-4 z-20 flex items-center gap-3 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-lg border border-slate-200 shadow-md text-slate-600 text-[11px] font-mono">
      {/* Persistence indicator */}
      <div className="flex items-center gap-1.5 text-emerald-600 font-sans font-semibold">
        <Database className="w-3.5 h-3.5" />
        <span>{isSynced ? 'IndexedDB Local-First' : 'Saving...'}</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      <div className="w-[1px] h-3.5 bg-slate-200" />

      {/* Mode */}
      <div className="flex items-center gap-1 font-sans">
        <span className="text-slate-400">Tool:</span>
        <span className="capitalize font-medium text-slate-800">{tool}</span>
      </div>

      <div className="w-[1px] h-3.5 bg-slate-200" />

      {/* Counts */}
      <div>
        <span>{cellCount} cells</span> • <span>{shapeCount} shapes</span>
      </div>

      <div className="w-[1px] h-3.5 bg-slate-200" />

      {/* Shape Snapping indicator */}
      <div className="flex items-center gap-1 text-purple-600 font-sans font-medium">
        <Sparkles className="w-3 h-3" />
        <span>Auto-Snap Engine Active</span>
      </div>
    </footer>
  );
};
