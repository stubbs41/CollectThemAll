import React, { useState } from 'react';
import Image from 'next/image';
import { PokemonCard } from '@/lib/types';
import { getProxiedImageUrl } from '@/lib/utils';

interface CardPrintSelectorProps {
  prints: PokemonCard[];
  selectedPrintId: string | null;
  onSelectPrint: (printId: string) => void;
  isLoading: boolean;
}

const CardPrintSelector: React.FC<CardPrintSelectorProps> = ({
  prints,
  selectedPrintId,
  onSelectPrint,
  isLoading
}) => {
  // Track which set logos have loaded
  const [loadedLogos, setLoadedLogos] = useState<Record<string, boolean>>({});

  // Function to mark a logo as loaded
  const handleLogoLoaded = (printId: string) => {
    setLoadedLogos(prev => ({
      ...prev,
      [printId]: true
    }));
  };

  if (isLoading) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-800">Available Prints</h3>
        <p className="text-sm text-gray-500 italic mt-1">Loading prints...</p>
      </div>
    );
  }

  if (prints.length <= 1) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-800">Available Prints</h3>
        <p className="text-sm text-gray-500 italic mt-1">
          {prints.length === 1 ? 'Only one print known.' : 'No other prints found.'}
        </p>
      </div>
    );
  }

  // Sort prints by set name alphabetically for stable ordering
  // This keeps the order consistent regardless of which item is selected
  const stableSortedPrints = [...prints].sort((a, b) => 
    a.set.name.localeCompare(b.set.name)
  );

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2 text-gray-800">Available Prints</h3>
      <div className="flex flex-wrap gap-2">
        {stableSortedPrints.map(print => (
          <button
            key={print.id}
            onClick={() => onSelectPrint(print.id)}
            className={`flex items-center gap-1.5 text-xs font-medium pl-1 pr-2 py-0.5 rounded border transition-colors shadow-sm ${ 
              selectedPrintId === print.id
                ? 'bg-blue-600 text-white border-blue-700 ring-1 ring-blue-300'
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:border-gray-400'
            }`}
            title={`${print.set.name} - ${print.rarity || ''}`}
          >
            {print.set.images?.logo ? (
              <>
                <div className="w-4 h-4 relative flex-shrink-0">
                  {/* Show a loading placeholder until the image loads */}
                  {!loadedLogos[print.id] && (
                    <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-sm" />
                  )}
                  <Image 
                    src={getProxiedImageUrl(print.set.images.logo)} 
                    alt="" 
                    width={16} 
                    height={16}
                    className={`object-contain ${loadedLogos[print.id] ? 'opacity-100' : 'opacity-0'}`}
                    style={{ height: 'auto' }}
                    onLoad={() => handleLogoLoaded(print.id)}
                    loading={print.id === selectedPrintId ? "eager" : "lazy"}
                    priority={print.id === selectedPrintId}
                  />
                </div>
                <span className="whitespace-nowrap">{print.set.name}</span>
              </>
            ) : (
              <span className="whitespace-nowrap">{print.set.name}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(CardPrintSelector); 