
import React from 'react';

interface PromptAsset {
  name: string;
  prompt: string;
}

interface PromptAssetsProps {
  assets: PromptAsset[];
  onAssetClick: (asset: PromptAsset) => void;
  isDisabled: boolean;
}

const PromptAssets: React.FC<PromptAssetsProps> = ({ assets, onAssetClick, isDisabled }) => {
  if (!assets || assets.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-20">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {assets.map((asset) => (
          <button
            key={asset.name}
            onClick={() => onAssetClick(asset)}
            disabled={isDisabled}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white/80 backdrop-blur-sm rounded-lg shadow-md hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {asset.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PromptAssets;
