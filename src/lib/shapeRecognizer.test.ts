import { describe, it, expect } from 'vitest';
import { recognizeStroke } from './shapeRecognizer';

describe('Shape Recognizer Engine', () => {
  it('recognizes a horizontal straight line', () => {
    // Generate a sequence of points along a horizontal line
    const points: [number, number][] = [];
    for (let x = 10; x <= 200; x += 10) {
      points.push([x, 50 + (Math.random() * 2 - 1)]); // Slight human jitter
    }

    const recognized = recognizeStroke(points);
    expect(recognized).not.toBeNull();
    expect(recognized?.type).toBe('line');
    expect(recognized?.width).toBeGreaterThan(150);
  });

  it('recognizes a drawn circle/ellipse', () => {
    // Generate 40 points in a circle with small radius variance
    const points: [number, number][] = [];
    const centerX = 150;
    const centerY = 150;
    const radius = 60;

    for (let i = 0; i <= 36; i++) {
      const angle = (i * 10 * Math.PI) / 180;
      const r = radius + (Math.random() * 3 - 1.5);
      points.push([centerX + r * Math.cos(angle), centerY + r * Math.sin(angle)]);
    }

    const recognized = recognizeStroke(points);
    expect(recognized).not.toBeNull();
    expect(recognized?.type).toBe('circle');
  });

  it('recognizes a closed rectangle', () => {
    // Draw 4 distinct edges returning to start
    const points: [number, number][] = [
      [50, 50], [100, 50], [150, 50], [200, 50],
      [200, 80], [200, 110], [200, 150],
      [150, 150], [100, 150], [50, 150],
      [50, 110], [50, 80], [50, 50]
    ];

    const recognized = recognizeStroke(points);
    expect(recognized).not.toBeNull();
    expect(recognized?.type).toBe('rect');
  });

  it('recognizes a drawn flowchart diamond', () => {
    const points: [number, number][] = [
      [100, 50], [125, 75], [150, 100],
      [125, 125], [100, 150],
      [75, 125], [50, 100],
      [75, 75], [100, 50]
    ];

    const recognized = recognizeStroke(points);
    expect(recognized).not.toBeNull();
    expect(recognized?.type).toBe('diamond');
  });

  it('recognizes a closed triangle', () => {
    const points: [number, number][] = [
      [100, 50], [125, 100], [150, 150],
      [100, 150], [50, 150],
      [75, 100], [100, 50]
    ];

    const recognized = recognizeStroke(points);
    expect(recognized).not.toBeNull();
    expect(recognized?.type).toBe('triangle');
  });

  it('returns null for an open, chaotic scribble', () => {
    const points: [number, number][] = [
      [10, 10], [20, 80], [40, 10], [60, 90], [80, 20], [100, 85], [120, 15]
    ];

    const recognized = recognizeStroke(points);
    expect(recognized).toBeNull();
  });
});
