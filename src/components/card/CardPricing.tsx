import React, { useState } from 'react';
import { CardPrices, PriceData } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { storeCardPrice, getCardPrice, getCardPriceWithFallback } from '@/lib/pricePersistence';
import { storePrice, getBestPrice } from '@/lib/robustPriceCache';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, CurrencyDollarIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface CardPricingProps {
  prices: CardPrices | undefined | null;
  cardId?: string; // Optional card ID for price persistence
}

// Helper function to get the most relevant price data
const getDisplayPrices = (prices: CardPrices | undefined | null, cardId?: string): PriceData | null => {
  // If we have a card ID, try to get the price from our robust cache first
  let robustCachedPrice: number = 0;
  if (cardId) {
    robustCachedPrice = getBestPrice(cardId, null);
  }

  // If we have a valid robust cached price, we'll use it for the market price
  // but we'll still try to get the low, mid, and high prices from the API data
  let cachedMarketPrice = 0;
  if (robustCachedPrice > 0) {
    console.log(`[CardPricing] Using robust cached price ${robustCachedPrice} for card ${cardId}`);
    cachedMarketPrice = robustCachedPrice;
  }

  // Try the original cache as a fallback
  let originalCachedPrice: number | undefined;
  if (cardId) {
    originalCachedPrice = getCardPrice(cardId);
  }

  // If we have a valid original cached price and no robust cached price, use it
  if (cachedMarketPrice === 0 && originalCachedPrice !== undefined && originalCachedPrice > 0) {
    console.log(`[CardPricing] Using original cached price ${originalCachedPrice} for card ${cardId}`);
    cachedMarketPrice = originalCachedPrice;
  }

  // If no cached price or no card ID, proceed with normal logic
  if (!prices) return null;

  // Find the first available price data with a market price
  let priceData: PriceData | null = null;

  if (prices.holofoil?.market) priceData = prices.holofoil;
  else if (prices.reverseHolofoil?.market) priceData = prices.reverseHolofoil;
  else if (prices.normal?.market) priceData = prices.normal;
  else if (prices.firstEditionHolofoil?.market) priceData = prices.firstEditionHolofoil;
  else if (prices.firstEditionNormal?.market) priceData = prices.firstEditionNormal;
  else priceData = Object.values(prices).find(priceData => priceData?.market != null) ?? null;

  // Store the price in BOTH our caches if it's valid and we have a card ID
  if (priceData?.market && cardId) {
    console.log(`[CardPricing] Storing API price ${priceData.market} for card ${cardId}`);
    storeCardPrice(cardId, priceData.market);
    storePrice(cardId, priceData.market);
  } else if (cardId && !priceData?.market) {
    // If we don't have a valid price from the API, try to get it from our fallback cache
    const fallbackPrice = getCardPriceWithFallback(cardId, null);
    if (fallbackPrice > 0 && cachedMarketPrice === 0) {
      console.log(`[CardPricing] Using fallback price ${fallbackPrice} for card ${cardId}`);
      // Also store it in our robust cache for future use
      storePrice(cardId, fallbackPrice);
      cachedMarketPrice = fallbackPrice;
    }
  }

  // If we have a cached market price, use it instead of the API market price
  if (cachedMarketPrice > 0) {
    // If we have price data from the API, use it for low, mid, and high prices
    if (priceData) {
      return {
        ...priceData,
        market: cachedMarketPrice
      };
    } else {
      // If we don't have price data from the API, create a new price data object
      return {
        market: cachedMarketPrice,
        low: null,
        mid: null,
        high: null,
        directLow: null
      };
    }
  }

  return priceData;
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

const CardPricing: React.FC<CardPricingProps> = ({ prices, cardId }) => {
  const [showAllPrices, setShowAllPrices] = useState(true);
  const displayPriceData = getDisplayPrices(prices, cardId);
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
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
            {finishType}
          </span>
          {availablePriceTypes.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAllPrices(!showAllPrices)}
              className="text-xs flex items-center text-gray-600 hover:text-gray-800"
            >
              {showAllPrices ? (
                <>
                  <ChevronUpIcon className="h-4 w-4 mr-1" />
                  Hide All
                </>
              ) : (
                <>
                  <ChevronDownIcon className="h-4 w-4 mr-1" />
                  Show All
                </>
              )}
            </button>
          )}
        </div>
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

          {/* All available price types */}
          {showAllPrices && availablePriceTypes.length > 1 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">All Available Prices:</p>
              <div className="grid grid-cols-2 gap-2">
                {availablePriceTypes.map(priceType => {
                  const priceData = prices[priceType as keyof CardPrices];
                  if (!priceData) return null;

                  const displayName = priceType.replace(/([A-Z])/g, ' $1').trim();
                  const isCurrentType = priceType.toLowerCase().replace(/ /g, '') === finishType.toLowerCase().replace(/ /g, '');

                  return (
                    <div key={priceType}
                      className={`p-2 rounded border flex flex-col ${isCurrentType ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">{displayName}</span>
                        {isCurrentType && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">Current</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {priceData.market && (
                          <div className="text-xs">
                            <span className="text-gray-500">Market:</span>
                            <span className="font-semibold text-green-600 ml-1">{formatPrice(priceData.market)}</span>
                          </div>
                        )}
                        {priceData.low && (
                          <div className="text-xs">
                            <span className="text-gray-500">Low:</span>
                            <span className="font-semibold text-blue-600 ml-1">{formatPrice(priceData.low)}</span>
                          </div>
                        )}
                        {priceData.mid && (
                          <div className="text-xs">
                            <span className="text-gray-500">Mid:</span>
                            <span className="font-semibold ml-1">{formatPrice(priceData.mid)}</span>
                          </div>
                        )}
                        {priceData.high && (
                          <div className="text-xs">
                            <span className="text-gray-500">High:</span>
                            <span className="font-semibold text-red-600 ml-1">{formatPrice(priceData.high)}</span>
                          </div>
                        )}
                      </div>
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
          <p className="text-xs text-gray-400">Updated: {lastUpdated}</p>
        </div>
      )}
    </div>
  );
};

export default CardPricing;