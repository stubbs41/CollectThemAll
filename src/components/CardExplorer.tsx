'use client'; // Make this a Client Component

import React, { useState, useEffect, useCallback } from 'react'; // Import hooks
import CardBinder from "@/components/CardBinder";
import { PokemonCard } from "@/lib/types";
import FilterPanel from './explore/FilterPanel';
import { applyPricesToCards } from '@/lib/priceCache';
// Import the enhanced search functionality
import { initializeSearchIndexes, searchCardsByName } from '@/lib/enhancedSearch';

const CARDS_PER_PAGE = 32; // Define cards per page (should match binder spread)

// --- Define Filter State Types (Example) ---
type FilterState = {
  set?: string;
  rarity?: string;
  type?: string;
  supertype?: string; // Added supertype
  // Add more filters as needed
};

// --- Define Filter Options Type ---
interface FilterOptions {
  sets: string[];
  rarities: string[];
  types: string[];
  supertypes: string[];
}

export default function CardExplorer() { // Changed from HomePage to CardExplorer
  // --- State for cards DISPLAYED after potential client-side filtering ---
  const [displayedCards, setDisplayedCards] = useState<PokemonCard[]>([]);
  // --- State for cards fetched directly from API (used for client-side filtering) ---
  const [fetchedCards, setFetchedCards] = useState<PokemonCard[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1); // State for current page number (1-based)
  const [totalPages, setTotalPages] = useState(1); // State for total pages
  const [emptyPageMessage, setEmptyPageMessage] = useState<string | null>(null); // Message when a page has no cards

  // Search related state
  const [searchQuery, setSearchQuery] = useState(""); // What the user types in the search box
  const [activeSearchTerm, setActiveSearchTerm] = useState(""); // The actual term being searched
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // --- Filter State ---
  const [filters, setFilters] = useState<FilterState>({});
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  // State to hold available filter options (fetched later)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
      sets: [],
      rarities: [],
      types: [],
      supertypes: []
  });
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  // --- Fetch Filter Options and Initialize from URL Parameters ---
  useEffect(() => {
    async function fetchFilterOptions() {
      setIsLoadingFilters(true);
      try {
        const response = await fetch('/api/cards-meta');
        if (!response.ok) {
          throw new Error('Failed to fetch filter options');
        }
        const data = await response.json();
        setFilterOptions({
            sets: data.sets || [],
            rarities: data.rarities || [],
            types: data.types || [],
            supertypes: data.supertypes || []
        });
      } catch (err) {
        console.error("Failed to load filter options:", err);
        // Optionally set an error state for filter options
      } finally {
        setIsLoadingFilters(false);
      }
    }
    fetchFilterOptions();

    // Check URL parameters for search query and page number
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const searchParam = url.searchParams.get('q'); // Use 'q' parameter to match the API
      const pageParam = url.searchParams.get('page');

      // Set search query if present in URL
      if (searchParam) {
        setSearchQuery(searchParam);
        setActiveSearchTerm(searchParam);
        setSearchPerformed(true);
      }

      // Set page number if present in URL
      if (pageParam) {
        const pageNumber = parseInt(pageParam, 10);
        if (!isNaN(pageNumber) && pageNumber > 0) {
          setCurrentPage(pageNumber);
        }
      }

      // Set filters if present in URL
      const newFilters: FilterState = {};
      if (url.searchParams.get('set')) newFilters.set = url.searchParams.get('set') || undefined;
      if (url.searchParams.get('rarity')) newFilters.rarity = url.searchParams.get('rarity') || undefined;
      if (url.searchParams.get('type')) newFilters.type = url.searchParams.get('type') || undefined;
      if (url.searchParams.get('supertype')) newFilters.supertype = url.searchParams.get('supertype') || undefined;

      // Only update filters if there are any
      if (Object.values(newFilters).some(v => v)) {
        setFilters(newFilters);
      }
    }
  }, []); // Fetch once on mount

  // Initialize search indexes when component mounts
  useEffect(() => {
    // Initialize the enhanced search indexes
    initializeSearchIndexes()
      .then(() => {
        console.log("Enhanced search indexes initialized successfully");
      })
      .catch(error => {
        console.error("Failed to initialize search indexes:", error);
        // We'll fall back to API-based search when searching, so no need to show an error
      });
  }, [currentPage]);

  // --- Function to update filters ---
  const updateFilters = (newFilters: Partial<FilterState>) => {
    console.log("Updating filters:", newFilters); // Log filter update
    setFilters(prev => ({ ...prev, ...newFilters }));
    if (currentPage !== 1) {
        setCurrentPage(1); // Reset page when filters change
    } else {
        // If already on page 1, state update might not trigger main useEffect if other deps are same.
        // Need to trigger based on filters object change. Main useEffect should handle this.
    }
    // Fetching is handled by the main useEffect reacting to 'filters'
  };

  // --- Function to clear all filters ---
  const clearFilters = () => {
      console.log("Clearing all filters"); // Log filter clear
      setFilters({});
      if (currentPage !== 1) {
          setCurrentPage(1);
      } else {
          // If already on page 1, state update might not trigger main useEffect if other deps are same.
           // Need to trigger based on filters object change. Main useEffect should handle this.
      }
      // Fetching handled by main useEffect reacting to 'filters'
  };

  // Function to fetch data for a specific page (FILTER ONLY)
  const fetchDataForPage = useCallback(async (pageToFetch: number, currentFilters: FilterState) => {
    // -- Include filters in API call --
    const filterParams = new URLSearchParams();
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value) {
        filterParams.append(key, value);
      }
    });
    const filterQueryString = filterParams.toString();
    const apiUrl = `/api/cards-paged?page=${pageToFetch}&limit=${CARDS_PER_PAGE}${filterQueryString ? '&' + filterQueryString : ''}`;

    // Update the URL with the page number without causing a full page refresh
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      // Don't clear search parameter if we're not searching
      // url.searchParams.delete('search');
      url.searchParams.set('page', pageToFetch.toString());
      // Add filter parameters to the URL
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        } else {
          url.searchParams.delete(key);
        }
      });
      window.history.replaceState({}, '', url.toString());
    }

    console.log(`CardExplorer: Fetching ${apiUrl}`);
    setIsLoading(true);
    setError(null);
    setEmptyPageMessage(null); // Clear any previous empty page message

    // Use AbortController for cleanup
    const controller = new AbortController();
    const signal = controller.signal;

    fetch(apiUrl, { signal })
      .then(res => {
        if (!res.ok) {
          if (signal.aborted) {
            console.log("CardExplorer: Fetch aborted for page", pageToFetch);
            return;
          }
          throw new Error(`Failed to fetch cards page ${pageToFetch}: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data: { cards: PokemonCard[], totalCount: number, totalPages: number, isEmptyPage: boolean, message?: string, redirected?: boolean, requestedPage?: number } | undefined) => {
        if (data) {
          console.log(`CardExplorer: Received ${data.cards.length} cards for page ${pageToFetch} (Filtered).`);

          // Set empty page message if applicable
          if (data.isEmptyPage && data.message) {
            setEmptyPageMessage(data.message);
          } else if (data.cards.length === 0) {
            setEmptyPageMessage(`No cards found for page ${pageToFetch}.`);
          } else if (data.redirected && data.message) {
            // Handle page redirection message
            setEmptyPageMessage(data.message);
            // Update current page to match what was actually fetched
            if (pageToFetch !== currentPage) {
              setCurrentPage(pageToFetch);
            }
          }

          // Apply cached prices to the fetched cards
          // Ensure the result is typed as PokemonCard[]
          const cardsWithPrices = applyPricesToCards(data.cards as PokemonCard[]);

          // Set fetched cards with prices applied
          setFetchedCards(cardsWithPrices as PokemonCard[]);
          setTotalPages(data.totalPages || Math.ceil(data.totalCount / CARDS_PER_PAGE));
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          console.log("CardExplorer: Fetch aborted for page", pageToFetch);
        } else {
          console.error(`CardExplorer: Error fetching page ${pageToFetch}:`, err);
          setError(err.message || 'Failed to load card data.');
          setDisplayedCards([]);
        }
      })
      .finally(() => {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      console.log("CardExplorer: Aborting fetch for page", pageToFetch);
      controller.abort();
    };
  }, [currentPage]);

  // Function to search for cards (SEARCH TERM ONLY)
  const searchCards = useCallback(async (query: string, pageToFetch: number /* Remove currentFilters here */) => {
    // -- Remove filter query construction from here --
    // const filterParams = new URLSearchParams(); ... etc ...
    // const filterQueryString = filterParams.toString();

    // Check if this is a specific Pokémon name search (like "Audino")
    const isSpecificPokemonSearch = query.trim().length > 2 && !query.includes(' ') && !query.includes('*');

    // Add a flag for specific Pokémon searches to use our direct search approach
    const apiUrl = `/api/cards-search?q=${encodeURIComponent(query)}&page=${pageToFetch}&limit=${CARDS_PER_PAGE}${isSpecificPokemonSearch ? '&directSearch=true' : ''}`;
    // -- Only search by name --

    // Update the URL with the search query and page number without causing a full page refresh
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('q', query); // Use 'q' parameter to match the API
      url.searchParams.set('page', pageToFetch.toString());
      window.history.replaceState({}, '', url.toString());
    }

    if (!query.trim()) {
      // If query is empty, revert to normal page view (fetchDataForPage will be called by useEffect)
      setSearchPerformed(false);
      // No need to call fetchDataForPage directly here, let useEffect handle it based on searchPerformed=false
      return;
    }

    console.log(`CardExplorer: Searching ${apiUrl} ${isSpecificPokemonSearch ? '(Direct Pokémon search)' : '(Name only)'}`);
    setIsLoading(true);
    setError(null);
    setEmptyPageMessage(null); // Clear any previous empty page message
    setIsSearching(true);
    setFetchedCards([]); // Clear previous results to avoid pagination issues
    setDisplayedCards([]); // Clear displayed cards
    setTotalPages(1); // Reset total pages to avoid pagination issues

    // Use AbortController for cleanup
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      // For specific Pokémon searches, use cache: 'no-store' to ensure fresh results
      const fetchOptions = {
        signal,
        cache: isSpecificPokemonSearch ? 'no-store' as RequestCache : 'default' as RequestCache
      };

      const response = await fetch(apiUrl, fetchOptions);

      if (!response.ok) {
        if (signal.aborted) {
          console.log("CardExplorer: Search aborted for query", query);
          return;
        }
        throw new Error(`Failed to search cards: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`CardExplorer: Search received ${data.cards.length} cards for "${query}"`);

      if (!signal.aborted) {
        // Set empty page message if applicable
        if (data.isEmptyPage && data.message) {
          setEmptyPageMessage(data.message);
        } else if (data.cards.length === 0) {
          if (isSpecificPokemonSearch) {
            // For specific Pokémon searches, provide a more helpful message
            setEmptyPageMessage(`No cards found for "${query}". This Pokémon might not be available in the database.`);
          } else {
            setEmptyPageMessage(`No cards found matching "${query}" on page ${pageToFetch}.`);
          }
          // Reset pagination when no results are found
          setTotalPages(1);
        } else if (data.redirected && data.message) {
          // Handle page redirection message
          setEmptyPageMessage(data.message);
          // Update current page to match what was actually fetched
          if (pageToFetch !== currentPage) {
            setCurrentPage(pageToFetch);
          }
        } else {
          setEmptyPageMessage(null);
        }

        // Apply cached prices to the fetched cards
        const cardsWithPrices = applyPricesToCards(data.cards);

        // Set fetched cards with prices applied
        setFetchedCards(cardsWithPrices as PokemonCard[]);

        // Client-side filtering will happen in useEffect to set displayedCards
        // Make sure totalPages is at least 1 to avoid pagination issues
        const calculatedTotalPages = Math.max(1, data.totalPages || Math.ceil(data.totalCount / CARDS_PER_PAGE));
        setTotalPages(calculatedTotalPages); // Pagination based on search total
        setSearchPerformed(true);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log("CardExplorer: Search aborted for query", query);
      } else {
        console.error(`CardExplorer: Error searching for "${query}":`, err);
        setError((err as Error).message || 'Failed to search for cards.');
        setDisplayedCards([]);
        setFetchedCards([]);
        setTotalPages(1); // Reset total pages on error
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
        setIsSearching(false);
      }
    }

    return () => {
      console.log("CardExplorer: Aborting search for query", query);
      controller.abort();
    };
  }, [currentPage]);

  // Function to search for cards using our enhanced client-side search
  const searchCardsEnhanced = useCallback(async (query: string, pageToFetch: number) => {
    if (!query.trim()) {
      // If query is empty, revert to normal page view
      setSearchPerformed(false);
      return;
    }

    // Update the URL with the search query and page number
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('q', query);
      url.searchParams.set('page', pageToFetch.toString());
      window.history.replaceState({}, '', url.toString());
    }

    console.log(`CardExplorer: Searching for "${query}" using enhanced search engine`);
    setIsLoading(true);
    setError(null);
    setEmptyPageMessage(null);
    setIsSearching(true);
    setFetchedCards([]);
    setDisplayedCards([]);
    setTotalPages(1);

    try {
      // Use our enhanced search function that uses the pre-built indexes
      const results = await searchCardsByName(query, pageToFetch, CARDS_PER_PAGE);
      console.log(`CardExplorer: Enhanced search received ${results.cards.length} cards for "${query}"`);
      // Handle empty results
      if (results.cards.length === 0) {
        setEmptyPageMessage(`No cards found matching "${query}".`);
        setTotalPages(1);
      } else {
        setEmptyPageMessage(null);
        setTotalPages(results.totalPages);
      }
      // Apply cached prices to the fetched cards
      const cardsWithPrices = applyPricesToCards(results.cards);
      setFetchedCards(cardsWithPrices);
      setSearchPerformed(true);
    } catch (err) {
      // --- PATCH: Show clear error and DO NOT fall back to API in local dev ---
      console.error(`CardExplorer: Error searching for "${query}":`, err);
      setError(
        'Local search indexes are missing or failed to load.\n' +
        'Please run your data preparation scripts (see README) to generate local search indexes in public/data/indexes/.\n' +
        'Search will not work until these files are present.'
      );
      setDisplayedCards([]);
      setFetchedCards([]);
      setTotalPages(1);
      // DO NOT fall back to API in local dev
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, []);

  // --- Client-side filtering logic ---
  const applyClientSideFilters = (cardsToFilter: PokemonCard[], currentFilters: FilterState): PokemonCard[] => {
      if (!Object.values(currentFilters).some(v => v)) {
          // No filters active, return original list
          return cardsToFilter;
      }
      console.log("Applying client-side filters:", currentFilters);
      return cardsToFilter.filter(card => {
          const setMatch = !currentFilters.set || card.set?.name === currentFilters.set;
          const rarityMatch = !currentFilters.rarity || card.rarity === currentFilters.rarity;
          // Assuming card.types is an array of strings
          const typeMatch = !currentFilters.type || card.types?.includes(currentFilters.type);
          const supertypeMatch = !currentFilters.supertype || card.supertype === currentFilters.supertype;

          return setMatch && rarityMatch && typeMatch && supertypeMatch;
      });
  };

  // Effect to fetch data OR apply client-side filters
  useEffect(() => {
    console.log("Effect triggered: searchPerformed=", searchPerformed, "currentPage=", currentPage, "filters=", filters, "activeSearchTerm=", activeSearchTerm); // Log effect trigger

    try {
      if (searchPerformed && activeSearchTerm.trim()) {
        // Search is active: Try enhanced search first, then fall back to API if needed
        console.log("Using enhanced search for:", activeSearchTerm);
        try {
          // Use our enhanced client-side search
          searchCardsEnhanced(activeSearchTerm, currentPage);
        } catch (searchError) {
          console.error("Error in enhanced search, falling back to API:", searchError);
          // If enhanced search fails, fall back to the API-based search
          searchCards(activeSearchTerm, currentPage);
        }
      } else {
        // No search: Call paged API with filters (sets fetchedCards and displayedCards)
        console.log("Calling fetchDataForPage API...");
        try {
          fetchDataForPage(currentPage, filters);
        } catch (fetchError) {
          console.error("Error in fetchDataForPage:", fetchError);
          setError("Failed to fetch card data. Please try again.");
          setIsLoading(false);
          setFetchedCards([]);
          setDisplayedCards([]);
          setTotalPages(1);
        }
      }
    } catch (error) {
      console.error("Error in data fetching effect:", error);
      setError("Failed to fetch data. Please try again.");
      setIsLoading(false);
      setFetchedCards([]);
      setDisplayedCards([]);
      setTotalPages(1);
    }
    // Cleanup function is handled by the specific fetch/search calls
  }, [currentPage, filters, searchPerformed, activeSearchTerm, fetchDataForPage, searchCards, searchCardsEnhanced]);

  // Helper function to preserve price data between card updates
  // Now uses the global price cache
  const preservePriceData = useCallback((oldCards: PokemonCard[], newCards: PokemonCard[]): PokemonCard[] => {
    // Apply cached prices to the new cards
    return applyPricesToCards(newCards);
  }, []);

  // Pagination handlers with URL updates
  const goToNextPage = useCallback(() => {
    const nextPage = Math.min(currentPage + 1, totalPages);
    setCurrentPage(nextPage);

    // Update URL while preserving other parameters
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('page', nextPage.toString());
      window.history.replaceState({}, '', url.toString());
    }
  }, [currentPage, totalPages]);

  const goToPreviousPage = useCallback(() => {
    const prevPage = Math.max(currentPage - 1, 1);
    setCurrentPage(prevPage);

    // Update URL while preserving other parameters
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('page', prevPage.toString());
      window.history.replaceState({}, '', url.toString());
    }
  }, [currentPage]);

  // Handler to go to a specific page
  const goToPage = useCallback((pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);

      // Update URL while preserving other parameters
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('page', pageNumber.toString());
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [totalPages]);

  // --- Render content based on state ---
  const renderCardContent = () => {
    // Handle loading state
    if (isLoading && displayedCards.length === 0) {
      return <div className="text-center p-10 text-lg text-gray-500">Loading Pokémon cards...</div>;
    }

    // Handle error state
    if (error) {
      return (
        <div className="text-center p-10">
          <p className="text-lg text-red-600 mb-2">Error: {error}</p>
          <div className="flex justify-center gap-4 mt-4">
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (searchPerformed) {
                  handleClearSearch();
                } else {
                  setCurrentPage(1);
                  fetchDataForPage(1, {});
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // Handle empty page message
    if (emptyPageMessage) {
      return (
        <div className="text-center p-10">
          <p className="text-lg text-amber-600 mb-2">{emptyPageMessage}</p>
          <p className="text-md text-gray-600">Try navigating to a lower page number or adjusting your search/filters.</p>
          <div className="flex justify-center gap-4 mt-4">
            <button
              type="button"
              onClick={() => {
                if (searchPerformed) {
                  // If we're searching, go to page 1 of search results
                  setCurrentPage(1);
                  searchCards(activeSearchTerm, 1);
                } else {
                  // Otherwise go to page 1 of regular browsing
                  setCurrentPage(1);
                  fetchDataForPage(1, filters);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Go to First Page
            </button>
            {emptyPageMessage.includes('exceeds the maximum available data') && (
              <button
                type="button"
                onClick={() => setCurrentPage(420)} // Hard-coded known last valid page
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Go to Last Valid Page (420)
              </button>
            )}
            {searchPerformed && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      );
    }

    // Handle no results
    if (!isLoading && displayedCards.length === 0) {
      return (
        <div className="text-center p-10">
          <p className="text-lg text-gray-500 mb-2">
            {searchPerformed ? `No cards found matching "${activeSearchTerm}"${Object.values(filters).some(v=>v) ? ' and filters' : ''}.` : 'No cards found matching filters.'}
          </p>
          <div className="flex justify-center gap-4 mt-4">
            {searchPerformed && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Clear Search
              </button>
            )}
            {Object.values(filters).some(v=>v) && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      );
    }

    // Render card binder with results
    return (
      <CardBinder
        // -- Pass displayedCards --
        cards={displayedCards}
        currentPage={currentPage}
        totalPages={totalPages}
        goToNextPage={goToNextPage}
        goToPreviousPage={goToPreviousPage}
        goToPage={goToPage}
        isLoading={isLoading}
        isExploreView={true} // This is the explore view
      />
    );
  };

  // --- Effect to apply client-side filters AFTER search results arrive ---
  useEffect(() => {
    // Always run this effect regardless of search state
    // This ensures hooks are always called in the same order
    const newlyFilteredCards = searchPerformed
      ? applyClientSideFilters(fetchedCards, filters)
      : fetchedCards;

    if (searchPerformed) {
      console.log(`Client-side filtering complete. Displaying ${newlyFilteredCards.length} of ${fetchedCards.length} fetched cards.`);
    }

    // Use the helper function to preserve price data
    // Remove displayedCards from the preservePriceData call to avoid infinite loop
    setDisplayedCards(newlyFilteredCards);
  }, [fetchedCards, filters, searchPerformed, preservePriceData]); // Removed displayedCards from dependency array

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Only set the active search term when the search button is clicked
      setActiveSearchTerm(searchQuery);
      setCurrentPage(1);
      setSearchPerformed(true);
      // useEffect will now call searchCards because searchPerformed is true and activeSearchTerm is set
    } else {
        // If search is submitted with empty query, clear search/filters
        handleClearSearch();
    }
  };

  // Handle clearing the search
  const handleClearSearch = () => {
    setSearchQuery("");
    setActiveSearchTerm(""); // Also clear the active search term
    setSearchPerformed(false);
    // No need to reset filters here, maybe user wants to keep them?
    // Let useEffect handle refetching paged data without search term

    // Update the URL to remove the search parameter
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('q'); // Use 'q' parameter to match the API
      window.history.replaceState({}, '', url.toString());
    }

    if (currentPage !== 1) {
        setCurrentPage(1); // Reset page if needed
    } else {
        // If already on page 1, manually trigger refetch for non-search
        // because only searchPerformed changed, currentPage hasn't
        console.log("Manual trigger fetchDataForPage after clear search");
        fetchDataForPage(1, filters);
    }
  };



  return (
    <div className="flex flex-col min-h-screen">
      {/* Search Form & Filter Button */}
      <div className="w-full bg-white shadow-sm p-4 mb-4 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for Pokémon cards by name..."
                  className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className={`px-4 py-2 rounded-lg font-medium
                    ${isSearching || !searchQuery.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Clear
                  </button>
                )}
                {/* --- Filter Button --- */}
                <button
                  type="button"
                  onClick={() => setIsFilterPanelOpen(true)}
                  className="px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-1"
                >
                  {/* Placeholder Icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                </button>
              </div>
            </form>

            {/* Display Active Filters (Placeholder) */}
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(filters).map(([key, value]) => value ? (
                <span key={key} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full flex items-center">
                  {key}: {value}
                  <button
                    type="button"
                    onClick={() => updateFilters({ [key]: undefined })} // Clear specific filter
                    className="ml-1 text-red-500 hover:text-red-700"
                  >
                    &times;
                  </button>
                </span>
              ) : null)}
              {Object.values(filters).some(v => v) && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-blue-600 hover:underline ml-1"
                  >
                      Clear All
                  </button>
              )}
            </div>
        </div>
      </div>

      {/* Search status message - adjust to reflect client filtering? */}
      {searchPerformed && !emptyPageMessage && (
          <div className="max-w-4xl mx-auto mt-2 text-sm text-gray-600">
            {isLoading ? `Searching for "${activeSearchTerm}"...` :
            `Displaying ${displayedCards.length} cards matching "${activeSearchTerm}"${Object.values(filters).some(v=>v) ? ' and filters' : ''}.`
            }
          </div>
      )}

      {/* Filter Panel Modal/Drawer (Pass displayedCards count?) */}
      {isFilterPanelOpen && (
          <FilterPanel
              isOpen={isFilterPanelOpen}
              onClose={() => setIsFilterPanelOpen(false)}
              currentFilters={filters}
              updateFilters={updateFilters}
              availableOptions={filterOptions} // Pass fetched options
              isLoadingOptions={isLoadingFilters} // Pass loading state
          />
      )}

      {/* Loading state - Check isLoading, not displayedCards.length */}
      {renderCardContent()}

    </div>
  );
}