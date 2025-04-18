/**
 * Utilities for handling market price updates
 */

// Cache key for last price update timestamp
const PRICE_UPDATE_TIMESTAMP_KEY = 'last_price_update_timestamp';

// Cache duration for prices (10 minutes in milliseconds)
export const PRICE_CACHE_DURATION = 10 * 60 * 1000;

/**
 * Check if prices need to be updated based on the last update timestamp
 * @returns {boolean} True if prices need to be updated, false otherwise
 */
export function shouldUpdatePrices(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const lastUpdateTimestamp = localStorage.getItem(PRICE_UPDATE_TIMESTAMP_KEY);

    if (!lastUpdateTimestamp) {
      return true; // No timestamp found, update needed
    }

    const lastUpdate = parseInt(lastUpdateTimestamp, 10);
    const now = Date.now();

    // Check if 10 minutes have passed since the last update
    return (now - lastUpdate) > PRICE_CACHE_DURATION;
  } catch (error) {
    console.error('Error checking price update timestamp:', error);
    return false; // Default to not updating on error
  }
}

/**
 * Update the last price update timestamp
 */
export function updatePriceTimestamp(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(PRICE_UPDATE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error updating price timestamp:', error);
  }
}

/**
 * Get the last price update timestamp
 * @returns {Date | null} The last update timestamp or null if not found
 */
export function getLastPriceUpdateTimestamp(): Date | null {
  if (typeof window === 'undefined') return null;

  try {
    const timestamp = localStorage.getItem(PRICE_UPDATE_TIMESTAMP_KEY);
    if (!timestamp) return null;

    return new Date(parseInt(timestamp, 10));
  } catch (error) {
    console.error('Error getting price update timestamp:', error);
    return null;
  }
}

/**
 * Format the last update time as a human-readable string
 * @returns {string} Human-readable last update time
 */
export function getLastUpdateTimeFormatted(): string {
  const timestamp = getLastPriceUpdateTimestamp();

  if (!timestamp) {
    return 'Never updated';
  }

  // Format the date
  return timestamp.toLocaleString();
}

/**
 * Get the time remaining until the next price update
 * @returns {string} Human-readable time remaining
 */
export function getTimeUntilNextUpdate(): string {
  const timestamp = getLastPriceUpdateTimestamp();

  if (!timestamp) {
    return 'Update needed';
  }

  const now = Date.now();
  const nextUpdate = timestamp.getTime() + PRICE_CACHE_DURATION;
  const timeRemaining = nextUpdate - now;

  if (timeRemaining <= 0) {
    return 'Update needed';
  }

  // Convert to hours and minutes
  const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
  const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

  return `${hours}h ${minutes}m`;
}
