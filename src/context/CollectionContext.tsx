'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { PokemonCard } from '@/lib/types';
import { storePrice } from '@/lib/robustPriceCache';
import CollectionService, {
  CollectionType,
  CollectionItem,
  CollectionGroup,
  AddCardResult,  // Import result type
  RemoveCardResult // Import result type
} from '@/services/CollectionService';
import { useAuth } from './AuthContext';

// Type Definitions
export interface Collection {
  id: string;
  name: string;
  groupName: string;
  type: CollectionType;
  cards: Map<string, CollectionItem>;
  value: number;
}

export interface CollectionGroup {
  id: string;
  name: string;
  description?: string;
  have_value: number;
  want_value: number;
  total_value: number;
}

export interface CollectionContextType {
  collections: Collection[];
  groups: string[];
  collectionGroups: CollectionGroup[];
  activeGroup: string;
  isLoading: boolean;
  addCardToCollection: (cardId: string, card: PokemonCard, collectionType: CollectionType, groupName?: string) => Promise<AddCardResult>;
  removeCardFromCollection: (cardId: string, collectionType: CollectionType, groupName?: string, decrementOnly?: boolean) => Promise<RemoveCardResult>;
  isCardInCollection: (cardId: string, collectionType: CollectionType, groupName?: string) => boolean;
  isCardInAnyCollection: (cardId: string) => boolean;
  getCardQuantity: (cardId: string, collectionType: CollectionType, groupName?: string) => number;
  refreshCollections: () => Promise<void>;
  createCollectionGroup: (groupName: string, description?: string) => Promise<{success: boolean, id?: string, error?: string}>;
  renameCollectionGroup: (oldName: string, newName: string, description?: string) => Promise<{success: boolean, error?: string}>;
  deleteCollectionGroup: (groupName: string) => Promise<{success: boolean, error?: string}>;
  setActiveGroup: (groupName: string) => void;
  shareCollection: (groupName: string, sharingLevel: 'group' | 'have' | 'want', expiresInDays?: number) => Promise<{success: boolean, shareId?: string, error?: string}>;
  importCollection: (data: any[], targetGroupName: string, createNewGroup?: boolean) => Promise<{success: boolean, error?: string}>;
  exportCollection: (groupName: string, collectionType?: CollectionType) => Promise<{success: boolean, data?: any[], error?: string}>;
  updateCardMarketPrice: (cardId: string, marketPrice: number) => Promise<boolean>;
  updateCollectionValues: () => Promise<void>;
}

// Create Context
const CollectionContext = createContext<CollectionContextType | undefined>(undefined);

// Provider Component
interface CollectionProviderProps {
  children: ReactNode;
}

// Local storage key for active collection group
const ACTIVE_GROUP_KEY = 'activeCollectionGroup';

// Function to get the active group from localStorage
const getStoredActiveGroup = (): string => {
  if (typeof window === 'undefined') return 'Default';
  try {
    const storedGroup = localStorage.getItem(ACTIVE_GROUP_KEY);
    return storedGroup || 'Default';
  } catch (error) {
    console.error('Error getting active group from localStorage:', error);
    return 'Default';
  }
};

