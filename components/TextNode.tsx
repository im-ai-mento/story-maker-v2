
import React, { useState, useRef, useCallback, useEffect, MouseEvent } from 'react';
import type { TextObject } from '../types';

interface TextNodeProps {
  textObject: TextObject;
  scale: number;
  isSelected: boolean;
  showHandles: boolean;
  onSelect: (e: MouseEvent, id: string) => void;
  updateTextObject: (id: string, newProps: Partial<TextObject>) => void;
  onDragStart: () => void;
  onDragMove: (e: globalThis.MouseEvent) => void;
  onDragEnd: () => void;
  zIndex: number;
}

const TextNode: React.FC<TextNodeProps> = ({
  textObject, scale, isSelected, showHandles, onSelect, updateTextObject, onDragStart, onDragMove, onDragEnd, zIndex
}) => {
  const [isEditing, setIsEditing] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const actionRef = useRef<{
    type: 'drag' | 'resize' | null;
    handle?: 'ml' | 'mr';
    initialMouse: { x: number; y: number };
    initialText: TextObject;
  }>({ type: null, initialMouse: { x: 0, y: 0 }, initialText: textObject });

  // FIX: Replace the old useEffect with one that measures and updates the height.
  // This ensures the TextObject's height property is accurate for selection logic.
  useEffect(() => {
    let newHeight = 0;
    if (isEditing) {
      if (textareaRef.current) {
        const el = textareaRef.current;
        el.style.height = 'auto'; // Temporarily shrink to measure scrollHeight
        newHeight = el.scrollHeight;
        el.style.height = `${newHeight}px`; // Set back to measured height
      }
    } else {
      if (nodeRef.current) {
        newHeight = nodeRef.current.offsetHeight;
      }
    }

    // Check if update is needed to avoid re-render loops
    if (newHeight > 0 && textObject.height !== newHeight) {
      updateTextObject(textObject.id, { height: newHeight });
    }
  }, [
    isEditing,
    textObject.content,
    textObject.width,
    textObject.height,
    textObject.id,
    updateTextObject,
  ]);

  // Focus and select text when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    const { type, handle, initialMouse, initialText } = actionRef.current;
    if (!type || isEditing) return;

    const dx = (e.clientX - initialMouse.x) / scale;

    if (type === 'drag') {
      const dy = (e.clientY - initialMouse.y) / scale;
      onDragMove(e);
      updateTextObject(textObject.id, {
        x: initialText.x + dx,
        y: initialText.y + dy,
      });
    } else if (type === 'resize' && handle) {
      let { x, width } = initialText;
      const minWidth = 50;

      if (handle === 'ml') {
        const newWidth = initialText.width - dx;
        if (newWidth > minWidth) {
            width = newWidth;
            x = initialText.x + dx;
        }
      } else if (handle === 'mr') {
        const newWidth = initialText.width + dx;
        if (newWidth > minWidth) {
            width = newWidth;
        }
      }
      updateTextObject(textObject.id, { x, width });
    }
  }, [scale, updateTextObject, textObject.id, onDragMove, isEditing]);

  const handleMouseUp = useCallback(() => {
    if (actionRef.current.type === 'drag') {
      onDragEnd();
    }
    actionRef.current.type = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, onDragEnd]);

  const handleActionStart = useCallback((e: MouseEvent, type: 'drag' | 'resize', handle?: 'ml' | 'mr') => {
    if (isEditing) return;
    e.stopPropagation();
    onSelect(e, textObject.id);

    if (type === 'resize' && !showHandles) return;

    if (type === 'drag') {
      onDragStart();
    }

    actionRef.current = {
      type,
      handle,
      initialMouse: { x: e.clientX, y: e.clientY },
      initialText: { ...textObject }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [textObject, onSelect, showHandles, onDragStart, handleMouseMove, handleMouseUp, isEditing]);


  const handleDoubleClick = (e: MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (textObject.content.trim() === '') {
        updateTextObject(textObject.id, { content: '텍스트를 입력하세요' });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateTextObject(textObject.id, { content: e.target.value });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      textareaRef.current?.blur();
    }
  };

  const styles: React.CSSProperties = {
    left: textObject.x,
    top: textObject.y,
    width: textObject.width,
    color: textObject.color,
    fontSize: `${textObject.fontSize}px`,
    fontFamily: textObject.fontFamily,
    lineHeight: 1.2,
    borderColor: isSelected && !isEditing ? '#4f46e5' : 'transparent',
    zIndex,
    minWidth: 50,
  };
  
  const textareaStyles: React.CSSProperties = {
    color: textObject.color,
    fontSize: `${textObject.fontSize}px`,
    fontFamily: textObject.fontFamily,
    lineHeight: 1.2,
  };

  return (
    <div
      ref={nodeRef}
      className={`absolute select-none whitespace-pre-wrap break-words border-2 ${isEditing ? '' : 'cursor-move'}`}
      style={styles}
      onMouseDown={(e) => handleActionStart(e, 'drag')}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
          <textarea
            ref={textareaRef}
            value={textObject.content}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onMouseDown={(e) => e.stopPropagation()} // Prevent canvas drag while editing
            className="w-full h-full p-0 m-0 bg-transparent border-2 border-dashed border-gray-400 focus:outline-none resize-none overflow-hidden"
            style={textareaStyles}
          />
        ) : (
          textObject.content
        )}
      
      {isSelected && showHandles && !isEditing && (
        <>
            {(['ml', 'mr'] as const).map(handle => (
                <div
                    key={handle}
                    className={`absolute w-3 h-3 bg-white border border-indigo-600 rounded-full z-10 cursor-ew-resize
                    top-1/2 -translate-y-1/2
                    ${handle === 'ml' ? '-left-1.5' : '-right-1.5'}`}
                    style={{ transform: `scale(${1 / scale})` }}
                    onMouseDown={(e) => handleActionStart(e, 'resize', handle)}
                />
            ))}
        </>
      )}
    </div>
  );
};

export default React.memo(TextNode);
