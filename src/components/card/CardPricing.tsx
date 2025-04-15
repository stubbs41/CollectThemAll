import React from 'react';
import { CardPrices, PriceData } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

interface CardPricingProps {
  prices: CardPrices | undefined | null;
}

// Helper function to get the most relevant price data
const getDisplayPrices = (prices: CardPrices | undefined | null): PriceData | null => {
  if (!prices) return null;
  if (prices.holofoil?.market) return prices.holofoil;
  if (prices.reverseHolofoil?.market) return prices.reverseHolofoil;
  if (prices.normal?.market) return prices.normal;
  if (prices.firstEditionHolofoil?.market) return prices.firstEditionHolofoil;
  if (prices.firstEditionNormal?.market) return prices.firstEditionNormal;
  return Object.values(prices).find(priceData => priceData?.market != null) ?? null;
};

// Helper function to get the finish type name
const getPriceFinishType = (prices: CardPrices | undefined | null): string => {
  if (!prices) return 'N/A';
  if (prices.holofoil?.market) return 'Holofoil';
  if (prices.reverseHolofoil?.market) return 'Reverse Holo';
  if (prices.normal?.market) return 'Normal';
  if (prices.firstEditionHolofoil?.market) return '1st Ed. Holo';
  if (prices.firstEditionNormal?.market) return '1st Ed. Normal';
  const firstAvailableKey = Object.keys(prices).find(key => prices[key as keyof CardPrices]?.market != null);
  return firstAvailableKey ? firstAvailableKey.replace(/([A-Z])/g, ' $1').trim() : 'Unknown';
};

const CardPricing: React.FC<CardPricingProps> = ({ prices }) => {
  const displayPriceData = getDisplayPrices(prices);
  const finishType = getPriceFinishType(prices);
  const lastUpdated = prices?.updatedAt ? new Date(prices.updatedAt).toLocaleDateString() : null;

  return (
    <div className="card-pricing">
      <h3 className="text-lg font-semibold mb-2 text-gray-800">Market Pricing ({finishType})</h3>
      
      {displayPriceData ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          {(['low', 'mid', 'high', 'market'] as const).map((priceKey) => {
            const priceValue = displayPriceData[priceKey];
            return priceValue != null ? (
              <div key={priceKey} className="bg-gray-50 p-2 rounded border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500 capitalize">{priceKey}</p>
                <p className={`text-lg font-semibold mt-0.5 ${priceKey === 'market' ? 'text-green-600' : 'text-gray-800'}`}>
                  {formatPrice(priceValue)}
                </p>
              </div>
            ) : null; 
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">No TCGPlayer price data available.</p>
      )}
      
      {lastUpdated && (
        <p className="text-xs text-gray-400 mt-2 text-right">Prices updated: {lastUpdated}</p>
      )}
    </div>
  );
};

export default React.memo(CardPricing); 