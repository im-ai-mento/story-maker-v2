
import React, { useRef, useCallback, forwardRef, useEffect, useState, useMemo } from 'react';
import type { ImageObject, TextObject, CanvasTransform, Tool, ImageClassification, DrawingCanvasObject } from '../types';
import ImageNode from './ImageNode';
import TextNode from './TextNode';
import DrawingCanvasNode from './DrawingCanvasNode';
import MergeButton from './MergeButton';

interface CanvasProps {
  images: ImageObject[];
  textObjects: TextObject[];
  drawingCanvases: DrawingCanvasObject[];
  transform: CanvasTransform;
  setTransform: React.Dispatch<React.SetStateAction<CanvasTransform>>;
  updateImage: (id: string, newProps: Partial<ImageObject>) => void;
  updateTextObject: (id: string, newProps: Partial<TextObject>) => void;
  updateDrawingCanvas: (id: string, newProps: Partial<DrawingCanvasObject>) => void;
  deleteImages: (ids: string[]) => void;
  deleteTextObjects: (ids: string[]) => void;
  deleteDrawingCanvases: (ids: string[]) => void;
  selectedImageIds: string[];
  setSelectedImageIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  selectedTextIds: string[];
  setSelectedTextIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  selectedDrawingCanvasIds: string[];
  setSelectedDrawingCanvasIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  activeTool: Tool;
  onTriggerUpload: () => void;
  onFileUpload: (file: File | Blob) => void;
  onAddText: (x: number, y: number) => void;
  onImageDragStart: () => void;
  onImageDrag: (e: globalThis.MouseEvent) => void;
  onImageDragEnd: () => void;
  activeImageUI: string | null;
  setActiveImageUI: (id: string | null) => void;
  onUpdateImageDetails: (id: string, details: Partial<Pick<ImageObject, 'classification' | 'name'>>) => void;
  onPastePrompt: (prompt: string) => void;
  onBackgroundClick: () => void;
  onContextAction: (action: string) => void;
  contentRef: React.RefObject<HTMLDivElement>;
  onOpenVideoModal: (image: ImageObject) => void;
  onExtractLastFrame?: (videoSrc: string, sourceImage: ImageObject) => void;
  layerOrder: string[];
  onMoveToFront: (id: string) => void;
  setActiveTool: (tool: Tool) => void;
}

