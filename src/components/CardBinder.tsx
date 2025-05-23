// src/components/CardBinder.tsx
'use client'; // Add this back for client-side interactivity

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PokemonCard } from '@/lib/types';
import SimpleCardDetailModal from './SimpleCardDetailModal';
import { formatPrice, getBestAvailablePrice, getProxiedImageUrl } from '@/lib/utils';
import { applyPricesToCards } from '@/lib/priceCache';
import { getCardPriceWithFallback, getCardPrice } from '@/lib/pricePersistence';
import { storePrice, getBestPrice } from '@/lib/robustPriceCache';
import { useCollections } from '@/context/CollectionContext';
import { useAuth } from '@/context/AuthContext';
import { fetchCardDetails } from '@/lib/pokemonApi'; // Import for prefetching

interface CardBinderProps {
  cards: PokemonCard[]; // Cards for the current page
  currentPage: number; // Current page number (1-based)
  totalPages: number; // Total number of pages
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (pageNumber: number) => void; // Add goToPage prop
  isLoading: boolean; // Loading state from parent
  isExploreView?: boolean; // New prop to indicate if this is the explore view
}

// Helper function to get price display details - fully independent of React
function calculatePriceDetails(card: PokemonCard | null) {
  if (!card || !card.id) {
    return {
      finalPrice: null,
      displayClass: 'bg-gray-500',
      textClass: 'text-white'
    };
  }

  // Try to get the best price from the card data
  const bestPrice = getBestAvailablePrice(card.tcgplayer?.prices);

  // Always try to get the price from our robust cache first
  const robustCachedPrice = getBestPrice(card.id, null);

  // Fall back to the original cache if needed
  const originalCachedPrice = getCardPrice(card.id);

  // Use the best available price with this priority
  let finalPrice;
  if (robustCachedPrice > 0) {
    finalPrice = robustCachedPrice;
  } else if (originalCachedPrice !== undefined && originalCachedPrice > 0) {
    finalPrice = originalCachedPrice;
  } else if (bestPrice !== null && bestPrice > 0) {
    finalPrice = bestPrice;
  } else {
    finalPrice = getCardPriceWithFallback(card.id, bestPrice);
  }

  // Store the price in our cache if it's valid
  if (finalPrice !== null && finalPrice > 0) {
    storePrice(card.id, finalPrice);
  }

  return {
    finalPrice,
    displayClass: finalPrice ? 'bg-gray-800' : 'bg-gray-500',
    textClass: finalPrice ? 'text-yellow-300' : 'text-white'
  };
}

const CARDS_PER_SPREAD = 32;

