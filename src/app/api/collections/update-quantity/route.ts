import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

// PATCH: Update card quantity directly
export async function PATCH(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // 1. Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Parse request body
    const { cardId, collectionType, groupName, quantity } = await request.json();
    
    // Validate required fields
    if (!cardId) {
      return NextResponse.json({ error: 'Missing cardId' }, { status: 400 });
    }
    
    if (quantity === undefined || quantity < 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    // Default values
    const type = collectionType || 'have';
    const group = groupName || 'Default';

    // 3. Get the existing card record
    const { data: existingCard, error: getError } = await supabase
      .from('collections')
      .select('id, quantity')
      .eq('user_id', session.user.id)
      .eq('card_id', cardId)
      .eq('collection_type', type)
      .eq('group_name', group)
      .single();

    if (getError && getError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error checking for existing card:', getError);
      return NextResponse.json({ error: `Database error: ${getError.message}` }, { status: 500 });
    }

    // 4. Handle the update based on quantity and existing state
    if (quantity === 0 && existingCard) {
      // Delete the card if quantity is 0
      const { error: deleteError } = await supabase
        .from('collections')
        .delete()
        .eq('id', existingCard.id);

      if (deleteError) {
        console.error('Error deleting card:', deleteError);
        return NextResponse.json({ error: `Database error: ${deleteError.message}` }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Card removed successfully',
        quantity: 0,
        cardId,
        collectionType: type,
        groupName: group
      });
    } 
    else if (existingCard) {
      // Update existing card quantity
      const { error: updateError } = await supabase
        .from('collections')
        .update({ 
          quantity: quantity,
          added_at: new Date().toISOString() // Update timestamp
        })
        .eq('id', existingCard.id);

      if (updateError) {
        console.error('Error updating card quantity:', updateError);
        return NextResponse.json({ error: `Database error: ${updateError.message}` }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Card quantity updated successfully',
        quantity: quantity,
        cardId,
        collectionType: type,
        groupName: group
      });
    }
    else {
      // Card doesn't exist and quantity > 0, but we can't create it without card details
      return NextResponse.json({ 
        error: 'Card not found in collection',
        cardId,
        collectionType: type,
        groupName: group
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Unexpected error in PATCH /api/collections/update-quantity:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