const Canvas = forwardRef<HTMLDivElement, CanvasProps>(({ 
  images, textObjects, drawingCanvases, transform, setTransform, 
  updateImage, updateTextObject, updateDrawingCanvas,
  deleteImages, deleteTextObjects, deleteDrawingCanvases,
  selectedImageIds, setSelectedImageIds, selectedTextIds, setSelectedTextIds,
  selectedDrawingCanvasIds, setSelectedDrawingCanvasIds,
  activeTool, 
  onTriggerUpload, onFileUpload, onAddText,
  onImageDragStart, onImageDrag, onImageDragEnd,
  activeImageUI, setActiveImageUI, onUpdateImageDetails, onPastePrompt, onBackgroundClick, onContextAction, contentRef, onOpenVideoModal, onExtractLastFrame,
  layerOrder, onMoveToFront, setActiveTool
}, ref) => {
  const isPanning = useRef(false);
  const isSelecting = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const selectionStart = useRef({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [mergeButtonPosition, setMergeButtonPosition] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace')) {
         if (selectedImageIds.length > 0) deleteImages(selectedImageIds);
         if (selectedTextIds.length > 0) deleteTextObjects(selectedTextIds);
         if (selectedDrawingCanvasIds.length > 0) deleteDrawingCanvases(selectedDrawingCanvasIds);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImageIds, selectedTextIds, selectedDrawingCanvasIds, deleteImages, deleteTextObjects, deleteDrawingCanvases]);


  const selectionOrderMap = useMemo(() => {
    const totalSelected = selectedImageIds.length + selectedTextIds.length + selectedDrawingCanvasIds.length;
    if (totalSelected <= 1) {
        return {};
    }

    // Combine all selected items to determine order based on X position
    const selectedImages = images.filter(img => selectedImageIds.includes(img.id));
    const selectedTexts = textObjects.filter(txt => selectedTextIds.includes(txt.id));
    const selectedCanvases = drawingCanvases.filter(can => selectedDrawingCanvasIds.includes(can.id));

    const allSelected = [...selectedImages, ...selectedTexts, ...selectedCanvases];
    
    // Sort by x-coordinate
    allSelected.sort((a, b) => a.x - b.x);

    const map: { [key: string]: number } = {};
    allSelected.forEach((item, index) => {
        map[item.id] = index + 1;
    });
    return map;
  }, [selectedImageIds, selectedTextIds, selectedDrawingCanvasIds, images, textObjects, drawingCanvases]);
  

  useEffect(() => {
    const totalSelected = selectedImageIds.length + selectedTextIds.length + selectedDrawingCanvasIds.length;
    
    if (totalSelected >= 1) {
        const selectedImages = images.filter(img => selectedImageIds.includes(img.id));
        const selectedTexts = textObjects.filter(txt => selectedTextIds.includes(txt.id));
        const selectedCanvases = drawingCanvases.filter(can => selectedDrawingCanvasIds.includes(can.id));
        const allSelected = [...selectedImages, ...selectedTexts, ...selectedCanvases];

        // Do not show menu if a single video is selected
        if (totalSelected === 1 && selectedImages.length === 1 && selectedImages[0].classification === 'video') {
            setMergeButtonPosition(null);
            return;
        }

        if (allSelected.length > 0) {
            const minX = Math.min(...allSelected.map(obj => obj.x));
            const minY = Math.min(...allSelected.map(obj => obj.y));
            const maxX = Math.max(...allSelected.map(obj => obj.x + obj.width));

            setMergeButtonPosition({ x: minX + (maxX - minX) / 2, y: minY });
        } else {
            setMergeButtonPosition(null);
        }
    } else {
        setMergeButtonPosition(null);
    }
  }, [selectedImageIds, selectedTextIds, selectedDrawingCanvasIds, images, textObjects, drawingCanvases]);


  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const startX = (e.clientX - rect.left - transform.x) / transform.scale;
    const startY = (e.clientY - rect.top - transform.y) / transform.scale;

    if (activeTool === 'pan') {
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } else if (activeTool === 'select') {
      isSelecting.current = true;
      selectionStart.current = { x: startX, y: startY };
      setSelectionBox({ x: startX, y: startY, width: 0, height: 0 });
    } else if (activeTool === 'text') {
      onAddText(startX, startY);
      setActiveTool('select'); // Switch back to select after adding text
    }
    onBackgroundClick();
  }, [activeTool, transform, onBackgroundClick, onAddText, setActiveTool]);

  const handleNodeSelect = useCallback((e: React.MouseEvent, id: string, type: 'image' | 'text' | 'drawingCanvas') => {
    onMoveToFront(id); // Bring selected item to front

    // Auto-reset tool if clicking a node while in a context tool mode (Pen, Eraser, Text)
    // Note: DrawingCanvasNode stops propagation for Pen/Eraser drawing, so this only fires if we are NOT drawing
    if (['text', 'pen', 'eraser'].includes(activeTool)) {
        // Exception: If we are selecting the SAME object that is currently selected, don't reset.
        // This allows clicking on the image again to draw if drag hasn't started.
        // But logic below handles multi-select which complicates things.
        // For Image Inpainting, the ImageNode handles Pen/Eraser events internally and stops propagation.
        // So if this fires, it means we clicked outside the mask/drawing area or simply selected it.
        setActiveTool('select');
    }

    if (activeTool !== 'select' && activeTool !== 'pen' && activeTool !== 'eraser') {
        setSelectedImageIds(type === 'image' ? [id] : []);
        setSelectedTextIds(type === 'text' ? [id] : []);
        setSelectedDrawingCanvasIds(type === 'drawingCanvas' ? [id] : []);
        return;
    }

    const isSelected = selectedImageIds.includes(id) || selectedTextIds.includes(id) || selectedDrawingCanvasIds.includes(id);

    if (e.shiftKey) {
        if (type === 'image') setSelectedImageIds(prev => isSelected ? prev.filter(i => i !== id) : [...prev, id]);
        if (type === 'text') setSelectedTextIds(prev => isSelected ? prev.filter(i => i !== id) : [...prev, id]);
        if (type === 'drawingCanvas') setSelectedDrawingCanvasIds(prev => isSelected ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
        if (!isSelected) {
            setSelectedImageIds(type === 'image' ? [id] : []);
            setSelectedTextIds(type === 'text' ? [id] : []);
            setSelectedDrawingCanvasIds(type === 'drawingCanvas' ? [id] : []);
        }
    }
}, [activeTool, selectedImageIds, selectedTextIds, selectedDrawingCanvasIds, setSelectedImageIds, setSelectedTextIds, setSelectedDrawingCanvasIds, onMoveToFront, setActiveTool]);


  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning.current && activeTool === 'pan') {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } else if (isSelecting.current && activeTool === 'select') {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const currentX = (e.clientX - rect.left - transform.x) / transform.scale;
      const currentY = (e.clientY - rect.top - transform.y) / transform.scale;

      const newX = Math.min(selectionStart.current.x, currentX);
      const newY = Math.min(selectionStart.current.y, currentY);
      const newWidth = Math.abs(currentX - selectionStart.current.x);
      const newHeight = Math.abs(currentY - selectionStart.current.y);
      setSelectionBox({ x: newX, y: newY, width: newWidth, height: newHeight });
    }
  }, [setTransform, transform, activeTool]);

  const handleMouseUpOrLeave = useCallback(() => {
    if (isPanning.current) {
      isPanning.current = false;
    }
    if (isSelecting.current) {
        isSelecting.current = false;
        if (selectionBox) {
            const boxRight = selectionBox.x + selectionBox.width;
            const boxBottom = selectionBox.y + selectionBox.height;

            const isInside = (obj: {x: number, y: number, width: number, height: number}) => {
                const objRight = obj.x + obj.width;
                const objBottom = obj.y + obj.height;
                return obj.x < boxRight && objRight > selectionBox.x && obj.y < boxBottom && objBottom > selectionBox.y;
            };

            setSelectedImageIds(images.filter(isInside).map(img => img.id));
            setSelectedTextIds(textObjects.filter(isInside).map(txt => txt.id));
            setSelectedDrawingCanvasIds(drawingCanvases.filter(isInside).map(can => can.id));
        }
        setSelectionBox(null);
    }
  }, [selectionBox, images, textObjects, drawingCanvases, setSelectedImageIds, setSelectedTextIds, setSelectedDrawingCanvasIds]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, transform.scale + scaleAmount), 5);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

    setTransform({ x: newX, y: newY, scale: newScale });
  }, [transform, setTransform]);

  const getCursor = () => {
    if (activeTool === 'pan') return isPanning.current ? 'grabbing' : 'grab';
    if (activeTool === 'select') return 'crosshair';
    if (activeTool === 'text') return 'text';
    if (activeTool === 'pen' || activeTool === 'eraser') return 'crosshair';
    return 'default';
  };
  
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    onTriggerUpload();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        if (file instanceof File && file.type.startsWith('image/')) {
          onFileUpload(file);
        }
      }
    }
  };

  const totalSelectedCount = selectedImageIds.length + selectedTextIds.length + selectedDrawingCanvasIds.length;

  return (
    <div
      ref={ref}
      className="w-full h-full overflow-hidden bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:16px_16px] relative"
      style={{ cursor: getCursor() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        ref={contentRef}
        className="transform-gpu transition-transform duration-0 origin-top-left"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        {images.map((image) => {
          const selectionOrder = selectionOrderMap[image.id] || 0;
          const isSelected = selectedImageIds.includes(image.id);
          const zIndex = layerOrder.indexOf(image.id) !== -1 ? layerOrder.indexOf(image.id) : 0;
          return (<ImageNode
            key={image.id}
            image={image}
            scale={transform.scale}
            updateImage={updateImage}
            isSelected={isSelected}
            onSelect={(e, id) => handleNodeSelect(e, id, 'image')}
            showHandles={totalSelectedCount <= 1 && isSelected}
            selectionOrder={selectionOrder}
            totalSelected={totalSelectedCount}
            onDragStart={onImageDragStart}
            onDragMove={onImageDrag}
            onDragEnd={onImageDragEnd}
            isActiveUI={activeImageUI === image.id}
            setActiveImageUI={setActiveImageUI}
            onUpdateDetails={onUpdateImageDetails}
            onPastePrompt={onPastePrompt}
            zIndex={zIndex}
            onOpenVideoModal={onOpenVideoModal}
            onExtractLastFrame={onExtractLastFrame}
            activeTool={activeTool}
          />
        )})}
        {drawingCanvases.map((canvas) => {
          const selectionOrder = selectionOrderMap[canvas.id] || 0;
          const isSelected = selectedDrawingCanvasIds.includes(canvas.id);
          const zIndex = layerOrder.indexOf(canvas.id) !== -1 ? layerOrder.indexOf(canvas.id) : 0;
          return (
            <DrawingCanvasNode
              key={canvas.id}
              drawingCanvas={canvas}
              scale={transform.scale}
              isSelected={isSelected}
              onSelect={(e, id) => handleNodeSelect(e, id, 'drawingCanvas')}
              updateDrawingCanvas={updateDrawingCanvas}
              onDragStart={onImageDragStart}
              onDragMove={onImageDrag}
              onDragEnd={onImageDragEnd}
              activeTool={activeTool}
              zIndex={zIndex}
              selectionOrder={selectionOrder}
              totalSelected={totalSelectedCount}
            />
          );
        })}
        {textObjects.map((text) => {
            const isSelected = selectedTextIds.includes(text.id);
            const zIndex = layerOrder.indexOf(text.id) !== -1 ? layerOrder.indexOf(text.id) : 0;
            return (
                <TextNode 
                    key={text.id}
                    textObject={text}
                    scale={transform.scale}
                    updateTextObject={updateTextObject}
                    isSelected={isSelected}
                    onSelect={(e, id) => handleNodeSelect(e, id, 'text')}
                    showHandles={totalSelectedCount <= 1 && isSelected}
                    onDragStart={onImageDragStart}
                    onDragMove={onImageDrag}
                    onDragEnd={onImageDragEnd}
                    zIndex={zIndex}
                />
            )
        })}
        {selectionBox && (
          <div
            className="absolute border border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}
        {mergeButtonPosition && (
            <MergeButton 
                position={mergeButtonPosition}
                scale={transform.scale}
                selectionCount={totalSelectedCount}
                onContextAction={onContextAction}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
            />
        )}
      </div>
      {isDraggingOver && (
        <div className="absolute inset-0 bg-indigo-500 bg-opacity-20 z-10 flex items-center justify-center pointer-events-none transition-opacity">
          <div className="p-8 text-center border-4 border-dashed border-white rounded-2xl">
            <p className="text-xl font-semibold text-white">Drop images to upload</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default Canvas;
