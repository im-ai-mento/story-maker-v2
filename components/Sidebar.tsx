
import React, { useState, useRef, useCallback, useEffect, MouseEvent } from 'react';
import { PlusSquareIcon } from './icons';

interface SidebarProps {
  onImageUpload: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onCharacterPanelToggle: () => void;
  onAddDrawingCanvas: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onImageUpload, fileInputRef, onCharacterPanelToggle, onAddDrawingCanvas }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
    event.target.value = ''; // Reset file input
  };

  return (
    <aside className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-4 z-20">
      <button
        onClick={onAddDrawingCanvas}
        className="w-12 h-12 flex items-center justify-center bg-white rounded-lg shadow-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
        title="New Drawing Canvas"
      >
        <PlusSquareIcon className="w-6 h-6 text-gray-600" />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/gif, image/webp"
      />
    </aside>
  );
};

export default Sidebar;
