import { createClient } from '@/lib/supabaseClient';
import { PokemonCard } from '@/lib/types';

export type CollectionType = 'have' | 'want';

export interface CollectionGroup {
  id: string;
  name: string;
  collections: Map<CollectionType, Map<string, CollectionItem>>;
}

export interface CollectionItem {
  id: string;
  card_id: string;
  card_name: string;
  card_image_small: string;
  collection_type: CollectionType;
  group_name: string;
  quantity: number;
  added_at: string;
}

export interface CardCollection {
  type: CollectionType;
  group_name: string;
  items: Map<string, CollectionItem>; // card_id -> CollectionItem
}

export interface AddCardResult {
  status: 'added' | 'updated' | 'error';
  message?: string;
  newQuantity?: number;
}

export interface RemoveCardResult {
  status: 'decremented' | 'removed' | 'not_found' | 'error';
  message?: string;
  newQuantity?: number;
}

export default class CollectionService {
  private supabase = createClient();
  
  // Updated cache to support groups
  private cache: {
    groups: Map<string, {
      have: Map<string, CollectionItem>;
      want: Map<string, CollectionItem>;
    }>;
    lastFetched: number | null;
  } = {
    groups: new Map([
      ['Default', {
        have: new Map(),
        want: new Map()
      }]
    ]),
    lastFetched: null
  };
  
  // Cache expiration time in milliseconds (5 minutes)
  private CACHE_EXPIRATION = 5 * 60 * 1000;
  
  // Get collection groups
  getCollectionGroups(): string[] {
    return Array.from(this.cache.groups.keys());
  }
  
  /**
   * Check if a user is authenticated
   */
  private async isAuthenticated(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();
    return data.session !== null;
  }
  
  /**
   * Check if the cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache.lastFetched) return false;
    return (Date.now() - this.cache.lastFetched) < this.CACHE_EXPIRATION;
  }
  
  /**
   * Fetch collections from the database
   */
  async fetchCollections(): Promise<Map<string, { have: Map<string, CollectionItem>; want: Map<string, CollectionItem> }>> {
    // If cache is valid, return it
    if (this.isCacheValid()) {
      return this.cache.groups;
    }
    
    // Check authentication
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      return new Map([
        ['Default', {
          have: new Map(),
          want: new Map()
        }]
      ]);
    }
    
