/**
 * API Key Verification Utility
 * 
 * This module provides functions to verify that API keys are properly configured
 * and working correctly. It's used at application startup to detect and report
 * any issues with API keys.
 */

// Flag to track if verification has been run
let verificationRun = false;

// Status of API keys
export const apiKeyStatus = {
  pokemonTcgApiKey: {
    configured: false,
    working: false,
    lastChecked: null as Date | null,
    error: null as string | null,
  }
};

/**
 * Verifies that the Pokemon TCG API key is properly configured and working
 */
export async function verifyPokemonTcgApiKey(): Promise<boolean> {
  try {
    // Check if the API key is configured in the environment
    const apiKeyConfigured = !!process.env.POKEMON_TCG_API_KEY;
    apiKeyStatus.pokemonTcgApiKey.configured = apiKeyConfigured;
    
    if (!apiKeyConfigured) {
      apiKeyStatus.pokemonTcgApiKey.error = 'Pokemon TCG API key is not configured in environment variables';
      console.warn('Pokemon TCG API key is not configured. API rate limits may apply.');
      return false;
    }
    
    // Make a test request to the API to verify the key is working
    const response = await fetch('/api/verify-api-key');
    const data = await response.json();
    
    apiKeyStatus.pokemonTcgApiKey.working = data.success;
    apiKeyStatus.pokemonTcgApiKey.lastChecked = new Date();
    
    if (!data.success) {
      apiKeyStatus.pokemonTcgApiKey.error = data.error || 'Unknown error verifying Pokemon TCG API key';
      console.error('Pokemon TCG API key verification failed:', data.error);
      return false;
    }
    
    console.log('Pokemon TCG API key verified successfully');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    apiKeyStatus.pokemonTcgApiKey.error = errorMessage;
    apiKeyStatus.pokemonTcgApiKey.lastChecked = new Date();
    console.error('Error verifying Pokemon TCG API key:', error);
    return false;
  }
}

/**
 * Runs verification for all API keys
 */
export async function verifyAllApiKeys(): Promise<void> {
  if (verificationRun) return;
  
  try {
    await verifyPokemonTcgApiKey();
    verificationRun = true;
  } catch (error) {
    console.error('Error verifying API keys:', error);
  }
}

/**
 * Gets the status of all API keys
 */
export function getApiKeyStatus(): typeof apiKeyStatus {
  return apiKeyStatus;
}
