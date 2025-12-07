
import React, { useRef, useCallback, useEffect, MouseEvent, memo } from 'react';
import type { DrawingCanvasObject, ResizeHandle, Tool } from '../types';

interface DrawingCanvasNodeProps {
  drawingCanvas: DrawingCanvasObject;
  scale: number;
  isSelected: boolean;
  onSelect: (e: MouseEvent, id: string) => void;
  updateDrawingCanvas: (id: string, newProps: Partial<DrawingCanvasObject>) => void;
  onDragStart: () => void;
  onDragMove: (e: globalThis.MouseEvent) => void;
  onDragEnd: () => void;
  activeTool: Tool;
  zIndex: number;
  selectionOrder?: number;
  totalSelected?: number;
}

const DrawingCanvasNode: React.FC<DrawingCanvasNodeProps> = ({
  drawingCanvas, scale, isSelected, onSelect, updateDrawingCanvas,
  onDragStart, onDragMove, onDragEnd, activeTool, zIndex, selectionOrder = 0, totalSelected = 0
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const actionRef = useRef<{
    type: 'drag' | 'resize' | null;
    handle?: ResizeHandle;
    initialMouse: { x: number; y: number };
    initialCanvas: DrawingCanvasObject;
  }>({ type: null, initialMouse: { x: 0, y: 0 }, initialCanvas: drawingCanvas });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      if (drawingCanvas.drawingSrc) {
        const image = new Image();
        image.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0);
        };
        image.src = drawingCanvas.drawingSrc;
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [drawingCanvas.drawingSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        canvas.width = drawingCanvas.width;
        canvas.height = drawingCanvas.height;
        const ctx = canvas.getContext('2d');
        if (ctx && drawingCanvas.drawingSrc) {
            const image = new Image();
            image.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            };
            image.src = drawingCanvas.drawingSrc;
        }
    }
  }, [drawingCanvas.width, drawingCanvas.height]);

  const getPointOnCanvas = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const handleDrawingMouseDown = (e: MouseEvent) => {
    if (activeTool !== 'pen' && activeTool !== 'eraser') return;
    
    // CRITICAL FIX: Only allow drawing if this canvas is already selected.
    // If not selected, let the event bubble or handle selection logic instead.
    if (!isSelected) {
        return; 
    }

    e.stopPropagation();
    isDrawing.current = true;
    lastPos.current = getPointOnCanvas(e);
  };

  const handleDrawingMouseMove = (e: MouseEvent) => {
    if (!isDrawing.current) return;
    e.stopPropagation();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const pos = getPointOnCanvas(e);
    if (!canvas || !ctx || !pos || !lastPos.current) return;

    ctx.beginPath();
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = activeTool === 'pen' ? '#000000' : 'rgba(0,0,0,1)';
    ctx.lineWidth = activeTool === 'eraser' ? 20 / scale : 5 / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos.current = pos;
  };

  const handleDrawingMouseUp = (e: MouseEvent) => {
    if (!isDrawing.current) return;
    e.stopPropagation();
    isDrawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      updateDrawingCanvas(drawingCanvas.id, { drawingSrc: canvas.toDataURL() });
    }
  };


  const handleActionMouseDown = useCallback((e: MouseEvent<HTMLDivElement>, type: 'drag' | 'resize', handle?: ResizeHandle) => {
    if (activeTool === 'pen' || activeTool === 'eraser') {
        // If drawing tools are active but we clicked a handle or the container (not the drawing surface logic above),
        // we might want to select it. 
        // If it WAS NOT selected, we should select it.
        if (!isSelected) {
             onSelect(e, drawingCanvas.id);
             return; // Don't start drag immediately on selection click to prevent jumps
        }
        // If it WAS selected, drawing logic (handleDrawingMouseDown) usually takes precedence for the canvas area.
        // But if we clicked a resize handle, we should resize even with pen active? 
        // Standard behavior: Handles override drawing.
        if (type === 'resize') {
             // proceed to resize logic below
        } else {
             return; // Let drawing logic handle drag on body
        }
    }

    e.stopPropagation();
    onSelect(e, drawingCanvas.id);
    
    if (type === 'resize' && !isSelected) return;

    if (type === 'drag') {
      onDragStart();
    }

    actionRef.current = {
      type,
      handle,
      initialMouse: { x: e.clientX, y: e.clientY },
      initialCanvas: { ...drawingCanvas }
    };
    window.addEventListener('mousemove', handleActionMouseMove);
    window.addEventListener('mouseup', handleActionMouseUp);
  }, [drawingCanvas, onSelect, isSelected, onDragStart, activeTool]);

  const handleActionMouseMove = useCallback((e: globalThis.MouseEvent) => {
    const { type, handle, initialMouse, initialCanvas } = actionRef.current;
    if (!type) return;

    const dx = (e.clientX - initialMouse.x) / scale;
    const dy = (e.clientY - initialMouse.y) / scale;

    if (type === 'drag') {
      onDragMove(e);
      updateDrawingCanvas(drawingCanvas.id, {
        x: initialCanvas.x + dx,
        y: initialCanvas.y + dy,
      });
    } else if (type === 'resize' && handle) {
        let { x, y, width, height } = initialCanvas;
        const minSize = 20;

        if (handle.includes('r')) width += dx;
        if (handle.includes('l')) { width -= dx; x += dx; }
        if (handle.includes('b')) height += dy;
        if (handle.includes('t')) { height -= dy; y += dy; }
        
        if (width < minSize) {
          width = minSize;
          if (handle.includes('l')) x = initialCanvas.x + initialCanvas.width - minSize;
        }
        if (height < minSize) {
          height = minSize;
          if (handle.includes('t')) y = initialCanvas.y + initialCanvas.height - minSize;
        }
        updateDrawingCanvas(drawingCanvas.id, { x, y, width, height });
    }
  }, [scale, updateDrawingCanvas, drawingCanvas.id, onDragMove]);

  const handleActionMouseUp = useCallback(() => {
    window.removeEventListener('mousemove', handleActionMouseMove);
    window.removeEventListener('mouseup', handleActionMouseUp);
    if (actionRef.current.type === 'drag') {
      onDragEnd();
    }
    actionRef.current.type = null;
  }, [handleActionMouseMove, onDragEnd]);

  const handles: ResizeHandle[] = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'];

  // Cursor logic: Crosshair if ready to draw (Selected AND Tool Active), otherwise move/default
  const showDrawingCursor = isSelected && (activeTool === 'pen' || activeTool === 'eraser');

  return (
    <div
      ref={nodeRef}
      className="absolute select-none border-2 border-transparent bg-white shadow-sm"
      style={{
        left: drawingCanvas.x,
        top: drawingCanvas.y,
        width: drawingCanvas.width,
        height: drawingCanvas.height,
        borderColor: isSelected ? '#4f46e5' : 'transparent',
        cursor: showDrawingCursor ? 'crosshair' : 'move',
        boxShadow: isSelected ? '0 0 0 1px #4f46e5' : '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        zIndex: zIndex,
      }}
      onMouseDown={(e) => handleActionMouseDown(e, 'drag')}
    >
      <canvas
        ref={canvasRef}
        width={drawingCanvas.width}
        height={drawingCanvas.height}
        className="absolute top-0 left-0 w-full h-full pointer-events-auto"
        onMouseDown={handleDrawingMouseDown}
        onMouseMove={handleDrawingMouseMove}
        onMouseUp={handleDrawingMouseUp}
        onMouseLeave={handleDrawingMouseUp}
      />
      
      {/* Selection Order Badge */}
      {selectionOrder > 0 && totalSelected > 1 && (
        <div 
           className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center bg-indigo-600 text-white text-xs font-bold rounded-full shadow-md z-10 pointer-events-none"
           style={{
             transform: `scale(${1 / scale})`,
             transformOrigin: 'top left',
           }}
        >
          {selectionOrder}
        </div>
      )}

      {isSelected && (
        <>
          {handles.map(handle => (
            <div
              key={handle}
              className={`absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full z-10 
              ${handle.includes('t') ? '-top-2' : ''} ${handle.includes('b') ? '-bottom-2' : ''}
              ${handle.includes('l') ? '-left-2' : ''} ${handle.includes('r') ? '-right-2' : ''}
              ${handle.includes('m') && !handle.includes('l') && !handle.includes('r') ? 'left-1/2 -translate-x-1/2' : ''}
              ${handle.includes('m') && !handle.includes('t') && !handle.includes('b') ? 'top-1/2 -translate-y-1/2' : ''}
              ${(handle === 'tm' || handle === 'bm') ? 'cursor-ns-resize' : 
                (handle === 'ml' || handle === 'mr') ? 'cursor-ew-resize' : 
                (handle === 'tl' || handle === 'br') ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}
              `}
              style={{ transform: `scale(${1 / scale})` }}
              onMouseDown={(e) => handleActionMouseDown(e, 'resize', handle)}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default memo(DrawingCanvasNode);