const CardBinder: React.FC<CardBinderProps> = ({
  cards,
  currentPage,
  totalPages,
  goToNextPage,
  goToPreviousPage,
  goToPage,
  isLoading,
  isExploreView = false,
}) => {
  // Get collection check function and collections array from context
  const {
    isCardInCollection,
    addCardToCollection,
    removeCardFromCollection,
    getCardQuantity
  } = useCollections();
  const { session } = useAuth(); // Get session to check if user is logged in

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Prefetch visible cards to improve performance
  const prefetchVisibleCards = useCallback(() => {
    // Only prefetch if we have cards
    if (!cards || cards.length === 0) return;

    // Prefetch the first 8 cards on the current page (most likely to be clicked)
    const cardsToFetch = cards.slice(0, 8);

    // Use setTimeout to avoid blocking the UI
    setTimeout(() => {
      cardsToFetch.forEach(card => {
        if (card && card.id) {
          // Fetch card details without forcing price refresh
          fetchCardDetails(card.id, false).catch(err => {
            // Silently fail for prefetching
            console.debug(`Failed to prefetch card ${card.id}:`, err);
          });
        }
      });
    }, 500); // Delay prefetching to prioritize visible content
  }, [cards]);

  // Prefetch cards when the component mounts or cards change
  useEffect(() => {
    prefetchVisibleCards();
  }, [prefetchVisibleCards]);

  // Apply cached prices to cards when they change
  const processedCards = useMemo(() => {
    // Apply cached prices to the cards
    return cards ? applyPricesToCards(cards) : [];
  }, [cards]);

  const handleCardClick = (cardId: string) => {
    if (cardId) {
      setSelectedCardId(cardId);
    }
  };

  const handleCloseModal = () => {
    setSelectedCardId(null);
  };


  const currentSpreadCards = processedCards || [];

  const leftPageCards = currentSpreadCards.slice(0, 16);
  const rightPageCards = currentSpreadCards.slice(16, 16 + 16);

  // Enhanced pagination function to show more pages and handle large page counts
  const getPaginationItems = (currentPage: number, totalPages: number) => {
    // Handle edge cases first
    if (totalPages <= 0) {
      return [1]; // Always show at least page 1
    }

    if (totalPages === 1) {
      return [1]; // If there's only one page, just return that
    }

    const items: (number | string)[] = [];
    const delta = 2; // Increased: show more pages around the current page

    // Always add the first page
    items.push(1);

    // Add leading ellipsis if needed
    if (currentPage > delta + 2) {
      items.push('...');
    }

    // Add pages around the current page
    const start = Math.max(2, currentPage - delta);
    const end = Math.min(totalPages - 1, currentPage + delta);

    // Only add pages if start <= end (prevents issues with small totalPages)
    if (start <= end) {
      for (let i = start; i <= end; i++) {
          items.push(i);
      }
    }

    // Add trailing ellipsis if needed
    if (currentPage < totalPages - delta - 1) {
      items.push('...');
    }

    // Always add the last page if it's greater than 1
    if (totalPages > 1) {
      items.push(totalPages);
    }

    // Deduplicate items (handles cases where start/end overlap with 1 or totalPages)
    const uniqueItems = items.filter((item, index, self) => {
        // Keep ellipsis
        if (typeof item === 'string') return true;
        // Keep first occurrence of a number
        return self.findIndex(i => i === item) === index;
    });

    return uniqueItems;
  };

  const paginationItems = getPaginationItems(currentPage, totalPages);
  
  // Get the last active collection group from localStorage, or default to 'Default'
  const getActiveGroup = () => {
    if (typeof window === 'undefined') return 'Default';
    try {
      const lastActiveGroup = localStorage.getItem('lastActiveCollectionGroup');
      const activeGroup = localStorage.getItem('activeCollectionGroup');
      // First try to use the last active group (from Add Cards click)
      // Then try the general active group
      // Finally fall back to 'Default'
      return lastActiveGroup || activeGroup || 'Default';
    } catch (error) {
      console.error('Error getting active group from localStorage:', error);
      return 'Default';
    }
  };

  const renderPage = (pageCards: PokemonCard[], side: 'Left' | 'Right') => {
    // Start index for the current spread (two pages)
    const spreadStartIndex = (currentPage - 1) * CARDS_PER_SPREAD;
    const defaultGroup = getActiveGroup();

    return (
      <div className="flex-1 bg-white rounded-lg shadow p-4 border border-gray-200 relative">
        {/* Add loading overlay */}
        {isLoading && (
            <div className="absolute inset-0 bg-white/70 flex justify-center items-center z-10">
                <p className="text-gray-500">Loading...</p>
            </div>
        )}
        <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 16 }).map((_, index) => {
                // Adjust card index calculation for the current page
                const cardIndexOnPage = side === 'Left' ? index : index + 16;
                const card = pageCards && index < pageCards.length ? pageCards[index] : null;
                const overallCardIndex = spreadStartIndex + cardIndexOnPage; // For display number

                // Only apply colored borders if user is logged in and card exists
                const isInHaveCollection = card && session && card.id && isCardInCollection(card.id, 'have', defaultGroup);
                const isInWantCollection = card && session && card.id && isCardInCollection(card.id, 'want', defaultGroup);

                // Determine border style: Want (Purple) > Owned (Green) > Default (Gray)
                const borderStyle = card
                    ? (session && isInWantCollection) ? 'border-purple-500 border-2'
                    : (session && isInHaveCollection) ? 'border-green-400 border-2'
                    : 'border-gray-300'
                    : 'border-gray-300';

                const currentQuantity = card && session && isInHaveCollection && card.id ? getCardQuantity(card.id, 'have', defaultGroup) : 0;

                // Calculate price details outside of JSX
                const priceDetails = card ? calculatePriceDetails(card) : {
                  finalPrice: null,
                  displayClass: 'bg-gray-300',
                  textClass: 'text-gray-500'
                };

                return (
                    <div
                        key={card ? `${card.id}-${overallCardIndex}` : `empty-${overallCardIndex}`}
                        className={`flex flex-col bg-gray-100 rounded border relative group cursor-pointer transition-shadow duration-150 hover:shadow-lg ${borderStyle}`}
                        onClick={() => card && card.id && handleCardClick(card.id)}
                    >
                         {/* Card Number Overlay - use overall index */}
                         <div className={`absolute top-0.5 left-0.5 text-[10px] font-bold px-1 rounded-sm ${card ? 'bg-black/60 text-white' : 'bg-gray-300 text-gray-600'}`}>
                            {String(overallCardIndex + 1).padStart(3, '0')}
                         </div>

                        {card ? (
                            <>
                                <Link href={card.id ? `/cards/${card.id}` : '#'} prefetch={false} onClick={(e) => {
                                    // Prevent the link navigation and use the modal instead
                                    e.preventDefault();
                                    if (card.id) handleCardClick(card.id);
                                }}>
                                    <div className={`flex-grow w-full aspect-[5/7] relative transition-opacity duration-200 ${isInHaveCollection ? 'opacity-70' : 'opacity-100'}`}>
                                        <Image
                                            src={getProxiedImageUrl(card.images?.small || '/images/card-placeholder.svg')}
                                            alt={card.name || 'Unknown Card'}
                                            fill
                                            sizes="(max-width: 768px) 15vw, 10vw"
                                            className="object-contain"
                                            priority={index < 8}
                                            loading={index < 16 ? "eager" : "lazy"}
                                            quality={85}
                                            onError={(e) => {
                                                // Handle image load errors
                                                const imgElement = e.currentTarget as HTMLImageElement;
                                                // Set a fallback image
                                                imgElement.src = '/images/card-placeholder.svg';
                                                // Add a class to indicate error
                                                imgElement.classList.add('image-error');
                                                console.warn(`Failed to load image for card: ${card.id}`);
                                            }}
                                        />
                                    </div>
                                </Link>
                                <div className="flex-shrink-0 p-1 h-[58px] text-center bg-gray-200 w-full border-t border-gray-300">
                                     <p className="text-[10px] font-medium text-gray-900 truncate leading-tight" title={card.name || 'Unknown Card'}>{card.name || 'Unknown Card'}</p>
                                     <p className="text-[9px] text-gray-600 leading-tight">{card.rarity || 'N/A'}</p>

                                     {/* Price display using precomputed details */}
                                     <div className={`mt-0.5 py-0.5 px-1 rounded ${priceDetails.displayClass}`}>
                                         <p className={`text-[10px] font-bold leading-tight ${priceDetails.textClass}`}>
                                             {priceDetails.finalPrice ? formatPrice(priceDetails.finalPrice) : 'No Price'}
                                         </p>
                                     </div>

                                     <p className="text-[8px] text-gray-600 leading-none mt-0.5">Market Price</p>
                                </div>

                                {/* --- ADD QUANTITY CONTROLS START --- */}
                                {session && isInHaveCollection && !isExploreView && card.id && (
                                    <div
                                        // Stop propagation so clicking controls doesn't open modal
                                        onClick={(e) => e.stopPropagation()}
                                        // Position at bottom, show on group hover
                                        className="absolute bottom-0 left-0 right-0 h-7 bg-black/80 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-b"
                                    >
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (card.id) removeCardFromCollection(card.id, 'have', defaultGroup);
                                            }}
                                            className="px-2.5 py-0.5 text-white bg-red-600 hover:bg-red-700 rounded-l text-lg font-bold leading-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label="Decrease quantity"
                                            // Disable button if quantity is 1 (or less, though shouldn't happen)
                                            // removeCardFromCollection handles removal if quantity becomes 0
                                            disabled={isLoading || currentQuantity <= 0}
                                        >
                                            -
                                        </button>
                                        <span className="px-3 py-0.5 text-white bg-gray-700 text-sm font-semibold leading-none min-w-[30px] text-center">
                                            {currentQuantity}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (card.id) addCardToCollection(card.id, card, 'have', defaultGroup);
                                            }}
                                            className="px-2.5 py-0.5 text-white bg-green-600 hover:bg-green-700 rounded-r text-lg font-bold leading-none disabled:opacity-50"
                                            aria-label="Increase quantity"
                                            disabled={isLoading}
                                        >
                                            +
                                        </button>
                                    </div>
                                )}
                                {/* --- ADD QUANTITY CONTROLS END --- */}
                            </>
                        ) : (
                            <>
                                <div className="flex-grow w-full aspect-[5/7] flex items-center justify-center bg-gray-200 rounded">
                                    <span className="text-xs text-gray-400">Empty</span>
                                </div>
                                <div className="flex-shrink-0 p-1 h-[58px] text-center bg-gray-200 w-full border-t border-gray-300">
                                    <p className="text-[10px] font-medium text-gray-400 truncate leading-tight">Empty Slot</p>
                                    <div className="mt-0.5 py-0.5 px-1 rounded bg-gray-300">
                                        <p className="text-[10px] font-bold leading-tight text-gray-500">No Price</p>
                                    </div>
                                    <p className="text-[8px] text-gray-500 leading-none mt-0.5">Market Price</p>
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col items-center bg-white p-5 rounded-lg shadow border border-gray-200">
         {/* Binder Pages */}
         <div className="flex flex-col md:flex-row justify-center items-start gap-5 w-full">
             {renderPage(leftPageCards, 'Left')}
             {renderPage(rightPageCards, 'Right')}
         </div>

         {/* Enhanced Pagination Controls */}
         <div className="text-center text-sm text-gray-600 mt-4 flex items-center justify-center flex-wrap gap-2 w-full">
             {/* Only show pagination if there are pages to navigate */}
             {totalPages > 0 && (
                 <>
                     <button
                         type="button"
                         onClick={goToPreviousPage}
                         disabled={currentPage <= 1 || isLoading}
                         className="px-4 py-2 rounded text-xs font-semibold transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                         aria-label="Previous Page"
                     >
                         &lt; Prev
                     </button>

                     {/* Dynamic pagination numbers */}
                     {paginationItems.map((item, index) => (
                         typeof item === 'number' ? (
                             <button
                                 key={`page-${item}`}
                                 type="button"
                                 onClick={() => goToPage(item)}
                                 disabled={isLoading}
                                 className={`w-8 h-8 rounded text-xs font-semibold transition-colors ${
                                     item === currentPage
                                         ? 'bg-blue-600 text-white cursor-default'
                                         : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                                 }`}
                                 aria-label={`Go to page ${item}`}
                                 aria-current={item === currentPage ? 'page' : undefined}
                             >
                                 {item}
                             </button>
                         ) : (
                             <span key={`ellipsis-${index}`} className="px-2 py-2 text-gray-400">
                                 ...
                             </span>
                         )
                     ))}

                     {/* Direct Page Navigation - only show if there are pages */}
                     {totalPages > 0 && (
                         <>
                             <div className="flex items-center gap-1">
                                <span className="text-xs font-medium">Go to:</span>
                                <input
                                    type="number"
                                    min="1"
                                    max={totalPages}
                                    className="w-14 h-8 px-2 py-1 text-xs border border-gray-300 rounded-md text-center"
                                    placeholder="#"
                                    title="Enter page number"
                                    aria-label="Page number input"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const pageNum = parseInt((e.target as HTMLInputElement).value);
                                            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                                                goToPage(pageNum);
                                                // Optional: Reset input
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        const input = e.currentTarget.previousSibling as HTMLInputElement;
                                        const pageNum = parseInt(input.value);
                                        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                                            goToPage(pageNum);
                                            // Optional: Reset input
                                            input.value = '';
                                        }
                                    }}
                                    disabled={isLoading}
                                    className="h-8 px-2 text-xs font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Go
                                </button>
                             </div>

                             <button
                                 type="button"
                                 onClick={goToNextPage}
                                 disabled={currentPage >= totalPages || isLoading}
                                 className="px-4 py-2 rounded text-xs font-semibold transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                 aria-label="Next Page"
                             >
                                 Next &gt;
                             </button>
                         </>
                     )}
                 </>
             )}
         </div>

         {/* Only show this message if user is logged in */}
         {session && <p className="text-xs text-gray-500 mt-2">Green border indicates cards you own. Purple border indicates cards you want. Click any slot for details.</p>}
         {!session && <p className="text-xs text-gray-500 mt-2">Sign in to track your collection. Click any card for details.</p>}

         <SimpleCardDetailModal cardId={selectedCardId} onClose={handleCloseModal} />
    </div>
  );
};

export default CardBinder;