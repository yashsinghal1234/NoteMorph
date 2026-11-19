export type ToolMode = 
  | 'select'
  | 'pan'
  | 'draw'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'text'
  | 'sticky'
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
  type: 'line' | 'arrow' | 'rect' | 'circle' | 'triangle' | 'freehand' | 'text' | 'sticky';
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

export interface ClientPresence {
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor: { x: number; y: number } | null;
  focusedCellId: string | null;
  selectedShapeIds: string[];
}

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}
