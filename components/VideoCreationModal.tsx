
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { generateVideo } from '../services/geminiService';
import type { ImageObject, AspectRatio } from '../types';
import { LoadingSpinnerIcon, ClapperboardIcon } from './icons';

interface VideoCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceImage: ImageObject | null;
  onAddVideoToCanvas: (videoSrc: string, aspectRatio: '16:9' | '9:16') => void;
  apiKey: string;
  onOpenApiKeyModal?: () => void;
}

const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
    const parts = dataUrl.split(',');
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const data = parts[1];
    return { mimeType, data };
};

const VideoCreationModal: React.FC<VideoCreationModalProps> = ({ isOpen, onClose, sourceImage, onAddVideoToCanvas, apiKey, onOpenApiKeyModal }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedVideoSrc, setGeneratedVideoSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [rawError, setRawError] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false);
    const [isAuthError, setIsAuthError] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
    // Default to the Standard/Quality model as it is more reliable currently
    const [videoModel, setVideoModel] = useState<'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview'>('veo-3.1-generate-preview');

    // Reset state when modal opens or source image changes
    useEffect(() => {
        if (isOpen) {
            setPrompt('');
            setGeneratedVideoSrc(null);
            setError(null);
            setRawError(null);
            setShowDebug(false);
            setIsAuthError(false);
            setIsGenerating(false);
            // Default to Quality model
            setVideoModel('veo-3.1-generate-preview');
        }
    }, [isOpen, sourceImage]);

    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !sourceImage) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setError(null);
        setRawError(null);
        setShowDebug(false);
        setIsAuthError(false);
        setGeneratedVideoSrc(null);

        try {
            if (!apiKey) throw new Error("API Key is missing");
            
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const { mimeType, data } = parseDataUrl(sourceImage.src);
            
            // Using generateVideo service with selected model
            const videoDataUrl = await generateVideo(ai, prompt, { mimeType, base64Data: data }, aspectRatio, apiKey, videoModel);
            
            setGeneratedVideoSrc(videoDataUrl);

        } catch (err: any) {
            console.error("Video generation failed:", err);
            
            const rawMessage = err.message || JSON.stringify(err, null, 2);
            setRawError(rawMessage);

            let errorMessage = "영상을 생성하는 중 오류가 발생했습니다.";

            // Try to parse the raw message if it looks like JSON
            let parsedError = null;
            if (rawMessage.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(rawMessage);
                    // Handle nested error structures common in Google APIs
                    if (parsed.error) {
                        parsedError = parsed.error;
                    } else {
                        parsedError = parsed;
                    }
                } catch (e) {
                    // Ignore parsing error
                }
            }

            const checkMessage = (msg: string) => {
                const m = msg.toUpperCase();
                return m.includes("429") || m.includes("RESOURCE_EXHAUSTED") || m.includes("QUOTA");
            };

            const isQuotaError = checkMessage(rawMessage) || (parsedError && (parsedError.code === 429 || parsedError.status === "RESOURCE_EXHAUSTED"));
            const isAuthIssue = rawMessage.includes("403") || rawMessage.includes("404") || rawMessage.includes("PERMISSION_DENIED") || rawMessage.includes("NOT_FOUND");
            const isServerIssue = rawMessage.includes("503") || rawMessage.includes("UNAVAILABLE");

            if (isQuotaError) {
                errorMessage = "🚨 할당량 초과 (429 Resource Exhausted)\n선택한 모델의 사용량 한도에 도달했습니다.\n\n해결 방법:\n1. 'Model' 옵션에서 다른 모델을 선택해 보세요.\n2. 잠시 후(5~10분) 다시 시도해보세요.";
            } else if (isAuthIssue) {
                errorMessage = "🚫 권한 오류\nAPI 키 권한이 없거나 비디오 모델(Veo)에 접근할 수 없습니다.\n결제가 연결된 프로젝트의 API 키인지 확인해주세요.";
                setIsAuthError(true);
            } else if (isServerIssue) {
                errorMessage = "🚧 서버 혼잡 (503)\nGoogle 서버가 현재 요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.";
            } else if (parsedError && parsedError.message) {
                 errorMessage = `오류: ${parsedError.message}`;
            } else {
                 errorMessage = "알 수 없는 오류가 발생했습니다. 아래 디버그 정보를 확인해주세요.";
            }
            
            setError(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddToCanvas = () => {
        if (generatedVideoSrc) {
            onAddVideoToCanvas(generatedVideoSrc, aspectRatio);
            onClose();
        }
    };

    const handleChangeKey = () => {
        if (onOpenApiKeyModal) {
            onOpenApiKeyModal();
        }
    };

    const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleGenerate();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-800 max-h-[90vh] relative">
                
                {/* Close Button (X) */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors text-3xl leading-none z-50"
                    title="Close (Esc)"
                >
                    &times;
                </button>

                {/* Left Side: Controls */}
                <div className="w-full md:w-1/3 p-6 flex flex-col gap-5 border-r border-gray-800 bg-[#222]">
                    <div className="flex items-center gap-3 text-white shrink-0">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                            <ClapperboardIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold tracking-wide">Video Studio</h2>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                         <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Model</label>
                         <select 
                            value={videoModel}
                            onChange={(e) => setVideoModel(e.target.value as any)}
                            className="w-full bg-gray-900 text-white text-sm rounded-lg p-2 border border-gray-700 focus:outline-none focus:border-indigo-500"
                            disabled={isGenerating}
                         >
                             <option value="veo-3.1-generate-preview">Veo 3.1 (High Quality) - Reliable</option>
                             <option value="veo-3.1-fast-generate-preview">Veo Fast (Preview) - Faster</option>
                         </select>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                         <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Aspect Ratio</label>
                         <div className="flex bg-gray-900 rounded-lg p-1">
                             <button 
                                onClick={() => setAspectRatio('9:16')}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${aspectRatio === '9:16' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                             >
                                 9:16 (Portrait)
                             </button>
                             <button 
                                onClick={() => setAspectRatio('16:9')}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${aspectRatio === '16:9' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                             >
                                 16:9 (Landscape)
                             </button>
                         </div>
                    </div>

                    <div className="flex flex-col gap-2 flex-1 min-h-[100px]">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prompt</label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handlePromptKeyDown}
                            placeholder="Describe the motion... (e.g., 'Camera pans right', 'The character waves hello')&#10;[Ctrl + Enter] to generate"
                            className="w-full h-full bg-[#111] border border-gray-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            disabled={isGenerating}
                        />
                    </div>

                    {error && (
                        <div className="flex flex-col gap-2 shrink-0">
                             <div className="flex items-center justify-between bg-red-900/30 border border-red-800 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-red-400 font-bold text-xs">⚠️ 오류 발생</span>
                                    {isAuthError && <span className="text-[10px] bg-red-900 text-white px-1.5 py-0.5 rounded">권한 문제</span>}
                                </div>
                                <button 
                                    onClick={() => setShowDebug(!showDebug)}
                                    className="text-[10px] bg-red-950/50 hover:bg-red-900 text-red-200 border border-red-800 px-2 py-1 rounded transition-colors"
                                >
                                    {showDebug ? "숨기기" : "내용 보기"}
                                </button>
                             </div>
                            
                            {showDebug && (
                                <div className="p-3 bg-black/40 border border-gray-800 rounded-lg text-xs text-gray-300 max-h-40 overflow-y-auto animate-in slide-in-from-top-1">
                                    <div className="whitespace-pre-wrap mb-2 font-medium text-red-200">{error}</div>
                                    {rawError && (
                                        <>
                                            <div className="text-[10px] text-gray-500 font-bold mt-2 mb-1">RAW ERROR:</div>
                                            <pre className="font-mono text-[10px] text-gray-500 whitespace-pre-wrap break-all">
                                                {rawError}
                                            </pre>
                                        </>
                                    )}
                                     {isAuthError && (
                                        <button 
                                            onClick={handleChangeKey}
                                            className="mt-3 w-full py-2 bg-red-700 hover:bg-red-600 text-white rounded font-bold transition-colors text-xs"
                                        >
                                            API Key 변경하기
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 shrink-0">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                            disabled={isGenerating}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                            className={`flex-1 py-3 font-semibold rounded-lg transition-all flex items-center justify-center gap-2
                                ${!prompt.trim() || isGenerating 
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/20'
                                }
                            `}
                        >
                            {isGenerating ? <LoadingSpinnerIcon /> : <ClapperboardIcon className="w-5 h-5" />}
                            {isGenerating ? 'Generating...' : 'Generate'}
                        </button>
                    </div>
                </div>

                {/* Right Side: Preview */}
                <div className="w-full md:w-2/3 bg-black flex flex-col items-center justify-center p-8 relative min-h-[400px]">
                    
                    {/* Source Image Overlay */}
                    <div className="absolute top-6 left-6 w-24 h-auto rounded-lg overflow-hidden border border-white/20 shadow-xl bg-black/50 backdrop-blur-sm z-10 group cursor-help">
                         <img src={sourceImage.src} alt="Source" className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                         <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                             <span className="text-[10px] text-white font-bold uppercase">Source</span>
                         </div>
                    </div>

                    {generatedVideoSrc ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500 z-0">
                             {/* Auto-play, loop, controls */}
                            <video 
                                src={generatedVideoSrc} 
                                controls 
                                autoPlay 
                                loop 
                                className="max-w-full max-h-[60vh] rounded-lg shadow-2xl border border-gray-800"
                            />
                             <div className="flex gap-4 mt-4">
                                <button
                                    onClick={handleAddToCanvas}
                                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full hover:shadow-lg transition-all font-semibold flex items-center gap-2"
                                >
                                    Add to Canvas
                                </button>
                                <a 
                                    href={generatedVideoSrc} 
                                    download={`video_${Date.now()}.mp4`}
                                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors text-sm font-semibold flex items-center gap-2"
                                >
                                    <ClapperboardIcon className="w-4 h-4" />
                                    Download MP4
                                </a>
                             </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-4 z-0">
                            {isGenerating ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative w-20 h-20">
                                        <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
                                        <ClapperboardIcon className="absolute inset-0 m-auto w-8 h-8 text-indigo-400 animate-pulse" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-lg font-medium text-white">Creating your video...</p>
                                        <p className="text-sm text-gray-400">This may take about 30-60 seconds.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ClapperboardIcon className="w-10 h-10 text-gray-600" />
                                    </div>
                                    <p className="text-gray-500 max-w-xs mx-auto">
                                        Enter a prompt and click Generate to bring your image to life with AI video.
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoCreationModal;
