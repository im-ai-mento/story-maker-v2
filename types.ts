

export type ImageClassification = 'original' | 'result' | 'character' | 'background' | 'modelSheet' | 'video';

export interface ImageObject {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  classification: ImageClassification;
  name?: string;
  prompt?: string;
  targetAspectRatio?: AspectRatio;
  modelSheetSrc?: string;
  poses?: string[];
  videoSrc?: string;
  maskSrc?: string; // For Inpainting
  poseIndex?: number;
  poseSrc?: string;
}

export interface TextObject {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
}

export interface DrawingCanvasObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  drawingSrc?: string;
}

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

export type ResizeHandle = 
  | 'tl' | 'tm' | 'tr'
  | 'ml' | 'mr'
  | 'bl' | 'bm' | 'br';

export type Tool = 'pan' | 'select' | 'text' | 'pen' | 'eraser';

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export const aspectRatios: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];

export interface PromptInputHandle {
  setPrompt: (text: string) => void;
  focus: () => void;
}

declare global {
  interface AIStudio {
      openSelectKey: () => Promise<void>;
      hasSelectedApiKey: () => Promise<boolean>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}