export const CollectionProvider: React.FC<CollectionProviderProps> = ({ children }) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [collectionGroups, setCollectionGroups] = useState<CollectionGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>(getStoredActiveGroup());
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();

  // Create a singleton instance of the CollectionService
  const collectionService = React.useMemo(() => new CollectionService(), []);

  // Function to load collections
  const loadCollections = useCallback(async () => {
    console.log('Loading collections...');
    setIsLoading(true);

    try {
      // Fetch collection groups
      console.log('Fetching collection groups...');
      const groups = await collectionService.fetchCollectionGroups();
      console.log('Collection groups fetched:', groups.length);
      setCollectionGroups(groups);

      // Fetch collections using the updated CollectionService API
      console.log('Fetching collections...');
      const groupsMap = await collectionService.fetchCollections();
      console.log('Collections fetched, group count:', groupsMap.size);

      // Convert the hierarchical structure to a flat array of collections
      const allCollections: Collection[] = [];
      const groupNames: string[] = [];

      // Process each group
      groupsMap.forEach((groupData, groupName) => {
        groupNames.push(groupName);

        // Find group value
        const groupInfo = groups.find(g => g.name === groupName);
        const haveValue = groupInfo?.have_value || 0;
        const wantValue = groupInfo?.want_value || 0;

        // Apply price persistence to the cards before adding to collections
        // Convert Map to array, apply price persistence, then convert back to Map
        const haveCards = new Map();
        Array.from(groupData.have.entries()).forEach(([cardId, card]) => {
          // Apply price persistence
          const bestPrice = getBestPrice(cardId, card.market_price);
          if (bestPrice > 0) {
            card.market_price = bestPrice;
          }
          // Store the price for future use
          if (card.market_price && card.market_price > 0) {
            storePrice(cardId, card.market_price);
          }
          haveCards.set(cardId, card);
        });

        const wantCards = new Map();
        Array.from(groupData.want.entries()).forEach(([cardId, card]) => {
          // Apply price persistence
          const bestPrice = getBestPrice(cardId, card.market_price);
          if (bestPrice > 0) {
            card.market_price = bestPrice;
          }
          // Store the price for future use
          if (card.market_price && card.market_price > 0) {
            storePrice(cardId, card.market_price);
          }
          wantCards.set(cardId, card);
        });

        // Add "have" collection for this group
        allCollections.push({
          id: `${groupName}-have`,
          name: 'My Collection',
          groupName: groupName,
          type: 'have',
          cards: haveCards,
          value: haveValue
        });

        // Add "want" collection for this group
        allCollections.push({
          id: `${groupName}-want`,
          name: 'Wishlist',
          groupName: groupName,
          type: 'want',
          cards: wantCards,
          value: wantValue
        });
      });

      console.log('Setting collections:', allCollections.length);
      setCollections(allCollections);
      setGroups(groupNames);

      // Update collection values
      await collectionService.updateCollectionValues();
      console.log('Collection values updated');
    } catch (error) {
      console.error('Error loading collections:', error);
      setCollections([]);
      setGroups([]);
      setCollectionGroups([]);
    } finally {
      setIsLoading(false);
      console.log('Finished loading collections');
    }
  }, [collectionService]);

  // Listen for auth events
  useEffect(() => {
    const handleAuthReady = (event: CustomEvent) => {
      console.log('Auth ready event received in CollectionContext');
      const { session, user } = event.detail;
      if (session) {
        console.log('Auth ready with session, loading collections...');
        // Add a small delay to ensure auth is fully established
        setTimeout(() => {
          loadCollections();
        }, 500);
      } else {
        console.log('Auth ready with no session, clearing collections');
        // No session, empty collections
        setCollections([]);
        setGroups([]);
        setCollectionGroups([]);
        setIsLoading(false);
      }
    };

    const handleAuthStateChange = (event: CustomEvent) => {
      console.log('Auth state change event received in CollectionContext:', event.detail.event);
      const { session, user, event: authEvent } = event.detail;

      if (session) {
        console.log('Auth state change with session, loading collections...');
        // Add a small delay to ensure auth is fully established
        setTimeout(() => {
          loadCollections();
        }, 500);
      } else {
        console.log('Auth state change with no session, clearing collections');
        // No session, empty collections
        setCollections([]);
        setGroups([]);
        setCollectionGroups([]);
        setIsLoading(false);
      }
    };

    // Handle force collection refresh event
    const handleForceCollectionRefresh = () => {
      console.log('Force collection refresh event received');
      if (session) {
        console.log('Session exists, force loading collections...');
        loadCollections();
      }
    };

    // Add event listeners
    if (typeof window !== 'undefined') {
      console.log('Adding auth event listeners in CollectionContext');
      window.addEventListener('auth-ready', handleAuthReady as EventListener);
      window.addEventListener('auth-state-change', handleAuthStateChange as EventListener);
      window.addEventListener('force-collection-refresh', handleForceCollectionRefresh as EventListener);
    }

    // Initial load based on session
    if (session) {
      console.log('Initial session exists in CollectionContext, loading collections...');
      loadCollections();
    } else {
      console.log('No initial session in CollectionContext, waiting for auth events');
      // No session, empty collections
      setCollections([]);
      setGroups([]);
      setCollectionGroups([]);
      setIsLoading(false);
    }

    // Cleanup event listeners
    return () => {
      if (typeof window !== 'undefined') {
        console.log('Removing auth event listeners in CollectionContext');
        window.removeEventListener('auth-ready', handleAuthReady as EventListener);
        window.removeEventListener('auth-state-change', handleAuthStateChange as EventListener);
        window.removeEventListener('force-collection-refresh', handleForceCollectionRefresh as EventListener);
      }
    };
  }, [session, loadCollections]);

  // Refresh collections function
  const refreshCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('[CollectionContext] Refreshing collections...');
      collectionService.invalidateCache();

      // Fetch collection groups
      const groups = await collectionService.fetchCollectionGroups();
      setCollectionGroups(groups);

      // Fetch collections using the updated CollectionService API
      const groupsMap = await collectionService.fetchCollections();

      // Convert the hierarchical structure to a flat array of collections
      const allCollections: Collection[] = [];
      const groupNames: string[] = [];

      // Process each group
      groupsMap.forEach((groupData, groupName) => {
        groupNames.push(groupName);

        // Find group value
        const groupInfo = groups.find(g => g.name === groupName);
        const haveValue = groupInfo?.have_value || 0;
        const wantValue = groupInfo?.want_value || 0;

        console.log(`[CollectionContext] Processing group ${groupName}: have=${haveValue}, want=${wantValue}`);

        // Store prices for future reference but don't modify the database values
        const haveCards = new Map();
        Array.from(groupData.have.entries()).forEach(([cardId, card]) => {
          // Always store the database price first, even if it's 0
          // This ensures we're using the latest data from the database
          if (card.market_price && card.market_price > 0) {
            storePrice(cardId, card.market_price);
          }

          // Log price for debugging
          console.log(`[CollectionContext] Have card ${cardId}: price=${card.market_price || 0}`);

          haveCards.set(cardId, card);
        });

        const wantCards = new Map();
        Array.from(groupData.want.entries()).forEach(([cardId, card]) => {
          // Always store the database price first, even if it's 0
          // This ensures we're using the latest data from the database
          if (card.market_price && card.market_price > 0) {
            storePrice(cardId, card.market_price);
          }

          // Log price for debugging
          console.log(`[CollectionContext] Want card ${cardId}: price=${card.market_price || 0}`);

          wantCards.set(cardId, card);
        });

        // Add "have" collection for this group
        allCollections.push({
          id: `${groupName}-have`,
          name: 'My Collection',
          groupName: groupName,
          type: 'have',
          cards: haveCards,
          value: haveValue
        });

        // Add "want" collection for this group
        allCollections.push({
          id: `${groupName}-want`,
          name: 'Wishlist',
          groupName: groupName,
          type: 'want',
          cards: wantCards,
          value: wantValue
        });
      });

      console.log(`[CollectionContext] Setting ${allCollections.length} collections`);
      setCollections(allCollections);
      setGroups(groupNames);

      // Update collection values
      await collectionService.updateCollectionValues();
    } catch (error) {
      console.error('[CollectionContext] Error refreshing collections:', error);
    } finally {
      setIsLoading(false);
    }
  }, [collectionService]);

  // Add card to collection
  const addCardToCollection = useCallback(async (
    cardId: string,
    card: PokemonCard,
    collectionType: CollectionType,
    groupName: string = 'Default'
  ): Promise<AddCardResult> => {
    if (!session) return { status: 'error', message: 'Not authenticated' };

    // Validate card and cardId
    if (!cardId) {
      console.error('Card ID is missing in addCardToCollection');
      return { status: 'error', message: 'Card ID is required' };
    }

    if (!card) {
      console.error('Card object is missing in addCardToCollection');
      return { status: 'error', message: 'Card data is required' };
    }

    // Ensure card has an ID and it matches the provided cardId
    if (!card.id) {
      console.log('Card object missing ID, setting it to the provided cardId:', cardId);
      card = { ...card, id: cardId };
    } else if (card.id !== cardId) {
      console.warn(`Card ID mismatch: provided ${cardId} but card object has ${card.id}. Using provided cardId.`);
      card = { ...card, id: cardId };
    }

    try {
      const result = await collectionService.addCard(card, collectionType, groupName);
      if (result.status === 'added' || result.status === 'updated') {
        // Refresh successful adds/updates
        await refreshCollections();
      }
      return result;
    } catch (error: any) {
      console.error(`Error adding card to ${collectionType} collection in context:`, error);
      return { status: 'error', message: error.message || 'An unexpected error occurred' };
    }
  }, [session, collectionService, refreshCollections]);

  // Remove card from collection
  const removeCardFromCollection = useCallback(async (
    cardId: string,
    collectionType: CollectionType,
    groupName: string = 'Default',
    decrementOnly: boolean = true
  ): Promise<RemoveCardResult> => {
    if (!session) return { status: 'error', message: 'Not authenticated' };

    try {
      // Pass the decrementOnly parameter to control whether to decrement or remove entirely
      const result = await collectionService.removeCard(cardId, collectionType, groupName, decrementOnly);
      if (result.status === 'decremented' || result.status === 'removed') {
        // Refresh successful removals/decrements
        await refreshCollections();
      }
      return result;
    } catch (error: any) {
      console.error(`Error removing card from ${collectionType} collection in context:`, error);
      return { status: 'error', message: error.message || 'An unexpected error occurred' };
    }
  }, [session, collectionService, refreshCollections]);

  // Check if card is in collection
  const isCardInCollection = useCallback((
    cardId: string,
    collectionType: CollectionType,
    groupName: string = 'Default'
  ): boolean => {
    if (!session) return false;

    const collection = collections.find(
      col => col.type === collectionType && col.groupName === groupName
    );
    return collection ? collection.cards.has(cardId) : false;
  }, [session, collections]);

  // New method: Check if card is in any collection
  const isCardInAnyCollection = useCallback((cardId: string): boolean => {
    if (!session) return false;

    return collections.some(collection => collection.cards.has(cardId));
  }, [session, collections]);

  // Get card quantity
  const getCardQuantity = useCallback((
    cardId: string,
    collectionType: CollectionType,
    groupName: string = 'Default'
  ): number => {
    if (!session) return 0;

    const collection = collections.find(
      col => col.type === collectionType && col.groupName === groupName
    );
    if (!collection) return 0;

    const item = collection.cards.get(cardId);
    return item ? item.quantity : 0;
  }, [session, collections]);

  // Create a new collection group
  const createCollectionGroup = useCallback(async (
    groupName: string,
    description?: string
  ): Promise<{success: boolean, id?: string, error?: string}> => {
    if (!session) return { success: false, error: 'Not authenticated' };

    try {
      const result = await collectionService.createCollectionGroup(groupName, description);
      if (result.success) {
        await refreshCollections();
      }
      return result;
    } catch (error: any) {
      console.error('Error creating collection group:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  }, [session, collectionService, refreshCollections]);

  // Rename a collection group
  const renameCollectionGroup = useCallback(async (
    oldName: string,
    newName: string,
    description?: string
  ): Promise<{success: boolean, error?: string}> => {
    if (!session) return { success: false, error: 'Not authenticated' };

    try {
      const result = await collectionService.renameCollectionGroup(oldName, newName, description);
      if (result.success) {
        await refreshCollections();

        // If renaming the active group, update activeGroup
        if (activeGroup === oldName) {
          setActiveGroup(newName);
        }
      }
      return result;
    } catch (error: any) {
      console.error('Error renaming collection group:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  }, [session, collectionService, refreshCollections, activeGroup]);

  // Delete a collection group
  const deleteCollectionGroup = useCallback(async (
    groupName: string
  ): Promise<{success: boolean, error?: string}> => {
    if (!session) return { success: false, error: 'Not authenticated' };

    try {
      const result = await collectionService.deleteCollectionGroup(groupName);
      if (result.success) {
        await refreshCollections();

        // If deleting the active group, switch to the first available group
        if (activeGroup === groupName && groups.length > 0) {
          // Find a group that's not the one being deleted
          const newActiveGroup = groups.find(g => g !== groupName);
          if (newActiveGroup) {
            setActiveGroup(newActiveGroup);
          } else {
            setActiveGroup('');
          }
        }
      }
      return result;
    } catch (error: any) {
      console.error('Error deleting collection group:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  }, [session, collectionService, refreshCollections, activeGroup]);

  // Share collection
  const shareCollection = useCallback(async (
    groupName: string,
    sharingLevel: 'group' | 'have' | 'want',
    expiresInDays: number = 7,
    options?: {
      is_collaborative?: boolean;
      password?: string;
      permission_level?: 'read' | 'write';
      allow_comments?: boolean;
    }
  ): Promise<{success: boolean, shareId?: string, error?: string}> => {
    if (!session) return { success: false, error: 'Not authenticated' };

    try {
      return await collectionService.createSharedCollection(
        groupName,
        sharingLevel,
        expiresInDays,
        options
      );
    } catch (error: any) {
      console.error('Error sharing collection:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  }, [session, collectionService]);

  // Import collection
  const importCollection = useCallback(async (
    data: any[],
    targetGroupName: string,
    createNewGroup: boolean = false
  ): Promise<{success: boolean, error?: string}> => {
    if (!session) return { success: false, error: 'Not authenticated' };

    try {
      const result = await collectionService.importCollection(data, targetGroupName, createNewGroup);
      if (result.success) {
        await refreshCollections();
      }
      return result;
    } catch (error: any) {
      console.error('Error importing collection:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  }, [session, collectionService, refreshCollections]);

  // Export collection
  const exportCollection = useCallback(async (
    groupName: string,
    collectionType?: CollectionType
  ): Promise<{success: boolean, data?: any[], error?: string}> => {
    if (!session) return { success: false, error: 'Not authenticated' };

    try {
      return await collectionService.exportCollection(groupName, collectionType);
    } catch (error: any) {
      console.error('Error exporting collection:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  }, [session, collectionService]);

  // Update card market price
  const updateCardMarketPrice = useCallback(async (
    cardId: string,
    marketPrice: number
  ): Promise<boolean> => {
    if (!session) return false;

    try {
      const success = await collectionService.updateCardMarketPrice(cardId, marketPrice);
      if (success) {
        await refreshCollections();
      }
      return success;
    } catch (error) {
      console.error('Error updating card market price:', error);
      return false;
    }
  }, [session, collectionService, refreshCollections]);

  // Update collection values
  const updateCollectionValues = useCallback(async (): Promise<void> => {
    if (!session) return;

    try {
      await collectionService.updateCollectionValues();
      await refreshCollections();
    } catch (error) {
      console.error('Error updating collection values:', error);
    }
  }, [session, collectionService, refreshCollections]);

  // Custom setActiveGroup function that also updates localStorage
  const setActiveGroupWithStorage = useCallback((groupName: string) => {
    // Default to 'Default' if no group name is provided
    const newActiveGroup = groupName || 'Default';

    // Update state
    setActiveGroup(newActiveGroup);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_GROUP_KEY, newActiveGroup);
      } catch (error) {
        console.error('Error saving active group to localStorage:', error);
      }
    }
  }, []);

  const contextValue: CollectionContextType = {
    collections,
    groups,
    collectionGroups,
    activeGroup,
    isLoading,
    addCardToCollection,
    removeCardFromCollection,
    isCardInCollection,
    isCardInAnyCollection,
    getCardQuantity,
    refreshCollections,
    createCollectionGroup,
    renameCollectionGroup,
    deleteCollectionGroup,
    setActiveGroup: setActiveGroupWithStorage,
    shareCollection,
    importCollection,
    exportCollection,
    updateCardMarketPrice,
    updateCollectionValues
  };

  return (
    <CollectionContext.Provider value={contextValue}>
      {children}
    </CollectionContext.Provider>
  );
};

// Custom Hook
export const useCollections = () => {
  const context = useContext(CollectionContext);
  if (context === undefined) {
    throw new Error('useCollections must be used within a CollectionProvider');
  }
  return context;
};