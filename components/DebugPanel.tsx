
import React from 'react';

interface DebugPanelProps {
  images: { label: string; src: string }[];
}

const DebugPanel: React.FC<DebugPanelProps> = ({ images }) => {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-0 right-0 h-full w-64 bg-gray-800 bg-opacity-90 text-white p-4 z-30 overflow-y-auto font-sans shadow-2xl">
      <h2 className="text-lg font-bold mb-4 border-b border-gray-600 pb-2">Debug Panel</h2>
      <div className="space-y-4">
        {images.map((image, index) => (
          <div key={index}>
            <p className="text-sm font-semibold mb-1 text-gray-300">{image.label}</p>
            <img src={image.src} alt={image.label} className="w-full h-auto rounded-md border-2 border-gray-500" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DebugPanel;
