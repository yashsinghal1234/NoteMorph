export interface RecognizedShape {
  type: 'line' | 'arrow' | 'rect' | 'circle' | 'triangle';
  x: number;
  y: number;
  width: number;
  height: number;
  points?: [number, number][];
}

/**
 * Real-time geometric stroke classifier.
 * Converts raw stylus/mouse stroke paths into crisp vector primitives
 * using Douglas-Peucker simplification, Shoelace area, and circularity metrics.
 */
export function recognizeStroke(rawPoints: [number, number][]): RecognizedShape | null {
  if (!rawPoints || rawPoints.length < 6) return null;

  // 1. Calculate path length and bounding box
  let pathLength = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < rawPoints.length; i++) {
    const [x, y] = rawPoints[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    if (i > 0) {
      const [px, py] = rawPoints[i - 1];
      pathLength += Math.hypot(x - px, y - py);
    }
  }

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  if (pathLength < 25) return null; // Too short to classify

  const [startX, startY] = rawPoints[0];
  const [endX, endY] = rawPoints[rawPoints.length - 1];
  const startEndDist = Math.hypot(endX - startX, endY - startY);

  // 2. Straight Line or Arrow Check
  const directRatio = startEndDist / pathLength;
  if (directRatio > 0.88) {
    // Check if the tail looks like an arrowhead (sharp reversal in last 20% of points)
    const tailIndex = Math.floor(rawPoints.length * 0.8);
    let hasArrowHead = false;
    if (rawPoints.length > 15) {
      const tailSegment = rawPoints.slice(tailIndex);
      for (let j = 1; j < tailSegment.length; j++) {
        const [cx, cy] = tailSegment[j];
        const [lx, ly] = tailSegment[j - 1];
        // Calculate angle between overall line vector and tail stroke
        const lineAngle = Math.atan2(endY - startY, endX - startX);
        const segmentAngle = Math.atan2(cy - ly, cx - lx);
        const angleDiff = Math.abs(lineAngle - segmentAngle);
        if (angleDiff > Math.PI * 0.6 && angleDiff < Math.PI * 1.4) {
          hasArrowHead = true;
          break;
        }
      }
    }

    return {
      type: hasArrowHead ? 'arrow' : 'line',
      x: minX,
      y: minY,
      width,
      height,
      points: [
        [startX, startY],
        [endX, endY],
      ],
    };
  }

  // 3. Closed Shape Check (Circle, Rectangle, Triangle)
  const isClosed = startEndDist / pathLength < 0.28;
  if (isClosed) {
    // Shoelace formula for polygon area
    let area = 0;
    for (let i = 0; i < rawPoints.length - 1; i++) {
      area += rawPoints[i][0] * rawPoints[i + 1][1] - rawPoints[i + 1][0] * rawPoints[i][1];
    }
    area = Math.abs(area) / 2;

    // Isoperimetric quotient (Circularity) = 4 * PI * Area / Perimeter^2
    const circularity = (4 * Math.PI * area) / (pathLength * pathLength);

    // If circularity is high, snap to circle/ellipse
    if (circularity > 0.72) {
      return {
        type: 'circle',
        x: minX,
        y: minY,
        width,
        height,
      };
    }

    // Douglas-Peucker path simplification to count corners
    const tolerance = Math.max(width, height) * 0.08;
    const simplified = douglasPeucker(rawPoints, tolerance);
    const cornerCount = simplified.length - 1; // Last point meets start point

    if (cornerCount === 3) {
      return {
        type: 'triangle',
        x: minX,
        y: minY,
        width,
        height,
      };
    }

    if (cornerCount >= 4 && cornerCount <= 6) {
      return {
        type: 'rect',
        x: minX,
        y: minY,
        width,
        height,
      };
    }

    // Default to rectangle if bounding box aspect ratio fits clean box
    if (circularity < 0.72 && area > width * height * 0.6) {
      return {
        type: 'rect',
        x: minX,
        y: minY,
        width,
        height,
      };
    }
  }

  return null; // Not recognized as primitive, retain freehand stroke
}

/** Ramer-Douglas-Peucker line simplification */
function douglasPeucker(points: [number, number][], epsilon: number): [number, number][] {
  if (points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const recResults2 = douglasPeucker(points.slice(index), epsilon);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

function perpendicularDistance(
  pt: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(pt[0] - lineStart[0], pt[1] - lineStart[1]);
  const u = ((pt[0] - lineStart[0]) * dx + (pt[1] - lineStart[1]) * dy) / (mag * mag);
  const clampedU = Math.max(0, Math.min(1, u));
  const projX = lineStart[0] + clampedU * dx;
  const projY = lineStart[1] + clampedU * dy;
  return Math.hypot(pt[0] - projX, pt[1] - projY);
}
