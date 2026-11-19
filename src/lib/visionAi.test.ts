import { describe, it, expect } from 'vitest';
import { parseMarkdownTables, parseMarkdownToOCRResult } from './visionAi';

describe('visionAi markdown parser', () => {
  it('parses markdown tables into spreadsheet grid coordinates', () => {
    const md = `
# Budget Estimate
| Item | Quantity | Cost |
| --- | --- | --- |
| Server | 2 | 1200 |
| Domain | 1 | 25 |
`;
    const cells = parseMarkdownTables(md);
    expect(cells.length).toBe(9); // 3 rows x 3 cols
    expect(cells[0]).toEqual({ row: 0, col: 0, text: 'Item' });
    expect(cells[1]).toEqual({ row: 0, col: 1, text: 'Quantity' });
    expect(cells[2]).toEqual({ row: 0, col: 2, text: 'Cost' });
    expect(cells[3]).toEqual({ row: 1, col: 0, text: 'Server' });
  });

  it('converts markdown blocks into structured canvas cards', () => {
    const md = `
Case Study 1: E-Commerce Architecture
An e-commerce platform supporting 100,000 concurrent users.

Questions:
1. Identify architectural bottlenecks.
2. Propose suitable microservice design.
`;
    const dummyCanvas = {
      width: 800,
      height: 600,
      toDataURL: () => 'data:image/png;base64,dummy',
    } as unknown as HTMLCanvasElement;

    const res = parseMarkdownToOCRResult(md, dummyCanvas);
    expect(res.paragraphs.length).toBe(2);
    expect(res.paragraphs[0].text).toContain('Case Study 1');
    expect(res.paragraphs[1].text).toContain('Questions:');
  });
});
