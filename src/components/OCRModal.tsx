import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, Table, FileText, X } from 'lucide-react';
import { processDocumentOCR, OCRResult } from '../lib/ocr';
import { setCell, setShape } from '../lib/crdt';
import { formulaEngine } from '../lib/hyperformula';

interface OCRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OCRModal: React.FC<OCRModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ value: number; status: string }>({
    value: 0,
    status: '',
  });
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleStartOCR = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await processDocumentOCR(file, (val, status) => {
        setProgress({ value: Math.round(val * 100), status });
      });
      setResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to process document');
    } finally {
      setLoading(false);
    }
  };

  const importToGrid = () => {
    if (!result) return;
    result.tableCells.forEach(cell => {
      const id = `r${cell.row}:c${cell.col}`;
      const computed = formulaEngine.setCell(cell.row, cell.col, cell.text);
      setCell({
        id,
        row: cell.row,
        col: cell.col,
        raw: cell.text,
        computed,
        updatedAt: Date.now(),
      });
    });
    onClose();
  };

  const importAsTextCards = () => {
    if (!result) return;
    result.words.forEach((w, idx) => {
      const id = `ocr_card_${Date.now()}_${idx}`;
      setShape({
        id,
        type: 'text',
        x: w.bbox.x0,
        y: w.bbox.y0,
        width: Math.max(w.bbox.x1 - w.bbox.x0 + 10, 80),
        height: Math.max(w.bbox.y1 - w.bbox.y0 + 10, 36),
        strokeColor: '#0f172a',
        strokeWidth: 1,
        text: w.text,
        ocrConfidence: w.confidence,
        updatedAt: Date.now(),
      });
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Document & Handwriting OCR Ingestion
            </h2>
            <p className="text-xs text-slate-500">
              Upload a PDF or image to extract text and reconstruct tables via Web Worker
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* File Dropzone */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl p-8 cursor-pointer transition-all">
            <UploadCloud className="w-10 h-10 text-blue-500 mb-2" />
            <span className="text-sm font-semibold text-slate-700">
              {file ? file.name : 'Click or drop PDF / Image here'}
            </span>
            <span className="text-xs text-slate-400 mt-1">
              Supports .pdf, .png, .jpg, .webp
            </span>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {/* Action Button & Progress */}
          {file && !result && (
            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                onClick={handleStartOCR}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing ({progress.status})...</span>
                  </>
                ) : (
                  <span>Run Intelligent OCR & Table Detection</span>
                )}
              </button>

              {loading && (
                <div className="w-full space-y-1">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 transition-all duration-300"
                      style={{ width: `${progress.value}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>{progress.status}</span>
                    <span>{progress.value}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Preview */}
          {result && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Detected {result.words.length} words across {result.tableCells.length} table
                  cells
                </span>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-auto bg-slate-50 p-2">
                <table className="w-full text-left text-xs border-collapse">
                  <tbody>
                    {result.tableCells.slice(0, 15).map((cell, idx) => (
                      <tr key={idx} className="border-b border-slate-200/60">
                        <td className="p-1 font-mono text-[10px] text-slate-400 w-16">
                          R{cell.row + 1}:C{cell.col + 1}
                        </td>
                        <td className="p-1 font-mono text-slate-700">{cell.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Options */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={importToGrid}
                  className="flex items-center justify-center gap-2 p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Table className="w-4 h-4" />
                  <span>Import into Spreadsheet Grid</span>
                </button>
                <button
                  onClick={importAsTextCards}
                  className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Import as Canvas Text Cards</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
