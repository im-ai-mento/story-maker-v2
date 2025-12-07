
import React from 'react';
import { MergeIcon, ShirtIcon, ShoppingBagIcon, PoseIcon, TextIcon, PencilIcon, EraserIcon } from './icons';
import type { Tool } from '../types';

interface MergeButtonProps {
    position: { x: number; y: number };
    scale: number;
    selectionCount: number;
    onContextAction: (action: string) => void;
    activeTool?: Tool;
    setActiveTool?: (tool: Tool) => void;
}

const MergeButton: React.FC<MergeButtonProps> = ({ position, scale, selectionCount, onContextAction, activeTool, setActiveTool }) => {
    const commonStyle: React.CSSProperties = {
        left: position.x,
        top: position.y,
        // Apply scaling to the container to ensure gaps scale correctly with buttons
        // Translate up by 100% + gap (converted to canvas units)
        transform: `translate(-50%, calc(-100% - ${16 / scale}px)) scale(${1 / scale})`,
        transformOrigin: 'bottom center',
    };

    // Single item selected: Show Tools (Text, Pen, Eraser)
    if (selectionCount === 1) {
        return (
            <div
                className="absolute z-50 flex flex-row gap-3 items-center justify-center p-1 w-max"
                style={commonStyle}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button
                    onClick={() => setActiveTool?.('text')}
                    className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all border border-white/20
                        ${activeTool === 'text' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-gray-700 hover:bg-gray-100'}
                    `}
                    title="Add Text"
                >
                    <TextIcon className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setActiveTool?.('pen')}
                    className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all border border-white/20
                        ${activeTool === 'pen' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-gray-700 hover:bg-gray-100'}
                    `}
                    title="Pen Tool"
                >
                    <PencilIcon className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setActiveTool?.('eraser')}
                    className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all border border-white/20
                        ${activeTool === 'eraser' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-gray-700 hover:bg-gray-100'}
                    `}
                    title="Eraser Tool"
                >
                    <EraserIcon className="w-5 h-5" />
                </button>
            </div>
        );
    }

    // If we have exactly 2 images, show specific actions
    if (selectionCount === 2) {
        return (
             <div
                className="absolute z-50 flex flex-row gap-3 items-center justify-center p-1 w-max"
                style={commonStyle}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button
                    onClick={() => onContextAction('의상 착용')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all whitespace-nowrap border border-white/20"
                    title="Wear Clothing from Source"
                >
                    <ShirtIcon className="w-4 h-4" />
                    <span>의상 착용</span>
                </button>
                 <button
                    onClick={() => onContextAction('상품 들기')}
                    className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-pink-700 hover:shadow-xl transition-all whitespace-nowrap border border-white/20"
                    title="Hold Product from Source"
                >
                    <ShoppingBagIcon className="w-4 h-4" />
                    <span>상품 들기</span>
                </button>
                <button
                    onClick={() => onContextAction('자세 따라하기')}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-full shadow-lg hover:bg-orange-600 hover:shadow-xl transition-all whitespace-nowrap border border-white/20"
                    title="Match Pose from Source"
                >
                    <PoseIcon className="w-4 h-4" />
                    <span>자세 따라하기</span>
                </button>
            </div>
        );
    }

    // Default "Merge" button for 3 or more images
    return (
        <div
            className="absolute z-50 p-1 w-max"
            style={commonStyle}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => onContextAction('Merge')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all whitespace-nowrap border border-white/20"
                title="Merge Selected"
            >
                <MergeIcon className="w-4 h-4" />
                <span>Merge</span>
            </button>
        </div>
    );
};

export default MergeButton;
