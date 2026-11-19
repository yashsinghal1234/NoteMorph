import React, { useState, useRef, useEffect } from 'react';
import { CellRecord } from '../types';
import { setCell } from '../lib/crdt';
import { formulaEngine } from '../lib/hyperformula';
import { Calculator, X } from 'lucide-react';

interface SpreadsheetGridProps {
  cells: Map<string, CellRecord>;
  onClose?: () => void;
}

const DEFAULT_ROWS = 30;
const DEFAULT_COLS = 16;

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({ cells, onClose }) => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCellId = `r${selectedCell.row}:c${selectedCell.col}`;
  const currentCellRecord = cells.get(selectedCellId);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (row: number, col: number) => {
    if (editingCell) {
      commitEdit();
    }
    setSelectedCell({ row, col });
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    const id = `r${row}:c${col}`;
    const record = cells.get(id);
    setSelectedCell({ row, col });
    setEditingCell({ row, col });
    setEditValue(record?.raw || '');
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const id = `r${row}:c${col}`;
    const raw = editValue.trim();

    // Evaluate formula or raw text using HyperFormula
    const computed = raw.startsWith('=')
      ? formulaEngine.setCell(row, col, raw)
      : formulaEngine.setCell(row, col, raw);

    setCell({
      id,
      row,
      col,
      raw,
      computed,
      updatedAt: Date.now(),
    });

    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) {
      if (e.key === 'Enter') {
        commitEdit();
        if (selectedCell.row < DEFAULT_ROWS - 1) {
          setSelectedCell(prev => ({ ...prev, row: prev.row + 1 }));
        }
      } else if (e.key === 'Escape') {
        setEditingCell(null);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, row: Math.min(DEFAULT_ROWS - 1, prev.row + 1) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, row: Math.max(0, prev.row - 1) }));
    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, col: Math.min(DEFAULT_COLS - 1, prev.col + 1) }));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, col: Math.max(0, prev.col - 1) }));
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      handleCellDoubleClick(selectedCell.row, selectedCell.col);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing directly into cell
      handleCellDoubleClick(selectedCell.row, selectedCell.col);
      setEditValue(e.key);
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="absolute bottom-10 right-8 z-20 w-[640px] h-[440px] bg-white rounded-xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden outline-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Title & Formula Bar Header */}
      <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Calculator className="w-4 h-4 text-emerald-600" />
          <span>Spreadsheet Layer</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono">
            HyperFormula DAG Active
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Formula Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs">
        <span className="font-mono font-bold text-slate-600 w-12 text-center bg-white border border-slate-200 rounded py-0.5">
          {formulaEngine.constructor ? (
            `${String.fromCharCode(65 + selectedCell.col)}${selectedCell.row + 1}`
          ) : ''}
        </span>
        <span className="font-serif italic text-slate-400 font-bold">fx</span>
        <input
          type="text"
          value={
            editingCell
              ? editValue
              : currentCellRecord?.raw || ''
          }
          onChange={e => {
            if (!editingCell) {
              setEditingCell(selectedCell);
            }
            setEditValue(e.target.value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit();
          }}
          placeholder="Enter value or formula e.g. =SUM(A1:A5)"
          className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
        />
      </div>

      {/* Grid Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="border-collapse table-fixed w-full text-xs">
          <thead>
            <tr className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300">
              <th className="w-10 p-1 text-center font-mono text-[11px] text-slate-400 border-r border-slate-300">
                #
              </th>
              {Array.from({ length: DEFAULT_COLS }).map((_, colIdx) => (
                <th
                  key={colIdx}
                  className="w-24 p-1 text-center font-mono text-[11px] text-slate-600 font-semibold border-r border-slate-200"
                >
                  {String.fromCharCode(65 + colIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: DEFAULT_ROWS }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-slate-100">
                <td className="bg-slate-50 text-center font-mono text-[10px] text-slate-400 border-r border-slate-300 select-none py-1 sticky left-0 z-0">
                  {rowIdx + 1}
                </td>
                {Array.from({ length: DEFAULT_COLS }).map((_, colIdx) => {
                  const id = `r${rowIdx}:c${colIdx}`;
                  const cell = cells.get(id);
                  const isSelected =
                    selectedCell.row === rowIdx && selectedCell.col === colIdx;
                  const isEditing =
                    editingCell?.row === rowIdx && editingCell?.col === colIdx;

                  return (
                    <td
                      key={colIdx}
                      onClick={() => handleCellClick(rowIdx, colIdx)}
                      onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                      className={`relative border-r border-slate-200 px-2 py-1 truncate font-mono text-[11px] transition-colors ${
                        isSelected
                          ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/50 z-10'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          className="absolute inset-0 w-full h-full px-2 py-1 bg-white border-2 border-blue-600 outline-none font-mono text-[11px] z-20"
                        />
                      ) : (
                        <span>
                          {cell?.computed !== undefined && cell?.computed !== ''
                            ? cell.computed
                            : cell?.raw || ''}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
