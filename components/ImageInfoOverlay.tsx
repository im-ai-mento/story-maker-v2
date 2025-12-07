import React, { useState, useEffect } from 'react';
import type { ImageObject, ImageClassification, AspectRatio } from '../types';
import { CopyIcon, CheckIcon, DownloadIcon, ClapperboardIcon, FilmIcon } from './icons';

interface ImageInfoOverlayProps {
  image: ImageObject;
  scale: number;
  isActive: boolean;
  onActivate: (id: string | null) => void;
  onUpdate: (id: string, details: Partial<Pick<ImageObject, 'classification' | 'name'>>) => void;
  onPastePrompt: (prompt: string) => void;
  onOpenVideoModal?: (image: ImageObject) => void;
  onExtractLastFrame?: (videoSrc: string, sourceImage: ImageObject) => void;
}

const classificationDetails: Record<ImageClassification, { short: string; full: string; color: string }> = {
  original: { short: 'O', full: 'Original', color: 'bg-gray-500' },
  result: { short: 'R', full: 'Result', color: 'bg-red-500' },
  character: { short: 'C', full: 'Character', color: 'bg-blue-500' },
  background: { short: 'B', full: 'Background', color: 'bg-purple-500' },
  modelSheet: { short: 'M', full: 'Model Sheet', color: 'bg-green-500' },
  video: { short: 'M', full: 'Video', color: 'bg-pink-500' },
};

const UI_VISIBILITY_THRESHOLD = 250; // in pixels

const commonRatios: { name: AspectRatio | string; value: number }[] = [
    { name: '1:1', value: 1 }, { name: '5:4', value: 5 / 4 }, { name: '4:3', value: 4 / 3 },
    { name: '3:2', value: 3 / 2 }, { name: '16:9', value: 16 / 9 }, { name: '2:1', value: 2 },
    { name: '4:5', value: 4 / 5 }, { name: '3:4', value: 3 / 4 }, { name: '2:3', value: 2 / 3 }, { name: '9:16', value: 9 / 16 },
];

const findClosestRatio = (w: number, h: number): string => {
    if (w === 0 || h === 0) return 'N/A';
    const actualRatio = w / h;
    const closest = commonRatios.reduce((prev, curr) => 
        Math.abs(curr.value - actualRatio) < Math.abs(prev.value - actualRatio) ? curr : prev
    );
    return closest.name;
};


