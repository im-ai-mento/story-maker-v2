import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { editImage } from '../services/geminiService';
import type { ImageObject } from '../types';
import { LoadingSpinnerIcon } from './icons';

interface CharacterDetailViewProps {
  character: ImageObject;
  onClose: () => void;
  onUpdate: (characterId: string, update: { modelSheetSrc?: string; poseIndex?: number; poseSrc?: string }) => void;
  activeModel: string;
  apiKey: string;
}

const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
    const parts = dataUrl.split(',');
    let mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    // Fix for "Unsupported MIME type: application/octet-stream"
    if (mimeType === 'application/octet-stream' || mimeType === 'binary/octet-stream') {
        mimeType = 'image/png';
    }
    const data = parts[1];
    return { mimeType, data };
};

const DIVERSE_STYLES = [
    "wearing a stylish cyberpunk outfit in a neon-lit city",
    "in elegant formal wear at a gala",
    "dressed in casual streetwear, skateboarding",
    "as a fantasy warrior in ornate armor",
    "wearing a vintage 1950s dress and hat",
    "in a cozy sweater, reading by a fireplace",
    "as a secret agent in a sleek black suit",
    "wearing bohemian festival clothing",
    "in futuristic sportswear",
    "dressed as a royal in a magnificent gown or tunic",
    "in a traditional Korean hanbok",
    "as a rockstar on stage with a guitar",
];

const FullscreenViewer = ({ src, onClose }: { src: string; onClose: () => void; }) => (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={onClose}>
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors text-5xl leading-none font-light z-10"
            aria-label="Close fullscreen view"
        >
            &times;
        </button>
        <img 
            src={src} 
            alt="Fullscreen view" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
            onClick={e => e.stopPropagation()} 
        />
    </div>
);

