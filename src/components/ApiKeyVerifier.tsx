'use client';

import { useEffect, useState } from 'react';
import { verifyAllApiKeys, getApiKeyStatus } from '@/lib/apiKeyVerification';

/**
 * Component that verifies API keys at application startup
 * This is a client component that runs once when the application loads
 */
export default function ApiKeyVerifier() {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Run verification once on component mount
    const runVerification = async () => {
      try {
        await verifyAllApiKeys();
        setVerified(true);
        
        // Check if there were any errors
        const status = getApiKeyStatus();
        if (status.pokemonTcgApiKey.error) {
          setError(status.pokemonTcgApiKey.error);
          
          // Log a warning to the console
          console.warn('Pokemon TCG API key issue detected:', status.pokemonTcgApiKey.error);
          console.warn('This may affect pricing data and API rate limits.');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error verifying API keys';
        setError(errorMessage);
        console.error('Error verifying API keys:', err);
      }
    };

    runVerification();
  }, []);

  // This component doesn't render anything visible
  return null;
}
