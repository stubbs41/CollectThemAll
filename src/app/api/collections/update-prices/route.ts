import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/lib/database.types';
import { findCardsByIds } from '@/lib/pokemonTcgApi';

export const dynamic = 'force-dynamic';

// GET: Update market prices for a user's collection
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const groupName = url.searchParams.get('groupName');

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // If userId is provided, check if it matches the authenticated user
    if (userId && userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build the query to get cards that need price updates
    let query = supabase
      .from('collections')
      .select('card_id')
      .eq('user_id', session.user.id);

    // Add group filter if provided
    if (groupName) {
      query = query.eq('group_name', groupName);
    }

    // Get unique card IDs
    const { data: cards, error: cardsError } = await query;

    if (cardsError) {
      return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ message: 'No cards found to update' });
    }

    // Extract unique card IDs
    const uniqueCardIds = [...new Set(cards.map(card => card.card_id))];

    // Fetch current market prices from Pokemon TCG API
    const apiCards = await findCardsByIds(uniqueCardIds);

    if (!apiCards || apiCards.length === 0) {
      return NextResponse.json({ message: 'No card data found from API' });
    }

    // Create a map of card ID to market price
    const priceMap = new Map();
    apiCards.forEach(card => {
      if (card.tcgplayer?.prices) {
        // Get the highest price from available variants
        let highestPrice = 0;

        // Check normal price
        if (card.tcgplayer.prices.normal?.market) {
          highestPrice = Math.max(highestPrice, card.tcgplayer.prices.normal.market);
        }

        // Check holofoil price
        if (card.tcgplayer.prices.holofoil?.market) {
          highestPrice = Math.max(highestPrice, card.tcgplayer.prices.holofoil.market);
        }

        // Check reverse holofoil price
        if (card.tcgplayer.prices.reverseHolofoil?.market) {
          highestPrice = Math.max(highestPrice, card.tcgplayer.prices.reverseHolofoil.market);
        }

        // Check 1st Edition price
        if (card.tcgplayer.prices.firstEdition?.market) {
          highestPrice = Math.max(highestPrice, card.tcgplayer.prices.firstEdition.market);
        }

        // Check unlimited price
        if (card.tcgplayer.prices.unlimited?.market) {
          highestPrice = Math.max(highestPrice, card.tcgplayer.prices.unlimited.market);
        }

        if (highestPrice > 0) {
          priceMap.set(card.id, highestPrice);
        }
      }
    });

    // Update prices in the database
    let updatedCount = 0;
    const updatePromises = [];

    for (const [cardId, price] of priceMap.entries()) {
      const updatePromise = supabase
        .from('collections')
        .update({ market_price: price })
        .eq('user_id', session.user.id)
        .eq('card_id', cardId)
        .then(({ error }) => {
          if (!error) {
            updatedCount++;
          } else {
            console.error(`Error updating price for card ${cardId}:`, error);
          }
        });

      updatePromises.push(updatePromise);
    }

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    // Update collection values
    try {
      // Fetch all collection groups
      const { data: groups, error: groupsError } = await supabase
        .from('collection_groups')
        .select('id, name')
        .eq('user_id', session.user.id);

      if (groupsError) throw groupsError;
      if (!groups || groups.length === 0) return;

      // Process each group
      for (const group of groups) {
        // Calculate have value
        const { data: haveData, error: haveError } = await supabase
          .from('collections')
          .select('card_id, quantity, market_price')
          .eq('user_id', session.user.id)
          .eq('group_name', group.name)
          .eq('collection_type', 'have');

        if (haveError) throw haveError;

        // Calculate want value
        const { data: wantData, error: wantError } = await supabase
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
        const { error: updateError } = await supabase
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

    return NextResponse.json({
      message: 'Market prices updated successfully',
      updated: updatedCount,
      total: uniqueCardIds.length
    });

  } catch (error) {
    console.error('Error updating market prices:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
}
