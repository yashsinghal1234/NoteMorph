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
  Sparkles,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { processDocumentOCR, cleanOCRText } from '../lib/ocr';
import { VisionAIConfig, DEFAULT_VISION_CONFIG } from '../lib/visionAi';
import { setCell, setShape, clearShapesOnly, yShapes } from '../lib/crdt';
import { formulaEngine } from '../lib/hyperformula';
import { OCRResult } from '../types';

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
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Background config (silently remembered from localStorage)
  const [config, setConfig] = useState<VisionAIConfig>(() => {
    const savedGeminiKey = localStorage.getItem('notemorp_gemini_key') || '';
    return {
      ...DEFAULT_VISION_CONFIG,
      geminiApiKey: savedGeminiKey,
    };
  });

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
      const res = await processDocumentOCR(
        file,
        (val, status) => {
          setProgress({ value: Math.round(val * 100), status });
        },
        config
      );
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

  const importAsParagraphs = () => {
    const textToImport = editableText.trim() || (result ? result.cleanedText : '');
    if (!textToImport) return;

    if (clearPrevious && yShapes.size > 0) {
      clearShapesOnly();
    }

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
        ocrConfidence: 99,
        updatedAt: Date.now(),
      });

      currentY += estimatedHeight + 28;
    });

    onClose();
  };

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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Digitize Handwritten Notes & Documents</span>
            </h2>
            <p className="text-xs text-slate-500">
              Auto-deciphers handwriting, heals character errors, and structures into clean digital notes
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
              {file ? file.name : 'Click or drop Handwritten Note / Photo / PDF here'}
            </span>
            <span className="text-xs text-slate-400 mt-1">
              Supports .jpg, .png, .webp, .pdf (100% on-device & private)
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
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progress.status || 'Processing notes...'}</span>
                  </>
                ) : (
                  <span>Convert to Digital Notes</span>
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
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Transcribed & matched {result.paragraphs.length} sections
                    {result.tableCells.length > 0 && ` (${result.tableCells.length} table cells)`}
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
                    Structured Notes
                  </button>
                  {result.tableCells.length > 0 && (
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
                  )}
                </div>
              </div>

              {activeTab === 'text' ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="font-medium">Digitized Content (ready for canvas):</span>
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
                <div className="border border-slate-200 rounded-lg max-h-52 overflow-auto bg-slate-50 p-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody>
                      {result.tableCells.slice(0, 25).map((cell, idx) => (
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

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="clearPrevious"
                  checked={clearPrevious}
                  onChange={e => setClearPrevious(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="clearPrevious" className="text-xs text-slate-600 cursor-pointer select-none">
                  Wipe old canvas shapes before importing
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

          {/* Optional Collapsible Settings (Hidden by default) */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
            >
              <Settings2 className="w-3 h-3" />
              <span>Advanced Connection Settings</span>
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showAdvanced && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs text-slate-600">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Ollama Local Endpoint:
                  </label>
                  <input
                    type="text"
                    value={config.ollamaEndpoint}
                    onChange={e => setConfig(c => ({ ...c, ollamaEndpoint: e.target.value }))}
                    className="w-full mt-0.5 p-1.5 bg-white border border-slate-200 rounded text-xs font-mono"
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Optional Gemini API Key:
                  </label>
                  <input
                    type="password"
                    value={config.geminiApiKey}
                    onChange={e => {
                      const k = e.target.value;
                      setConfig(c => ({ ...c, geminiApiKey: k }));
                      localStorage.setItem('notemorp_gemini_key', k);
                    }}
                    className="w-full mt-0.5 p-1.5 bg-white border border-slate-200 rounded text-xs font-mono"
                    placeholder="AIzaSy..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
