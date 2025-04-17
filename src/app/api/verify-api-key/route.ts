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
    return NextResponse.json({
      success: false,
      error: 'Pokemon TCG API key is not configured in environment variables',
      configured: false,
    });
  }
  
  try {
    // Make a test request to the Pokemon TCG API
    // We'll use a well-known card ID that should always exist
    const testCardId = 'base1-4'; // Charizard from Base Set
    
    // Configure the SDK with the API key
    const headers = {
      'X-Api-Key': apiKey,
    };
    
    // Make a direct request to the API to test the key
    const response = await fetch(`https://api.pokemontcg.io/v2/cards/${testCardId}`, {
      headers,
    });
    
    if (!response.ok) {
      // If the response is not OK, the API key is not working
      return NextResponse.json({
        success: false,
        error: `API key verification failed: ${response.status} ${response.statusText}`,
        configured: true,
        statusCode: response.status,
      });
    }
    
    // If we get here, the API key is working
    return NextResponse.json({
      success: true,
      configured: true,
      message: 'Pokemon TCG API key verified successfully',
    });
  } catch (error) {
    // If there's an error, the API key is not working
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: `Error verifying API key: ${errorMessage}`,
      configured: true,
    });
  }
}
