import { createClient } from '@/lib/supabaseClient';
import { PokemonCard } from '@/lib/types';

export type CollectionType = 'have' | 'want';

export interface CollectionGroup {
  id: string;
  name: string;
  description?: string;
  have_value: number;
  want_value: number;
  total_value: number;
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
  market_price: number;
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
    groups: new Map(),
    lastFetched: null
  };

  // Cache expiration time in milliseconds (10 minutes)
  private CACHE_EXPIRATION = 10 * 60 * 1000;

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
    console.log('CollectionService: fetchCollections called');

    // Always invalidate cache to ensure we get fresh data
    this.invalidateCache();
    console.log('CollectionService: Cache invalidated to ensure fresh data');

    // Check authentication
    console.log('CollectionService: Checking authentication');
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) {
      console.log('CollectionService: No authenticated session found');
      return new Map();
    }

    console.log('CollectionService: User authenticated, fetching collections');

    try {
      // First, fetch all collection groups to ensure we have all groups in the cache
      console.log('CollectionService: Fetching collection groups');
      const { data: groups, error: groupsError } = await this.supabase
        .from('collection_groups')
        .select('name')
        .eq('user_id', session.user.id);

      if (groupsError) {
        console.error('CollectionService: Error fetching collection groups:', groupsError);
        throw groupsError;
      }

      console.log('CollectionService: Collection groups fetched:', groups?.length || 0);

      // Reset cache
      this.cache.groups = new Map();

      // Initialize cache with all groups from the database
      if (groups && groups.length > 0) {
        groups.forEach(group => {
          this.cache.groups.set(group.name, {
            have: new Map(),
            want: new Map()
          });
        });
      } else {
        // If no groups found, create a default group
        console.log('CollectionService: No groups found, creating Default group');
        this.cache.groups.set('Default', {
          have: new Map(),
          want: new Map()
        });
      }

      // Cache is now initialized with groups from the database

      // Fetch all collections
      console.log('CollectionService: Fetching all collections');
      const { data: allData, error: fetchError } = await this.supabase
        .from('collections')
        .select('*')
        .eq('user_id', session.user.id);

      if (fetchError) {
        console.error('CollectionService: Error fetching collections:', fetchError);
        throw fetchError;
      }

      console.log('CollectionService: Collections fetched:', allData?.length || 0);

      // Log sample data for debugging
      if (allData && allData.length > 0) {
        console.log('CollectionService: Sample collection item:', allData[0]);

        // Check if market_price is included in the response
        const hasPrices = allData.some(item => item.market_price !== undefined && item.market_price !== null);
        console.log(`CollectionService: Collection data includes market prices: ${hasPrices}`);

        // Count items with valid prices
        const itemsWithPrice = allData.filter(item => item.market_price && item.market_price > 0).length;
        console.log(`CollectionService: Items with valid prices: ${itemsWithPrice} of ${allData.length}`);
      }

      // Group collections by group_name
      if (allData && allData.length > 0) {
        allData.forEach(item => {
          const groupName = item.group_name || 'Default';

          // Ensure group exists in cache (should already be there from the groups fetch)
          if (!this.cache.groups.has(groupName)) {
            console.log(`CollectionService: Creating missing group in cache: ${groupName}`);
            this.cache.groups.set(groupName, {
              have: new Map(),
              want: new Map()
            });
          }

          const group = this.cache.groups.get(groupName)!;

          // Add item to appropriate collection type
          if (item.collection_type === 'have') {
            // Ensure market_price is a number
            if (item.market_price === null || item.market_price === undefined) {
              item.market_price = 0;
            }
            group.have.set(item.card_id, item);
          } else if (item.collection_type === 'want') {
            // Ensure market_price is a number
            if (item.market_price === null || item.market_price === undefined) {
              item.market_price = 0;
            }
            group.want.set(item.card_id, item);
          }
        });
      } else {
        console.log('CollectionService: No collections found');
      }

      this.cache.lastFetched = Date.now();
      console.log('CollectionService: Collections cached at', new Date(this.cache.lastFetched).toLocaleString());

      return this.cache.groups;
    } catch (error) {
      console.error('CollectionService: Error fetching collections:', error);
      return new Map();
    }
  }

  /**
   * Add a card to a collection
   */
  async addCard(
    card: PokemonCard,
    collectionType: CollectionType,
    groupName: string
  ): Promise<AddCardResult> {
    try {
      // Check authentication and get session
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session || !session.user) {
        console.error('No authenticated user session found');
        return { status: 'error', message: 'Authentication required' };
      }

      // Validate card object has required fields
      if (!card) {
        console.error('Card object is undefined or null');
        return { status: 'error', message: 'Invalid card data: Card object is missing' };
      }

      if (!card.id) {
        console.error('Card ID is missing from card object:', card);
        return { status: 'error', message: 'Invalid card data: Card ID is missing' };
      }

      const userId = session.user.id;
      const cardId = card.id;
      const cardName = card.name || 'Unknown Card';
      const cardImageSmall = card.images?.small || '';

      // Check if card already exists in this collection and group
      // Use maybeSingle() instead of single() to avoid 406 errors when no record is found
      const { data: existingCard, error: checkError } = await this.supabase
        .from('collections')
        .select('id, quantity')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .eq('collection_type', collectionType)
        .eq('group_name', groupName)
        .maybeSingle();

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
        this.updateCacheForCardChange(cardId, collectionType, groupName, newQuantity);
        this.invalidateCache();
        return { status: 'updated', newQuantity: newQuantity };
      } else {
        // Card doesn't exist, insert it
        const { data, error: insertError } = await this.supabase
          .from('collections')
          .insert({
            user_id: userId,
            card_id: cardId,
            card_name: cardName,
            card_image_small: cardImageSmall,
            collection_type: collectionType,
            group_name: groupName,
            quantity: 1
          })
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('Error inserting new card:', insertError);
          throw new Error(`Database insert error: ${insertError.message}`);
        }

        // Update cache
        this.updateCacheForCardChange(cardId, collectionType, groupName, 1, data);
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
    groupName: string,
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
    groupName: string,
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
        .maybeSingle();

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
    groupName: string
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
        .maybeSingle();

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
    groupName: string
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
        .maybeSingle();

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
  async createCollectionGroup(groupName: string, description?: string): Promise<{ success: boolean, id?: string, error?: string }> {
    if (!groupName.trim()) return { success: false, error: 'Group name cannot be empty' };

    // Check authentication
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      // Check if group already exists
      const { data: existingGroup, error: checkError } = await this.supabase
        .from('collection_groups')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', groupName)
        .maybeSingle();

      if (existingGroup) {
        return { success: false, error: 'A collection group with this name already exists' };
      }

      // Create new group in database
      const { data: newGroup, error: insertError } = await this.supabase
        .from('collection_groups')
        .insert({
          user_id: session.user.id,
          name: groupName,
          description: description || null,
          have_value: 0,
          want_value: 0,
          total_value: 0
        })
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('Error creating collection group:', insertError);
        return { success: false, error: insertError.message };
      }

      // Add the group to cache
      if (!this.cache.groups.has(groupName)) {
        this.cache.groups.set(groupName, {
          have: new Map(),
          want: new Map()
        });
      }

      return { success: true, id: newGroup.id };
    } catch (error: any) {
      console.error('Error creating collection group:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rename a collection group
   */
  async renameCollectionGroup(oldName: string, newName: string, description?: string): Promise<{ success: boolean, error?: string }> {
    if (!oldName.trim() || !newName.trim()) {
      return { success: false, error: 'Group names cannot be empty' };
    }

    if (oldName === 'Default') {
      return { success: false, error: 'Cannot rename the Default collection group' };
    }

    // Check authentication
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      // Check if new name already exists
      const { data: existingGroup, error: checkError } = await this.supabase
        .from('collection_groups')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', newName)
        .maybeSingle();

      if (existingGroup) {
        return { success: false, error: 'A collection group with this name already exists' };
      }

      // Get the group ID
      const { data: groupData, error: groupError } = await this.supabase
        .from('collection_groups')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', oldName)
        .maybeSingle();

      if (groupError || !groupData) {
        return { success: false, error: 'Collection group not found' };
      }

      // Update the group name in collection_groups table
      const { error: updateGroupError } = await this.supabase
        .from('collection_groups')
        .update({
          name: newName,
          description: description !== undefined ? description : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupData.id);

      if (updateGroupError) {
        throw updateGroupError;
      }

      // Update all cards in this group
      const { error: updateCardsError } = await this.supabase
        .from('collections')
        .update({ group_name: newName })
        .eq('user_id', session.user.id)
        .eq('group_name', oldName);

      if (updateCardsError) {
        throw updateCardsError;
      }

      // Update cache
      if (this.cache.groups.has(oldName)) {
        const groupData = this.cache.groups.get(oldName)!;
        this.cache.groups.set(newName, groupData);
        this.cache.groups.delete(oldName);
      }

      // Invalidate cache to ensure fresh data on next fetch
      this.invalidateCache();
      return { success: true };
    } catch (error: any) {
      console.error(`Error renaming collection group:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a collection group
   */
  async deleteCollectionGroup(groupName: string): Promise<{ success: boolean, error?: string }> {
    if (!groupName.trim()) {
      return { success: false, error: 'Group name cannot be empty' };
    }

    if (groupName === 'Default') {
      return { success: false, error: 'Cannot delete the Default collection group' };
    }

    // Check authentication
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      // Get the group ID
      const { data: groupData, error: groupError } = await this.supabase
        .from('collection_groups')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', groupName)
        .single();

      if (groupError || !groupData) {
        return { success: false, error: 'Collection group not found' };
      }

      // Delete all cards in this group
      const { error: deleteCardsError } = await this.supabase
        .from('collections')
        .delete()
        .eq('user_id', session.user.id)
        .eq('group_name', groupName);

      if (deleteCardsError) {
        throw deleteCardsError;
      }

      // Delete the group
      const { error: deleteGroupError } = await this.supabase
        .from('collection_groups')
        .delete()
        .eq('id', groupData.id);

      if (deleteGroupError) {
        throw deleteGroupError;
      }

      // Update cache
      this.cache.groups.delete(groupName);

      // Invalidate cache to ensure fresh data on next fetch
      this.invalidateCache();
      return { success: true };
    } catch (error: any) {
      console.error(`Error deleting collection group:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch collection groups from the database
   */
  async fetchCollectionGroups(): Promise<any[]> {
    console.log('CollectionService: fetchCollectionGroups called');

    // Check authentication
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) {
      console.log('CollectionService: No authenticated session found for fetchCollectionGroups');
      return [];
    }

    try {
      console.log('CollectionService: Fetching collection groups for user:', session.user.id);
      // Fetch all collection groups
      const { data: groups, error } = await this.supabase
        .from('collection_groups')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name');

      if (error) {
        console.error('CollectionService: Error fetching collection groups:', error);
        throw error;
      }

      // Return the groups as is
      if (!groups || groups.length === 0) {
        console.log('CollectionService: No collection groups found');

        // Create a default group if none exists
        console.log('CollectionService: Creating default collection group');
        const result = await this.createCollectionGroup('Default', 'Default collection group');
        if (result.success && result.id) {
          console.log('CollectionService: Default group created with ID:', result.id);
          // Fetch the newly created group
          const { data: newGroups } = await this.supabase
            .from('collection_groups')
            .select('*')
            .eq('id', result.id);

          return newGroups || [];
        }

        return [];
      }

      console.log('CollectionService: Fetched', groups.length, 'collection groups');
      return groups;
    } catch (error) {
      console.error('CollectionService: Error fetching collection groups:', error);
      return [];
    }
  }

  /**
   * Calculate and update collection values
   */
  async updateCollectionValues(): Promise<void> {
    // Check authentication
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) return;

    try {
      // Fetch all collection groups
      const { data: groups, error: groupsError } = await this.supabase
        .from('collection_groups')
        .select('id, name')
        .eq('user_id', session.user.id);

      if (groupsError) throw groupsError;
      if (!groups || groups.length === 0) return;

      // Process each group
      for (const group of groups) {
        // Calculate have value
        const { data: haveData, error: haveError } = await this.supabase
          .from('collections')
          .select('card_id, quantity, market_price')
          .eq('user_id', session.user.id)
          .eq('group_name', group.name)
          .eq('collection_type', 'have');

        if (haveError) throw haveError;

        // Calculate want value
        const { data: wantData, error: wantError } = await this.supabase
          .from('collections')
          .select('card_id, quantity, market_price')
          .eq('user_id', session.user.id)
          .eq('group_name', group.name)
          .eq('collection_type', 'want');

        if (wantError) throw wantError;

        // Calculate values
        const haveValue = haveData ? haveData.reduce((sum, item) => sum + (item.market_price || 0) * (item.quantity || 1), 0) : 0;
        const wantValue = wantData ? wantData.reduce((sum, item) => sum + (item.market_price || 0) * (item.quantity || 1), 0) : 0;
        const totalValue = haveValue + wantValue;

        // Update group values
        const { error: updateError } = await this.supabase
          .from('collection_groups')
          .update({
            have_value: haveValue,
            want_value: wantValue,
            total_value: totalValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', group.id);

        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error updating collection values:', error);
    }
  }

  /**
   * Create a shared collection link
   */
  async createSharedCollection(
    groupName: string,
    sharingLevel: 'group' | 'have' | 'want',
    expiresInDays: number = 7,
    options?: {
      is_collaborative?: boolean;
      password?: string;
      permission_level?: 'read' | 'write';
      allow_comments?: boolean;
    }
  ): Promise<{ success: boolean, shareId?: string, error?: string }> {
    if (!groupName.trim()) {
      return { success: false, error: 'Group name cannot be empty' };
    }

    // Check authentication
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      // First check if the collection group exists
      const { data: groupData, error: groupError } = await this.supabase
        .from('collection_groups')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', groupName)
        .maybeSingle();

      if (groupError) {
        console.error('Error checking collection group:', groupError);
        return { success: false, error: 'Collection group not found' };
      }

      // Fetch the collection data based on sharing level
      let collectionData: any[] = [];
      let collectionType = '';

      if (sharingLevel === 'group') {
        // Share both have and want collections
        const { data, error } = await this.supabase
          .from('collections')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('group_name', groupName);

        if (error) throw error;
        collectionData = data || [];
        collectionType = 'all';
      } else {
        // Share only have or want collection
        const { data, error } = await this.supabase
          .from('collections')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('group_name', groupName)
          .eq('collection_type', sharingLevel);

        if (error) throw error;
        collectionData = data || [];
        collectionType = sharingLevel;
      }

      // Generate a unique share ID
      const shareId = crypto.randomUUID();

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Create shared collection record - only include fields that exist in the schema
      const { data: sharedCollection, error: createError } = await this.supabase
        .from('shared_collections')
        .insert({
          user_id: session.user.id,
          share_id: shareId,
          group_name: groupName,
          collection_name: groupName,
          collection_type: collectionType,
          data: collectionData,
          expires_at: expiresAt.toISOString(),
          status: 'active',
          view_count: 0,
          sharing_level: sharingLevel
          // Omit fields that don't exist in the schema
          // is_collaborative: options?.is_collaborative || false,
          // password_protected: !!options?.password,
          // password_hash: options?.password ? await this.hashPassword(options.password) : null,
          // sharing_permission: options?.permission_level || 'read',
          // allow_comments: options?.allow_comments || false
        })
        .select()
        .maybeSingle();

      if (createError) throw createError;

      return { success: true, shareId };
    } catch (error: any) {
      console.error('Error creating shared collection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import a collection from data
   */
  async importCollection(
    data: any[],
    targetGroupName: string,
    createNewGroup: boolean = false
  ): Promise<{ success: boolean, error?: string }> {
    // Check authentication
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, error: 'Authentication required' };
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return { success: false, error: 'No valid data to import' };
    }

    try {
      // If creating a new group, check if it already exists
      if (createNewGroup && targetGroupName !== 'Default') {
        const { data: existingGroup } = await this.supabase
          .from('collection_groups')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('name', targetGroupName)
          .maybeSingle();

        if (!existingGroup) {
          // Create the new group
          const result = await this.createCollectionGroup(targetGroupName);
          if (!result.success) {
            return { success: false, error: result.error || 'Failed to create collection group' };
          }
        }
      }

      // Process each item in the data
      const importPromises = data.map(async (item) => {
        // Validate item has required fields
        if (!item.card_id) {
          console.warn('Skipping invalid import item (missing card_id):', item);
          return;
        }

        // If collection_type is missing, use the default 'have' type
        const collectionType = item.collection_type || 'have';

        // Check if card already exists in this collection and group
        const { data: existingCard } = await this.supabase
          .from('collections')
          .select('id, quantity')
          .eq('user_id', session.user.id)
          .eq('card_id', item.card_id)
          .eq('collection_type', collectionType)
          .eq('group_name', targetGroupName)
          .single();

        if (existingCard) {
          // Update existing card
          await this.supabase
            .from('collections')
            .update({
              quantity: (item.quantity || 1) + (existingCard.quantity || 1),
              market_price: item.market_price || 0,
              added_at: new Date().toISOString()
            })
            .eq('id', existingCard.id);
        } else {
          // Insert new card
          await this.supabase
            .from('collections')
            .insert({
              user_id: session.user.id,
              card_id: item.card_id,
              card_name: item.card_name || 'Unknown Card',
              card_image_small: item.card_image_small || '',
              collection_type: collectionType,
              group_name: targetGroupName,
              quantity: item.quantity || 1,
              market_price: item.market_price || 0
            });
        }
      });

      await Promise.all(importPromises);

      // Update collection values
      await this.updateCollectionValues();

      // Invalidate cache
      this.invalidateCache();

      return { success: true };
    } catch (error: any) {
      console.error('Error importing collection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export a collection to data
   */
  async exportCollection(
    groupName: string,
    collectionType?: CollectionType
  ): Promise<{ success: boolean, data?: any[], error?: string }> {
    // Check authentication
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      let query = this.supabase
        .from('collections')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('group_name', groupName);

      if (collectionType) {
        query = query.eq('collection_type', collectionType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error exporting collection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update card market price
   */
  async updateCardMarketPrice(cardId: string, marketPrice: number): Promise<boolean> {
    if (!cardId || marketPrice < 0) return false;

    // Check authentication
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session || !session.user) return false;

    try {
      // Update all instances of this card
      const { error } = await this.supabase
        .from('collections')
        .update({ market_price: marketPrice })
        .eq('user_id', session.user.id)
        .eq('card_id', cardId);

      if (error) throw error;

      // Update collection values
      await this.updateCollectionValues();

      // Invalidate cache
      this.invalidateCache();

      return true;
    } catch (error) {
      console.error('Error updating card market price:', error);
      return false;
    }
  }

  /**
   * Invalidate cache to force refresh on next fetch
   */
  invalidateCache(): void {
    this.cache.lastFetched = null;
  }

  /**
   * Hash a password for storage
   */
  private async hashPassword(password: string): Promise<string> {
    // In a real implementation, you would use a proper password hashing library
    // For this example, we'll use a simple hash function
    return await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password)
    ).then(hash => {
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    });
  }
}