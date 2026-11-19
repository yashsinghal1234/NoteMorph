import React, { useRef, useState, useEffect, useCallback } from 'react';
import getStroke from 'perfect-freehand';
import { ShapeRecord, ToolMode, ViewportTransform, CellRecord } from '../types';
import { setShape, deleteShape } from '../lib/crdt';
import { recognizeStroke } from '../lib/shapeRecognizer';
import { formulaEngine, FormulaEngine } from '../lib/hyperformula';
import { Link2, Trash2, Unlink } from 'lucide-react';

interface CanvasProps {
  tool: ToolMode;
  setTool: (tool: ToolMode) => void;
  color: string;
  strokeWidth: number;
  shapes: Map<string, ShapeRecord>;
  shapeOrder: string[];
  cells: Map<string, CellRecord>;
  autoSnap: boolean;
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
  cells,
  autoSnap,
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
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const handleShapeDoubleClick = (e: React.MouseEvent, shape: ShapeRecord) => {
    e.stopPropagation();
    setEditingShapeId(shape.id);
    setEditingText(shape.text || '');
  };

  const commitShapeText = () => {
    if (!editingShapeId) return;
    const shape = shapes.get(editingShapeId);
    if (shape) {
      setShape({ ...shape, text: editingText, updatedAt: Date.now() });
    }
    setEditingShapeId(null);
  };

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

  // Direct shape pointer down - allows selecting individual shapes effortlessly
  const handleShapePointerDown = (e: React.PointerEvent, shape: ShapeRecord) => {
    if (tool === 'pan' || isSpacePressed || e.button === 1) return;
    e.stopPropagation();
    if (tool === 'eraser') {
      deleteShape(shape.id);
      setSelectedShapeId(null);
      return;
    }
    setSelectedShapeId(shape.id);
    setTool('select');
    setDragStart({ x: e.clientX, y: e.clientY });
    setShapeStartWorld({ x: shape.x, y: shape.y });
    setIsPointerDown(true);
  };

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
      // Find clicked shape with generous hit testing padding (reverse order for top-most)
      let clickedId: string | null = null;
      const hitMargin = 16;

