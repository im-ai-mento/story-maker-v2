
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import saveAs from 'file-saver';

import type { ImageObject, CanvasTransform, Tool, AspectRatio, ImageClassification, PromptInputHandle, TextObject, DrawingCanvasObject } from './types';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PromptInput from './components/PromptInput';
import Canvas from './components/Canvas';
import PromptAssets from './components/PromptAssets';
import DebugPanel from './components/DebugPanel';
import TrashCan from './components/TrashCan';
import CharacterPanel from './components/CharacterPanel';
import CharacterDetailView from './components/CharacterDetailView';
import TextToolbar from './components/TextToolbar';
import VideoCreationModal from './components/VideoCreationModal';
import { CursorArrowIcon, HandIcon, TextIcon, PencilIcon, EraserIcon, LoadingSpinnerIcon, DocumentPlusIcon, FolderOpenIcon, SaveIcon } from './components/icons';
import { generateImage, editImage, parsePromptForEntities, validateApiKey } from './services/geminiService';

const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
    if (!dataUrl || typeof dataUrl !== 'string') return { mimeType: 'image/png', data: '' };
    const parts = dataUrl.split(',');
    if (parts.length < 2) return { mimeType: 'image/png', data: '' };
    const mimeMatch = parts[0].match(/:(.*?);/);
    let mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    
    // Fix for "Unsupported MIME type: application/octet-stream"
    // Default to image/png if octet-stream is detected, as the API rejects it.
    if (mimeType === 'application/octet-stream' || mimeType === 'binary/octet-stream') {
        mimeType = 'image/png';
    }

    const data = parts[1];
    return { mimeType, data };
};

// FIX: Direct Resize to User's Standard (1376px)
// User Feedback: "Why upscale if it saves at 768x1376?"
// We adhere strictly to 1376px max dimension. No step-down, no fancy logic.
// Just standard resizing to match the model's native output range.
const optimizeImageForApi = (base64Str: string, maxWidth = 1376, quality = 0.95): Promise<{ mimeType: string, data: string }> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            let width = img.naturalWidth;
            let height = img.naturalHeight;

            // Simple resize logic: strictly cap at maxWidth (1376px)
            // If the image is smaller (e.g. 768x1376), it won't be touched.
            if (width > maxWidth || height > maxWidth) {
                if (width > height) {
                    height *= maxWidth / width;
                    width = maxWidth;
                } else {
                    width *= maxWidth / height;
                    height = maxWidth;
                }
            } else {
                // No resizing needed, return original
                resolve(parseDataUrl(base64Str));
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                // Standard smoothing is best for 1:1 matching
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium'; 
                ctx.drawImage(img, 0, 0, width, height);
                
                // Use JPEG 0.95 - Efficient, high quality, no bloat.
                const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(parseDataUrl(optimizedDataUrl));
            } else {
                resolve(parseDataUrl(base64Str));
            }
        };
        img.onerror = () => {
            resolve(parseDataUrl(base64Str));
        };
    });
};

const createPaddedImage = (
    base64Image: string,
    targetAspectRatio: AspectRatio
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const [w, h] = targetAspectRatio.split(':').map(Number);
            const targetRatio = w / h;
            const imageRatio = img.naturalWidth / img.naturalHeight;

            let canvasWidth: number;
            let canvasHeight: number;

            if (imageRatio > targetRatio) {
                canvasWidth = img.naturalWidth;
                canvasHeight = img.naturalWidth / targetRatio;
            } else {
                canvasHeight = img.naturalHeight;
                canvasWidth = img.naturalHeight * targetRatio;
            }

            // Sync with optimizeImageForApi limit (1376px)
            const MAX_DIMENSION = 1376;
            let scaleFactor = 1;
            if (canvasWidth > MAX_DIMENSION || canvasHeight > MAX_DIMENSION) {
              scaleFactor = Math.min(MAX_DIMENSION / canvasWidth, MAX_DIMENSION / canvasHeight);
            }
            
            canvasWidth *= scaleFactor;
            canvasHeight *= scaleFactor;
            const finalImgWidth = img.naturalWidth * scaleFactor;
            const finalImgHeight = img.naturalHeight * scaleFactor;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            ctx.fillStyle = '#00ff00'; // Lime green for outpainting mask
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            const dx = (canvas.width - finalImgWidth) / 2;
            const dy = (canvas.height - finalImgHeight) / 2;
            ctx.drawImage(img, dx, dy, finalImgWidth, finalImgHeight);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = `data:image/png;base64,${base64Image}`;
    });
};

const outpaintingPrompt = "If the height size of the attached image is long, 이미지 속 상단과 하단의 초록색 범위를  모두 제거하고 기존의 사진을 자연스럽게 연장해줘. If the width size of the attached image is long, 이미지 속 좌측과 우측의 초록색 범위를  모두 제거하고 기존의 사진을 자연스럽게 연장해줘";

interface ToolsProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
}

const Tools: React.FC<ToolsProps> = ({ activeTool, setActiveTool, onNew, onSave, onLoad }) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-white rounded-lg shadow-md">
      <button
        onClick={onNew}
        className="w-10 h-10 flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
        title="New Project"
      >
        <DocumentPlusIcon className="w-5 h-5" />
      </button>
      <button
        onClick={onLoad}
        className="w-10 h-10 flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
        title="Load Project"
      >
        <FolderOpenIcon className="w-5 h-5" />
      </button>
      <button
        onClick={onSave}
        className="w-10 h-10 flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
        title="Save Project"
      >
        <SaveIcon className="w-5 h-5" />
      </button>
      
      <div className="w-px h-6 bg-gray-200 mx-1"></div>

      <button
        onClick={() => setActiveTool('select')}
        className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${activeTool === 'select' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}
        aria-label="Select tool (V)"
        title="Select tool (V)"
        data-active={activeTool === 'select'}
      >
        <CursorArrowIcon className="w-5 h-5" />
      </button>
      <button
        onClick={() => setActiveTool('pan')}
        className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${activeTool === 'pan' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}
        aria-label="Hand tool (A)"
        title="Hand tool (A)"
        data-active={activeTool === 'pan'}
      >
        <HandIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

