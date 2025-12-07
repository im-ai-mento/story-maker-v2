
import React from 'react';
import type { ImageObject } from '../types';

interface CharacterPanelProps {
  isOpen: boolean;
  images: ImageObject[];
  onClose: () => void;
  onSelectCharacter: (id: string) => void;
}

const CharacterPanel: React.FC<CharacterPanelProps> = ({ isOpen, images, onClose, onSelectCharacter }) => {
  const characters = images.filter(img => img.classification === 'character');

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/30 z-30 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div 
        className={`fixed top-0 left-0 h-full bg-white shadow-2xl z-40 transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} 
        style={{ width: '320px' }}
      >
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Character Library</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
        </div>
        
        {characters.length > 0 ? (
          <div className="p-4 overflow-y-auto">
            <div className="grid grid-cols-3 gap-4">
              {characters.map(char => (
                <div 
                  key={char.id} 
                  className="text-center cursor-pointer group flex flex-col items-center" 
                  onClick={() => onSelectCharacter(char.id)}
                >
                  <img 
                    src={char.src} 
                    alt={char.name} 
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 group-hover:border-indigo-500 group-hover:scale-105 transition-all duration-200" 
                  />
                  <p className="mt-2 text-sm font-semibold text-gray-700 break-all">{char.name}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-center text-gray-500">No characters created yet. Classify an image as a 'Character' to add it here.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default CharacterPanel;
