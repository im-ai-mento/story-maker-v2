
import React from 'react';
import type { TextObject } from '../types';

interface TextToolbarProps {
  selectedText: TextObject;
  onUpdate: (id: string, newProps: Partial<TextObject>) => void;
}

const fontFamilies = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Helvetica'];
const fontSizes = [12, 16, 24, 36, 48, 72, 96];

const TextToolbar: React.FC<TextToolbarProps> = ({ selectedText, onUpdate }) => {
  if (!selectedText) return null;

  const handleUpdate = (prop: keyof TextObject, value: any) => {
    onUpdate(selectedText.id, { [prop]: value });
  };

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-2 bg-white rounded-lg shadow-md border border-gray-200 pointer-events-auto">
      {/* Font Family */}
      <select
        value={selectedText.fontFamily}
        onChange={(e) => handleUpdate('fontFamily', e.target.value)}
        className="p-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {fontFamilies.map(font => <option key={font} value={font}>{font}</option>)}
      </select>

      {/* Font Size */}
      <select
        value={selectedText.fontSize}
        onChange={(e) => handleUpdate('fontSize', Number(e.target.value))}
        className="p-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {fontSizes.map(size => <option key={size} value={size}>{size}</option>)}
      </select>

      {/* Font Color */}
      <div className="w-8 h-8 rounded-md overflow-hidden border border-gray-300">
        <input
          type="color"
          value={selectedText.color}
          onChange={(e) => handleUpdate('color', e.target.value)}
          className="w-full h-full p-0 border-none cursor-pointer"
          style={{ transform: 'scale(1.5)'}}
          title="Change text color"
        />
      </div>
    </div>
  );
};

export default TextToolbar;