// REVISED: Safe Prompts to avoid PROHIBITED_CONTENT triggers
const promptAssetData = [
  {
    name: "애니메이션 실사화",
    type: "single",
    prompt: `You are an expert digital artist specializing in cinematic adaptations. 
Transform the character in the attached image into a hyper-realistic, high-definition photograph. 
The subject should look like a real person (Korean idol style) in a movie scene. 
Maintain the original pose and expression accurately. 
Lighting should be cinematic and realistic. 
Ensure skin texture and hair look natural and photorealistic.`,
    negativePrompt: `anime, cartoon, illustration, drawing, 2d, sketch, painting, distorted, noise, aliasing, shimmering, blurry`
  },
  {
    name: "의상 착용",
    type: "dual",
    prompt: `You are a professional fashion editor. Your task is to composite a fashion look.

**INPUTS:**
- Image 1 (Left): The fashion model / base character.
- Image 2 (Right): The reference clothing item.

**TASK:**
Drape the clothing from Image 2 onto the model in Image 1. 
- Ensure the fit is natural and tailored to the model's pose.
- Maintain the model's original identity, face, and pose exactly as they are in Image 1.
- Preserve the lighting and environment of Image 1.
- Ignore the mannequin/person in Image 2; strictly transfer the fabric and design of the garment.

**OUTPUT:**
A high-quality, photorealistic fashion photograph.`
  },
  {
    name: "상품 들기",
    type: "dual",
    prompt: `You are a professional product photographer and editor.

**INPUTS:**
- Image 1 (Left): The lifestyle model / character.
- Image 2 (Right): The product (e.g., bottle, phone, box).

**TASK:**
Composite the product from Image 2 into the hand of the character in Image 1.
- The product placement must look physically accurate (grip, lighting, shadows).
- Maintain the character's face, clothing, and background from Image 1.
- Only adjust the hand/fingers slightly if necessary to grip the object naturally.

**OUTPUT:**
A high-quality commercial lifestyle photograph.`
  },
  {
    name: "자세 따라하기",
    type: "dual",
    prompt: `You are an expert in pose transfer and character consistency.

**INPUTS:**
- Image 1 (Left): The Source Character (Reference for identity, face, clothes).
- Image 2 (Right): The Target Pose (Reference for body language/geometry).

**TASK:**
Generate a new image of the Character from Image 1 performing the Pose from Image 2.
- The character's face, hairstyle, and outfit must match Image 1.
- The character's body position and gesture must match Image 2.
- If Image 2 is a sketch or stick figure, interpret it as the skeletal structure.

**OUTPUT:**
A photorealistic image of the character in the new pose.`
  },
  {
    name: "의상 추출",
    type: "single",
    prompt: `You are a technical fashion archivist.

**TASK:**
Isolate the clothing items from the attached image.
- Create a "ghost mannequin" or "flat lay" style image of just the garments.
- Remove the person, skin, and background entirely.
- Place the clothing on a clean, pure white background.
- Preserve all fabric details, textures, and colors accurately.

**OUTPUT:**
A clean product catalog image of the clothing.`
  },
  {
    name: "오류 범위 해결",
    type: "single",
    prompt: `You are an expert photo restoration specialist.
The attached image contains solid colored masks (green/blue/black blocks) at the edges.

**TASK:**
Perform "Outpainting" to fill these masked areas.
- Extend the scenery, background, and objects naturally into the masked regions.
- Ensure seamless continuity of lighting and texture.
- Remove any solid color borders.

**OUTPUT:**
A complete, full-frame photograph.`
  },
];


