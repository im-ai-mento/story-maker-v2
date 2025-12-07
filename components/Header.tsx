
import React from 'react';
import { KeyIcon, KeyOffIcon } from './icons';

interface HeaderProps {
  scale: number;
  onExport: () => void;
  onOpenApiKeyModal: () => void;
  hasApiKey: boolean;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

const Header: React.FC<HeaderProps> = ({ scale, onExport, onOpenApiKeyModal, hasApiKey, projectName, onProjectNameChange, inputRef }) => {
  const zoomPercentage = Math.round(scale * 100);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          e.currentTarget.blur();
      }
  };

  return (
    <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 pointer-events-none">
      <div className="flex items-center gap-4 pointer-events-auto">
          <h1 className="text-sm font-bold tracking-widest text-gray-500 uppercase select-none">
            STORY MAKER
          </h1>
          <div className="h-4 w-px bg-gray-300"></div>
          <input
            ref={inputRef}
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-transparent text-lg font-bold text-gray-800 focus:outline-none rounded px-2 -ml-2 border border-transparent focus:border-indigo-500 focus:bg-white transition-all w-64 truncate placeholder-gray-400 hover:border-gray-300"
            placeholder="Untitled Story"
          />
      </div>
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="text-sm font-semibold text-gray-600 bg-white/50 backdrop-blur-sm rounded-md px-3 py-1.5 shadow-sm">
          {zoomPercentage}%
        </div>
         <button 
          onClick={onOpenApiKeyModal}
          className={`p-2 text-sm font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 transition-colors
            ${hasApiKey 
                ? 'text-gray-600 bg-white/80 hover:bg-white' 
                : 'text-red-500 bg-red-50 hover:bg-red-100 border border-red-300'
            }
          `}
          title={hasApiKey ? "API Key Configured" : "API Key Missing"}
        >
          {hasApiKey ? <KeyIcon className="w-5 h-5" /> : <KeyOffIcon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};

export default Header;
