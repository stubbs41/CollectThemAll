'use client';

import React, { useEffect, useState, useRef } from 'react';
import { PokemonCard } from '@/lib/types';
import { fetchCardDetails } from '@/lib/pokemonApi';
import Image from 'next/image';
import { getProxiedImageUrl } from '@/lib/utils';
import { applyPriceToCard } from '@/lib/priceCache';
import { useAuth } from '@/context/AuthContext';
import { useCollections } from '@/context/CollectionContext';
import CollectionSelector from './card/CollectionSelector';
import CardPricing from './card/CardPricing';

interface SimpleCardDetailModalProps {
  cardId: string | null;
  onClose: () => void;
}

const SimpleCardDetailModal: React.FC<SimpleCardDetailModalProps> = ({ cardId, onClose }) => {
  const [card, setCard] = useState<PokemonCard | null>(null);
  const [prints, setPrints] = useState<PokemonCard[]>([]);
  const [selectedPrintId, setSelectedPrintId] = useState<string | null>(null);
  const [loading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [addingToHave, setAddingToHave] = useState<boolean>(false);
  const [addingToWant, setAddingToWant] = useState<boolean>(false);
  const [addSuccess, setAddSuccess] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('Default');

  // Get auth and collection context
  const { session } = useAuth();
  const { addCardToCollection, refreshCollections, activeGroup } = useCollections();

  // Initialize selected group with active group
  useEffect(() => {
    setSelectedGroup(activeGroup);
  }, [activeGroup]);

  const modalRef = useRef<HTMLDivElement>(null);

  // Initialize selectedPrintId when cardId changes
  useEffect(() => {
    if (!cardId) {
      setCard(null);
      setPrints([]);
      setSelectedPrintId(null);
      return;
    }

    // Initialize with cardId when first opening the modal
    setSelectedPrintId(cardId);
  }, [cardId]);

  // Load card data when selectedPrintId changes
  useEffect(() => {
    if (!selectedPrintId) return;

    let isMounted = true;
    const loadCardData = async () => {
      setIsLoading(true);
      setError(null);

      // Don't clear card data immediately to avoid flickering
      // Only clear if we don't have a card yet
      if (!card) {
        setCard(null);
        setPrints([]);
      }

      try {
        // Fetch card details for the currently selected print
        // Only force refresh pricing if this is the initial load
        console.log(`Loading card data for ID: ${selectedPrintId}`);
        const fetchedInitialDetails = await fetchCardDetails(selectedPrintId, !card);

        if (!fetchedInitialDetails) {
          throw new Error(`Card details not found for ID: ${selectedPrintId}`);
        }

        if (!isMounted) return;

        // Apply cached prices and set the card data
        const cardWithPrices = applyPriceToCard(fetchedInitialDetails);
        setCard(cardWithPrices);

        // If we already have prints and we're just switching between them,
        // don't refetch the prints list
        if (prints.length > 0 && prints.some(p => p.name === fetchedInitialDetails.name)) {
          setIsLoading(false);
          return;
        }

        // Fetch prints if we have a card name
        let fetchedPrints: PokemonCard[] = [];
        if (fetchedInitialDetails.name) {
          try {
            const pokemonName = encodeURIComponent(fetchedInitialDetails.name);
            console.log(`[SimpleCardDetailModal] Fetching prints for name: '${fetchedInitialDetails.name}', encoded as: '${pokemonName}'`);

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

        // Safely combine prints and apply cached prices
        try {
          // Apply cached prices to all prints
          const printsWithPrices = fetchedPrints.map(print => applyPriceToCard(print));

          const combinedPrints = [...printsWithPrices];
          // Only add the current card if it's not already in the prints array
          if (fetchedPrints.length === 0 || !combinedPrints.some(p => p.id === cardWithPrices.id)) {
            combinedPrints.unshift(cardWithPrices);
          }
          setPrints(combinedPrints);
        } catch (combineError) {
          console.error('Error combining prints:', combineError);
          // At minimum, show the current card
          setPrints([cardWithPrices]);
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
  }, [selectedPrintId]);

  // Safely find the selected print or fall back to the main card
  const displayedCard = prints.find(p => p && p.id === selectedPrintId) || card;

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
          type="button"
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
              <div className="relative w-full aspect-[5/7]">
                <Image
                  src={getProxiedImageUrl(displayedCard.images?.large || displayedCard.images?.small || '/images/card-placeholder.png')}
                  alt={displayedCard.name || 'Pokemon Card'}
                  fill
                  sizes="(max-width: 768px) 100vw, 300px"
                  className="object-contain"
                  priority
                />
              </div>
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
                <h3 className="text-lg font-semibold">Other Prints</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {prints.length > 0 ? (
                    prints.map(print => (
                      <button
                        type="button"
                        key={print.id}
                        onClick={() => {
                          console.log(`Selecting print: ${print.id}`);
                          // Just update the selectedPrintId - the useEffect will handle the rest
                          setSelectedPrintId(print.id);
                        }}
                        className={`px-2 py-1 text-sm rounded border ${selectedPrintId === print.id ? 'bg-blue-100 border-blue-500' : 'bg-gray-100 border-gray-300'}`}
                      >
                        {print.set?.name || 'Unknown Set'}
                      </button>
                    ))
                  ) : (
                    <p className="text-gray-500">No other prints available</p>
                  )}
                </div>
              </div>

              {/* Collection actions */}
              <div className="border-t border-gray-200 pt-4 mt-2">
                <h3 className="text-lg font-semibold">Collection Actions</h3>
                {!session ? (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-amber-700 text-sm">Please sign in to add cards to your collection or wishlist.</p>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    >
                      Close to Sign In
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    {/* Collection Selector */}
                    <div className="mb-4">
                      <CollectionSelector
                        onSelect={setSelectedGroup}
                        selectedGroup={selectedGroup}
                        label="Add to Collection Group"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={addingToHave || addingToWant}
                        onClick={async () => {
                          if (!displayedCard) return;

                          setAddingToHave(true);
                          try {
                            // Use the context function to add to collection
                            const result = await addCardToCollection(
                              displayedCard.id,
                              displayedCard,
                              'have',
                              selectedGroup
                            );

                            if (result.status === 'added' || result.status === 'updated') {
                              setAddSuccess(true);
                              setTimeout(() => setAddSuccess(false), 3000);
                              // Refresh collections to update UI
                              await refreshCollections();
                            } else if (result.status === 'error') {
                              alert(`Error: ${result.message || 'Failed to add card to collection'}`);
                            }
                          } catch (error) {
                            console.error('Error adding to collection:', error);
                            alert('Failed to add card to collection. Please try again.');
                          } finally {
                            setAddingToHave(false);
                          }
                        }}
                      >
                        {addingToHave ? 'Adding...' : 'Add to Collection'}
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={addingToHave || addingToWant}
                        onClick={async () => {
                          if (!displayedCard) return;

                          setAddingToWant(true);
                          try {
                            // Use the context function to add to wishlist
                            const result = await addCardToCollection(
                              displayedCard.id,
                              displayedCard,
                              'want',
                              selectedGroup
                            );

                            if (result.status === 'added' || result.status === 'updated') {
                              setAddSuccess(true);
                              setTimeout(() => setAddSuccess(false), 3000);
                              // Refresh collections to update UI
                              await refreshCollections();
                            } else if (result.status === 'error') {
                              alert(`Error: ${result.message || 'Failed to add card to wishlist'}`);
                            }
                          } catch (error) {
                            console.error('Error adding to wishlist:', error);
                            alert('Failed to add card to wishlist. Please try again.');
                          } finally {
                            setAddingToWant(false);
                          }
                        }}
                      >
                        {addingToWant ? 'Adding...' : 'Add to Wishlist'}
                      </button>
                    </div>

                    {addSuccess && (
                      <div className="mt-3 text-center">
                        <p className="text-sm text-green-600 font-medium">
                          Card added successfully to {selectedGroup}!
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleCardDetailModal;
