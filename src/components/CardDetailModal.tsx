'use client';

import React, { useEffect, useState, useRef } from 'react';
import { PokemonCard } from '@/lib/types';
import { fetchCardDetails } from '@/lib/pokemonApi';

// Import our new components
import CardImage from './card/CardImage';
import CardPricing from './card/CardPricing';
import CardPrintSelector from './card/CardPrintSelector';
import CardCollectionActions from './card/CardCollectionActions';

interface CardDetailModalProps {
  cardId: string | null;
  onClose: () => void;
}

const CardDetailModal: React.FC<CardDetailModalProps> = ({ cardId, onClose }) => {
  const [card, setCard] = useState<PokemonCard | null>(null);
  const [prints, setPrints] = useState<PokemonCard[]>([]);
  const [selectedPrintId, setSelectedPrintId] = useState<string | null>(null);
  const [loading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Load card data when cardId changes
  useEffect(() => {
    if (!cardId) {
      setCard(null);
      setPrints([]);
      setSelectedPrintId(null);
      return;
    }

    let isMounted = true;
    const loadCardData = async () => {
      setIsLoading(true);
      setError(null);
      setCard(null);
      setPrints([]);
      setSelectedPrintId(cardId);

      try {
        // Fetch card details
        console.log(`Card ID changed from ${selectedPrintId} to ${cardId}`);
        const fetchedInitialDetails = await fetchCardDetails(cardId);

        if (!fetchedInitialDetails) {
          throw new Error(`Card details not found for ID: ${cardId}`);
        }

        if (!isMounted) return;

        // Safely set the card data
        setCard(fetchedInitialDetails);

        // Fetch prints if we have a card name
        let fetchedPrints: PokemonCard[] = [];
        if (fetchedInitialDetails.name) {
          try {
            const pokemonName = encodeURIComponent(fetchedInitialDetails.name);
            console.log(`[CardDetailModal] Fetching prints for name: '${fetchedInitialDetails.name}', encoded as: '${pokemonName}'`);

            const printsResponse = await fetch(`/api/pokemon/${pokemonName}/prints`);
            if (printsResponse.ok) {
              const printsData = await printsResponse.json();
              // Ensure we have an array of prints
              if (Array.isArray(printsData.prints)) {
                fetchedPrints = printsData.prints;
              } else {
                console.warn('Prints data is not an array:', printsData);
                fetchedPrints = [];
              }
            } else {
              console.warn(`Failed to fetch prints (${printsResponse.status}): ${printsResponse.statusText}`);
            }
          } catch (printError) {
            console.error('Error fetching prints:', printError);
            // Continue with empty prints array rather than failing completely
          }
        }

        if (!isMounted) return;

        // Safely combine prints
        try {
          const combinedPrints = [...fetchedPrints];
          // Only add the current card if it's not already in the prints array
          if (fetchedPrints.length === 0 || !combinedPrints.some(p => p.id === fetchedInitialDetails.id)) {
            combinedPrints.unshift(fetchedInitialDetails);
          }
          setPrints(combinedPrints);
        } catch (combineError) {
          console.error('Error combining prints:', combineError);
          // At minimum, show the current card
          setPrints([fetchedInitialDetails]);
        }

      } catch (err) {
        console.error("Error loading card data:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCardData();
    return () => { isMounted = false; };
  }, [cardId, selectedPrintId]);

  // Safely find the selected print or fall back to the main card
  const displayedCard = prints.find(p => p && p.id === selectedPrintId) || card;

  const handleSelectPrint = (printId: string) => {
    if (printId) setSelectedPrintId(printId);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!cardId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl px-8 py-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative text-gray-900" ref={modalRef}>
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-400 hover:text-gray-600 text-3xl font-light"
          aria-label="Close modal"
        >
          &times;
        </button>

        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex justify-center items-center z-20">
            <p className="text-gray-600">Loading details...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex justify-center items-center z-20">
            <p className="text-red-600 p-10 text-center">Error: {error}</p>
          </div>
        )}

        {displayedCard && !loading && !error && (
          <div className="flex flex-col md:flex-row gap-8">
            {/* Left column - Card image */}
            <div className="md:w-[300px] flex-shrink-0">
              <CardImage
                imageUrl={
                  displayedCard.images?.large ||
                  displayedCard.images?.small ||
                  '/images/card-placeholder.png'
                }
                altText={displayedCard.name || 'Pokemon Card'}
              />
            </div>

            {/* Right column - Card details */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Card header */}
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-0.5">
                  {displayedCard.name || 'Unknown Card'}
                </h2>
                <p className="text-sm text-gray-500">
                  {displayedCard.set?.name || 'Unknown Set'} •
                  {displayedCard.number || '?'} / ? •
                  {displayedCard.rarity || 'N/A'}
                </p>
              </div>

              {/* Pricing section */}
              <div className="border-t border-gray-200 pt-4">
                <CardPricing prices={displayedCard.tcgplayer?.prices} />
              </div>

              {/* Print selector */}
              <div className="border-t border-gray-200 pt-4">
                <CardPrintSelector
                  prints={prints}
                  selectedPrintId={selectedPrintId}
                  onSelectPrint={handleSelectPrint}
                  isLoading={loading}
                />
              </div>

              {/* Collection actions */}
              <div className="border-t border-gray-200 pt-4 mt-2">
                <CardCollectionActions
                  card={displayedCard}
                  onClose={onClose}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardDetailModal;