import { NextRequest, NextResponse } from 'next/server';
// Use the auth helper client for authenticated routes
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; 
import { cookies } from 'next/headers';
import { CollectionType } from '@/services/CollectionService';
import type { Database } from '@/lib/database.types'; // Import Database type if needed

interface ImportItem {
  card_id: string;
  card_name: string | null;
  card_image_small: string | null;
  quantity: number;
}

interface BulkImportRequest {
  collection_type: CollectionType;
  group_name: string;
  items: ImportItem[];
}

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const requestData: BulkImportRequest = await request.json();
    
    // Validate the collection type
    if (!requestData.collection_type) {
      return NextResponse.json({ error: 'Collection type is required' }, { status: 400 });
    }

    // Validate the group name
    const groupName = requestData.group_name || 'Default';
    
    // Validate the items
    if (!Array.isArray(requestData.items) || requestData.items.length === 0) {
      return NextResponse.json({ error: 'No items to import' }, { status: 400 });
    }

    // Create Supabase client using the Route Handler helper
    const cookieStore = cookies(); 
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore }); 

    // Get the current user session (this should work now)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date().toISOString();

    // Prepare items for bulk insert
    const itemsToInsert = requestData.items.map(item => ({
      user_id: userId,
      card_id: item.card_id,
      card_name: item.card_name,
      card_image_small: item.card_image_small,
      collection_type: requestData.collection_type,
      group_name: groupName,
      quantity: item.quantity || 1,
      added_at: now
    }));

    // First, check if any of these cards already exist in the collection
    const { data: existingCards, error: queryError } = await supabase
      .from('collections')
      .select('card_id, quantity')
      .eq('user_id', userId)
      .eq('collection_type', requestData.collection_type)
      .eq('group_name', groupName)
      .in('card_id', requestData.items.map(item => item.card_id));

    if (queryError) {
      console.error('Error checking existing cards:', queryError);
      return NextResponse.json({ error: 'Failed to check existing cards' }, { status: 500 });
    }

    // Create a map of existing cards for quick lookup
    const existingCardMap = new Map();
    existingCards?.forEach(card => {
      existingCardMap.set(card.card_id, card.quantity);
    });

    // Separate items into new cards and cards that need updating
    const newCards = [];
    const cardsToUpdate = [];

    for (const item of itemsToInsert) {
      if (existingCardMap.has(item.card_id)) {
        // Card exists, update quantity
        cardsToUpdate.push({
          card_id: item.card_id,
          user_id: userId,
          collection_type: requestData.collection_type,
          group_name: groupName,
          quantity: existingCardMap.get(item.card_id) + (item.quantity || 1),
          added_at: now
        });
      } else {
        // New card
        newCards.push(item);
      }
    }

    // Insert new cards
    let insertedCount = 0;
    if (newCards.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('collections')
        .insert(newCards)
        .select('id');

      if (insertError) {
        console.error('Error inserting new cards:', insertError);
        return NextResponse.json({ error: 'Failed to import new cards' }, { status: 500 });
      }

      insertedCount = insertedData?.length || 0;
    }

    // Update existing cards
    let updatedCount = 0;
    for (const card of cardsToUpdate) {
      const { error: updateError } = await supabase
        .from('collections')
        .update({ 
          quantity: card.quantity,
          added_at: card.added_at
        })
        .eq('user_id', card.user_id)
        .eq('card_id', card.card_id)
        .eq('collection_type', card.collection_type)
        .eq('group_name', card.group_name);

      if (updateError) {
        console.error('Error updating card:', updateError);
        continue;
      }

      updatedCount++;
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Imported ${insertedCount} new cards and updated ${updatedCount} existing cards`,
      importedCount: insertedCount + updatedCount
    });

  } catch (error: any) { // Add type annotation for error
    console.error('Error in bulk import:', error);
    return NextResponse.json({ error: error.message || 'Failed to process import' }, { status: 500 });
  }
} 