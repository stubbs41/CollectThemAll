'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { PokemonCard } from '@/lib/types';
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
  removeCardFromCollection: (cardId: string, collectionType: CollectionType, groupName?: string) => Promise<RemoveCardResult>;
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

export const CollectionProvider: React.FC<CollectionProviderProps> = ({ children }) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<string[]>(['Default']);
  const [collectionGroups, setCollectionGroups] = useState<CollectionGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('Default');
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();

  // Create a singleton instance of the CollectionService
  const collectionService = React.useMemo(() => new CollectionService(), []);

  // Load collections when auth state changes
  useEffect(() => {
    const loadCollections = async () => {
      setIsLoading(true);

      try {
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

          // Add "have" collection for this group
          allCollections.push({
            id: `${groupName}-have`,
            name: 'My Collection',
            groupName: groupName,
            type: 'have',
            cards: groupData.have,
            value: haveValue
          });

          // Add "want" collection for this group
          allCollections.push({
            id: `${groupName}-want`,
            name: 'Wishlist',
            groupName: groupName,
            type: 'want',
            cards: groupData.want,
            value: wantValue
          });
        });

        setCollections(allCollections);
        setGroups(groupNames);

        // Update collection values
        await collectionService.updateCollectionValues();
      } catch (error) {
        console.error('Error loading collections:', error);
        setCollections([]);
        setGroups(['Default']);
        setCollectionGroups([{
          id: 'default',
          name: 'Default',
          have_value: 0,
          want_value: 0,
          total_value: 0
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      loadCollections();
    } else {
      // No session, empty collections
      setCollections([]);
      setGroups(['Default']);
      setCollectionGroups([{
        id: 'default',
        name: 'Default',
        have_value: 0,
        want_value: 0,
        total_value: 0
      }]);
      setIsLoading(false);
    }
  }, [session, collectionService]);

  // Refresh collections function
  const refreshCollections = useCallback(async () => {
    setIsLoading(true);
    try {
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

        // Add "have" collection for this group
        allCollections.push({
          id: `${groupName}-have`,
          name: 'My Collection',
          groupName: groupName,
          type: 'have',
          cards: groupData.have,
          value: haveValue
        });

        // Add "want" collection for this group
        allCollections.push({
          id: `${groupName}-want`,
          name: 'Wishlist',
          groupName: groupName,
          type: 'want',
          cards: groupData.want,
          value: wantValue
        });
      });

      setCollections(allCollections);
      setGroups(groupNames);

      // Update collection values
      await collectionService.updateCollectionValues();
    } catch (error) {
      console.error('Error refreshing collections:', error);
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
    groupName: string = 'Default'
  ): Promise<RemoveCardResult> => {
    if (!session) return { status: 'error', message: 'Not authenticated' };

    try {
      // Use decrementOnly=true to decrement quantity instead of removing entirely (when qty > 1)
      const result = await collectionService.removeCard(cardId, collectionType, groupName, true);
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

        // If deleting the active group, switch to Default
        if (activeGroup === groupName) {
          setActiveGroup('Default');
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
    setActiveGroup,
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