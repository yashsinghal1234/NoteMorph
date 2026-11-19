import React, { useRef, useState, useEffect, useCallback } from 'react';
import getStroke from 'perfect-freehand';
import { ShapeRecord, ToolMode, ViewportTransform } from '../types';
import { setShape, deleteShape } from '../lib/crdt';
import { recognizeStroke } from '../lib/shapeRecognizer';

interface CanvasProps {
  tool: ToolMode;
  setTool: (tool: ToolMode) => void;
  color: string;
  strokeWidth: number;
  shapes: Map<string, ShapeRecord>;
  shapeOrder: string[];
  viewport: ViewportTransform;
  setViewport: React.Dispatch<React.SetStateAction<ViewportTransform>>;
}

export const Canvas: React.FC<CanvasProps> = ({
  tool,
  setTool,
  color,
  strokeWidth,
  shapes,
  shapeOrder,
  viewport,
  setViewport,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<[number, number][]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [shapeStartWorld, setShapeStartWorld] = useState<{ x: number; y: number } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Track spacebar for pan shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Convert screen coordinates to world canvas coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): [number, number] => {
      const rect = containerRef.current?.getBoundingClientRect();
      const clientX = screenX - (rect?.left || 0);
      const clientY = screenY - (rect?.top || 0);
      return [
        (clientX - viewport.x) / viewport.zoom,
        (clientY - viewport.y) / viewport.zoom,
      ];
    },
    [viewport]
  );

  // Wheel event for smooth zoom around cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+Wheel
        const zoomDelta = e.deltaY < 0 ? 1.1 : 0.9;
        setViewport(prev => {
          const newZoom = Math.min(Math.max(prev.zoom * zoomDelta, 0.15), 5.0);
          return {
            zoom: newZoom,
            x: cursorX - ((cursorX - prev.x) / prev.zoom) * newZoom,
            y: cursorY - ((cursorY - prev.y) / prev.zoom) * newZoom,
          };
        });
      } else {
        // Pan
        setViewport(prev => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [setViewport]);

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent) => {
    // If clicking on background or middle button
    if (e.button === 1 || tool === 'pan' || isSpacePressed) {
      setDragStart({ x: e.clientX, y: e.clientY });
      setIsPointerDown(true);
      return;
    }

    const [worldX, worldY] = screenToWorld(e.clientX, e.clientY);

    if (tool === 'select') {
      // Find clicked shape (reverse order for top-most)
      let clickedId: string | null = null;
      for (let i = shapeOrder.length - 1; i >= 0; i--) {
        const shape = shapes.get(shapeOrder[i]);
        if (!shape) continue;

        if (
          worldX >= shape.x &&
          worldX <= shape.x + shape.width &&
          worldY >= shape.y &&
          worldY <= shape.y + shape.height
        ) {
          clickedId = shape.id;
          break;
        }
      }

      setSelectedShapeId(clickedId);
      if (clickedId) {
        const clickedShape = shapes.get(clickedId);
        setDragStart({ x: e.clientX, y: e.clientY });
        setShapeStartWorld(clickedShape ? { x: clickedShape.x, y: clickedShape.y } : null);
      }
      setIsPointerDown(true);
      return;
    }

    // Start drawing stroke or shape
    setIsPointerDown(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setCurrentStroke([[worldX, worldY]]);
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown) return;

    if (tool === 'pan' || e.buttons === 4 || isSpacePressed) {
      if (dragStart) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
      return;
    }

    if (tool === 'select' && selectedShapeId && shapeStartWorld && dragStart) {
      const dx = (e.clientX - dragStart.x) / viewport.zoom;
      const dy = (e.clientY - dragStart.y) / viewport.zoom;
      const shape = shapes.get(selectedShapeId);
      if (shape) {
        setShape({
          ...shape,
          x: shapeStartWorld.x + dx,
          y: shapeStartWorld.y + dy,
        });
      }
      return;
    }

    // Accumulate points for drawing
    const [worldX, worldY] = screenToWorld(e.clientX, e.clientY);
    setCurrentStroke(prev => [...prev, [worldX, worldY]]);
  };

  // Pointer Up: Commit Shape
  const handlePointerUp = () => {
    if (!isPointerDown) return;
    setIsPointerDown(false);
    setDragStart(null);
    setShapeStartWorld(null);

    if (tool === 'pan' || tool === 'select') return;
    if (currentStroke.length < 2) {
      setCurrentStroke([]);
      return;
    }

    const [startX, startY] = currentStroke[0];
    const [endX, endY] = currentStroke[currentStroke.length - 1];
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    const minX = Math.min(startX, endX);
    const minY = Math.min(startY, endY);
    const id = `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (tool === 'draw') {
      // Execute intelligent stroke recognition!
      const recognized = recognizeStroke(currentStroke);
      if (recognized) {
        // Auto-snapped to geometric primitive
        setShape({
          id,
          type: recognized.type,
          x: recognized.x,
          y: recognized.y,
          width: recognized.width,
          height: recognized.height,
          strokeColor: color,
          fillColor: recognized.type === 'circle' || recognized.type === 'rect' ? `${color}15` : undefined,
          strokeWidth,
          points: recognized.points,
          updatedAt: Date.now(),
        });
      } else {
        // Retain as freehand stroke
        setShape({
          id,
          type: 'freehand',
          x: minX,
          y: minY,
          width: Math.max(width, 10),
          height: Math.max(height, 10),
          strokeColor: color,
          strokeWidth,
          points: currentStroke,
          updatedAt: Date.now(),
        });
      }
    } else if (tool === 'rect') {
      setShape({
        id,
        type: 'rect',
        x: minX,
        y: minY,
        width: Math.max(width, 20),
        height: Math.max(height, 20),
        strokeColor: color,
        fillColor: `${color}15`,
        strokeWidth,
        updatedAt: Date.now(),
      });
    } else if (tool === 'circle') {
      setShape({
        id,
        type: 'circle',
        x: minX,
        y: minY,
        width: Math.max(width, 20),
        height: Math.max(height, 20),
        strokeColor: color,
        fillColor: `${color}15`,
        strokeWidth,
        updatedAt: Date.now(),
      });
    } else if (tool === 'triangle') {
      setShape({
        id,
        type: 'triangle',
        x: minX,
        y: minY,
        width: Math.max(width, 20),
        height: Math.max(height, 20),
        strokeColor: color,
        fillColor: `${color}15`,
        strokeWidth,
        updatedAt: Date.now(),
      });
    } else if (tool === 'line' || tool === 'arrow') {
      setShape({
        id,
        type: tool,
        x: minX,
        y: minY,
        width: Math.max(width, 10),
        height: Math.max(height, 10),
        strokeColor: color,
        strokeWidth,
        points: [
          [startX, startY],
          [endX, endY],
        ],
        updatedAt: Date.now(),
      });
    } else if (tool === 'text') {
      setShape({
        id,
        type: 'text',
        x: minX,
        y: minY,
        width: Math.max(width, 140),
        height: Math.max(height, 80),
        strokeColor: color,
        strokeWidth,
        text: 'Type note...',
        updatedAt: Date.now(),
      });
      setTool('select');
    }

    setCurrentStroke([]);
  };

  // Convert points to SVG path string using perfect-freehand
  const getSvgPathFromStroke = (points: [number, number][], strokeW: number): string => {
    if (!points || points.length === 0) return '';
    const stroke = getStroke(points, {
      size: strokeW * 2,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });
    if (!stroke || stroke.length === 0) return '';
    const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
      },
      ['M', ...stroke[0], 'Q']
    );
    d.push('Z');
    return d.join(' ');
  };

  // Delete selected shape with Backspace or Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedShapeId) {
        deleteShape(selectedShapeId);
        setSelectedShapeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`relative w-full h-full overflow-hidden infinite-grid-pattern touch-none ${
        tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
      }`}
      style={
        {
          '--grid-size': `${32 * viewport.zoom}px`,
          '--grid-offset-x': `${viewport.x}px`,
          '--grid-offset-y': `${viewport.y}px`,
        } as React.CSSProperties
      }
    >
      {/* SVG Canvas World */}
      <svg
        className="w-full h-full pointer-events-none"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={color} />
          </marker>
        </defs>

        {/* Existing Shapes */}
        {shapeOrder.map(id => {
          const shape = shapes.get(id);
          if (!shape) return null;
          const isSelected = selectedShapeId === shape.id;

          return (
            <g key={shape.id} className="pointer-events-auto">
              {shape.type === 'rect' && (
                <rect
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  rx="6"
                  stroke={shape.strokeColor}
                  strokeWidth={shape.strokeWidth}
                  fill={shape.fillColor || 'transparent'}
                />
              )}

              {shape.type === 'circle' && (
                <ellipse
                  cx={shape.x + shape.width / 2}
                  cy={shape.y + shape.height / 2}
                  rx={shape.width / 2}
                  ry={shape.height / 2}
                  stroke={shape.strokeColor}
                  strokeWidth={shape.strokeWidth}
                  fill={shape.fillColor || 'transparent'}
                />
              )}

              {shape.type === 'triangle' && (
                <polygon
                  points={`${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height} ${shape.x},${shape.y + shape.height}`}
                  stroke={shape.strokeColor}
                  strokeWidth={shape.strokeWidth}
                  fill={shape.fillColor || 'transparent'}
                />
              )}

              {shape.type === 'line' && shape.points && (
                <line
                  x1={shape.points[0][0]}
                  y1={shape.points[0][1]}
                  x2={shape.points[1][0]}
                  y2={shape.points[1][1]}
                  stroke={shape.strokeColor}
                  strokeWidth={shape.strokeWidth}
                  strokeLinecap="round"
                />
              )}

              {shape.type === 'arrow' && shape.points && (
                <line
                  x1={shape.points[0][0]}
                  y1={shape.points[0][1]}
                  x2={shape.points[1][0]}
                  y2={shape.points[1][1]}
                  stroke={shape.strokeColor}
                  strokeWidth={shape.strokeWidth}
                  strokeLinecap="round"
                  markerEnd="url(#arrowhead)"
                />
              )}

              {shape.type === 'freehand' && shape.points && (
                <path
                  d={getSvgPathFromStroke(shape.points, shape.strokeWidth)}
                  fill={shape.strokeColor}
                />
              )}

              {shape.type === 'text' && (
                <foreignObject
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                >
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => {
                      setShape({ ...shape, text: e.currentTarget.textContent || '' });
                    }}
                    className="w-full h-full p-2 bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm text-xs text-slate-800 outline-none font-sans overflow-auto"
                  >
                    {shape.text}
                  </div>
                </foreignObject>
              )}

              {/* Selection Halo */}
              {isSelected && (
                <rect
                  x={shape.x - 4}
                  y={shape.y - 4}
                  width={shape.width + 8}
                  height={shape.height + 8}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  rx="8"
                />
              )}
            </g>
          );
        })}

        {/* Live Active Stroke Preview */}
        {currentStroke.length > 1 && tool === 'draw' && (
          <path
            d={getSvgPathFromStroke(currentStroke, strokeWidth)}
            fill={color}
            opacity="0.85"
          />
        )}
      </svg>
    </div>
  );
};
