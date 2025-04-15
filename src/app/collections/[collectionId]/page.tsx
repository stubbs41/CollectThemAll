'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useCollections } from '@/context/CollectionContext';
import { PokemonCard } from '@/lib/types';
import { fetchCardDetails } from '@/lib/pokemonApi';
import { getProxiedImageUrl } from '@/lib/utils';

const CollectionDetailPage: React.FC = () => {
    const params = useParams();
    const collectionId = params.collectionId as string;

    const { collections } = useCollections(); // Remove isLoaded from destructuring
    const [collectionName, setCollectionName] = useState<string>('');
    const [cards, setCards] = useState<PokemonCard[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Context is guaranteed to be loaded here because the provider delays rendering
        if (!collectionId) {
            setError("Collection ID not found in URL.");
            setLoading(false);
            return;
        }

        const targetCollection = collections.find(col => col.id === collectionId);

        if (!targetCollection) {
            setError(`Collection with ID "${collectionId}" not found.`);
            setCollectionName('');
            setCards([]);
            setLoading(false);
            return;
        }

        setCollectionName(targetCollection.name);
        const cardIds = Array.from(targetCollection.cards);

        if (cardIds.length === 0) {
            setCards([]);
            setLoading(false);
            setError(null);
            return;
        }

        const fetchAllCards = async () => {
            // Start loading state specific to fetching cards for this page
            setLoading(true);
            setError(null);
            console.log(`Fetching ${cardIds.length} cards for collection "${targetCollection.name}" (${collectionId})...`, cardIds);

            try {
                const cardPromises = cardIds.map(id =>
                    fetchCardDetails(id).catch(err => {
                        console.error(`Failed fetching card ID ${id}:`, err);
                        return null;
                    })
                );
                const results = await Promise.all(cardPromises);
                const fetchedCards: PokemonCard[] = results.filter(card => card !== null) as PokemonCard[];
                console.log('Fetched cards:', fetchedCards);

                if (fetchedCards.length !== cardIds.length) {
                    console.warn("Some cards failed to load.");
                }

                setCards(fetchedCards);
            } catch (err) {
                console.error("Error fetching cards for collection:", err);
                setError('Failed to load card details.');
                setCards([]);
            } finally {
                setLoading(false); // Stop loading once fetching is done or failed
            }
        };

        fetchAllCards();

    }, [collectionId, collections]); // Remove isLoaded dependency

    // --- Render Logic ---
    // Simplified initial loading check
    if (loading && cards.length === 0) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <p className="text-lg text-gray-500">Loading collection details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <p className="text-lg text-red-600">Error: {error}</p>
                <Link href="/collections" className="text-blue-500 hover:underline mt-4 inline-block">
                    Back to Collections
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <Link href="/collections" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Back to Collections
            </Link>
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Collection: {collectionName}</h1>

            {/* Optional: Show loading indicator if fetching additional details after initial render */}
            {loading && cards.length > 0 && (
                 <p className="text-center text-gray-500 mb-4">Loading card details...</p>
            )}

            {cards.length === 0 && !loading && (
                <p className="text-center text-gray-500">This collection is empty.</p>
            )}

            {cards.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {cards.map(card => (
                        <div key={card.id} className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                            <div className="aspect-[5/7] relative w-full">
                                <Image
                                    src={getProxiedImageUrl(card.images.small)}
                                    alt={card.name}
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                                    className="object-contain"
                                    unoptimized={!card.images.small}
                                    priority={false}
                                />
                            </div>
                             <div className="p-2 text-center bg-gray-50 border-t border-gray-200">
                                 <p className="text-xs font-medium truncate text-gray-700" title={card.name}>{card.name}</p>
                                 <p className="text-xs text-gray-500 truncate" title={card.set.name}>{card.set.name}</p>
                             </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CollectionDetailPage; 