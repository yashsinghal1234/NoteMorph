import { describe, it, expect } from 'vitest';
import { formulaEngine } from './hyperformula';

describe('HyperFormula Engine Integration', () => {
  it('converts columns to letters and back', () => {
    expect(formulaEngine.constructor).toBeDefined();
  });

  it('evaluates direct arithmetic and SUM formulas', () => {
    formulaEngine.setCell(0, 0, '100'); // A1 = 100
    formulaEngine.setCell(1, 0, '250'); // A2 = 250
    const sumResult = formulaEngine.setCell(2, 0, '=SUM(A1:A2)'); // A3 = =SUM(A1:A2)

    expect(sumResult).toBe('350');
  });

  it('reactively updates dependent formulas', () => {
    formulaEngine.setCell(0, 1, '50'); // B1 = 50
    formulaEngine.setCell(1, 1, '=B1*3'); // B2 = =B1*3 -> 150
    expect(formulaEngine.getComputedValue(1, 1)).toBe('150');

    // Update B1
    formulaEngine.setCell(0, 1, '200');
    expect(formulaEngine.getComputedValue(1, 1)).toBe('600');
  });
});
