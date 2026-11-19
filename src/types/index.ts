export type ToolMode = 
  | 'select'
  | 'pan'
  | 'draw'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'diamond'
  | 'circle'
  | 'triangle'
  | 'text'
  | 'sticky'
  | 'eraser'
  | 'table';

export interface CellRecord {
  id: string;              // "r0:c0"
  row: number;
  col: number;
  raw: string;             // Raw text or formula e.g. "=SUM(A1:A5)"
  computed?: string;       // Evaluated output e.g. "1500"
  format?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    background?: string;
    align?: 'left' | 'center' | 'right';
  };
  comment?: string;
  updatedAt: number;
}

export interface ShapeRecord {
  id: string;              // UUID
  type: 'line' | 'arrow' | 'rect' | 'diamond' | 'circle' | 'triangle' | 'freehand' | 'text' | 'sticky';
  x: number;               // World coordinate
  y: number;
  width: number;
  height: number;
  rotation?: number;
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  points?: [number, number][]; // Freehand coordinate points [[x, y], ...]
  text?: string;
  ocrConfidence?: number;
  anchoredCellId?: string;
  bindCellRef?: string;    // e.g. "A1" or "B2"
  bindProperty?: 'label' | 'height' | 'color';
  updatedAt: number;
}

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface ClientPresence {
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor: { x: number; y: number } | null;
  focusedCellId: string | null;
}

export interface ExtractedOCRWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface ExtractedParagraph {
  id: string;
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedTableCell {
  row: number;
  col: number;
  text: string;
}

export interface OCRResult {
  rawText: string;
  cleanedText: string;
  paragraphs: ExtractedParagraph[];
  words: ExtractedOCRWord[];
  tableCells: ExtractedTableCell[];
  canvasDataUrl: string;
  width: number;
  height: number;
}

export type OCREngineType = 'ollama' | 'trocr' | 'gemini' | 'tesseract';

export interface VisionAIConfig {
  engine: OCREngineType;
  ollamaEndpoint: string;
  ollamaModel: string;
  geminiApiKey: string;
}