    try {
      // Fetch all collections
      const { data: allData, error: fetchError } = await this.supabase
        .from('collections')
        .select('*');
      
      if (fetchError) throw fetchError;
      
      // Reset cache
      this.cache.groups = new Map();
      
      // Group collections by group_name
      if (allData) {
        allData.forEach(item => {
          const groupName = item.group_name || 'Default';
          
          // Ensure group exists in cache
          if (!this.cache.groups.has(groupName)) {
            this.cache.groups.set(groupName, {
              have: new Map(),
              want: new Map()
            });
          }
          
          const group = this.cache.groups.get(groupName)!;
          
          // Add item to appropriate collection type
          if (item.collection_type === 'have') {
            group.have.set(item.card_id, item);
          } else if (item.collection_type === 'want') {
            group.want.set(item.card_id, item);
          }
        });
      }
      
      // Ensure Default group always exists
      if (!this.cache.groups.has('Default')) {
        this.cache.groups.set('Default', {
          have: new Map(),
          want: new Map()
        });
      }
      
      this.cache.lastFetched = Date.now();
      
      return this.cache.groups;
    } catch (error) {
      console.error('Error fetching collections:', error);
      return new Map([
        ['Default', {
          have: new Map(),
          want: new Map()
        }]
      ]);
    }
  }
  
  /**
   * Add a card to a collection
   */
  async addCard(
    card: PokemonCard,
    collectionType: CollectionType,
    groupName: string = 'Default'
  ): Promise<AddCardResult> {
    try {
      // Check authentication and get session
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session || !session.user) {
        console.error('No authenticated user session found');
        return { status: 'error', message: 'Authentication required' };
      }

      const userId = session.user.id;

      // Check if card already exists in this collection and group
      const { data: existingCard, error: checkError } = await this.supabase
        .from('collections')
        .select('id, quantity')
        .eq('user_id', userId)
        .eq('card_id', card.id)
        .eq('collection_type', collectionType)
        .eq('group_name', groupName)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error checking for existing card:', checkError.message || checkError);
        throw new Error(`Database check error: ${checkError.message}`);
      }

      if (existingCard) {
        // Card exists, increment quantity
        const newQuantity = existingCard.quantity + 1;
        const { error: updateError } = await this.supabase
          .from('collections')
          .update({
            quantity: newQuantity,
            added_at: new Date().toISOString() // Update timestamp
          })
          .eq('id', existingCard.id);

        if (updateError) {
          console.error('Error updating card quantity:', updateError);
          throw new Error(`Database update error: ${updateError.message}`);
        }

        // Update cache
        this.updateCacheForCardChange(card.id, collectionType, groupName, newQuantity);
        this.invalidateCache();
        return { status: 'updated', newQuantity: newQuantity };
      } else {
        // Card doesn't exist, insert it
        const { data, error: insertError } = await this.supabase
          .from('collections')
          .insert({
            user_id: userId,
            card_id: card.id,
            card_name: card.name || 'Unknown Card',
            card_image_small: card.images?.small || '',
            collection_type: collectionType,
            group_name: groupName,
            quantity: 1
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting new card:', insertError);
          throw new Error(`Database insert error: ${insertError.message}`);
        }

        // Update cache
        this.updateCacheForCardChange(card.id, collectionType, groupName, 1, data);
        this.invalidateCache();
        return { status: 'added', newQuantity: 1 };
      }
    } catch (error: any) {
      console.error(`Error in addCard service for ${collectionType} collection:`, error);
      throw error;
    }
  }

  // Helper method to update cache for card changes
  private updateCacheForCardChange(
    cardId: string, 
    collectionType: CollectionType, 
    groupName: string = 'Default',
    quantity: number,
    data?: any
  ) {
    // Ensure group exists in cache
    if (!this.cache.groups.has(groupName)) {
      this.cache.groups.set(groupName, {
        have: new Map(),
        want: new Map()
      });
    }
    
    const group = this.cache.groups.get(groupName)!;
    
    if (data) {
      // New card added
      if (collectionType === 'have') {
        group.have.set(cardId, data);
      } else {
        group.want.set(cardId, data);
      }
    } else {
      // Existing card updated
      if (collectionType === 'have' && group.have.has(cardId)) {
        const item = group.have.get(cardId)!;
        item.quantity = quantity;
        item.added_at = new Date().toISOString();
      } else if (collectionType === 'want' && group.want.has(cardId)) {
        const item = group.want.get(cardId)!;
        item.quantity = quantity;
        item.added_at = new Date().toISOString();
      }
    }
  }
  
  /**
   * Remove a card from a collection (or decrement quantity)
   */
  async removeCard(
    cardId: string,
    collectionType: CollectionType,
    groupName: string = 'Default',
    decrementOnly: boolean = true
  ): Promise<RemoveCardResult> {
    try {
        // Check authentication and get session
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session || !session.user) {
            console.error('No authenticated user session found for removeCard');
            return { status: 'error', message: 'Authentication required' };
        }
        const userId = session.user.id;


      // Check if card exists and get its quantity
      const { data: existingCard, error: checkError } = await this.supabase
        .from('collections')
        .select('id, quantity')
        .eq('user_id', userId) // Ensure user owns the card
        .eq('card_id', cardId)
        .eq('collection_type', collectionType)
        .eq('group_name', groupName)
        .single();

      // Handle case where card is not found
      if (checkError && checkError.code === 'PGRST116') {
        return { status: 'not_found' };
      }
      if (checkError) {
        console.error('Error checking card before removal:', checkError);
        throw new Error(`Database check error: ${checkError.message}`);
      }
      if (!existingCard) {
        return { status: 'not_found' }; // Should ideally be caught by PGRST116, but belt-and-suspenders
      }

      if (decrementOnly && existingCard.quantity > 1) {
        // Decrement quantity
        const newQuantity = existingCard.quantity - 1;
        const { error: updateError } = await this.supabase
          .from('collections')
          .update({ quantity: newQuantity })
          .eq('id', existingCard.id);

        if (updateError) {
          console.error('Error decrementing card quantity:', updateError);
          throw new Error(`Database update error: ${updateError.message}`);
        }

        // Update cache
        this.updateCacheForCardChange(cardId, collectionType, groupName, newQuantity);
        this.invalidateCache();
        return { status: 'decremented', newQuantity: newQuantity };

      } else {
        // Remove card completely (quantity is 1 or decrementOnly is false)
        const { error: deleteError } = await this.supabase
          .from('collections')
          .delete()
          .eq('id', existingCard.id);

        if (deleteError) {
           console.error('Error deleting card:', deleteError);
          throw new Error(`Database delete error: ${deleteError.message}`);
        }

        // Update cache
        if (this.cache.groups.has(groupName)) {
          const group = this.cache.groups.get(groupName)!;
          if (collectionType === 'have') {
            group.have.delete(cardId);
          } else if (collectionType === 'want') {
            group.want.delete(cardId);
          }
        }
        this.invalidateCache();
        return { status: 'removed', newQuantity: 0 };
      }
    } catch (error: any) {
      console.error(`Error in removeCard service for ${collectionType} collection:`, error);
      throw error;
    }
  }
  
  /**
   * Check if a card is in a collection
   */
  async isCardInCollection(
    cardId: string, 
    collectionType: CollectionType, 
    groupName: string = 'Default'
  ): Promise<boolean> {
    // Try to use cache first
    if (this.isCacheValid()) {
      if (this.cache.groups.has(groupName)) {
        const group = this.cache.groups.get(groupName)!;
        if (collectionType === 'have') {
          return group.have.has(cardId);
        } else {
          return group.want.has(cardId);
        }
      }
      return false;
    }
    
    // Check authentication
    const isAuth = await this.isAuthenticated();
    if (!isAuth) return false;
    
    try {
      const { data, error } = await this.supabase
        .from('collections')
        .select('id')
        .eq('card_id', cardId)
        .eq('collection_type', collectionType)
        .eq('group_name', groupName)
        .single();
      
      return !error && data !== null;
    } catch (error) {
      console.error(`Error checking if card is in ${collectionType} collection:`, error);
      return false;
    }
  }
  
  /**
   * Get a card's quantity in a collection
   */
  async getCardQuantity(
    cardId: string, 
    collectionType: CollectionType, 
    groupName: string = 'Default'
  ): Promise<number> {
    // Try to use cache first
    if (this.isCacheValid()) {
      if (this.cache.groups.has(groupName)) {
        const group = this.cache.groups.get(groupName)!;
        if (collectionType === 'have') {
          return group.have.has(cardId) ? group.have.get(cardId)!.quantity : 0;
        } else {
          return group.want.has(cardId) ? group.want.get(cardId)!.quantity : 0;
        }
      }
      return 0;
    }
    
    // Check authentication
    const isAuth = await this.isAuthenticated();
    if (!isAuth) return 0;
    
    try {
      const { data, error } = await this.supabase
        .from('collections')
        .select('quantity')
        .eq('card_id', cardId)
        .eq('collection_type', collectionType)
        .eq('group_name', groupName)
        .single();
      
      if (error || !data) return 0;
      return data.quantity;
    } catch (error) {
      console.error(`Error getting card quantity for ${collectionType} collection:`, error);
      return 0;
    }
  }

  /**
   * Create a new collection group
   */
  async createCollectionGroup(groupName: string): Promise<boolean> {
    if (!groupName.trim()) return false;
    
    // Add the group to cache
    if (!this.cache.groups.has(groupName)) {
      this.cache.groups.set(groupName, {
        have: new Map(),
        want: new Map()
      });
    }
    
    return true;
  }

  /**
   * Rename a collection group
   */
  async renameCollectionGroup(oldName: string, newName: string): Promise<boolean> {
    if (!oldName.trim() || !newName.trim() || oldName === 'Default') return false;
    
    // Check authentication
    const isAuth = await this.isAuthenticated();
    if (!isAuth) return false;
    
    try {
      // Update all cards in this group
      const { error } = await this.supabase
        .from('collections')
        .update({ group_name: newName })
        .eq('group_name', oldName);
      
      if (error) throw error;
      
      // Invalidate cache to ensure fresh data on next fetch
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error(`Error renaming collection group:`, error);
      return false;
    }
  }

  /**
   * Delete a collection group
   */
  async deleteCollectionGroup(groupName: string): Promise<boolean> {
    if (groupName === 'Default') return false;
    
    // Check authentication
    const isAuth = await this.isAuthenticated();
    if (!isAuth) return false;
    
    try {
      // Delete all cards in this group
      const { error } = await this.supabase
        .from('collections')
        .delete()
        .eq('group_name', groupName);
      
      if (error) throw error;
      
      // Remove from cache
      this.cache.groups.delete(groupName);
      
      // Invalidate cache to ensure fresh data on next fetch
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error(`Error deleting collection group:`, error);
      return false;
    }
  }
  
  /**
   * Invalidate cache to force refresh on next fetch
   */
  invalidateCache(): void {
    this.cache.lastFetched = null;
  }
} 