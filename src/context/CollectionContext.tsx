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
}

export interface CollectionContextType {
  collections: Collection[];
  groups: string[];
  isLoading: boolean;
  addCardToCollection: (cardId: string, card: PokemonCard, collectionType: CollectionType, groupName?: string) => Promise<AddCardResult>;
  removeCardFromCollection: (cardId: string, collectionType: CollectionType, groupName?: string) => Promise<RemoveCardResult>;
  isCardInCollection: (cardId: string, collectionType: CollectionType, groupName?: string) => boolean;
  isCardInAnyCollection: (cardId: string) => boolean;
  getCardQuantity: (cardId: string, collectionType: CollectionType, groupName?: string) => number;
  refreshCollections: () => Promise<void>;
  createCollectionGroup: (groupName: string) => Promise<boolean>;
  renameCollectionGroup: (oldName: string, newName: string) => Promise<boolean>;
  deleteCollectionGroup: (groupName: string) => Promise<boolean>;
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
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();
  
  // Create a singleton instance of the CollectionService
  const collectionService = React.useMemo(() => new CollectionService(), []);
  
  // Load collections when auth state changes
  useEffect(() => {
    const loadCollections = async () => {
      setIsLoading(true);
      
      try {
        // Fetch collections using the updated CollectionService API
        const groupsMap = await collectionService.fetchCollections();
        
        // Convert the hierarchical structure to a flat array of collections
        const allCollections: Collection[] = [];
        const groupNames: string[] = [];
        
        // Process each group
        groupsMap.forEach((groupData, groupName) => {
          groupNames.push(groupName);
          
          // Add "have" collection for this group
          allCollections.push({
            id: `${groupName}-have`,
            name: 'My Collection',
            groupName: groupName,
            type: 'have',
            cards: groupData.have
          });
          
          // Add "want" collection for this group
          allCollections.push({
            id: `${groupName}-want`,
            name: 'Wishlist',
            groupName: groupName,
            type: 'want',
            cards: groupData.want
          });
        });
        
        setCollections(allCollections);
        setGroups(groupNames);
      } catch (error) {
        console.error('Error loading collections:', error);
        setCollections([]);
        setGroups(['Default']);
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
      setIsLoading(false);
    }
  }, [session, collectionService]);
  
  // Refresh collections function
  const refreshCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      collectionService.invalidateCache();
      
      // Fetch collections using the updated CollectionService API
      const groupsMap = await collectionService.fetchCollections();
      
      // Convert the hierarchical structure to a flat array of collections
      const allCollections: Collection[] = [];
      const groupNames: string[] = [];
      
      // Process each group
      groupsMap.forEach((groupData, groupName) => {
        groupNames.push(groupName);
        
        // Add "have" collection for this group
        allCollections.push({
          id: `${groupName}-have`,
          name: 'My Collection',
          groupName: groupName,
          type: 'have',
          cards: groupData.have
        });
        
        // Add "want" collection for this group
        allCollections.push({
          id: `${groupName}-want`,
          name: 'Wishlist',
          groupName: groupName,
          type: 'want',
          cards: groupData.want
        });
      });
      
      setCollections(allCollections);
      setGroups(groupNames);
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
  const createCollectionGroup = useCallback(async (groupName: string): Promise<boolean> => {
    if (!session) return false;
    
    try {
      const success = await collectionService.createCollectionGroup(groupName);
      if (success) {
        await refreshCollections();
      }
      return success;
    } catch (error) {
      console.error('Error creating collection group:', error);
      return false;
    }
  }, [session, collectionService, refreshCollections]);
  
  // Rename a collection group
  const renameCollectionGroup = useCallback(async (oldName: string, newName: string): Promise<boolean> => {
    if (!session) return false;
    
    try {
      const success = await collectionService.renameCollectionGroup(oldName, newName);
      if (success) {
        await refreshCollections();
      }
      return success;
    } catch (error) {
      console.error('Error renaming collection group:', error);
      return false;
    }
  }, [session, collectionService, refreshCollections]);
  
  // Delete a collection group
  const deleteCollectionGroup = useCallback(async (groupName: string): Promise<boolean> => {
    if (!session) return false;
    
    try {
      const success = await collectionService.deleteCollectionGroup(groupName);
      if (success) {
        await refreshCollections();
      }
      return success;
    } catch (error) {
      console.error('Error deleting collection group:', error);
      return false;
    }
  }, [session, collectionService, refreshCollections]);
  
  const contextValue: CollectionContextType = {
    collections,
    groups,
    isLoading,
    addCardToCollection,
    removeCardFromCollection,
    isCardInCollection,
    isCardInAnyCollection,
    getCardQuantity,
    refreshCollections,
    createCollectionGroup,
    renameCollectionGroup,
    deleteCollectionGroup
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