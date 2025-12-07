
import React, { useState, useRef, useEffect } from 'react';
import { SaveIcon, FolderOpenIcon, DocumentPlusIcon, FolderIcon } from './icons';

interface FileMenuProps {
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
}

const FileMenu: React.FC<FileMenuProps> = ({ onNew, onSave, onLoad }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: () => void) => {
      action();
      setIsOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}
        title="File Menu"
      >
        <FolderIcon className="w-6 h-6" />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
            <button
                onClick={() => handleAction(onNew)}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
                <DocumentPlusIcon className="w-4 h-4 text-gray-500" />
                <span>New Project</span>
            </button>
            <div className="h-px bg-gray-100 my-1 mx-2"></div>
            <button
                onClick={() => handleAction(onLoad)}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
                <FolderOpenIcon className="w-4 h-4 text-gray-500" />
                <span>Load Project</span>
            </button>
            <button
                onClick={() => handleAction(onSave)}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
                <SaveIcon className="w-4 h-4 text-gray-500" />
                <span>Save Project</span>
            </button>
        </div>
      )}
      <div className="w-px h-6 bg-gray-200 mx-1 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none translate-x-1"></div>
    </div>
  );
};

export default FileMenu;
