
import React, { useState, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ArrowRightIcon, LoadingSpinnerIcon, ChevronDownIcon, ExclamationCircleIcon } from './icons';
import { AspectRatio, aspectRatios, PromptInputHandle } from '../types';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  loadingMessage: string | null;
  errorMessage: string | null;
  detailedError?: string | null;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onFocusChange: (isFocused: boolean) => void;
}

const PromptInput = forwardRef<PromptInputHandle, PromptInputProps>(({ onSubmit, isLoading, loadingMessage, errorMessage, detailedError, aspectRatio, onAspectRatioChange, onFocusChange }, ref) => {
  const [prompt, setPrompt] = useState('');
  const [placeholder, setPlaceholder] = useState("한국 전통 스타일로 내 사무실을 꾸며줘");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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

    if (loadingMessage) {
        setPlaceholder(loadingMessage);
        return;
    }

    if (!isLoading) {
      setPlaceholder("한국 전통 스타일로 내 사무실을 꾸며줘");
      return;
    }

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
    <>
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
              className={`w-full h-full py-3 pl-4 text-gray-700 bg-white focus:outline-none disabled:bg-white rounded-r-full ${errorMessage ? 'pr-24' : 'pr-14'}`}
              disabled={isLoading}
              onFocus={() => onFocusChange(true)}
              onBlur={() => onFocusChange(false)}
            />
            {errorMessage && (
                <button
                    type="button"
                    onClick={() => setShowErrorModal(true)}
                    className="absolute right-14 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors z-10 shadow-sm"
                    title="Show Error Details"
                >
                    <ExclamationCircleIcon className="w-4 h-4" />
                </button>
            )}
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

      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-4">
                
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                            <ExclamationCircleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">오류가 발생했습니다</h3>
                            <p className="text-sm text-gray-500">작업을 완료하지 못했습니다.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowErrorModal(false)} 
                        className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
                    >
                        &times;
                    </button>
                </div>

                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <p className="text-sm text-red-800 font-medium leading-relaxed">
                        {errorMessage || "알 수 없는 오류가 발생했습니다."}
                    </p>
                </div>

                {detailedError && (
                    <div className="border-t pt-4">
                        <button 
                            onClick={() => setShowDetails(!showDetails)}
                            className="text-xs text-gray-500 hover:text-gray-700 underline flex items-center gap-1"
                        >
                            {showDetails ? "상세 정보 숨기기" : "기술적 상세 정보 보기 (개발자용)"}
                        </button>
                        
                        {showDetails && (
                            <div className="mt-3 bg-gray-900 p-4 rounded-lg overflow-auto max-h-48 border border-gray-700">
                                <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                                    {detailedError}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end">
                    <button 
                        onClick={() => setShowErrorModal(false)} 
                        className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
});

export default PromptInput;
