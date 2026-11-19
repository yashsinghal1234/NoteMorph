import { HyperFormula } from 'hyperformula';

export class FormulaEngine {
  private hf: HyperFormula;
  private sheetId: number;

  constructor() {
    this.hf = HyperFormula.buildEmpty({
      licenseKey: 'gpl-v3',
    });
    const sheetName = this.hf.addSheet('Sheet1');
    this.sheetId = this.hf.getSheetId(sheetName) as number;
  }

  /** Convert 0-indexed column number to Excel column letters (0 -> A, 27 -> AB) */
  public static colToLetter(col: number): string {
    let temp: number;
    let letter = '';
    let c = col + 1;
    while (c > 0) {
      temp = (c - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      c = Math.floor((c - temp) / 26);
    }
    return letter;
  }

  /** Convert Excel cell reference e.g. "A1" to row/col */
  public static cellRefToCoords(ref: string): { row: number; col: number } | null {
    const match = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const letters = match[1];
    const row = parseInt(match[2], 10) - 1;
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    return { row, col: col - 1 };
  }

  /** Set raw cell content and compute value */
  public setCell(row: number, col: number, value: string): string {
    try {
      this.hf.setCellContents({ col, row, sheet: this.sheetId }, [[value]]);
      return this.getComputedValue(row, col);
    } catch {
      return value;
    }
  }

  /** Get calculated value of a cell */
  public getComputedValue(row: number, col: number): string {
    try {
      const val = this.hf.getCellValue({ col, row, sheet: this.sheetId });
      if (val === null || val === undefined) return '';
      if (typeof val === 'object' && 'value' in (val as any)) {
        return String((val as any).value);
      }
      return String(val);
    } catch {
      return '';
    }
  }

  /** Batch set entire grid contents for recomputation */
  public loadSheetData(data: (string | number)[][]) {
    try {
      this.hf.setSheetContent(this.sheetId, data);
    } catch (e) {
      console.error('Error loading sheet data:', e);
    }
  }

  /** Resolve cell value by reference like 'A1' */
  public getCellValueByRef(ref: string): string | null {
    const coords = FormulaEngine.cellRefToCoords(ref);
    if (!coords) return null;
    return this.getComputedValue(coords.row, coords.col);
  }
}

export const formulaEngine = new FormulaEngine();