const CharacterDetailView: React.FC<CharacterDetailViewProps> = ({ character, onClose, onUpdate, activeModel, apiKey }) => {
    const [isGeneratingModelSheet, setIsGeneratingModelSheet] = useState(false);
    const [generatingPoseIndex, setGeneratingPoseIndex] = useState<number | null>(null);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

    const handleGenerateModelSheet = async () => {
        if (isGeneratingModelSheet || !character) return;
        setIsGeneratingModelSheet(true);
        try {
            if (!apiKey) throw new Error("API key not configured.");
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const { mimeType, data } = parseDataUrl(character.src);
            const prompt = "Create a photorealistic character model sheet for the provided character. The sheet must include a full-body view from the front, side, and back. Below these, include a variety of different facial expressions and dynamic poses. Maintain the character's photorealistic appearance and style from the reference image.";
            // Force 1:1 aspect ratio for model sheets
            const newImageBase64 = await editImage(ai, prompt, [{ mimeType, base64Data: data }], activeModel, undefined, '1:1');
            const newImageSrc = `data:image/png;base64,${newImageBase64}`;
            onUpdate(character.id, { modelSheetSrc: newImageSrc });
        } catch (error) {
            console.error("Failed to generate model sheet:", error);
            alert("Failed to generate model sheet. Check the console for details.");
        } finally {
            setIsGeneratingModelSheet(false);
        }
    };

    const handleGeneratePose = async (index: number) => {
        if (generatingPoseIndex !== null || !character) return;
        setGeneratingPoseIndex(index);
         try {
            if (!apiKey) throw new Error("API key not configured.");
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const { mimeType, data } = parseDataUrl(character.src);
            const randomStyleDescription = DIVERSE_STYLES[Math.floor(Math.random() * DIVERSE_STYLES.length)];
            const prompt = `Your task is to create a photorealistic image based on the reference character. It is absolutely crucial that the final image is a PHOTOGRAPH, not a digital painting, illustration, or 3D render. Realism is the highest priority. The character should be ${randomStyleDescription}. The final image must be a professional-quality photograph with realistic skin textures and natural lighting. The main focus must be on the character, with a beautifully composed but subtly blurred background (bokeh effect) that complements them without being distracting. Maintain the character's appearance from the reference image. The final image must have a 9:16 aspect ratio. Output only the image.`;
            // Force 9:16 aspect ratio for poses
            const newImageBase64 = await editImage(ai, prompt, [{ mimeType, base64Data: data }], activeModel, undefined, '9:16');
            const newImageSrc = `data:image/png;base64,${newImageBase64}`;
            onUpdate(character.id, { poseIndex: index, poseSrc: newImageSrc });
        } catch (error) {
            console.error(`Failed to generate pose for index ${index}:`, error);
            alert(`Failed to generate pose. Check the console for details.`);
        } finally {
            setGeneratingPoseIndex(null);
        }
    };

    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
          <div className="bg-black w-full h-full max-w-7xl rounded-xl shadow-2xl flex flex-col relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <img 
                src={character.src} 
                alt="background" 
                className="absolute inset-0 w-full h-full object-cover object-top opacity-50 blur" 
            />
            <div className="relative w-full h-full flex flex-col">
                <div className="p-4 border-b border-white/20 flex justify-between items-center flex-shrink-0 bg-black/30 backdrop-blur-sm">
                    <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-md">{character.name} - Character Workspace</h2>
                    <button onClick={onClose} className="text-white/70 hover:text-white text-4xl leading-none">&times;</button>
                </div>

                <div className="flex-1 p-6 flex items-stretch justify-center gap-6 overflow-hidden">
                    {/* Left Column */}
                    <div className="flex-1 flex flex-col gap-6 min-w-0">
                        {/* Style Images Row */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <h3 className="font-bold text-white mb-2 drop-shadow-md">스타일 이미지 (9:16)</h3>
                            <div className="flex-1 grid grid-cols-4 rounded-lg overflow-hidden shadow bg-white/10 backdrop-blur-sm">
                                {[...Array(4)].map((_, i) => {
                                    const poseSrc = character.poses?.[i];
                                    const isGenerating = generatingPoseIndex === i;
                                    const canGenerate = !poseSrc && !isGenerating;
                                    const isClickable = poseSrc || canGenerate;

                                    return (
                                    <div 
                                        key={i} 
                                        onClick={poseSrc ? () => setFullscreenImage(poseSrc) : (canGenerate ? () => handleGeneratePose(i) : undefined)} 
                                        className={`relative bg-black/10 flex items-center justify-center transition-colors border-r border-white/10 last:border-r-0
                                            ${isClickable ? 'cursor-pointer' : ''}
                                            ${canGenerate ? 'hover:bg-black/30' : ''}
                                        `}
                                    >
                                        {isGenerating ? (
                                            <LoadingSpinnerIcon className="w-8 h-8 text-white" />
                                        ) : poseSrc ? (
                                            <img src={poseSrc} alt={`Style ${i+1}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs text-center text-white/60 font-medium">스타일 생성</span>
                                        )}
                                    </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    {/* Right Column */}
                    <div className="flex flex-col h-full aspect-square flex-shrink-0">
                        <h3 className="font-bold text-white mb-2 drop-shadow-md">Model Sheet (1:1)</h3>
                        <div className="flex-1 relative">
                            {(() => {
                                const canGenerate = !character.modelSheetSrc && !isGeneratingModelSheet;
                                const isClickable = character.modelSheetSrc || canGenerate;
                                return (
                                    <div 
                                        onClick={character.modelSheetSrc ? () => setFullscreenImage(character.modelSheetSrc) : (canGenerate ? handleGenerateModelSheet : undefined)} 
                                        className={`absolute inset-0 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center shadow transition-colors overflow-hidden
                                            ${isClickable ? 'cursor-pointer' : ''}
                                            ${canGenerate ? 'hover:bg-black/30' : ''}
                                        `}
                                    >
                                        {isGeneratingModelSheet ? (
                                            <div className="flex flex-col items-center gap-2 text-white">
                                                <LoadingSpinnerIcon className="w-10 h-10" />
                                                <span className="font-semibold drop-shadow-md">Generating Model Sheet...</span>
                                            </div>
                                        ) : character.modelSheetSrc ? (
                                            <img src={character.modelSheetSrc} alt="Model Sheet" className="w-full h-full object-cover object-top" />
                                        ) : (
                                            <span className="text-white/80 font-semibold text-center drop-shadow-md">모델시트를 생성하세요<br/>(Click to Generate)</span>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
        {fullscreenImage && <FullscreenViewer src={fullscreenImage} onClose={() => setFullscreenImage(null)} />}
      </>
    );
};

export default CharacterDetailView;