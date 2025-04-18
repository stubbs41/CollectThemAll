'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useCollections } from '@/context/CollectionContext';
import { PokemonCard } from '@/lib/types';
import { fetchCardDetails } from '@/lib/pokemonApi'; // Assuming this fetches a single card

const CollectionDetailPage: React.FC = () => {
    const params = useParams();
    const collectionId = params.collectionId as string; // Get ID from URL query

    const { collections } = useCollections();
    const [collectionName, setCollectionName] = useState<string>('');
    const [cards, setCards] = useState<PokemonCard[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Wait for context/collections to load
        if (!collectionId || collections.length === 0) {
            // Keep loading until collections are available
            // Or handle the case where collectionId is invalid early?
             setLoading(true); // Ensure loading is true while waiting
            return;
        }

        const collection = collections.find(c => c.id === collectionId);

        if (!collection) {
            setError('Collection not found.');
            setLoading(false);
            return;
        }

        setCollectionName(collection.name);
        const cardIds = Array.from(collection.cards);

        if (cardIds.length === 0) {
            setCards([]); // No cards in this collection
            setLoading(false);
            return;
        }

        const fetchAllCards = async () => {
            setLoading(true);
            setError(null);
            console.log(`Fetching ${cardIds.length} cards for collection ${collectionId}...`, cardIds); // Debug log

            try {
                // Fetch details for each card ID
                // Note: This can be slow for large collections!
                const cardPromises = cardIds.map(id =>
                    fetchCardDetails(id).catch(err => {
                        console.error(`Failed fetching card ID ${id}:`, err);
                        return null; // Return null on error for specific card
                    })
                );
                const results = await Promise.all(cardPromises);

                // Filter out null results (failed fetches)
                const fetchedCards: PokemonCard[] = results.filter(card => card !== null) as PokemonCard[];
                console.log('Fetched cards:', fetchedCards); // Debug log

                if(fetchedCards.length !== cardIds.length) {
                    console.warn("Some cards failed to load.");
                    // Optionally set a non-blocking error/warning message
                }

                setCards(fetchedCards);
            } catch (err) {
                // Catch potential errors in Promise.all or other parts
                console.error("Error fetching cards for collection:", err);
                setError('Failed to load card details.');
            } finally {
                setLoading(false);
            }
        };

        fetchAllCards();

    }, [collectionId, collections]); // Rerun effect if collectionId or collections array changes

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <Link href="/collections" className="text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center group">
                    <svg className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    Back to Collections
                </Link>
                <h1 className="text-3xl font-bold text-gray-800 mt-2 break-words">
                    Collection: {collectionName || (loading ? 'Loading...' : 'Unknown')}
                </h1>
            </div>

            {loading && (
                <div className="text-center py-10">
                    <p className="text-gray-500 animate-pulse">Loading cards...</p>
                    {/* You could add a spinner here */}
                </div>
            )}

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
                    {error}
                </div>
            )}

            {!loading && !error && cards.length === 0 && collectionName && (
                 <div className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
                    <p className="text-gray-500 italic">This collection is empty.</p>
                    <p className="mt-2 text-sm">Go back to the <Link href="/" className='text-indigo-600 hover:underline'>Card Binder</Link> to add some!</p>
                 </div>
            )}

            {!loading && !error && cards.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {cards.map(card => (
                        <div
                            key={card.id}
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow hover:shadow-md transition-shadow duration-150 flex flex-col group relative"
                            title={`${card.name} - ${card.set.name}`}
                        >
                             {/* Simple card display - Just the image */}
                            <div className="aspect-[5/7] w-full relative bg-gray-100">
                                <Image
                                    src={card.images.small}
                                    alt={card.name}
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                                    className="object-contain transition-transform duration-200 group-hover:scale-105"
                                />
                                {/* Optional: Add an overlay or link to view details */}
                            </div>
                            {/* Minimal info below image */}
                             <div className="p-2 text-center bg-gray-50 border-t border-gray-200">
                                 <p className="text-xs font-medium truncate text-gray-700" title={card.name}>{card.name}</p>
                                 <p className="text-xs text-gray-500 truncate" title={card.set.name}>{card.set.name}</p>
                             </div>
                        </div>
                    ))}\
                </div>
            )}
        </div>
    );
};

export default CollectionDetailPage;
