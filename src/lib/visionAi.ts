import { ExtractedParagraph, ExtractedTableCell, OCRResult, cleanOCRText } from './ocr';

export type OCREngineType = 'ollama' | 'trocr' | 'gemini' | 'tesseract';

export interface VisionAIConfig {
  engine: OCREngineType;
  ollamaEndpoint: string;
  ollamaModel: string;
  geminiApiKey: string;
}

export const DEFAULT_VISION_CONFIG: VisionAIConfig = {
  engine: 'trocr',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'qwen2.5-vl',
  geminiApiKey: '',
};

/**
 * Check if local Ollama server is running and discover installed vision models.
 */
export async function checkOllamaConnection(
  endpoint = 'http://localhost:11434'
): Promise<{ connected: boolean; models: string[] }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return { connected: false, models: [] };
    const data = await res.json();
    const models = (data.models || []).map((m: any) => m.name as string);
    return { connected: true, models };
  } catch {
    return { connected: false, models: [] };
  }
}

/**
 * Transcribe handwriting & document via local Ollama vision model (Qwen2.5-VL / Llama3.2-Vision).
 * Runs 100% offline and private on localhost.
 */
export async function runOllamaOCR(
  canvas: HTMLCanvasElement,
  config: VisionAIConfig,
  onProgress?: (val: number, status: string) => void
): Promise<OCRResult> {
  onProgress?.(0.2, 'Connecting to local Ollama vision engine...');

  const { connected } = await checkOllamaConnection(config.ollamaEndpoint);
  if (!connected) {
    throw new Error(
      `Cannot connect to Ollama at ${config.ollamaEndpoint}. Please ensure Ollama is running ('ollama serve') with a vision model like 'qwen2.5-vl'.`
    );
  }

  onProgress?.(0.4, `Encoding image for ${config.ollamaModel}...`);
  // Convert canvas to base64 JPEG
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

  onProgress?.(0.6, `Deciphering handwriting with ${config.ollamaModel}...`);
  const prompt = `You are a high-precision handwritten text and document transcription engine.
Carefully transcribe all handwritten and printed text from this image exactly as written.
- Preserve document structure, headings, bullet lists, and question numbers.
- If there are tables or tabular data, format them as clean Markdown tables with '|' columns.
- Correct any obvious messy stroke ambiguities using English vocabulary and domain context.
- Output ONLY the transcribed text in clean Markdown without commentary or introductory greetings.`;

  const response = await fetch(`${config.ollamaEndpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel || 'qwen2.5-vl',
      prompt,
      images: [base64Data],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const transcribedText = (result.response || '').trim();

  onProgress?.(0.9, 'Formatting structured canvas cards...');
  return parseMarkdownToOCRResult(transcribedText, canvas);
}

/**
 * Run Microsoft TrOCR in-browser using Transformers.js (WebGPU/WASM).
 * Zero server required, downloads 64MB model once and caches in browser.
 */
export async function runTrOCROCR(
  canvas: HTMLCanvasElement,
  onProgress?: (val: number, status: string) => void
): Promise<OCRResult> {
  onProgress?.(0.2, 'Loading in-browser TrOCR neural handwriting model...');

  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    // Configure to allow local cache
    env.allowLocalModels = false;

    onProgress?.(0.4, 'Initializing TrOCR pipeline (cached in browser)...');
    const ocr = await pipeline('image-to-text', 'Xenova/trocr-small-handwritten', {
      progress_callback: (progressInfo: any) => {
        if (progressInfo.status === 'progress') {
          const p = Math.round(progressInfo.progress || 0);
          onProgress?.(0.4 + (p / 100) * 0.3, `Downloading neural weights: ${p}%`);
        }
      },
    });

    onProgress?.(0.75, 'Transcribing handwriting with Vision Transformer...');
    const dataUrl = canvas.toDataURL('image/png');
    const output: any = await ocr(dataUrl);
    const transcribedText = output?.[0]?.generated_text || '';

    onProgress?.(0.95, 'Structuring recognized text...');
    return parseMarkdownToOCRResult(transcribedText, canvas);
  } catch (err: any) {
    console.warn('TrOCR browser model execution warning:', err);
    throw new Error(
      `In-browser TrOCR execution failed: ${err.message || err}. You can also use Local Ollama (Qwen2.5-VL) or standard high-resolution OCR.`
    );
  }
}

/**
 * Optional Bring-Your-Own-Key Gemini Vision API for instant cloud handwriting transcription.
 */
export async function runGeminiVisionOCR(
  canvas: HTMLCanvasElement,
  apiKey: string,
  onProgress?: (val: number, status: string) => void
): Promise<OCRResult> {
  if (!apiKey?.trim()) {
    throw new Error('Please enter a Gemini API key or switch to Local Ollama / In-Browser TrOCR.');
  }

  onProgress?.(0.3, 'Sending image to Gemini Vision API...');
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

  const prompt = `You are a high-precision document and handwriting transcription engine.
Transcribe all handwritten and printed text in this image with 100% faithfulness.
- Preserve headings, question numbers, and paragraphs cleanly.
- Format any tables as clean Markdown tables with '|' columns.
- Fix broken cursive words using semantic context.
- Output ONLY the transcribed content in clean Markdown without commentary.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `Gemini API error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  onProgress?.(0.9, 'Processing structured layout...');
  return parseMarkdownToOCRResult(text, canvas);
}

/**
 * Parse Markdown paragraphs and tables into structured OCRResult shapes.
 */
export function parseMarkdownToOCRResult(markdownText: string, canvas: HTMLCanvasElement): OCRResult {
  const cleaned = cleanOCRText(markdownText);
  const tableCells = parseMarkdownTables(markdownText);

  // Split into coherent paragraph cards
  const rawBlocks = cleaned
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(b => b.length > 0 && !/^\|[-:\s|]+\|$/.test(b));

  let currentY = 80;
  const paragraphs: ExtractedParagraph[] = rawBlocks.map((b, idx) => {
    const lineCount = b.split('\n').length;
    const estimatedHeight = Math.max(lineCount * 28 + Math.floor(b.length / 55) * 20 + 44, 85);
    const p: ExtractedParagraph = {
      id: `ai_p_${idx}`,
      text: b,
      confidence: 99,
      x: 80,
      y: currentY,
      width: 640,
      height: estimatedHeight,
    };
    currentY += estimatedHeight + 28;
    return p;
  });

  return {
    rawText: markdownText,
    cleanedText: cleaned,
    paragraphs,
    words: [],
    tableCells,
    canvasDataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Extract 2D table coordinates from Markdown tables.
 */
export function parseMarkdownTables(text: string): ExtractedTableCell[] {
  const lines = text.split('\n');
  const cells: ExtractedTableCell[] = [];
  let tableRowIdx = 0;
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (/^\|[-:\s|]+\|$/.test(trimmed)) {
        continue; // Header separator
      }
      inTable = true;
      const cols = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());

      cols.forEach((colText, colIdx) => {
        cells.push({
          row: tableRowIdx,
          col: colIdx,
          text: colText,
        });
      });
      tableRowIdx++;
    } else {
      if (inTable) {
        inTable = false;
        tableRowIdx += 2;
      }
    }
  }

  return cells;
}
