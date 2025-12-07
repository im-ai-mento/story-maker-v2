
import React, { useState, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ArrowRightIcon, LoadingSpinnerIcon, ChevronDownIcon } from './icons';
import { AspectRatio, aspectRatios, PromptInputHandle } from '../types';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  loadingMessage: string | null;
  errorMessage: string | null;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onFocusChange: (isFocused: boolean) => void;
}

const PromptInput = forwardRef<PromptInputHandle, PromptInputProps>(({ onSubmit, isLoading, loadingMessage, errorMessage, aspectRatio, onAspectRatioChange, onFocusChange }, ref) => {
  const [prompt, setPrompt] = useState('');
  const [placeholder, setPlaceholder] = useState("한국 전통 스타일로 내 사무실을 꾸며줘");
  const internalInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    setPrompt(text: string) {
      setPrompt(text);
    },
    focus() {
      internalInputRef.current?.focus();
    },
  }));

  useEffect(() => {
    if (errorMessage) {
      setPlaceholder(errorMessage);
      return;
    }

    // If a specific message (like for retries) is passed, use it and stop.
    if (loadingMessage) {
        setPlaceholder(loadingMessage);
        return;
    }

    if (!isLoading) {
      setPlaceholder("한국 전통 스타일로 내 사무실을 꾸며줘");
      return;
    }

    // Standard loading logic with cycling messages
    setPlaceholder("이미지 생성 중입니다.");

    const startTime = Date.now();
    let messageIndex = 1;

    const earlyMessages = ["이미지 생성 중입니다.", "AI는 실수를 할 수 있습니다.", "잠시만 기다려주세요..."];
    const lateMessages = ["생성이 거의 다 완료되어 갑니다.", "AI는 실수를 할 수 있습니다.", "잠시만 기다려주세요..."];
    
    const intervalId = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        
        const currentMessages = elapsedTime < 35000 
            ? earlyMessages 
            : lateMessages;
        
        setPlaceholder(currentMessages[messageIndex % currentMessages.length]);
        messageIndex++;
    }, 3000);

    return () => {
        clearInterval(intervalId);
    };
  }, [isLoading, loadingMessage, errorMessage]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt);
      setPrompt('');
    }
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-20">
      <form
        onSubmit={handleSubmit}
        className="w-full p-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-full shadow-2xl flex items-stretch"
      >
        <div className="relative flex items-center">
            <select
              value={aspectRatio}
              onChange={(e) => onAspectRatioChange(e.target.value as AspectRatio)}
              className="h-full pl-5 pr-10 text-sm font-semibold text-gray-600 bg-white rounded-l-full border-r border-gray-200 focus:outline-none appearance-none cursor-pointer"
              disabled={isLoading}
              onFocus={() => onFocusChange(true)}
              onBlur={() => onFocusChange(false)}
            >
              {aspectRatios.map(ratio => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative flex-1">
          <input
            ref={internalInputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            className="w-full h-full py-3 pl-4 pr-14 text-gray-700 bg-white focus:outline-none disabled:bg-white rounded-r-full"
            disabled={isLoading}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? <LoadingSpinnerIcon /> : <ArrowRightIcon className="w-5 h-5 text-gray-600" />}
          </button>
        </div>
      </form>
    </div>
  );
});

export default PromptInput;
