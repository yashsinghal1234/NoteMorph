import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Local-first PDF worker: served locally from /pdf.worker.min.js (100% offline & privacy-first)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.js', window.location.origin).href;
}

export interface ExtractedOCRWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface ExtractedTableCell {
  row: number;
  col: number;
  text: string;
}

export interface OCRResult {
  rawText: string;
  words: ExtractedOCRWord[];
  tableCells: ExtractedTableCell[];
  canvasDataUrl: string;
  width: number;
  height: number;
}

/**
 * Process a PDF or image file, run Tesseract OCR, and cluster bounding boxes into table cells.
 */
export async function processDocumentOCR(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> {
  const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
  let canvas: HTMLCanvasElement;

  if (isPDF) {
    onProgress?.(0.1, 'Rendering PDF page...');
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1); // Page 1 for initial ingest

    const viewport = page.getViewport({ scale: 1.5 });
    canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create 2D canvas context');

    await page.render({ canvasContext: ctx, viewport }).promise;
  } else {
    onProgress?.(0.1, 'Loading image...');
    canvas = document.createElement('canvas');
    const img = new Image();
    const imgUrl = URL.createObjectURL(file);

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imgUrl;
    });

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(imgUrl);
  }

  onProgress?.(0.3, 'Pre-processing image for maximum OCR contrast...');
  preprocessCanvas(canvas);

  onProgress?.(0.4, 'Initializing OCR engine...');
  const worker = await createWorker('eng');

  onProgress?.(0.6, 'Recognizing text and positions...');
  const ret = await worker.recognize(canvas);
  await worker.terminate();

  onProgress?.(0.9, 'Clustering rows and columns...');
  const words: ExtractedOCRWord[] = (ret.data as any).words?.map((w: any) => ({
    text: w.text.trim(),
    confidence: w.confidence,
    bbox: w.bbox,
  })).filter((w: ExtractedOCRWord) => w.text.length > 0) || [];

  // Spatial clustering algorithm: cluster words into rows and columns
  const tableCells = clusterWordsIntoTable(words);

  onProgress?.(1.0, 'Complete');

  return {
    rawText: ret.data.text,
    words,
    tableCells,
    canvasDataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Image preprocessing to boost OCR character recognition on scans and photos.
 * Enhances contrast and binarizes extreme tones so Tesseract can cleanly separate ink from paper.
 */
function preprocessCanvas(canvas: HTMLCanvasElement) {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Adaptive contrast stretching: push paper background to clean white
      const enhanced = gray > 185 ? 255 : gray < 75 ? 0 : (gray - 75) * (255 / 110);
      const clamped = Math.max(0, Math.min(255, enhanced));
      data[i] = clamped;
      data[i + 1] = clamped;
      data[i + 2] = clamped;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('Canvas preprocessing skipped:', e);
  }
}

/**
 * Spatial Table Clustering Algorithm:
 * 1. Cluster words by vertical overlap into rows.
 * 2. Identify column gutters.
 * 3. Map into 2D grid coordinates.
 */
function clusterWordsIntoTable(words: ExtractedOCRWord[]): ExtractedTableCell[] {
  if (words.length === 0) return [];

  // Calculate median word height to determine line spacing tolerance
  const heights = words.map(w => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 16;
  const lineTolerance = medianHeight * 0.6;

  // 1. Group into horizontal rows
  const sortedWords = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const rows: ExtractedOCRWord[][] = [];

  for (const word of sortedWords) {
    const wordMidY = (word.bbox.y0 + word.bbox.y1) / 2;
    let placed = false;

    for (const row of rows) {
      const rowMidY = (row[0].bbox.y0 + row[0].bbox.y1) / 2;
      if (Math.abs(wordMidY - rowMidY) <= lineTolerance) {
        row.push(word);
        placed = true;
        break;
      }
    }

    if (!placed) {
      rows.push([word]);
    }
  }

  // Sort words inside each row by X coordinate
  for (const row of rows) {
    row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  }

  // 2. Identify distinct column bins
  // Aggregate all word X positions to determine global column gutters
  const xPositions = words.map(w => w.bbox.x0).sort((a, b) => a - b);
  const colThreshold = medianHeight * 3.5; // Gap distance to consider separate column
  const columnLefts: number[] = [];

  for (const x of xPositions) {
    if (!columnLefts.some(c => Math.abs(c - x) < colThreshold)) {
      columnLefts.push(x);
    }
  }
  columnLefts.sort((a, b) => a - b);

  // 3. Map into (row, col) table cells
  const tableCells: ExtractedTableCell[] = [];

  rows.forEach((row, rowIndex) => {
    // Merge words that belong to the same column
    const colBuckets = new Map<number, string[]>();

    for (const word of row) {
      let closestColIdx = 0;
      let minColDist = Infinity;

      columnLefts.forEach((cLeft, idx) => {
        const dist = Math.abs(word.bbox.x0 - cLeft);
        if (dist < minColDist) {
          minColDist = dist;
          closestColIdx = idx;
        }
      });

      const current = colBuckets.get(closestColIdx) || [];
      current.push(word.text);
      colBuckets.set(closestColIdx, current);
    }

    colBuckets.forEach((texts, colIndex) => {
      tableCells.push({
        row: rowIndex,
        col: colIndex,
        text: texts.join(' '),
      });
    });
  });

  return tableCells;
}