const App: React.FC = () => {
  const [images, setImages] = useState<ImageObject[]>([]);
  const [textObjects, setTextObjects] = useState<TextObject[]>([]);
  const [drawingCanvases, setDrawingCanvases] = useState<DrawingCanvasObject[]>([]);
  const [layerOrder, setLayerOrder] = useState<string[]>([]);
  const [transform, setTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 0.2 });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [selectedTextIds, setSelectedTextIds] = useState<string[]>([]);
  const [selectedDrawingCanvasIds, setSelectedDrawingCanvasIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>('pan');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [debugImages, setDebugImages] = useState<{ label: string; src: string }[]>([]);
  const [isDraggingForDelete, setIsDraggingForDelete] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [activeImageUI, setActiveImageUI] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isCharacterPanelOpen, setIsCharacterPanelOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  
  const [projectName, setProjectName] = useState<string>('Untitled Story');

  const [apiKey, setApiKey] = useState<string>(() => {
      return localStorage.getItem('gemini_api_key') || process.env.API_KEY || '';
  });
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [tempApiKeyInput, setTempApiKeyInput] = useState('');
  const [isCheckingKey, setIsCheckingKey] = useState(false);
  const [keyValidationError, setKeyValidationError] = useState<string | null>(null);

  const [activeModel, setActiveModel] = useState<string>('gemini-2.5-flash-image');
  
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedVideoSourceImage, setSelectedVideoSourceImage] = useState<ImageObject | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const trashCanRef = useRef<HTMLDivElement>(null);
  const previousToolRef = useRef<Tool>(activeTool);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<PromptInputHandle>(null);
  const loadProjectInputRef = useRef<HTMLInputElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    promptInputRef.current?.focus();
    if (canvasRef.current) {
        const { clientWidth, clientHeight } = canvasRef.current;
        setTransform({
          scale: 0.2,
          x: clientWidth / 2,
          y: clientHeight / 2,
        });
      }
  }, []);

  const handleMoveToFront = useCallback((id: string) => {
    setLayerOrder(prev => {
        if (prev[prev.length - 1] === id) return prev;
        return [...prev.filter(item => item !== id), id];
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            return;
        }

        if (e.repeat) return;

        switch (e.code) {
            case 'KeyV':
                setActiveTool('select');
                break;
            case 'KeyA':
                setActiveTool('pan');
                break;
            case 'KeyP':
                e.preventDefault();
                setActiveTool('pen');
                break;
            case 'KeyE':
                e.preventDefault();
                setActiveTool('eraser');
                break;
            case 'KeyT':
                if (e.metaKey || e.ctrlKey) return; 
                e.preventDefault();
                setActiveTool('text');
                break;
        }

        switch (e.key) {
            case ' ':
                if (activeTool !== 'pan') {
                    previousToolRef.current = activeTool;
                    setActiveTool('pan');
                }
                break;
            case 'Control':
            case 'Meta':
                if (activeTool !== 'select') {
                    previousToolRef.current = activeTool;
                    setActiveTool('select');
                }
                break;
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          if (previousToolRef.current !== 'pan') {
            setActiveTool(previousToolRef.current);
          }
          break;
        case 'Control':
        case 'Meta':
           if (previousToolRef.current !== 'select') {
            setActiveTool(previousToolRef.current);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool]);
  
  const addImageToCanvas = useCallback((
    imgSrc: string,
    classification: ImageClassification,
    options?: { prompt?: string; targetAspectRatio?: AspectRatio; x?: number; y?: number; width?: number; height?: number; id?: string }
  ) => {
    const img = new Image();
    img.onload = () => {
      const newImage: ImageObject = {
        id: options?.id || `img_${Date.now()}`,
        src: imgSrc,
        x: options?.x ?? (-transform.x + (canvasRef.current?.clientWidth ?? window.innerWidth) / 2) / transform.scale - (options?.width ?? img.naturalWidth) / 2,
        y: options?.y ?? (-transform.y + (canvasRef.current?.clientHeight ?? window.innerHeight) / 2) / transform.scale - (options?.height ?? img.naturalHeight) / 2,
        width: options?.width ?? img.naturalWidth,
        height: options?.height ?? img.naturalHeight,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        classification,
        ...(options?.prompt && { prompt: options.prompt }),
        ...(options?.targetAspectRatio && { targetAspectRatio: options.targetAspectRatio }),
      };
      setImages((prev) => [...prev, newImage]);
      setLayerOrder((prev) => [...prev, newImage.id]); 
      setSelectedImageIds([newImage.id]); 
      setSelectedTextIds([]);
      setSelectedDrawingCanvasIds([]);
      promptInputRef.current?.focus(); 
      setActiveTool('select');
    };
    img.src = imgSrc;
  }, [transform.x, transform.y, transform.scale]);

  const addTextToCanvas = useCallback((x: number, y: number) => {
    const newText: TextObject = {
        id: `txt_${Date.now()}`,
        content: '텍스트를 입력하세요',
        x,
        y,
        fontSize: 48,
        color: '#000000',
        fontFamily: 'Arial',
        width: 300,
        height: 60, 
    };
    setTextObjects(prev => [...prev, newText]);
    setLayerOrder((prev) => [...prev, newText.id]); 
    setSelectedTextIds([newText.id]);
    setSelectedImageIds([]);
    setSelectedDrawingCanvasIds([]);
  }, []);

  const addDrawingCanvas = useCallback(() => {
    const [w, h] = aspectRatio.split(':').map(Number);
    const ratio = w / h;
    const BASE_DIMENSION = 1024; 

    let canvasWidth, canvasHeight;

    if (ratio >= 1) {
        canvasHeight = BASE_DIMENSION;
        canvasWidth = Math.round(BASE_DIMENSION * ratio);
    } else {
        canvasWidth = BASE_DIMENSION;
        canvasHeight = Math.round(BASE_DIMENSION / ratio);
    }
    
    const newCanvas: DrawingCanvasObject = {
      id: `canvas_${Date.now()}`,
      x: (-transform.x + (canvasRef.current?.clientWidth ?? window.innerWidth) / 2) / transform.scale - canvasWidth / 2,
      y: (-transform.y + (canvasRef.current?.clientHeight ?? window.innerHeight) / 2) / transform.scale - canvasHeight / 2,
      width: canvasWidth,
      height: canvasHeight,
      drawingSrc: '', 
    };
    setDrawingCanvases(prev => [...prev, newCanvas]);
    setLayerOrder((prev) => [...prev, newCanvas.id]); 
    
    setSelectedDrawingCanvasIds([newCanvas.id]);
    setSelectedImageIds([]);
    setSelectedTextIds([]);
    
    setActiveTool('select'); 
  }, [transform.x, transform.y, transform.scale, aspectRatio]);


  const handleFileUpload = useCallback((file: File | Blob) => {
    if (!file.type.startsWith('image/')) {
        console.warn('Attempted to upload a non-image file:', file.type);
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target?.result as string;
      if (imgSrc) {
        addImageToCanvas(imgSrc, 'original');
      }
    };
    reader.readAsDataURL(file);
  }, [addImageToCanvas]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                    handleFileUpload(file);
                    event.preventDefault();
                    break; 
                }
            }
        }
    };
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handleFileUpload]);
  
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleGenerateImage = useCallback(async (prompt: string) => {
    if (!prompt || isLoading) return;

    if (!apiKey) {
        setTempApiKeyInput('');
        setIsApiKeyModalOpen(true);
        return;
    }

    let finalPrompt = prompt;
    let negativePrompt: string | undefined;
    const assetMatch = prompt.match(/^\[(.*?)\]\s*(.*)$/);

    if (assetMatch) {
      const assetName = assetMatch[1];
      const userText = assetMatch[2];
      const matchedAsset = promptAssetData.find(asset => asset.name === assetName);
      
      if (matchedAsset) {
        let basePrompt = matchedAsset.prompt;

        if (assetName === "애니메이션 실사화" && activeModel === 'gemini-3-pro-image-preview') {
            basePrompt = `Create a hyper-realistic cinematic portrait of a Korean idol. The scene is a perfect snapshot with natural lighting, realistic skin textures, and high detail. The subject should not look like a cartoon or doll.`;
        }

        finalPrompt = userText
          ? `${basePrompt}\n\nAdditional user request: ${userText}`
          : basePrompt;
        
        if ('negativePrompt' in matchedAsset && (matchedAsset as any).negativePrompt) {
            negativePrompt = (matchedAsset as any).negativePrompt;
        }
      }
    }

    setIsLoading(true);
    setLoadingMessage(null);
    setErrorMessage(null);
    setDetailedError(null);
    setDebugImages([]);
    
    // REVISED: Limit to 3 retries to prevent "Infinite Loop" feeling.
    // Pro 3 model failure is usually payload size or safety, not transient.
    const maxRetries = 3; 

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            const selectedImages = images.filter(img => selectedImageIds.includes(img.id));
            const selectedCanvases = drawingCanvases.filter(canvas => selectedDrawingCanvasIds.includes(canvas.id));
            
            const editableItems = [
                ...selectedImages.map(img => ({ ...img, type: 'image' })),
                ...selectedCanvases.map(canvas => ({ ...canvas, src: canvas.drawingSrc, type: 'canvas' }))
            ].sort((a, b) => a.x - b.x); 

            // IMPORTANT: If editing images (creating from reference), fallback to Gemini Pro 3
            // because Imagen 4 (via generateImages) strictly does text-to-image generation, not editing.
            let currentModel = activeModel;
            // Force Imagen 4 for generation from scratch (no selected items) as per user request
            if (editableItems.length === 0) {
                currentModel = 'imagen-4.0-generate-001';
            } else if (activeModel.includes('imagen') && editableItems.length > 0) {
                // If editing (items selected) but active model is Imagen (if we had a button), fallback to Gemini.
                // Since we don't have an Imagen button anymore, this is just a safety check.
                console.log("Switching to Gemini 3 Pro for editing/inpainting task as Imagen is generation-only.");
                currentModel = 'gemini-3-pro-image-preview';
            }

            if (editableItems.length > 0) {
                const isSingleItem = editableItems.length === 1;
                let isMatchingAspectRatio = false;

                if (isSingleItem) {
                    const singleItem = editableItems[0];
                    const itemRatio = singleItem.width / singleItem.height;
                    const [targetW, targetH] = aspectRatio.split(':').map(Number);
                    const targetRatio = targetW / targetH;
                    if (Math.abs(itemRatio - targetRatio) < 0.01) {
                        isMatchingAspectRatio = true;
                    }
                }

                // OPTIMIZATION: Use 1376px JPEG 0.95 (Efficient & Sharp)
                // 1. Matched to user's 768x1376 output requirement.
                // 2. No weird upscaling.
                const referenceImageData = await Promise.all(editableItems.map(async (item) => {
                    const src = item.src || ""; 
                    if (!src) return null;
                    const { data: optimizedBase64, mimeType: optimizedMimeType } = await optimizeImageForApi(src, 1376, 0.95);
                    return { mimeType: optimizedMimeType, base64Data: optimizedBase64 };
                }));
                
                const validReferenceData = referenceImageData.filter(item => item !== null) as { mimeType: string; base64Data: string }[];

                if (validReferenceData.length === 0) {
                     throw new Error("Selected items have no data.");
                }

                setDebugImages(editableItems.map((item, i) => ({ label: `Reference ${i + 1} (${item.type})`, src: item.src })));
                
                // Append negative prompt to main prompt if exists
                const effectivePrompt = negativePrompt ? `${finalPrompt}\n\nNegative Prompt: ${negativePrompt}` : finalPrompt;

                // Handle Mask for Inpainting
                let maskPart = undefined;
                if (isSingleItem && isMatchingAspectRatio) {
                    const item = editableItems[0];
                    if ('maskSrc' in item && item.maskSrc) {
                        // Also optimize mask
                        const { data: maskBase64, mimeType: maskMimeType } = await optimizeImageForApi(item.maskSrc, 1376, 0.95);
                        maskPart = { mimeType: maskMimeType, base64Data: maskBase64 };
                    }
                }

                if (isSingleItem && isMatchingAspectRatio) {
                    const finalImageBase64 = await editImage(ai, effectivePrompt, validReferenceData, currentModel, maskPart, aspectRatio);
                    const finalImgSrc = `data:image/png;base64,${finalImageBase64}`;
                    setDebugImages(prev => [...prev, { label: 'Final Result (1-Step)', src: finalImgSrc }]);
                    addImageToCanvas(finalImgSrc, 'result', { prompt, targetAspectRatio: aspectRatio });
                } else {
                    const initialImageBase64 = await editImage(ai, effectivePrompt, validReferenceData, currentModel, undefined, aspectRatio);
                    const initialImageSrc = `data:image/png;base64,${initialImageBase64}`;
                    setDebugImages(prev => [...prev, { label: 'Step 1: Initial Edit', src: initialImageSrc }]);

                    const paddedImageSrc = await createPaddedImage(initialImageBase64, aspectRatio);
                    // Optimize the padded image as well with high quality
                    const { data: paddedData, mimeType: paddedMimeType } = await optimizeImageForApi(paddedImageSrc, 1376, 0.95);
                    setDebugImages(prev => [...prev, { label: 'Step 2: Padded for Outpainting', src: paddedImageSrc }]);

                    const finalImageBase64 = await editImage(ai, outpaintingPrompt, [{ mimeType: paddedMimeType, base64Data: paddedData }], currentModel, undefined, aspectRatio);
                    const finalImgSrc = `data:image/png;base64,${finalImageBase64}`;

                    setDebugImages(prev => [...prev, { label: 'Step 3: Final Result', src: finalImgSrc }]);
                    addImageToCanvas(finalImgSrc, 'result', { prompt, targetAspectRatio: aspectRatio });
                }
                
                setImages(prev => prev.map(img => {
                    if (selectedImageIds.includes(img.id)) {
                        return { ...img, maskSrc: undefined };
                    }
                    return img;
                }));
                
                setSelectedImageIds([]);
                setSelectedDrawingCanvasIds([]);

            } else {
                const characterImages = images.filter(img => img.classification === 'character' && img.name);
                const backgroundImages = images.filter(img => img.classification === 'background' && img.name);
        
                if (characterImages.length > 0 && backgroundImages.length > 0) {
                    const characterNames = characterImages.map(img => img.name!);
                    const backgroundNames = backgroundImages.map(img => img.name!);
                    
                    const { characterName, backgroundName } = await parsePromptForEntities(ai, finalPrompt, characterNames, backgroundNames);
        
                    if (characterName && backgroundName) {
                        const characterImage = characterImages.find(img => img.name === characterName);
                        const backgroundImage = backgroundImages.find(img => img.name === backgroundName);
        
                        if (characterImage && backgroundImage) {
                            console.log(`Found entities: Character '${characterName}', Background '${backgroundName}'. Using editImage.`);
                            
                            const imagesToEdit = [characterImage, backgroundImage];
                            const referenceImageData = await Promise.all(imagesToEdit.map(async (img) => {
                                const { data, mimeType } = await optimizeImageForApi(img.src, 1376, 0.95);
                                return { mimeType, base64Data: data };
                            }));

                            setDebugImages(imagesToEdit.map((img, i) => ({ label: `Reference ${i + 1} (${img.name})`, src: img.src })));
                            
                            const effectivePrompt = negativePrompt ? `${finalPrompt}\n\nNegative Prompt: ${negativePrompt}` : finalPrompt;

                            const initialImageBase64 = await editImage(ai, effectivePrompt, referenceImageData, 'gemini-3-pro-image-preview', undefined, aspectRatio);
                            const initialImageSrc = `data:image/png;base64,${initialImageBase64}`;
                            setDebugImages(prev => [...prev, { label: 'Step 1: Initial Combination', src: initialImageSrc }]);
        
                            const paddedImageSrc = await createPaddedImage(initialImageBase64, aspectRatio);
                            const { data: paddedData, mimeType: paddedMimeType } = await optimizeImageForApi(paddedImageSrc, 1376, 0.95);
                            setDebugImages(prev => [...prev, { label: 'Step 2: Padded for Outpainting', src: paddedImageSrc }]);

                            const finalImageBase64 = await editImage(ai, outpaintingPrompt, [{ mimeType: paddedMimeType, base64Data: paddedData }], 'gemini-3-pro-image-preview', undefined, aspectRatio);
                            const finalImgSrc = `data:image/png;base64,${finalImageBase64}`;
        
                            setDebugImages(prev => [...prev, { label: 'Step 3: Final Result', src: finalImgSrc }]);
                            addImageToCanvas(finalImgSrc, 'result', { prompt, targetAspectRatio: aspectRatio });
                            
                            setIsLoading(false);
                            setLoadingMessage(null);
                            setActiveTool('select');
                            return;
                        }
                    }
                }

                // FALLBACK: Generate a new image from scratch
                // User requirement: Automatically use Imagen 4 if no image is selected (Generation mode)
                const base64Image = await generateImage(ai, finalPrompt, currentModel, aspectRatio);
                const imgSrc = `data:image/png;base64,${base64Image}`;
                setDebugImages([{ label: 'Final Result (Imagen 4)', src: imgSrc }]);
                addImageToCanvas(imgSrc, 'result', { prompt, targetAspectRatio: aspectRatio });
            }

            setIsLoading(false);
            setLoadingMessage(null);
            // CHANGED: Force reset to 'select' after generation
            setActiveTool('select');
            return; 

        } catch (error: any) {
            console.error(`Image generation/editing failed on attempt ${attempt}:`, error);
            
            // CLEAN ERROR MESSAGE LOGIC
            let cleanMessage = error.message || 'Unknown error';
            let parsedError = null;

            // 1. Try to parse JSON error (often hidden in stringified message or error.message)
            try {
                const textToParse = error.message || JSON.stringify(error);
                const jsonMatch = textToParse.match(/{.*}/); // Find JSON-like substring
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.error) parsedError = parsed.error;
                    else parsedError = parsed;
                }
            } catch (e) { /* ignore */ }

            // 2. Direct Object Check (if error is { error: { code: 503 } })
            if (error.error) {
                parsedError = error.error;
            }

            // 3. Extract cleaner message from parsed error if available
            if (parsedError && parsedError.message) {
                cleanMessage = parsedError.message;
            }

            // 4. Sanitize Stack Trace (Remove Base64 junk)
            const rawStack = error.stack || '';
            const sanitizedStack = rawStack.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, '<BASE64_IMAGE_DATA_REMOVED>');
            
            // 5. Construct Readable Detailed Error
            const fullErrorDetails = `Reason: ${cleanMessage}\n\nTechnical Details:\n${sanitizedStack}`;
            setDetailedError(fullErrorDetails);

            // ERROR CLASSIFICATION
            const rawString = JSON.stringify(error).toLowerCase();
            const msgLower = cleanMessage.toLowerCase();

            // CRITICAL FIX: Stop retrying immediately if blocked by safety filters or client errors
            if (msgLower.includes("safety_block") || msgLower.includes("blocked") || msgLower.includes("prohibited") || msgLower.includes("recitation")) {
                setErrorMessage("안전 정책 또는 금지된 콘텐츠로 인해 이미지가 차단되었습니다. 프롬프트를 수정해주세요.");
                setIsLoading(false);
                setLoadingMessage(null);
                return; 
            }

            if (msgLower.includes("400") || msgLower.includes("invalid_argument") || msgLower.includes("payload") || msgLower.includes("too large")) {
                 setErrorMessage("이미지 데이터가 너무 큽니다. 입력 이미지를 줄이거나 더 간단한 프롬프트로 시도해주세요.");
                 setIsLoading(false);
                 setLoadingMessage(null);
                 return;
            }

            // CHECK FOR 503 OVERLOAD (Robust Detection)
            const is503 = 
                (parsedError && (parsedError.code === 503 || parsedError.status === "UNAVAILABLE")) ||
                msgLower.includes('503') || 
                msgLower.includes('overloaded') || 
                msgLower.includes('unavailable') ||
                rawString.includes('"code":503');

            const is429 = 
                (parsedError && (parsedError.code === 429 || parsedError.status === "RESOURCE_EXHAUSTED")) ||
                msgLower.includes('429') || 
                msgLower.includes('quota') ||
                msgLower.includes('resource_exhausted');

            if (attempt < maxRetries) {
                let delay = 3000;
                let message = "";

                if (is503) {
                    // Quick Backoff for 503: 1s, 2s, 4s
                    delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); 
                    message = `⚠️ 서버 과부하 (503). ${Math.round(delay/1000)}초 후 자동 재시도합니다... (${attempt}/${maxRetries})`;
                } else if (is429) {
                    delay = 5000;
                    message = `⏳ 사용량 한도 도달. 잠시 대기 중... (${attempt}/${maxRetries})`;
                } else {
                    delay = 2000;
                    message = `오류 발생. 재시도 중... (${attempt}/${maxRetries})`;
                }
                
                console.log(`Retry attempt ${attempt}: ${message}`);
                setLoadingMessage(message);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Explicit continue
            } else {
                console.error("Image generation/editing failed after all retries.");
                if (is503) {
                    setErrorMessage("Google 서버가 현재 매우 혼잡합니다 (503 Overloaded). 잠시 후 다시 시도해주세요.");
                } else if (is429) {
                    setErrorMessage("API 사용량이 초과되었습니다 (429 Quota Exceeded). 잠시 후 다시 시도하거나 다른 계정을 사용하세요.");
                } else {
                    setErrorMessage("생성을 실패하였습니다. 문제가 지속되면 콘솔의 상세 에러를 확인하세요.");
                }
                setIsLoading(false);
                setLoadingMessage(null);
            }
        }
    }
  }, [isLoading, images, drawingCanvases, selectedImageIds, selectedDrawingCanvasIds, aspectRatio, addImageToCanvas, activeModel, apiKey]);


  const updateImage = useCallback((id: string, newProps: Partial<ImageObject>) => {
    setImages((prevImages) =>
      prevImages.map((img) => (img.id === id ? { ...img, ...newProps } : img))
    );
  }, []);

  const updateTextObject = useCallback((id: string, newProps: Partial<TextObject>) => {
    setTextObjects((prev) => 
        prev.map((txt) => (txt.id === id ? { ...txt, ...newProps } : txt))
    );
  }, []);

  const updateDrawingCanvas = useCallback((id: string, newProps: Partial<DrawingCanvasObject>) => {
    setDrawingCanvases((prev) =>
      prev.map((canvas) => (canvas.id === id ? { ...canvas, ...newProps } : canvas))
    );
  }, []);

  const handleUpdateImageDetails = useCallback((
    id: string,
    details: Partial<Pick<ImageObject, 'classification' | 'name'>>
  ) => {
    setImages(prevImages =>
      prevImages.map(img => {
        if (img.id === id) {
          return { ...img, ...details };
        }
        return img;
      })
    );
    if (details.name || details.classification === 'modelSheet') {
      setActiveImageUI(id); 
    }
  }, []);
  
  const deleteImages = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setImages((prevImages) => prevImages.filter((img) => !ids.includes(img.id)));
    setLayerOrder((prev) => prev.filter(id => !ids.includes(id))); 
    setSelectedImageIds([]);
  }, []);

  const deleteTextObjects = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setTextObjects((prev) => prev.filter((txt) => !ids.includes(txt.id)));
    setLayerOrder((prev) => prev.filter(id => !ids.includes(id))); 
    setSelectedTextIds([]);
  }, []);

  const deleteDrawingCanvases = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setDrawingCanvases((prev) => prev.filter((canvas) => !ids.includes(canvas.id)));
    setLayerOrder((prev) => prev.filter(id => !ids.includes(id))); 
    setSelectedDrawingCanvasIds([]);
  }, []);


  const handleImageDragStart = useCallback(() => {
    if (selectedImageIds.length > 0 || selectedTextIds.length > 0 || selectedDrawingCanvasIds.length > 0) {
      setIsDraggingForDelete(true);
    }
  }, [selectedImageIds, selectedTextIds, selectedDrawingCanvasIds]);
  
  const handleImageDrag = useCallback((e: globalThis.MouseEvent) => {
    if (!isDraggingForDelete || !trashCanRef.current) return;
    const trashRect = trashCanRef.current.getBoundingClientRect();
    const isOver = e.clientX >= trashRect.left &&
                   e.clientX <= trashRect.right &&
                   e.clientY >= trashRect.top &&
                   e.clientY <= trashRect.bottom;
    setIsOverTrash(isOver);
  }, [isDraggingForDelete]);
  
  const handleImageDragEnd = useCallback(() => {
    if (isOverTrash) {
      deleteImages(selectedImageIds);
      deleteTextObjects(selectedTextIds);
      deleteDrawingCanvases(selectedDrawingCanvasIds);
    }
    setIsDraggingForDelete(false);
    setIsOverTrash(false);
  }, [isOverTrash, selectedImageIds, selectedTextIds, selectedDrawingCanvasIds, deleteImages, deleteTextObjects, deleteDrawingCanvases]);

  const handlePastePrompt = useCallback((prompt: string) => {
    if (promptInputRef.current) {
      promptInputRef.current.setPrompt(prompt);
      promptInputRef.current.focus();
    }
  }, []);

  const handleAssetClick = useCallback((asset: { name: string; prompt: string }) => {
    if (asset.name === "오류 범위 해결") {
        setActiveModel('gemini-3-pro-image-preview');
    }

    if (promptInputRef.current) {
      promptInputRef.current.setPrompt(`[${asset.name}] `);
      promptInputRef.current.focus();
    }
  }, []);

  const handleContextAction = useCallback((action: string) => {
     if (action === 'Merge') {
         handleMergeSelected();
         return;
     }

     if (action === "자세 따라하기") {
         setActiveModel('gemini-3-pro-image-preview');
     }

     const asset = promptAssetData.find(a => a.name === action);
     if (asset && promptInputRef.current) {
         promptInputRef.current.setPrompt(`[${asset.name}] `);
         promptInputRef.current.focus();
     }
  }, []);


  const handleToggleCharacterPanel = () => {
    setIsCharacterPanelOpen(prev => !prev);
  };

  const handleSelectCharacter = (characterId: string) => {
      setSelectedCharacterId(characterId);
      setIsCharacterPanelOpen(false);
  };

  const handleCloseCharacterDetail = () => {
      setSelectedCharacterId(null);
  };

  const handleUpdateCharacterImage = useCallback((
      characterId: string,
      update: { modelSheetSrc?: string; poseIndex?: number; poseSrc?: string }
  ) => {
      setImages(prevImages => {
          return prevImages.map(img => {
              if (img.id === characterId) {
                  const updatedImage = { ...img };
                  if (update.modelSheetSrc) {
                      updatedImage.modelSheetSrc = update.modelSheetSrc;
                  }
                  if (update.poseIndex !== undefined && update.poseSrc) {
                      const newPoses = [...(updatedImage.poses || Array(4).fill(null))];
                      newPoses[update.poseIndex] = update.poseSrc;
                      updatedImage.poses = newPoses as string[];
                  }
                  return updatedImage;
              }
              return img;
          });
      });
  }, []);

  const handleOpenVideoModal = (image: ImageObject) => {
    setSelectedVideoSourceImage(image);
    setIsVideoModalOpen(true);
  };

  const handleCloseVideoModal = () => {
    setIsVideoModalOpen(false);
    setSelectedVideoSourceImage(null);
  };

  const handleAddVideoToCanvas = (videoSrc: string, aspectRatio: '9:16' | '16:9') => {
      if (!selectedVideoSourceImage) return;

      const newWidth = selectedVideoSourceImage.width;
      const newHeight = selectedVideoSourceImage.height;

      const newImage: ImageObject = {
        id: `vid_${Date.now()}`,
        src: selectedVideoSourceImage.src, 
        x: selectedVideoSourceImage.x + 50,
        y: selectedVideoSourceImage.y + 50,
        width: newWidth,
        height: newHeight,
        naturalWidth: selectedVideoSourceImage.naturalWidth,
        naturalHeight: selectedVideoSourceImage.naturalHeight,
        classification: 'video',
        videoSrc: videoSrc,
        targetAspectRatio: aspectRatio as AspectRatio,
      };

      setImages((prev) => [...prev, newImage]);
      setLayerOrder((prev) => [...prev, newImage.id]); 
      setSelectedImageIds([newImage.id]);
  };
  
  const handleExtractLastFrame = useCallback((videoSrc: string, sourceImage: ImageObject) => {
      const video = document.createElement('video');
      video.src = videoSrc;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
          video.currentTime = video.duration; 
      };

      video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = sourceImage.naturalWidth;
          canvas.height = sourceImage.naturalHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
              const targetRatio = canvas.width / canvas.height;
              const videoRatio = video.videoWidth / video.videoHeight;
              
              let renderWidth, renderHeight, offsetX, offsetY;
              
              if (videoRatio > targetRatio) {
                  renderHeight = canvas.height;
                  renderWidth = renderHeight * videoRatio;
                  offsetX = (canvas.width - renderWidth) / 2;
                  offsetY = 0;
              } else {
                  renderWidth = canvas.width;
                  renderHeight = renderWidth / videoRatio;
                  offsetX = 0;
                  offsetY = (canvas.height - renderHeight) / 2;
              }
              
              const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
              const x = (canvas.width / 2) - (video.videoWidth / 2) * scale;
              const y = (canvas.height / 2) - (video.videoHeight / 2) * scale;
              
              ctx.drawImage(video, x, y, video.videoWidth * scale, video.videoHeight * scale);
              
              const dataUrl = canvas.toDataURL('image/png');
              addImageToCanvas(dataUrl, 'original', {
                  x: sourceImage.x + sourceImage.width + 20,
                  y: sourceImage.y,
                  width: sourceImage.width,
                  height: sourceImage.height,
                  targetAspectRatio: sourceImage.targetAspectRatio
              });
          }
      };

      video.onerror = () => {
        console.error("Error loading video for frame extraction.");
      }
      
      video.load();
  }, [addImageToCanvas]);

  const handleExport = useCallback(async () => {
    if (!canvasContentRef.current) return;

    setSelectedImageIds([]);
    setSelectedTextIds([]);
    setSelectedDrawingCanvasIds([]);

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const canvas = await html2canvas(canvasContentRef.current, {
            backgroundColor: null, 
            scale: 2, 
        });
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = 'story-maker-canvas.png';
        link.href = image;
        link.click();
    } catch (error) {
        console.error('Error exporting canvas:', error);
        alert('Could not export canvas. See console for details.');
    }
  }, []);

  // --- Reusable Loading Logic ---
  const loadProjectFromFile = useCallback(async (file: File) => {
      try {
          const zip = await JSZip.loadAsync(file);
          const projectFile = zip.file("project.json");
          if (!projectFile) throw new Error("Invalid project file: missing project.json");

          const projectJson = await projectFile.async("string");
          const projectData = JSON.parse(projectJson);

          const loadAsset = async (path: string): Promise<string> => {
              const file = zip.file(path);
              if (!file) return "";
              const blob = await file.async("blob");
              return new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
              });
          };

          const restoredImages = await Promise.all(projectData.images.map(async (img: any) => {
              img.src = await loadAsset(img.src);
              if (img.modelSheetSrc) img.modelSheetSrc = await loadAsset(img.modelSheetSrc);
              if (img.poses) {
                   img.poses = await Promise.all(img.poses.map(async (p: any) => p ? await loadAsset(p) : p));
              }
              if (img.videoSrc) img.videoSrc = await loadAsset(img.videoSrc);
              if (img.maskSrc) img.maskSrc = await loadAsset(img.maskSrc);
              return img;
          }));

          const restoredDrawings = await Promise.all(projectData.drawingCanvases.map(async (canvas: any) => {
              if (canvas.drawingSrc) canvas.drawingSrc = await loadAsset(canvas.drawingSrc);
              return canvas;
          }));

          setImages(restoredImages);
          setTextObjects(projectData.textObjects || []);
          setDrawingCanvases(restoredDrawings);
          if (projectData.layerOrder) setLayerOrder(projectData.layerOrder);
          if (projectData.aspectRatio) setAspectRatio(projectData.aspectRatio);
          if (projectData.transform) setTransform(projectData.transform);
          
          if (projectData.projectName) {
              setProjectName(projectData.projectName);
          } else {
              setProjectName(file.name.replace(/\.[^/.]+$/, ""));
          }

          setSelectedImageIds([]);
          setSelectedTextIds([]);
          setSelectedDrawingCanvasIds([]);

      } catch (error) {
          console.error("Failed to load project:", error);
          alert("Failed to load project.");
      }
  }, []);


  const handleSaveProject = useCallback(async () => {
      try {
          const zip = new JSZip();
          const assetsFolder = zip.folder("assets");
          
          if (!assetsFolder) throw new Error("Could not create assets folder");

          const addAsset = (dataUrl: string, prefix: string): string => {
              const { mimeType, data } = parseDataUrl(dataUrl);
              const ext = mimeType.split('/')[1] || 'bin';
              const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
              assetsFolder.file(filename, data, { base64: true });
              return `assets/${filename}`;
          };

          const processedImages = images.map(img => {
              const newImg = { ...img };
              newImg.src = addAsset(img.src, 'img');
              if (img.modelSheetSrc) {
                  newImg.modelSheetSrc = addAsset(img.modelSheetSrc, 'sheet');
              }
              if (img.poses) {
                  newImg.poses = img.poses.map(p => p ? addAsset(p, 'pose') : p);
              }
              if (img.videoSrc) {
                  newImg.videoSrc = addAsset(img.videoSrc, 'vid');
              }
              if (img.maskSrc) {
                  newImg.maskSrc = addAsset(img.maskSrc, 'mask');
              }
              return newImg;
          });

          const processedDrawings = drawingCanvases.map(canvas => {
              const newCanvas = { ...canvas };
              if (canvas.drawingSrc) {
                  newCanvas.drawingSrc = addAsset(canvas.drawingSrc, 'draw');
              }
              return newCanvas;
          });

          const projectData = {
              version: 1,
              projectName, 
              images: processedImages,
              textObjects,
              drawingCanvases: processedDrawings,
              layerOrder,
              aspectRatio,
              transform 
          };

          zip.file("project.json", JSON.stringify(projectData));

          const content = await zip.generateAsync({ type: "blob" });

          // Standard Download
          saveAs(content, `${projectName}.story`);
          alert("프로젝트가 저장되었습니다.");

      } catch (error) {
          console.error("Failed to save project:", error);
          alert("Failed to save project.");
      }
  }, [images, textObjects, drawingCanvases, layerOrder, aspectRatio, transform, projectName]);

  const handleLoadProjectInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      await loadProjectFromFile(file);
      e.target.value = ''; // Reset
  }, [loadProjectFromFile]);

  const handleOpenProjectClick = async () => {
      loadProjectInputRef.current?.click();
  };

  const handleNewProject = useCallback(() => {
      if (confirm("새로운 프로젝트를 만드시겠습니까? 저장하지 않은 내용은 사라집니다.")) {
          setImages([]);
          setTextObjects([]);
          setDrawingCanvases([]);
          setLayerOrder([]);
          setProjectName("Untitled Story");
          setSelectedImageIds([]);
          setSelectedTextIds([]);
          setSelectedDrawingCanvasIds([]);
          setAspectRatio('9:16');
          
          setTimeout(() => {
              projectNameInputRef.current?.focus();
              projectNameInputRef.current?.select();
          }, 100);
      }
  }, []);


  const handleMergeSelected = useCallback(async () => {
    const selectedImages = images.filter(img => selectedImageIds.includes(img.id));
    const selectedTexts = textObjects.filter(txt => selectedTextIds.includes(txt.id));
    const selectedCanvases = drawingCanvases.filter(can => selectedDrawingCanvasIds.includes(can.id));
    
    if (selectedImages.length + selectedTexts.length + selectedCanvases.length <= 1) return;

    const allSelectedObjects = [...selectedImages, ...selectedTexts, ...selectedCanvases];

    const minX = Math.min(...allSelectedObjects.map(obj => obj.x));
    const minY = Math.min(...allSelectedObjects.map(obj => obj.y));
    const maxX = Math.max(...allSelectedObjects.map(obj => obj.x + obj.width));
    const maxY = Math.max(...allSelectedObjects.map(obj => obj.y + (obj as any).height ?? 0));
    
    const captureWidth = maxX - minX;
    const captureHeight = maxY - minY;

    const captureContainer = document.createElement('div');
    captureContainer.style.position = 'absolute';
    captureContainer.style.left = '-9999px'; // Position off-screen
    captureContainer.style.width = `${captureWidth}px`;
    captureContainer.style.height = `${captureHeight}px`;
    captureContainer.style.overflow = 'hidden';
    document.body.appendChild(captureContainer);

    allSelectedObjects.forEach(obj => {
        let element: HTMLElement | null = null;
        if ('src' in obj) { // ImageObject
            const img = document.createElement('img');
            img.src = obj.src;
            img.style.width = `${obj.width}px`;
            img.style.height = `${obj.height}px`;
            element = img;
        } else if ('drawingSrc' in obj) { // DrawingCanvasObject
            const div = document.createElement('div');
            div.style.width = `${obj.width}px`;
            div.style.height = `${obj.height}px`;
            div.style.backgroundColor = 'white'; // Assuming white background
            if (obj.drawingSrc) {
                const img = document.createElement('img');
                img.src = obj.drawingSrc;
                img.style.position = 'absolute';
                img.style.top = '0';
                img.style.left = '0';
                img.style.width = '100%';
                img.style.height = '100%';
                div.appendChild(img);
            }
            element = div;
        } else if ('content' in obj) { // TextObject
            const txt = document.createElement('div');
            txt.innerText = obj.content;
            txt.style.width = `${obj.width}px`;
            txt.style.color = obj.color;
            txt.style.fontFamily = obj.fontFamily;
            txt.style.fontSize = `${obj.fontSize}px`;
            txt.style.lineHeight = '1.2';
            txt.style.whiteSpace = 'pre-wrap';
            txt.style.overflowWrap = 'break-word';
            element = txt;
        }
        
        if (element) {
            element.style.position = 'absolute';
            element.style.left = `${obj.x - minX}px`;
            element.style.top = `${obj.y - minY}px`;
            captureContainer.appendChild(element);
        }
    });

    try {
        const canvas = await html2canvas(captureContainer, { backgroundColor: null });
        const mergedImageSrc = canvas.toDataURL('image/png');
        
        // Cleanup
        document.body.removeChild(captureContainer);

        // Add new merged image
        addImageToCanvas(mergedImageSrc, 'result', {
            x: minX,
            y: minY,
            width: captureWidth,
            height: captureHeight,
        });

        // Delete original items
        deleteImages(selectedImageIds);
        deleteTextObjects(selectedTextIds);
        deleteDrawingCanvases(selectedDrawingCanvasIds);

    } catch (error) {
        console.error("Failed to merge objects:", error);
        document.body.removeChild(captureContainer);
        alert("Could not merge items. See console for details.");
    }

  }, [images, textObjects, drawingCanvases, selectedImageIds, selectedTextIds, selectedDrawingCanvasIds, addImageToCanvas, deleteImages, deleteTextObjects, deleteDrawingCanvases]);


  const selectedCharacter = images.find(img => img.id === selectedCharacterId);
  const selectedTextObject = selectedTextIds.length === 1 ? textObjects.find(t => t.id === selectedTextIds[0]) : undefined;

  const handleApiKeySubmit = async () => {
    if (!tempApiKeyInput.trim()) return;

    setKeyValidationError(null);
    setIsCheckingKey(true);

    const isValid = await validateApiKey(tempApiKeyInput.trim());

    if (isValid) {
        setApiKey(tempApiKeyInput.trim());
        localStorage.setItem('gemini_api_key', tempApiKeyInput.trim());
        setIsApiKeyModalOpen(false);
    } else {
        setKeyValidationError("유효한 API 키를 입력해주세요!");
    }
    setIsCheckingKey(false);
  };

  return (
    <div className="relative w-screen h-screen bg-[#f8f9fa] font-sans">
      <Header 
        scale={transform.scale} 
        onExport={handleExport}
        onOpenApiKeyModal={() => {
            setTempApiKeyInput(apiKey);
            setKeyValidationError(null);
            setIsApiKeyModalOpen(true);
        }}
        hasApiKey={!!apiKey}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        inputRef={projectNameInputRef}
      />
      
      {/* Hidden input for fallback loading */}
      <input 
        type="file" 
        accept=".story" 
        ref={loadProjectInputRef} 
        onChange={handleLoadProjectInputChange} 
        className="hidden" 
      />

      <Tools activeTool={activeTool} setActiveTool={setActiveTool} onNew={handleNewProject} onSave={handleSaveProject} onLoad={handleOpenProjectClick} />
      {selectedTextObject && <TextToolbar selectedText={selectedTextObject} onUpdate={updateTextObject} />}
      
      {/* Model Switcher */}
      <div className="absolute bottom-6 left-6 z-50 flex items-center bg-white/90 backdrop-blur shadow-lg rounded-full p-1 border border-gray-200">
        <button
          onClick={() => setActiveModel('gemini-2.5-flash-image')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex flex-col items-center ${
            activeModel === 'gemini-2.5-flash-image'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span>Flash 2.5</span>
          <span className="text-[10px] font-normal opacity-80">Fast</span>
        </button>
        <button
          onClick={() => setActiveModel('gemini-3-pro-image-preview')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex flex-col items-center ${
            activeModel === 'gemini-3-pro-image-preview'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span>Pro 3</span>
          <span className="text-[10px] font-normal opacity-80">Smart</span>
        </button>
      </div>

      <Sidebar 
        fileInputRef={fileInputRef} 
        onImageUpload={handleFileUpload} 
        onCharacterPanelToggle={handleToggleCharacterPanel}
        onAddDrawingCanvas={addDrawingCanvas}
      />
      <Canvas
        ref={canvasRef}
        contentRef={canvasContentRef}
        images={images}
        textObjects={textObjects}
        drawingCanvases={drawingCanvases}
        transform={transform}
        setTransform={setTransform}
        updateImage={updateImage}
        updateTextObject={updateTextObject}
        updateDrawingCanvas={updateDrawingCanvas}
        deleteImages={deleteImages}
        deleteTextObjects={deleteTextObjects}
        deleteDrawingCanvases={deleteDrawingCanvases}
        selectedImageIds={selectedImageIds}
        setSelectedImageIds={setSelectedImageIds}
        selectedTextIds={selectedTextIds}
        setSelectedTextIds={setSelectedTextIds}
        selectedDrawingCanvasIds={selectedDrawingCanvasIds}
        setSelectedDrawingCanvasIds={setSelectedDrawingCanvasIds}
        activeTool={activeTool}
        onTriggerUpload={triggerFileUpload}
        onFileUpload={handleFileUpload}
        onAddText={addTextToCanvas}
        onImageDragStart={handleImageDragStart}
        onImageDrag={handleImageDrag}
        onImageDragEnd={handleImageDragEnd}
        activeImageUI={activeImageUI}
        setActiveImageUI={setActiveImageUI}
        onUpdateImageDetails={handleUpdateImageDetails}
        onPastePrompt={handlePastePrompt}
        onBackgroundClick={() => {
          setActiveImageUI(null);
          
          // 배경 클릭 시 선택된 이미지의 마스크(붓칠) 초기화
          if (selectedImageIds.length > 0) {
              setImages(prev => prev.map(img => {
                  if (selectedImageIds.includes(img.id) && img.maskSrc) {
                      return { ...img, maskSrc: undefined };
                  }
                  return img;
              }));
          }

          setSelectedImageIds([]);
          setSelectedTextIds([]);
          setSelectedDrawingCanvasIds([]);
          
          // FORCE RESET TO PAN if current tool is a drawing context tool
          if (['text', 'pen', 'eraser'].includes(activeTool)) {
              setActiveTool('pan');
          }
        }}
        onContextAction={handleContextAction}
        onOpenVideoModal={handleOpenVideoModal}
        onExtractLastFrame={handleExtractLastFrame}
        layerOrder={layerOrder}
        onMoveToFront={handleMoveToFront}
        setActiveTool={setActiveTool}
      />
      <PromptAssets 
        assets={promptAssetData.filter(asset => asset.type === 'single')} 
        onAssetClick={handleAssetClick}
        isDisabled={isLoading} 
      />
      <PromptInput 
        ref={promptInputRef} 
        onSubmit={handleGenerateImage} 
        isLoading={isLoading} 
        loadingMessage={loadingMessage}
        errorMessage={errorMessage}
        detailedError={detailedError}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        onFocusChange={setIsInputFocused}
      />
      <TrashCan ref={trashCanRef} isVisible={isDraggingForDelete} isOver={isOverTrash} />
      {/* <DebugPanel images={debugImages} /> */}
      <CharacterPanel 
        isOpen={isCharacterPanelOpen}
        images={images}
        onClose={handleToggleCharacterPanel}
        onSelectCharacter={handleSelectCharacter}
      />
      {selectedCharacter && (
          <CharacterDetailView 
              character={selectedCharacter}
              onClose={handleCloseCharacterDetail}
              onUpdate={handleUpdateCharacterImage}
              activeModel={activeModel}
              apiKey={apiKey}
          />
      )}
      
      {/* Video Creation Modal */}
      <VideoCreationModal 
        isOpen={isVideoModalOpen}
        onClose={handleCloseVideoModal}
        sourceImage={selectedVideoSourceImage}
        onAddVideoToCanvas={handleAddVideoToCanvas}
        apiKey={apiKey}
        onOpenApiKeyModal={() => {
            setTempApiKeyInput(apiKey);
            setKeyValidationError(null);
            setIsApiKeyModalOpen(true);
        }}
      />

      {/* API Key Modal */}
      {isApiKeyModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
               {isCheckingKey && (
                  <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-[110] text-white animate-in fade-in duration-300">
                      <LoadingSpinnerIcon className="w-12 h-12 mb-4" />
                      <p className="font-semibold text-lg tracking-wide">API 키 확인 중...</p>
                  </div>
               )}
               <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full relative overflow-hidden">
                  <button 
                    onClick={() => setIsApiKeyModalOpen(false)} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl"
                  >
                    &times;
                  </button>
                  <h1 className="text-2xl font-bold text-gray-800 mb-4">Enter API Key</h1>
                  <p className="text-gray-600 mb-6 text-sm">
                      To use Story Maker, please enter your Google Gemini API Key.
                  </p>
                  
                  {keyValidationError && (
                      <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg text-sm font-semibold">
                          {keyValidationError}
                      </div>
                  )}

                  <input
                      type="text"
                      placeholder="Paste your API Key here"
                      className={`w-full px-4 py-3 mb-4 border rounded-lg focus:outline-none focus:ring-2 bg-gray-50 text-gray-800 ${keyValidationError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`}
                      value={tempApiKeyInput}
                      onChange={(e) => {
                          setTempApiKeyInput(e.target.value);
                          if(keyValidationError) setKeyValidationError(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApiKeySubmit()}
                  />
                  <div className="text-left text-xs text-gray-500 mb-4 bg-yellow-50 p-2 rounded border border-yellow-200">
                     💡 <strong>Tip:</strong> Video generation features require an API key from a project with billing enabled.
                  </div>
                  <button 
                      onClick={handleApiKeySubmit}
                      disabled={!tempApiKeyInput.trim() || isCheckingKey}
                      className={`w-full px-6 py-3 font-semibold rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                        ${!tempApiKeyInput.trim() || isCheckingKey
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'}
                      `}
                  >
                      Save Key
                  </button>
                  <div className="mt-6">
                      <a 
                          href="https://aistudio.google.com/app/apikey" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-500 hover:text-indigo-700 underline"
                      >
                          Get an API Key from Google AI Studio
                      </a>
                  </div>
               </div>
          </div>
      )}
    </div>
  );
};

export default App;
