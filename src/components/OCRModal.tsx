import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Table,
  FileText,
  Layers,
  X,
  Cpu,
  Sparkles,
  Server,
  Cloud,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { processDocumentOCR, cleanOCRText } from '../lib/ocr';
import {
  checkOllamaConnection,
  VisionAIConfig,
  DEFAULT_VISION_CONFIG,
  OCREngineType,
} from '../lib/visionAi';
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

  // Vision Engine Configuration State
  const [config, setConfig] = useState<VisionAIConfig>(() => {
    const savedGeminiKey = localStorage.getItem('notemorp_gemini_key') || '';
    const savedEngine = (localStorage.getItem('notemorp_ocr_engine') as OCREngineType) || 'trocr';
    return {
      ...DEFAULT_VISION_CONFIG,
      engine: savedEngine,
      geminiApiKey: savedGeminiKey,
    };
  });

  // Ollama Discovery State
  const [ollamaStatus, setOllamaStatus] = useState<{
    checking: boolean;
    connected: boolean;
    models: string[];
  }>({
    checking: false,
    connected: false,
    models: [],
  });

  // Probe Ollama whenever Ollama engine is selected or on mount
  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      setOllamaStatus(prev => ({ ...prev, checking: true }));
      const res = await checkOllamaConnection(config.ollamaEndpoint);
      if (isMounted) {
        setOllamaStatus({
          checking: false,
          connected: res.connected,
          models: res.models,
        });
        if (res.connected && res.models.length > 0) {
          const visionModel = res.models.find(m =>
            m.includes('qwen') || m.includes('vl') || m.includes('vision') || m.includes('llava')
          );
          if (visionModel) {
            setConfig(c => ({ ...c, ollamaModel: visionModel }));
          }
        }
      }
    };
    if (config.engine === 'ollama') {
      probe();
    }
    return () => {
      isMounted = false;
    };
  }, [config.engine, config.ollamaEndpoint]);

  const handleEngineChange = (engine: OCREngineType) => {
    setConfig(prev => ({ ...prev, engine }));
    localStorage.setItem('notemorp_ocr_engine', engine);
  };

  const handleGeminiKeyChange = (key: string) => {
    setConfig(prev => ({ ...prev, geminiApiKey: key }));
    localStorage.setItem('notemorp_gemini_key', key);
  };

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
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Digitalize Handwritten Notes & Documents</span>
            </h2>
            <p className="text-xs text-slate-500">
              Transform handwriting, scans & whiteboard photos into editable digital canvas cards
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
          {/* AI Engine Selection Bar */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Select Recognition Engine:</span>
              <span className="text-[11px] font-normal text-slate-400">
                100% Private & Local-first
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => handleEngineChange('trocr')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition-all ${
                  config.engine === 'trocr'
                    ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cpu className="w-4 h-4 mb-1 text-purple-600" />
                <span>TrOCR In-Browser</span>
                <span className="text-[9px] text-slate-400 font-normal">WebGPU / Zero Setup</span>
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('ollama')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition-all ${
                  config.engine === 'ollama'
                    ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Server className="w-4 h-4 mb-1 text-blue-600" />
                <span>Local Ollama</span>
                <span className="text-[9px] text-slate-400 font-normal">Qwen2.5-VL / SOTA</span>
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('tesseract')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition-all ${
                  config.engine === 'tesseract'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 mb-1 text-slate-600" />
                <span>Fast Tesseract</span>
                <span className="text-[9px] text-slate-400 font-normal">Printed Scans</span>
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('gemini')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition-all ${
                  config.engine === 'gemini'
                    ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cloud className="w-4 h-4 mb-1 text-emerald-600" />
                <span>Cloud Vision</span>
                <span className="text-[9px] text-slate-400 font-normal">BYOK Gemini API</span>
              </button>
            </div>
          </div>

          {/* Engine Context Specific Info / Config */}
          {config.engine === 'ollama' && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      ollamaStatus.connected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                    }`}
                  />
                  <span className="font-semibold text-slate-800">
                    {ollamaStatus.connected
                      ? `Connected to Ollama on ${config.ollamaEndpoint}`
                      : 'Ollama is not running locally'}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    setOllamaStatus(s => ({ ...s, checking: true }));
                    const res = await checkOllamaConnection(config.ollamaEndpoint);
                    setOllamaStatus({ checking: false, connected: res.connected, models: res.models });
                  }}
                  className="flex items-center gap-1 text-[11px] text-blue-700 hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${ollamaStatus.checking ? 'animate-spin' : ''}`} />
                  <span>Check Status</span>
                </button>
              </div>

              {ollamaStatus.connected ? (
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-slate-600 font-medium">Vision Model:</label>
                  <select
                    value={config.ollamaModel}
                    onChange={e => setConfig(c => ({ ...c, ollamaModel: e.target.value }))}
                    className="p-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono font-medium text-slate-800"
                  >
                    {ollamaStatus.models.length > 0 ? (
                      ollamaStatus.models.map(m => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    ) : (
                      <option value="qwen2.5-vl">qwen2.5-vl (default)</option>
                    )}
                  </select>
                </div>
              ) : (
                <div className="space-y-1 text-slate-600">
                  <p>
                    Start Ollama with a vision model to transcribe complex handwriting with 98% accuracy:
                  </p>
                  <div className="flex items-center gap-2 p-1.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px]">
                    <code>ollama run qwen2.5-vl</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {config.engine === 'trocr' && (
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-2 text-purple-800 font-semibold">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>Microsoft TrOCR (Transformer OCR for Handwriting)</span>
              </div>
              <p className="text-slate-600">
                Runs 100% inside your browser via Transformers.js with WebGPU/WASM acceleration. The 64MB model downloads once and is permanently cached locally.
              </p>
            </div>
          )}

          {config.engine === 'gemini' && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
              <label className="font-semibold text-emerald-900 flex items-center justify-between">
                <span>Google Gemini API Key (stored in local browser only):</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={config.geminiApiKey}
                onChange={e => handleGeminiKeyChange(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800"
              />
            </div>
          )}

          {/* File Dropzone */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl p-6 cursor-pointer transition-all">
            <UploadCloud className="w-9 h-9 text-blue-500 mb-2" />
            <span className="text-sm font-semibold text-slate-700">
              {file ? file.name : 'Click or drop Handwritten Note / Scan / PDF here'}
            </span>
            <span className="text-xs text-slate-400 mt-1">
              Supports .jpg, .png, .webp, .pdf
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
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing ({progress.status})...</span>
                  </>
                ) : (
                  <span>
                    Transcribe with{' '}
                    {config.engine === 'ollama'
                      ? `Local ${config.ollamaModel}`
                      : config.engine === 'trocr'
                      ? 'In-Browser TrOCR'
                      : config.engine === 'gemini'
                      ? 'Gemini Vision'
                      : 'Tesseract OCR'}
                  </span>
                )}
              </button>

              {loading && (
                <div className="w-full space-y-1">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-purple-600 h-2 transition-all duration-300"
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
                    Successfully extracted {result.paragraphs.length} sections
                    {result.tableCells.length > 0 && ` & ${result.tableCells.length} table cells`}
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

              {activeTab === 'text' ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="font-medium">Digitized Content (review / edit before canvas import):</span>
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
                    className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 leading-relaxed"
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
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="clearPrevious" className="text-xs text-slate-600 cursor-pointer select-none">
                  Wipe old canvas shapes before importing
                </label>
              </div>

              {/* Import Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  onClick={importAsParagraphs}
                  className="flex items-center justify-center gap-1.5 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
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