const ImageInfoOverlay: React.FC<ImageInfoOverlayProps> = ({ image, scale, isActive, onActivate, onUpdate, onPastePrompt, onOpenVideoModal, onExtractLastFrame }) => {
  const [isNaming, setIsNaming] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [promptPasted, setPromptPasted] = useState(false);
  
  const isLargeEnough = image.width * scale >= UI_VISIBILITY_THRESHOLD;

  useEffect(() => {
    if (!isActive) {
      setIsNaming(false);
      setNameInput('');
    }
  }, [isActive]);

  const handleNameSave = () => {
    if (nameInput.trim()) {
      onUpdate(image.id, { name: nameInput.trim() });
      setIsNaming(false);
      setNameInput('');
    }
  };

  const handlePastePrompt = () => {
    if (image.prompt) {
      onPastePrompt(image.prompt);
      setPromptPasted(true);
      setTimeout(() => setPromptPasted(false), 2000);
    }
  };

  const handleSaveImage = () => {
    // 1. Video Export (Direct Link)
    if (image.classification === 'video' && image.videoSrc) {
        const link = document.createElement('a');
        link.href = image.videoSrc;
        const fileName = image.name 
            ? `Video_${image.name}.mp4`
            : `Video_${image.id}.mp4`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    // 2. Image Export (Canvas Re-encoding)
    // This solves issues where base64 strings from API cause preview/import errors in Premiere Pro
    const img = new Image();
    img.crossOrigin = "anonymous"; // Handle potential CORS if src is external url
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            
            // Generate a clean Blob from the canvas
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    
                    const fileName = image.name 
                        ? `${classificationDetails[image.classification].full}_${image.name}.png`
                        : `${classificationDetails[image.classification].full}_${image.id}.png`;
                    
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    
                    // Cleanup
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }
            }, 'image/png');
        }
    };
    img.src = image.src;
  };

  const handleExtractFrame = () => {
      if (image.classification === 'video' && image.videoSrc && onExtractLastFrame) {
          onExtractLastFrame(image.videoSrc, image);
      }
  };
  
  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLargeEnough) {
      return;
    }
    onActivate(image.id);
  };

  const badgeContent = classificationDetails[image.classification].short;
  const badgeColor = classificationDetails[image.classification].color;
  
  const getRatioString = () => {
    if (image.targetAspectRatio) {
      return image.targetAspectRatio;
    }
    if (!image.naturalWidth || !image.naturalHeight) return 'N/A';
    return findClosestRatio(Math.round(image.naturalWidth), Math.round(image.naturalHeight));
  }

  const renderContent = () => {
    if (isNaming) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <label className="text-xs text-gray-300 font-semibold mb-1">Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="이름을 입력해주세요"
              className="px-2 py-1 text-sm bg-gray-900/50 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
            />
          </div>
          <button 
            onClick={handleNameSave} 
            className="self-end p-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors"
            title="저장"
          >
            <CheckIcon className="w-5 h-5" />
          </button>
        </div>
      );
    }

    const { full } = classificationDetails[image.classification];
    
    return (
        <div className="flex items-center justify-between w-full">
            <div className="flex flex-col items-start">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-bold text-white ${badgeColor} rounded-full`}>{full}</span>
                    {image.name && <span className="text-lg font-bold text-white">{image.name}</span>}
                </div>
                <p className="text-xs text-gray-300 mt-1">{Math.round(image.naturalWidth)} x {Math.round(image.naturalHeight)} | {getRatioString()}</p>
            </div>
             <div className="flex items-center gap-2">
               {image.classification !== 'video' && (
                 <div className="relative group">
                    <button onClick={() => onOpenVideoModal?.(image)} className="p-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full hover:shadow-lg transition-all transform hover:scale-105">
                      <ClapperboardIcon className="w-5 h-5 text-white" />
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-bold text-white bg-black/80 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                      Video Studio
                    </span>
                 </div>
               )}
               {image.classification === 'video' && onExtractLastFrame && (
                   <div className="relative group">
                    <button onClick={handleExtractFrame} className="p-2.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors" title="Extract Last Frame">
                        <FilmIcon className="w-5 h-5 text-white" />
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-bold text-white bg-black/80 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                      Extract Last Frame
                    </span>
                   </div>
               )}

               <button onClick={handleSaveImage} className="p-2.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors" title="Download">
                <DownloadIcon className="w-5 h-5 text-white" />
              </button>
              
              {image.prompt && (
                  <button onClick={handlePastePrompt} className="p-2.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors" title={promptPasted ? 'Pasted!' : '프롬프트 붙여넣기'}>
                    <CopyIcon className="w-5 h-5 text-white" />
                  </button>
              )}
            </div>
        </div>
    );
  };


  return (
    <>
      <button
        className={`absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center text-white text-xs font-bold rounded-full shadow-lg z-10 ${badgeColor} hover:scale-110 transition-transform`}
        style={{ transform: `scale(${1 / scale})`, transformOrigin: 'bottom right' }}
        onClick={handleBadgeClick}
      >
        {badgeContent}
      </button>
      
      {isActive && isLargeEnough && (
        <>
        <div
          className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"
        />
        <div
          className="absolute bottom-0 left-0 p-4 pr-10 z-20 flex items-end pointer-events-auto transition-opacity duration-300"
          onClick={(e) => e.stopPropagation()}
          style={{ 
            transform: `scale(${1 / scale})`, 
            transformOrigin: 'bottom left', 
            width: `${image.width * scale}px`
          }}
        >
          {renderContent()}
        </div>
        </>
      )}
    </>
  );
};

export default ImageInfoOverlay;