import { describe, it, expect } from 'vitest';
import { cleanOCRText } from './ocr';

describe('cleanOCRText', () => {
  it('corrects common OCR misreads such as q instead of g in diagram and ing', () => {
    const raw = 'Draw activity diaqram and architectural modelinq of theposed system';
    const cleaned = cleanOCRText(raw);
    expect(cleaned).toContain('diagram');
    expect(cleaned).toContain('modeling');
    expect(cleaned).toContain('the proposed');
  });

  it('unmerges concatenated words produced by tight character spacing', () => {
    const raw = 'platform includes product catalogmanagement and orderprocessing with paymentgateways';
    const cleaned = cleanOCRText(raw);
    expect(cleaned).toContain('catalog management');
    expect(cleaned).toContain('order processing');
    expect(cleaned).toContain('payment gateways');
  });

  it('corrects hospital and architecture domain typos', () => {
    const raw = 'hAspital wants develop software fpatienteaistration and nonolithic irchitecture';
    const cleaned = cleanOCRText(raw);
    expect(cleaned).toContain('hospital');
    expect(cleaned).toContain('monolithic architecture');
  });
});
