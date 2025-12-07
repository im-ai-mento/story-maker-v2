
import React, { forwardRef } from 'react';
import { TrashIcon } from './icons';

interface TrashCanProps {
  isVisible: boolean;
  isOver: boolean;
}

const TrashCan = forwardRef<HTMLDivElement, TrashCanProps>(({ isVisible, isOver }, ref) => {
  return (
    <div
      ref={ref}
      className={`absolute bottom-8 right-8 flex flex-col items-center justify-center gap-1 p-4 rounded-2xl shadow-lg transition-all duration-300 pointer-events-none
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50 -translate-y-10'}
        ${isOver ? 'scale-110 bg-red-500' : 'bg-white'}
      `}
    >
      <TrashIcon className={`w-8 h-8 ${isOver ? 'text-white' : 'text-gray-500'}`} />
      <span className={`text-xs font-semibold transition-colors ${isOver ? 'text-white' : 'text-gray-600'}`}>
        휴지통
      </span>
    </div>
  );
});

export default TrashCan;
