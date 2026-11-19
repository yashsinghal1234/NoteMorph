import React, { useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Table,
  FileText,
  Layers,
  X,
  Trash2,
} from 'lucide-react';
import { processDocumentOCR, OCRResult, cleanOCRText } from '../lib/ocr';
import { setCell, setShape, clearShapesOnly, yShapes } from '../lib/crdt';
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
  const [editableText, setEditableText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'text' | 'table'>('text');
  const [clearPrevious, setClearPrevious] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setEditableText('');
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
      setEditableText(res.cleanedText || res.rawText);
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

  // Import as clean, readable paragraph sections (not individual single words!)
  const importAsParagraphs = () => {
    const textToImport = editableText.trim() || (result ? result.cleanedText : '');
    if (!textToImport) return;

    if (clearPrevious && yShapes.size > 0) {
      clearShapesOnly();
    }

    // Split text into coherent paragraphs by double newlines or headers
    const blocks = textToImport
      .split(/\n\s*\n/)
      .map(b => b.trim())
      .filter(b => b.length > 0);

    let currentY = 80;
    blocks.forEach((block, idx) => {
      const lineCount = block.split('\n').length;
      const charCount = block.length;
      const estimatedHeight = Math.max(
        lineCount * 28 + Math.floor(charCount / 55) * 20 + 44,
        90
      );
      const id = `ocr_section_${Date.now()}_${idx}`;

      setShape({
        id,
        type: 'text',
        x: 80,
        y: currentY,
        width: 640,
        height: estimatedHeight,
        strokeColor: '#0f172a',
        strokeWidth: 1,
        text: block,
        ocrConfidence: 95,
        updatedAt: Date.now(),
      });

      currentY += estimatedHeight + 28;
    });

    onClose();
  };

  // Import entire document as one unified, clean note
  const importAsFullDocument = () => {
    const textToImport = editableText.trim() || (result ? result.cleanedText : '');
    if (!textToImport) return;

    if (clearPrevious && yShapes.size > 0) {
      clearShapesOnly();
    }

    const lines = textToImport.split('\n');
    const id = `ocr_doc_${Date.now()}`;

    setShape({
      id,
      type: 'text',
      x: 80,
      y: 80,
      width: 680,
      height: Math.max(lines.length * 28 + Math.floor(textToImport.length / 60) * 18 + 60, 200),
      strokeColor: '#0f172a',
      strokeWidth: 1,
      text: textToImport,
      updatedAt: Date.now(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Document & Handwriting OCR Ingestion
            </h2>
            <p className="text-xs text-slate-500">
              High-resolution on-device OCR with intelligent paragraph restructuring
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
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl p-6 cursor-pointer transition-all">
            <UploadCloud className="w-9 h-9 text-blue-500 mb-2" />
            <span className="text-sm font-semibold text-slate-700">
              {file ? file.name : 'Click or drop PDF / Image here'}
            </span>
            <span className="text-xs text-slate-400 mt-1">
              Supports .pdf, .png, .jpg, .webp (processed 100% on-device)
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
            <div className="flex flex-col items-center gap-3 pt-1">
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
                  <span>Run High-Resolution OCR</span>
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
            <div className="space-y-4 pt-1">
              {/* Header stats & tab switcher */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Detected {result.paragraphs.length} paragraph blocks ({result.words.length} words)
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setActiveTab('text')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      activeTab === 'text'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Structured Text
                  </button>
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      activeTab === 'table'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Table Grid ({result.tableCells.length})
                  </button>
                </div>
              </div>

              {/* Text Preview (Editable) */}
              {activeTab === 'text' ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="font-medium">Extracted & Cleaned Text (editable before import):</span>
                    <button
                      onClick={() => setEditableText(cleanOCRText(editableText))}
                      className="text-blue-600 hover:underline text-[11px]"
                    >
                      Re-apply smart cleaner
                    </button>
                  </div>
                  <textarea
                    value={editableText}
                    onChange={e => setEditableText(e.target.value)}
                    rows={8}
                    className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
                  />
                </div>
              ) : (
                /* Table Preview */
                <div className="border border-slate-200 rounded-lg max-h-52 overflow-auto bg-slate-50 p-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody>
                      {result.tableCells.slice(0, 20).map((cell, idx) => (
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
              )}

              {/* Cleanup option checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="clearPrevious"
                  checked={clearPrevious}
                  onChange={e => setClearPrevious(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="clearPrevious" className="text-xs text-slate-600 cursor-pointer select-none">
                  Wipe old canvas shapes before importing (clears old overlapping words)
                </label>
              </div>

              {/* Import Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  onClick={importAsParagraphs}
                  className="flex items-center justify-center gap-1.5 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>Import as Section Cards</span>
                </button>

                <button
                  onClick={importAsFullDocument}
                  className="flex items-center justify-center gap-1.5 p-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Import as Single Note</span>
                </button>

                <button
                  onClick={importToGrid}
                  className="flex items-center justify-center gap-1.5 p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Table className="w-4 h-4 shrink-0" />
                  <span>Import to Grid</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
