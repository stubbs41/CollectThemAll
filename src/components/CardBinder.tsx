// src/components/CardBinder.tsx
'use client'; // Add this back for client-side interactivity

import React, { useState } from 'react'; // Only import what's actually used
import Image from 'next/image';
import { PokemonCard } from '@/lib/types'; // Removed CardPrices import
import CardDetailModal from './CardDetailModal'; // Import the modal component
import { formatPrice, getMarketPrice, getBestAvailablePrice, getProxiedImageUrl } from '@/lib/utils'; // Import from utils
import { useCollections } from '@/context/CollectionContext'; // Import context hook
import { useAuth } from '@/context/AuthContext'; // Import auth context

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

const CARDS_PER_SPREAD = 32;

const CardBinder: React.FC<CardBinderProps> = ({
  cards,
  currentPage,
  totalPages,
  goToNextPage,
  goToPreviousPage,
  goToPage,
  isLoading,
  isExploreView = false, // Default to false
}) => {
  // Get collection check function and collections array from context
  const {
    collections,
    isCardInCollection,
    addCardToCollection,
    removeCardFromCollection,
    getCardQuantity
  } = useCollections();
  const { session } = useAuth(); // Get session to check if user is logged in

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleCardClick = (cardId: string) => {
    setSelectedCardId(cardId);
  };
  const handleCloseModal = () => {
    setSelectedCardId(null);
  };

  const currentPageIndex = currentPage - 1;
  const startIndex = currentPageIndex * CARDS_PER_SPREAD;

  const currentSpreadCards = cards;

  const leftPageCards = currentSpreadCards.slice(0, 16);
  const rightPageCards = currentSpreadCards.slice(16, 16 + 16);

  // Simpler helper function to generate pagination numbers
  const getPaginationItems = (currentPage: number, totalPages: number) => {
    const items: (number | string)[] = [];
    const delta = 1; // How many pages to show around the current page

    // Always add the first page
    items.push(1);

    // Add leading ellipsis if needed
    if (currentPage > delta + 2) {
      items.push('...');
    }

    // Add pages around the current page
    const start = Math.max(2, currentPage - delta);
    const end = Math.min(totalPages - 1, currentPage + delta);

    for (let i = start; i <= end; i++) {
        items.push(i);
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

  const renderPage = (pageCards: PokemonCard[], side: 'Left' | 'Right') => {
    // Define CARDS_PER_SPREAD constant
    const CARDS_PER_SPREAD = 32; // 16 cards on left page + 16 cards on right page

    // Start index for the current spread (two pages)
    const startIndex = (currentPage - 1) * CARDS_PER_SPREAD;

    // Default to 'Default' group if needed
    const defaultGroup = 'Default';

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
                const card = pageCards[index];
                const overallCardIndex = startIndex + cardIndexOnPage; // For display number

                // Only apply colored borders if user is logged in and card exists
                const isInHaveCollection = card && session && isCardInCollection(card.id, 'have', defaultGroup);
                const isInWantCollection = card && session && isCardInCollection(card.id, 'want', defaultGroup);

                // Determine border style: Want (Purple) > Owned (Green) > Default (Gray)
                const borderStyle = card
                    ? (session && isInWantCollection) ? 'border-purple-500 border-2'
                    : (session && isInHaveCollection) ? 'border-green-400 border-2'
                    : 'border-gray-300'
                    : 'border-gray-300';

                const marketPrice = card ? getMarketPrice(card.tcgplayer?.prices) : null;
                const currentQuantity = card && session && isInHaveCollection ? getCardQuantity(card.id, 'have', defaultGroup) : 0;

                return (
                    <div
                        key={card ? card.id : `empty-${overallCardIndex}`}
                        className={`flex flex-col bg-gray-100 rounded border relative group cursor-pointer transition-shadow duration-150 hover:shadow-lg ${borderStyle}`}
                        onClick={() => card && handleCardClick(card.id)}
                        // Remove onContextMenu if it exists (though it doesn't seem to)
                    >
                         {/* Card Number Overlay - use overall index */}
                         <div className={`absolute top-0.5 left-0.5 text-[10px] font-bold px-1 rounded-sm ${card ? 'bg-black/60 text-white' : 'bg-gray-300 text-gray-600'}`}>
                            {String(overallCardIndex + 1).padStart(3, '0')}
                         </div>

                        {card ? (
                            <>
                                <div className={`flex-grow w-full aspect-[5/7] relative transition-opacity duration-200 ${isInHaveCollection ? 'opacity-70' : 'opacity-100'}`}>
                                    <Image
                                        src={getProxiedImageUrl(card.images.small)}
                                        alt={card.name}
                                        fill
                                        sizes="(max-width: 768px) 15vw, 10vw"
                                        className="object-contain"
                                        priority={index < 8}
                                        unoptimized={!card.images.small}
                                    />
                                </div>
                                <div className="flex-shrink-0 p-1 h-[58px] text-center bg-gray-200 w-full border-t border-gray-300">
                                     <p className="text-[10px] font-medium text-gray-900 truncate leading-tight" title={card.name}>{card.name}</p>
                                     <p className="text-[9px] text-gray-600 leading-tight">{card.rarity || 'N/A'}</p>
                                     
                                     {/* Use getBestAvailablePrice for better pricing fallback */}
                                     {(() => {
                                         const bestPrice = card ? getBestAvailablePrice(card.tcgplayer?.prices) : null;
                                         const isMarketPrice = card && getMarketPrice(card.tcgplayer?.prices) === bestPrice;
                                         
                                         return (
                                             <div className={`mt-0.5 py-0.5 px-1 rounded ${bestPrice ? 'bg-gray-800' : 'bg-gray-500'}`}>
                                                 <p className={`text-[10px] font-bold leading-tight ${bestPrice ? 'text-yellow-300' : 'text-white'}`}>
                                                     {bestPrice ? formatPrice(bestPrice) : 'No Price'}
                                                 </p>
                                             </div>
                                         );
                                     })()}
                                     
                                     <p className="text-[8px] text-gray-600 leading-none mt-0.5">Market Price</p>
                                </div>

                                {/* --- ADD QUANTITY CONTROLS START --- */}
                                {session && isInHaveCollection && !isExploreView && (
                                    <div
                                        // Stop propagation so clicking controls doesn't open modal
                                        onClick={(e) => e.stopPropagation()}
                                        // Position at bottom, show on group hover
                                        className="absolute bottom-0 left-0 right-0 h-7 bg-black/80 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-b"
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeCardFromCollection(card.id, 'have', defaultGroup);
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addCardToCollection(card.id, card, 'have', defaultGroup);
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
                            <div className="flex-1 flex items-center justify-center aspect-[5/7] bg-gray-200 rounded">
                                <span className="text-xs text-gray-400">Empty</span>
                            </div>
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
             <button
                 onClick={goToPreviousPage}
                 disabled={currentPage === 1 || isLoading}
                 className="px-4 py-2 rounded text-xs font-semibold transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                 aria-label="Previous Page"
             >
                 &lt; Prev
             </button>
             {/* Page Number Buttons */}
             {paginationItems.map((item, index) => (
                 typeof item === 'number' ? (
                     <button
                         key={`page-${item}`}
                         onClick={() => goToPage(item)}
                         disabled={item === currentPage || isLoading}
                         className={`px-4 py-2 rounded text-xs font-semibold transition-colors min-w-[36px] ${ // Ensure minimum tap area
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
             
             {/* Direct Page Navigation */}
             <div className="flex items-center gap-1">
                <span className="text-xs font-medium">Go to:</span>
                <input 
                    type="number" 
                    min="1" 
                    max={totalPages} 
                    className="w-14 h-8 px-2 py-1 text-xs border border-gray-300 rounded-md text-center"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            const pageNum = parseInt((e.target as HTMLInputElement).value);
                            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                                goToPage(pageNum);
                            } else {
                                alert(`Please enter a page number between 1 and ${totalPages}`);
                            }
                        }
                    }}
                    disabled={isLoading}
                />
                <button
                    onClick={(e) => {
                        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                        const pageNum = parseInt(input.value);
                        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                            goToPage(pageNum);
                        } else {
                            alert(`Please enter a page number between 1 and ${totalPages}`);
                        }
                    }}
                    disabled={isLoading}
                    className="px-2 py-1 h-8 rounded text-xs font-semibold transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Go
                </button>
             </div>
             
             <button
                 onClick={goToNextPage}
                 disabled={currentPage >= totalPages || isLoading}
                 className="px-4 py-2 rounded text-xs font-semibold transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                 aria-label="Next Page"
             >
                 Next &gt;
             </button>
         </div>

         {/* Only show this message if user is logged in */}
         {session && <p className="text-xs text-gray-500 mt-2">Green border indicates cards you own. Purple border indicates cards you want. Click any slot for details.</p>}
         {!session && <p className="text-xs text-gray-500 mt-2">Sign in to track your collection. Click any card for details.</p>}

         <CardDetailModal cardId={selectedCardId} onClose={handleCloseModal} />
    </div>
  );
} // Close CardBinder component function body

export default CardBinder; 