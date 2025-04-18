import { NextResponse } from 'next/server';
import { findCardByID } from 'pokemon-tcg-sdk-typescript/dist/sdk';

/**
 * API route for verifying that the Pokemon TCG API key is working
 * This is used at application startup to detect and report any issues with the API key
 */
export async function GET() {
  // Get API key from environment variables
  const apiKey = process.env.POKEMON_TCG_API_KEY || '';

  // Check if API key is configured
  if (!apiKey) {
    console.warn('[Server] Pokemon TCG API key is not configured in environment variables');
    return NextResponse.json({
      success: false,
      error: 'Pokemon TCG API key is not configured in environment variables',
      configured: false,
    });
  }

  try {
    // Make a test request to the Pokemon TCG API
    // We'll use multiple well-known card IDs that should always exist
    // and try them in sequence until one works
    const testCardIds = [
      'sv3-1',    // Scarlet & Violet
      'swsh1-1',  // Sword & Shield
      'sm1-1',    // Sun & Moon
      'xy1-1',    // XY
      'base1-4'   // Charizard from Base Set (fallback)
    ];

    // Start with the first card ID
    let testCardId = testCardIds[0];

    // Configure the SDK with the API key
    const headers = {
      'X-Api-Key': apiKey,
    };

    console.log('[Server] Verifying Pokemon TCG API key with test request...');

    // Try each card ID in sequence until one works
    let response;
    let success = false;
    let lastError = '';

    for (const cardId of testCardIds) {
      try {
        console.log(`[Server] Trying to verify API key with card ID: ${cardId}`);

        // Make a direct request to the API to test the key
        response = await fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`, {
          headers,
          // Add a cache: 'no-store' to ensure we're not getting a cached response
          cache: 'no-store',
        });

        if (response.ok) {
          // If the response is OK, the API key is working
          console.log(`[Server] API key verification successful with card ID: ${cardId}`);
          success = true;
          break;
        } else {
          lastError = `${response.status} ${response.statusText}`;
          console.warn(`[Server] API key verification failed with card ID ${cardId}: ${lastError}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`[Server] Error verifying API key with card ID ${cardId}: ${lastError}`);
      }
    }

    if (!success) {
      // If none of the card IDs worked, the API key is not working
      console.error(`[Server] API key verification failed after trying all card IDs: ${lastError}`);
      return NextResponse.json({
        success: false,
        error: `API key verification failed: ${lastError}`,
        configured: true,
        statusCode: response?.status || 500,
      });
    }

    // Try to parse the response to make sure it's valid
    const data = await response.json();

    if (!data || !data.data) {
      console.error('[Server] API key verification failed: Invalid response format');
      return NextResponse.json({
        success: false,
        error: 'API key verification failed: Invalid response format',
        configured: true,
      });
    }

    // If we get here, the API key is working
    console.log('[Server] Pokemon TCG API key verified successfully');
    return NextResponse.json({
      success: true,
      configured: true,
      message: 'Pokemon TCG API key verified successfully',
    });
  } catch (error) {
    // If there's an error, the API key is not working
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Server] Error verifying API key: ${errorMessage}`);

    return NextResponse.json({
      success: false,
      error: `Error verifying API key: ${errorMessage}`,
      configured: true,
    });
  }
}