      for (let i = shapeOrder.length - 1; i >= 0; i--) {
        const shape = shapes.get(shapeOrder[i]);
        if (!shape) continue;

        const boundValue = shape.bindCellRef
          ? formulaEngine.getCellValueByRef(shape.bindCellRef)
          : null;
        const num = Number(boundValue);
        const curHeight =
          shape.bindProperty === 'height' && !isNaN(num) && num > 0
            ? Math.min(Math.max(num, 15), 800)
            : shape.height;

        if (
          worldX >= shape.x - hitMargin &&
          worldX <= shape.x + shape.width + hitMargin &&
          worldY >= shape.y - hitMargin &&
          worldY <= shape.y + curHeight + hitMargin
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

    // Compute true bounding box across all points in stroke
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const [px, py] of currentStroke) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    const width = Math.max(maxX - minX, 15);
    const height = Math.max(maxY - minY, 15);
    const [startX, startY] = currentStroke[0];
    const [endX, endY] = currentStroke[currentStroke.length - 1];
    const id = `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (tool === 'draw') {
      // Execute intelligent stroke recognition if autoSnap is enabled!
      const recognized = autoSnap ? recognizeStroke(currentStroke) : null;
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
        width: Math.max(width, 60),
        height: Math.max(height, 50),
        strokeColor: color,
        fillColor: '#ffffff',
        strokeWidth,
        text: '',
        updatedAt: Date.now(),
      });
    } else if (tool === 'diamond') {
      setShape({
        id,
        type: 'diamond',
        x: minX,
        y: minY,
        width: Math.max(width, 70),
        height: Math.max(height, 70),
        strokeColor: color,
        fillColor: '#ffffff',
        strokeWidth,
        text: '',
        updatedAt: Date.now(),
      });
    } else if (tool === 'sticky') {
      setShape({
        id,
        type: 'sticky',
        x: minX,
        y: minY,
        width: Math.max(width, 160),
        height: Math.max(height, 160),
        strokeColor: '#ca8a04',
        fillColor: '#fef08a',
        strokeWidth: 1,
        text: '',
        updatedAt: Date.now(),
      });
      setEditingShapeId(id);
      setEditingText('');
      setSelectedShapeId(id);
      setTool('select');
    } else if (tool === 'circle') {
      setShape({
        id,
        type: 'circle',
        x: minX,
        y: minY,
        width: Math.max(width, 50),
        height: Math.max(height, 50),
        strokeColor: color,
        fillColor: '#ffffff',
        strokeWidth,
        text: '',
        updatedAt: Date.now(),
      });
    } else if (tool === 'triangle') {
      setShape({
        id,
        type: 'triangle',
        x: minX,
        y: minY,
        width: Math.max(width, 50),
        height: Math.max(height, 50),
        strokeColor: color,
        fillColor: '#ffffff',
        strokeWidth,
        text: '',
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
        height: Math.max(height, 60),
        strokeColor: color,
        strokeWidth: 1,
        text: '',
        updatedAt: Date.now(),
      });
      setEditingShapeId(id);
      setEditingText('');
      setSelectedShapeId(id);
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

  // Keyboard shortcuts on selected shape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedShapeId && !editingShapeId) {
        deleteShape(selectedShapeId);
        setSelectedShapeId(null);
      } else if (e.key === 'Enter' && selectedShapeId && !editingShapeId) {
        const shape = shapes.get(selectedShapeId);
        if (shape) {
          setEditingShapeId(shape.id);
          setEditingText(shape.text || '');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, editingShapeId, shapes]);

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
          <filter id="sticky-shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="2" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.12" />
          </filter>
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

          // Resolve live reactive data binding if shape is bound to a cell
          const boundValue = shape.bindCellRef
            ? formulaEngine.getCellValueByRef(shape.bindCellRef)
            : null;
          const num = Number(boundValue);
          const displayHeight =
            shape.bindProperty === 'height' && !isNaN(num) && num > 0
              ? Math.min(Math.max(num, 15), 800)
              : shape.height;
          const displayStrokeColor =
            shape.bindProperty === 'color' && !isNaN(num)
              ? num < 0
                ? '#ef4444'
                : '#10b981'
              : shape.strokeColor;

          return (
            <g
              key={shape.id}
              className="pointer-events-auto cursor-pointer"
              onPointerDown={e => handleShapePointerDown(e, shape)}
              onDoubleClick={e => handleShapeDoubleClick(e, shape)}
              style={{ pointerEvents: 'all' }}
            >
              {/* Sticky Note */}
              {shape.type === 'sticky' && (
                <>
                  <rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={displayHeight}
                    rx="8"
                    fill={shape.fillColor || '#fef08a'}
                    stroke="#ca8a04"
                    strokeWidth="1.5"
                    filter="url(#sticky-shadow)"
                    pointerEvents="all"
                  />
                  <text
                    x={shape.x + shape.width - 12}
                    y={shape.y + displayHeight - 12}
                    textAnchor="end"
                    fontSize="12"
                    fill="#854d0e"
                    opacity="0.8"
                    className="font-handwritten select-none"
                  >
                    {new Date(shape.updatedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </text>
                </>
              )}

              {/* Diamond */}
              {shape.type === 'diamond' && (
                <polygon
                  points={`${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + displayHeight / 2} ${shape.x + shape.width / 2},${shape.y + displayHeight} ${shape.x},${shape.y + displayHeight / 2}`}
                  stroke={displayStrokeColor}
                  strokeWidth={shape.strokeWidth}
                  strokeLinejoin="round"
                  fill={shape.fillColor || '#ffffff'}
                  pointerEvents="all"
                />
              )}

              {/* Rectangle */}
              {shape.type === 'rect' && (
                <rect
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={displayHeight}
                  rx="8"
                  stroke={displayStrokeColor}
                  strokeWidth={shape.strokeWidth}
                  strokeLinejoin="round"
                  fill={shape.fillColor || '#ffffff'}
                  pointerEvents="all"
                />
              )}

              {/* Circle / Ellipse */}
              {shape.type === 'circle' && (
                <ellipse
                  cx={shape.x + shape.width / 2}
                  cy={shape.y + displayHeight / 2}
                  rx={shape.width / 2}
                  ry={displayHeight / 2}
                  stroke={displayStrokeColor}
                  strokeWidth={shape.strokeWidth}
                  fill={shape.fillColor || '#ffffff'}
                  pointerEvents="all"
                />
              )}

              {/* Triangle */}
              {shape.type === 'triangle' && (
                <polygon
                  points={`${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + displayHeight} ${shape.x},${shape.y + displayHeight}`}
                  stroke={displayStrokeColor}
                  strokeWidth={shape.strokeWidth}
                  strokeLinejoin="round"
                  fill={shape.fillColor || '#ffffff'}
                  pointerEvents="all"
                />
              )}

              {/* Line */}
              {shape.type === 'line' && shape.points && (
                <>
                  <line
                    x1={shape.points[0][0]}
                    y1={shape.points[0][1]}
                    x2={shape.points[1][0]}
                    y2={shape.points[1][1]}
                    stroke="transparent"
                    strokeWidth={Math.max(shape.strokeWidth + 18, 24)}
                    pointerEvents="stroke"
                  />
                  <line
                    x1={shape.points[0][0]}
                    y1={shape.points[0][1]}
                    x2={shape.points[1][0]}
                    y2={shape.points[1][1]}
                    stroke={displayStrokeColor}
                    strokeWidth={shape.strokeWidth}
                    strokeLinecap="round"
                    pointerEvents="stroke"
                  />
                </>
              )}

              {/* Arrow */}
              {shape.type === 'arrow' && shape.points && (
                <>
                  <line
                    x1={shape.points[0][0]}
                    y1={shape.points[0][1]}
                    x2={shape.points[1][0]}
                    y2={shape.points[1][1]}
                    stroke="transparent"
                    strokeWidth={Math.max(shape.strokeWidth + 18, 24)}
                    pointerEvents="stroke"
                  />
                  <line
                    x1={shape.points[0][0]}
                    y1={shape.points[0][1]}
                    x2={shape.points[1][0]}
                    y2={shape.points[1][1]}
                    stroke={displayStrokeColor}
                    strokeWidth={shape.strokeWidth}
                    strokeLinecap="round"
                    markerEnd="url(#arrowhead)"
                    pointerEvents="stroke"
                  />
                </>
              )}

              {/* Freehand */}
              {shape.type === 'freehand' && shape.points && (
                <path
                  d={getSvgPathFromStroke(shape.points, shape.strokeWidth)}
                  fill={displayStrokeColor}
                  pointerEvents="all"
                />
              )}

              {/* Direct Text Embedded in ANY Closed Shape (No separate text boxes!) */}
              {shape.type !== 'line' && shape.type !== 'arrow' && shape.type !== 'freehand' && (
                <foreignObject
                  x={shape.x + 8}
                  y={shape.y + 8}
                  width={Math.max(shape.width - 16, 20)}
                  height={Math.max(displayHeight - (shape.type === 'sticky' ? 28 : 16), 20)}
                  className={editingShapeId === shape.id ? 'pointer-events-auto z-40' : 'pointer-events-none'}
                >
                  <div className="w-full h-full flex items-center justify-center text-center overflow-hidden">
                    {editingShapeId === shape.id ? (
                      <textarea
                        autoFocus
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onBlur={commitShapeText}
                        onKeyDown={e => {
                          if (e.key === 'Escape') commitShapeText();
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            commitShapeText();
                          }
                        }}
                        placeholder="Type here..."
                        className="w-full h-full bg-transparent outline-none resize-none text-center font-handwritten text-slate-900 text-lg md:text-xl p-0 overflow-auto border-none focus:ring-0 leading-snug"
                      />
                    ) : (
                      <span className="font-handwritten text-slate-900 text-lg md:text-xl leading-snug whitespace-pre-wrap break-words select-none">
                        {shape.bindCellRef && (!shape.bindProperty || shape.bindProperty === 'label')
                          ? `${shape.text ? `${shape.text} ` : ''}[${boundValue ?? '...'}]`
                          : shape.text}
                      </span>
                    )}
                  </div>
                </foreignObject>
              )}

              {/* Data Binding Pill Badge */}
              {shape.bindCellRef && (
                <g transform={`translate(${shape.x + 4}, ${shape.y - 14})`}>
                  <rect
                    x="0"
                    y="0"
                    width={Math.max((shape.bindCellRef.length + (boundValue?.length || 0)) * 7 + 24, 60)}
                    height="16"
                    rx="4"
                    fill="#eff6ff"
                    stroke="#3b82f6"
                    strokeWidth="1"
                  />
                  <text
                    x="5"
                    y="11"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#1d4ed8"
                  >
                    ⚯ {shape.bindCellRef}: {boundValue ?? '...'}
                  </text>
                </g>
              )}

              {/* Selection Halo */}
              {isSelected && (
                <rect
                  x={shape.x - 4}
                  y={shape.y - 4}
                  width={shape.width + 8}
                  height={displayHeight + 8}
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

      {/* Floating Data-Binding Shape Inspector */}
      {selectedShapeId && shapes.has(selectedShapeId) && (
        (() => {
          const selShape = shapes.get(selectedShapeId)!;
          return (
            <div
              className="absolute z-30 flex items-center gap-2 p-2 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 text-xs animate-in fade-in"
              style={{
                left: Math.max(16, selShape.x * viewport.zoom + viewport.x),
                top: Math.max(16, (selShape.y + selShape.height + 12) * viewport.zoom + viewport.y),
              }}
              onPointerDown={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Link2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Bind Cell:</span>
                <input
                  type="text"
                  placeholder="e.g. A1"
                  value={selShape.bindCellRef || ''}
                  onChange={e => {
                    setShape({ ...selShape, bindCellRef: e.target.value.toUpperCase().trim() });
                  }}
                  className="w-16 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-[11px] uppercase outline-none focus:border-blue-500"
                />
              </div>

              {selShape.bindCellRef && (
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
                  {(['label', 'height', 'color'] as const).map(prop => (
                    <button
                      key={prop}
                      onClick={() => setShape({ ...selShape, bindProperty: prop })}
                      className={`px-1.5 py-0.5 rounded capitalize ${
                        (selShape.bindProperty || 'label') === prop
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {prop}
                    </button>
                  ))}
                  <button
                    title="Unbind Cell"
                    onClick={() => {
                      const { bindCellRef, bindProperty, ...rest } = selShape;
                      setShape({ ...rest, updatedAt: Date.now() });
                    }}
                    className="p-1 hover:text-red-600 text-slate-400"
                  >
                    <Unlink className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="w-[1px] h-4 bg-slate-200" />

              <button
                title="Delete Shape"
                onClick={() => {
                  deleteShape(selShape.id);
                  setSelectedShapeId(null);
                }}
                className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })()
      )}
    </div>
  );
};
