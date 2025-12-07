
import React, { useCallback, useRef, MouseEvent, memo, useState, useEffect } from 'react';
import type { ImageObject, ResizeHandle, Tool } from '../types';
import ImageInfoOverlay from './ImageInfoOverlay';
import { PlayIcon } from './icons';

interface ImageNodeProps {
  image: ImageObject;
  scale: number;
  updateImage: (id: string, newProps: Partial<ImageObject>) => void;
  isSelected: boolean;
  onSelect: (e: MouseEvent<HTMLDivElement>, id: string) => void;
  showHandles: boolean;
  selectionOrder: number;
  totalSelected: number;
  onDragStart: () => void;
  onDragMove: (e: globalThis.MouseEvent) => void;
  onDragEnd: () => void;
  isActiveUI: boolean;
  setActiveImageUI: (id: string | null) => void;
  onUpdateDetails: (id: string, details: Partial<Pick<ImageObject, 'classification' | 'name'>>) => void;
  onPastePrompt: (prompt: string) => void;
  zIndex: number;
  onOpenVideoModal?: (image: ImageObject) => void;
  onExtractLastFrame?: (videoSrc: string, sourceImage: ImageObject) => void;
  activeTool?: Tool;
}

const ImageNode: React.FC<ImageNodeProps> = ({ 
  image, scale, updateImage, isSelected, onSelect, showHandles, selectionOrder, 
  totalSelected, onDragStart, onDragMove, onDragEnd, isActiveUI, setActiveImageUI, onUpdateDetails, onPastePrompt, zIndex, onOpenVideoModal, onExtractLastFrame,
  activeTool
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const isDrawingMask = useRef(false);
  const lastMaskPos = useRef<{ x: number; y: number } | null>(null);
  
  // Slider State
  const isDraggingSlider = useRef(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const actionRef = useRef<{
    type: 'drag' | 'resize' | null;
    handle?: ResizeHandle;
    initialMouse: { x: number; y: number };
    initialImage: ImageObject;
  }>({ type: null, initialMouse: { x: 0, y: 0 }, initialImage: image });

  // Mouse position state for custom cursor
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Initialize/Load Mask
  useEffect(() => {
      const canvas = maskCanvasRef.current;
      if (canvas) {
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              if (image.maskSrc) {
                  const maskImg = new Image();
                  maskImg.onload = () => {
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
                  };
                  maskImg.src = image.maskSrc;
              } else {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
          }
      }
  }, [image.maskSrc, image.naturalWidth, image.naturalHeight]);

  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>, type: 'drag' | 'resize', handle?: ResizeHandle) => {
    e.stopPropagation();
    onSelect(e, image.id);
    if (type === 'resize' && !showHandles) return;

    if (type === 'drag') {
      onDragStart();
    }

    actionRef.current = {
      type,
      handle,
      initialMouse: { x: e.clientX, y: e.clientY },
      initialImage: { ...image }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [image, onSelect, showHandles, onDragStart]);

  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    const { type, handle, initialMouse, initialImage } = actionRef.current;
    if (!type) return;

    const dx = (e.clientX - initialMouse.x) / scale;
    const dy = (e.clientY - initialMouse.y) / scale;

    if (type === 'drag') {
      onDragMove(e);
      updateImage(image.id, {
        x: initialImage.x + dx,
        y: initialImage.y + dy,
      });
    } else if (type === 'resize' && handle) {
      let { x, y, width, height } = initialImage;
      const minSize = 20;
      const isCornerHandle = !handle.includes('m');

      if (isCornerHandle) {
        const aspectRatio = initialImage.width / initialImage.height;
        let newWidth = width;

        if (handle.includes('r')) { // tr, br
          newWidth = initialImage.width + dx;
        } else { // tl, bl
          newWidth = initialImage.width - dx;
        }
        
        if (newWidth < minSize) {
          newWidth = minSize;
        }
        
        const newHeight = newWidth / aspectRatio;
        
        width = newWidth;
        height = newHeight;

        if (handle.includes('l')) {
          x = initialImage.x + initialImage.width - newWidth;
        }
        if (handle.includes('t')) {
          y = initialImage.y + initialImage.height - newHeight;
        }
      } else { // Middle handles
        if (handle.includes('l')) {
          width -= dx;
          x += dx;
        }
        if (handle.includes('r')) {
          width += dx;
        }
        if (handle.includes('t')) {
          height -= dy;
          y += dy;
        }
        if (handle.includes('b')) {
          height += dy;
        }
        
        if (width < minSize) {
          width = minSize;
          if(handle.includes('l')) x = initialImage.x + initialImage.width - minSize;
        }
        if (height < minSize) {
          height = minSize;
          if(handle.includes('t')) y = initialImage.y + initialImage.height - minSize;
        }
      }
      updateImage(image.id, { x, y, width, height });
    }
  }, [scale, updateImage, image.id, onDragMove]);

  const handleMouseUp = useCallback(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    if (actionRef.current.type === 'drag') {
      onDragEnd();
    }
    actionRef.current.type = null;
  }, [handleMouseMove, onDragEnd]);

  const handlePlay = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsPlaying(true);
  };

  // Mask Drawing Handlers
  const getMaskPoint = (e: MouseEvent) => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
      };
  };

  const handleMaskMouseDown = (e: MouseEvent) => {
      if ((activeTool !== 'pen' && activeTool !== 'eraser') || !isSelected) return;
      e.stopPropagation(); // Prevent dragging the image
      isDrawingMask.current = true;
      lastMaskPos.current = getMaskPoint(e);
  };

  const handleMaskMouseMove = (e: MouseEvent) => {
      // Update cursor position for custom brush cursor - ADJUST FOR SCALE
      const rect = e.currentTarget.getBoundingClientRect();
      setMousePos({
          x: (e.clientX - rect.left) / scale,
          y: (e.clientY - rect.top) / scale
      });

      if (!isDrawingMask.current) return;
      e.stopPropagation();
      
      const canvas = maskCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      const pos = getMaskPoint(e);
      
      if (!canvas || !ctx || !pos || !lastMaskPos.current) return;

      // Adjust brush size relative to natural image dimensions vs displayed dimensions
      // CRITICAL FIX: Include canvas scale in calculation to ensure brush size is accurate visually
      const scaleRatio = image.naturalWidth / (image.width * scale);
      
      // FIXED: Removed extra 'scale' multiplication to prevent double scaling
      const actualBrushSize = brushSize * scaleRatio;

      ctx.beginPath();
      ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
      // RESTORED: Use Blue (Indigo) for Pen instead of Red, with low opacity 0.2
      ctx.strokeStyle = activeTool === 'pen' ? 'rgba(79, 70, 229, 0.2)' : 'rgba(0,0,0,1)';
      ctx.lineWidth = actualBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastMaskPos.current.x, lastMaskPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      lastMaskPos.current = pos;
  };

  const handleMaskMouseUp = (e: MouseEvent) => {
      if (!isDrawingMask.current) return;
      e.stopPropagation();
      isDrawingMask.current = false;
      lastMaskPos.current = null;
      
      const canvas = maskCanvasRef.current;
      if (canvas) {
          updateImage(image.id, { maskSrc: canvas.toDataURL() });
      }
  };

  const handleMaskMouseLeave = (e: MouseEvent) => {
      setMousePos(null);
      if (isDrawingMask.current) {
          handleMaskMouseUp(e);
      }
  }

  // Custom Slider Handlers
  const handleSliderMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent image deselection or drag
      isDraggingSlider.current = true;
      updateSlider(e.clientY);
      window.addEventListener('mousemove', handleSliderMouseMove);
      window.addEventListener('mouseup', handleSliderMouseUp);
  };

  const handleSliderMouseMove = (e: globalThis.MouseEvent) => {
      if (isDraggingSlider.current) {
          updateSlider(e.clientY);
      }
  };

  const handleSliderMouseUp = () => {
      isDraggingSlider.current = false;
      window.removeEventListener('mousemove', handleSliderMouseMove);
      window.removeEventListener('mouseup', handleSliderMouseUp);
  };

  const updateSlider = (clientY: number) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      // Calculate percentage from bottom (0% at bottom, 100% at top)
      const percentage = 1 - Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
      
      const minSize = 5;
      const maxSize = 100;
      const newSize = Math.round(minSize + percentage * (maxSize - minSize));
      setBrushSize(newSize);
  };

  const handles: ResizeHandle[] = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'];
  const showMaskTools = isSelected && (activeTool === 'pen' || activeTool === 'eraser');

  // Determine theme color based on tool
  const themeColor = activeTool === 'eraser' ? 'bg-red-500' : 'bg-indigo-500';
  const cursorBorderColor = activeTool === 'eraser' ? 'red' : '#4f46e5'; // Indigo/Blue
  // CHANGED: Lowered opacity of cursor background
  const cursorBgColor = activeTool === 'eraser' ? 'rgba(255, 0, 0, 0.1)' : 'rgba(79, 70, 229, 0.1)';

  return (
    <div
      ref={nodeRef}
      className={`absolute select-none ${showMaskTools ? 'cursor-none' : 'cursor-move'} border-2 border-transparent bg-black`}
      style={{
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
        borderColor: isSelected ? '#4f46e5' : 'transparent',
        boxShadow: isSelected ? '0 0 0 1px #4f46e5' : 'none',
        zIndex: zIndex
      }}
      onMouseDown={(e) => handleMouseDown(e, 'drag')}
      onMouseEnter={() => setActiveImageUI(image.id)}
      onMouseLeave={() => setActiveImageUI(null)}
    >
      {image.classification === 'video' && isPlaying ? (
          <video 
              src={image.videoSrc}
              controls
              autoPlay
              className="w-full h-full pointer-events-auto"
              style={{ objectFit: 'cover' }} 
              onMouseDown={(e) => e.stopPropagation()} 
              onEnded={() => setIsPlaying(false)}
          />
      ) : (
          <>
            <img src={image.src} alt="story element" className="w-full h-full object-fill pointer-events-none" draggable="false" />
            
            {/* Inpainting Mask Canvas */}
            <canvas 
                ref={maskCanvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-auto ${showMaskTools ? 'z-20' : 'pointer-events-none'}`}
                style={{ opacity: 1 }}
                onMouseDown={handleMaskMouseDown}
                onMouseMove={handleMaskMouseMove}
                onMouseUp={handleMaskMouseUp}
                onMouseLeave={handleMaskMouseLeave}
            />

            {/* Custom Brush Cursor */}
            {showMaskTools && mousePos && (
                <div 
                    className="absolute rounded-full border-2 pointer-events-none z-30 transform -translate-x-1/2 -translate-y-1/2 shadow-sm"
                    style={{
                        left: mousePos.x,
                        top: mousePos.y,
                        // FIXED: Divide by scale to ensure visual size matches brush size on screen
                        width: brushSize / scale,
                        height: brushSize / scale,
                        borderColor: cursorBorderColor,
                        backgroundColor: cursorBgColor
                    }}
                />
            )}

            {image.classification === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div 
                        className="bg-black/50 rounded-full p-4 pointer-events-auto cursor-pointer hover:bg-black/70 transition-colors backdrop-blur-sm shadow-xl"
                        onClick={handlePlay}
                        style={{ transform: `scale(${1 / scale})` }}
                    >
                        <PlayIcon className="w-8 h-8 text-white" />
                    </div>
                </div>
            )}
          </>
      )}

      {/* Custom Brush Size Slider (Left Side - Outside) */}
      {showMaskTools && (
          <div 
            className="absolute -left-12 top-0 bottom-0 w-12 flex items-center justify-center z-50 pointer-events-none"
            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'center right' }}
          >
              <div 
                ref={sliderRef}
                className="h-48 w-2 bg-white/30 backdrop-blur rounded-full shadow-xl border border-white/50 relative pointer-events-auto cursor-ns-resize group"
                onMouseDown={handleSliderMouseDown}
              >
                  {/* Track Background */}
                  <div className={`absolute inset-x-0 bottom-0 rounded-full w-full ${themeColor}`} style={{ height: `${((brushSize - 5) / 95) * 100}%` }} />
                  
                  {/* Thumb Handle */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-md border border-gray-300 transform transition-transform group-hover:scale-110"
                    style={{ bottom: `calc(${((brushSize - 5) / 95) * 100}% - 12px)` }}
                  >
                      {/* Visual Indicator of Size */}
                      <div className="absolute -left-10 top-1/2 -translate-y-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Size: {brushSize}
                      </div>
                  </div>
              </div>
          </div>
      )}

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
      {isSelected && showHandles && (
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
              onMouseDown={(e) => handleMouseDown(e, 'resize', handle)}
            />
          ))}
        </>
      )}
       <ImageInfoOverlay
          image={image}
          scale={scale}
          isActive={isActiveUI}
          onActivate={setActiveImageUI}
          onUpdate={onUpdateDetails}
          onPastePrompt={onPastePrompt}
          onOpenVideoModal={onOpenVideoModal}
          onExtractLastFrame={onExtractLastFrame}
        />
    </div>
  );
};

export default memo(ImageNode);
