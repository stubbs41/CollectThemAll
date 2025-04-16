import React from 'react';
import { CardPrices, PriceData } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

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

  // Get all available price types
  const availablePriceTypes = prices ? Object.keys(prices).filter(key => {
    const priceData = prices[key as keyof CardPrices];
    return priceData && (priceData.market || priceData.low || priceData.mid || priceData.high);
  }) : [];

  return (
    <div className="card-pricing">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">TCG Market Pricing</h3>
        <span className="text-sm font-medium px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
          {finishType}
        </span>
      </div>

      {displayPriceData ? (
        <div className="space-y-4">
          {/* Main price display with larger market price */}
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
            <div>
              <div className="flex items-center">
                <CurrencyDollarIcon className="h-5 w-5 text-green-600 mr-1" />
                <span className="text-sm font-medium text-gray-700">Market Price</span>
              </div>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatPrice(displayPriceData.market || 0)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <ArrowTrendingDownIcon className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-xs font-medium text-gray-600">Low</span>
                </div>
                <p className="text-sm font-semibold text-blue-600">
                  {formatPrice(displayPriceData.low || 0)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">Mid</span>
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  {formatPrice(displayPriceData.mid || 0)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <ArrowTrendingUpIcon className="h-4 w-4 text-red-600 mr-1" />
                  <span className="text-xs font-medium text-gray-600">High</span>
                </div>
                <p className="text-sm font-semibold text-red-600">
                  {formatPrice(displayPriceData.high || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Other available price types */}
          {availablePriceTypes.length > 1 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Other Available Prices:</p>
              <div className="grid grid-cols-2 gap-2">
                {availablePriceTypes.filter(type => type !== finishType.toLowerCase().replace(/ /g, '')).map(priceType => {
                  const priceData = prices[priceType as keyof CardPrices];
                  if (!priceData?.market) return null;

                  const displayName = priceType.replace(/([A-Z])/g, ' $1').trim();

                  return (
                    <div key={priceType} className="bg-gray-50 p-2 rounded border border-gray-200 flex justify-between items-center">
                      <span className="text-xs font-medium">{displayName}</span>
                      <span className="text-sm font-semibold">{formatPrice(priceData.market)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
          <p className="text-sm text-gray-500 italic">No TCGPlayer price data available.</p>
        </div>
      )}

      {lastUpdated && (
        <div className="flex justify-end mt-2">
          <p className="text-xs text-gray-400">Prices updated: {lastUpdated}</p>
        </div>
      )}
    </div>
  );
};

export default CardPricing;