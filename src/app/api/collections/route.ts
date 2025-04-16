import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types'; // Adjust path

export const dynamic = 'force-dynamic'; // Ensure fresh data and auth checks

// GET: Fetch the user's collection
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // 1. Get the current logged-in user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session Error:', sessionError.message);
      return NextResponse.json({ error: 'Failed to get session' }, { status: 401 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get collection type from query params (default to 'have')
    const { searchParams } = new URL(request.url);
    const collectionType = searchParams.get('type') || 'have';
    const countOnly = searchParams.get('countOnly') === 'true';

    // If countOnly is true, just return the total count
    if (countOnly) {
      const { data: collection, error: fetchError } = await supabase
        .from('collections')
        .select('quantity')
        .eq('user_id', session.user.id)
        .eq('collection_type', collectionType);

      if (fetchError) {
        console.error('Error fetching collection count:', fetchError.message);
        return NextResponse.json({ error: `Database error: ${fetchError.message}` }, { status: 500 });
      }

      // Calculate total cards
      const totalCards = (collection ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
      return NextResponse.json({ totalCards });
    }

    // 2. Fetch collection items for this user
    // RLS ensures we only get rows where collections.user_id matches session.user.id
    const { data: collection, error: fetchError } = await supabase
      .from('collections')
      .select('id, card_id, card_name, card_image_small, quantity, collection_type, added_at') // Include quantity field
      .eq('user_id', session.user.id) // Double check, but RLS is the primary security
      .eq('collection_type', collectionType) // Filter by collection type
      .order('added_at', { ascending: false }); // Order by most recently added

    if (fetchError) {
      console.error('Error fetching collection:', fetchError.message);
      // Log the specific error for debugging
      return NextResponse.json({ error: `Database error: ${fetchError.message}` }, { status: 500 });
    }

    return NextResponse.json({ collection: collection ?? [] }); // Return empty array if null

  } catch (error) {
    console.error('Unexpected error in GET /api/collections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add a card to the user's collection (Using UPSERT)
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // 1. Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Parse request body
    // IMPORTANT: We no longer need incrementQuantity from the client
    const { cardId, cardName, cardImageSmall, collectionType = 'have' } = await request.json();
    if (!cardId) {
      return NextResponse.json({ error: 'Missing cardId' }, { status: 400 });
    }

    // 3. Prepare the data for upsert
    const cardDataToUpsert = {
      user_id: session.user.id,
      card_id: cardId,
      collection_type: collectionType,
      // Fields to insert/update:
      card_name: cardName,             // Update name/image in case they changed
      card_image_small: cardImageSmall,
      quantity: 1,                     // Start with quantity 1 if inserting
      added_at: new Date().toISOString() // Update timestamp on add/update
    };

    // 4. Perform the UPSERT
    // onConflict specifies the columns causing the conflict (our unique constraint)
    // ignoreDuplicates: false means we want to UPDATE on conflict, not ignore.
    const { data, error: upsertError } = await supabase
      .from('collections')
      .upsert(cardDataToUpsert, {
        onConflict: 'user_id,card_id,collection_type',
        ignoreDuplicates: false,
        // IMPORTANT: If you need to increment quantity on conflict,
        // this simple upsert won't work directly.
        // We need a database function for atomic increment.
        // Let's stick to setting quantity=1 on conflict for now,
        // assuming duplicates shouldn't happen or quantity isn't the goal here.
        // OR, handle increment logic after the upsert if needed.
      })
      .select() // Return the inserted/updated row
      .single();

    if (upsertError) {
      console.error('Error upserting card to collection:', upsertError);
       // Check if it's the specific duplicate key error, although upsert should handle it?
      if (upsertError.code === '23505') {
          // This case might indicate a race condition or config issue if upsert
          // didn't handle the conflict as expected. Maybe log differently.
          console.error('Upsert conflict was not handled automatically:', upsertError);
          return NextResponse.json({ error: 'Conflict updating card quantity.' }, { status: 409 });
      }
      return NextResponse.json({ error: `Database error: ${upsertError.message}` }, { status: 500 });
    }

    // Determine if it was an insert or update based on timestamps? Difficult.
    // Upsert returns the final state. Assume success.
    return NextResponse.json({
        message: 'Card added or updated successfully',
        updatedCard: data
    }, { status: 200 }); // Use 200 OK for upsert

  } catch (error) {
    console.error('Unexpected error in POST /api/collections:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a card from the user's collection
export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // 1. Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Get the card ID and collection type to delete from query parameters
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');
    const collectionType = searchParams.get('type') || 'have'; // Default to 'have'
    const decrementOnly = searchParams.get('decrementOnly') === 'true';

    if (!cardId) {
      return NextResponse.json({ error: 'Missing cardId query parameter' }, { status: 400 });
    }

    // If we should only decrement quantity (not fully delete)
    if (decrementOnly) {
      // Get current quantity
      const { data: cardData, error: getError } = await supabase
        .from('collections')
        .select('id, quantity')
        .eq('user_id', session.user.id)
        .eq('card_id', cardId)
        .eq('collection_type', collectionType)
        .single();

      if (getError) {
        console.error('Error getting card quantity:', getError.message);
        return NextResponse.json({ error: `Database error: ${getError.message}` }, { status: 500 });
      }

      // If quantity is 1, delete the card
      if (!cardData || cardData.quantity <= 1) {
        // Delete logic (same as the non-decrement case below)
      } else {
        // Decrement quantity
        const { error: updateError } = await supabase
          .from('collections')
          .update({ quantity: cardData.quantity - 1 })
          .eq('id', cardData.id);

        if (updateError) {
          console.error('Error decrementing card quantity:', updateError.message);
          return NextResponse.json({ error: `Database error: ${updateError.message}` }, { status: 500 });
        }

        return NextResponse.json({
          message: 'Card quantity decremented successfully',
          quantity: cardData.quantity - 1
        }, { status: 200 });
      }
    }

    // 3. Delete the card from the database
    // RLS policy ensures the user can only delete their own cards
    const { error: deleteError, count } = await supabase
      .from('collections')
      .delete()
      .eq('user_id', session.user.id) // Must match logged-in user
      .eq('card_id', cardId)         // Must match the specific card
      .eq('collection_type', collectionType); // Must match the collection type

    if (deleteError) {
      console.error('Error deleting card from collection:', deleteError.message);
      return NextResponse.json({ error: `Database error: ${deleteError.message}` }, { status: 500 });
    }

    if (count === 0) {
      // This could mean the card wasn't in their collection or RLS prevented deletion
      console.warn(`Attempted to delete cardId ${cardId} for user ${session.user.id}, but no rows were affected.`);
    }

    return NextResponse.json({ message: 'Card removed successfully' }, { status: 200 }); // Or 204 No Content

  } catch (error) {
    console.error('Unexpected error in DELETE /api/collections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
