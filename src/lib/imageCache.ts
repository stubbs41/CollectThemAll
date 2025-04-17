/**
 * Image Cache Manager
 * 
 * This module handles downloading and caching images locally
 * from the Pokemon TCG API image URLs.
 */

// Cache configuration
const IMAGE_CACHE_PREFIX = 'pokemon_tcg_image_';
const IMAGE_CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

// IndexedDB configuration
const DB_NAME = 'PokemonTCGImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

/**
 * Opens the IndexedDB database
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event);
      reject('Error opening IndexedDB');
    };
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store for images
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Stores an image in the cache
 */
export async function cacheImage(url: string, blob: Blob): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Store the image with metadata
    await store.put({
      url,
      blob,
      timestamp: Date.now(),
      size: blob.size
    });
    
    console.log(`Image cached: ${url}`);
    
    // Clean up old images if cache is too large
    await cleanupCache();
  } catch (error) {
    console.error('Error caching image:', error);
  }
}

/**
 * Gets an image from the cache
 */
export async function getCachedImage(url: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      
      request.onerror = (event) => {
        console.error('Error getting cached image:', event);
        reject('Error getting cached image');
      };
      
      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        
        if (result) {
          // Check if the image is expired
          const isExpired = Date.now() - result.timestamp > IMAGE_CACHE_EXPIRY;
          
          if (isExpired) {
            console.log(`Cached image expired: ${url}`);
            // Delete the expired image
            deleteImage(url);
            resolve(null);
          } else {
            console.log(`Image found in cache: ${url}`);
            resolve(result.blob);
          }
        } else {
          console.log(`Image not found in cache: ${url}`);
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('Error getting cached image:', error);
    return null;
  }
}

/**
 * Deletes an image from the cache
 */
async function deleteImage(url: string): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await store.delete(url);
    console.log(`Image deleted from cache: ${url}`);
  } catch (error) {
    console.error('Error deleting image:', error);
  }
}

/**
 * Cleans up the cache by removing old images if the cache is too large
 */
async function cleanupCache(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Get all images
    const request = store.getAll();
    
    request.onsuccess = async (event) => {
      const images = (event.target as IDBRequest).result;
      
      // Calculate total size
      const totalSize = images.reduce((sum, image) => sum + image.size, 0);
      
      if (totalSize > MAX_CACHE_SIZE) {
        console.log(`Cache size (${totalSize} bytes) exceeds limit (${MAX_CACHE_SIZE} bytes). Cleaning up...`);
        
        // Sort images by timestamp (oldest first)
        images.sort((a, b) => a.timestamp - b.timestamp);
        
        let sizeToFree = totalSize - MAX_CACHE_SIZE;
        
        // Delete oldest images until we free up enough space
        for (const image of images) {
          if (sizeToFree <= 0) break;
          
          await deleteImage(image.url);
          sizeToFree -= image.size;
        }
      }
    };
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
}

/**
 * Loads an image with caching
 */
export async function loadImageWithCache(url: string): Promise<string> {
  try {
    // Try to get from cache first
    const cachedImage = await getCachedImage(url);
    
    if (cachedImage) {
      // Create object URL from cached blob
      return URL.createObjectURL(cachedImage);
    }
    
    // If not in cache, fetch from URL
    console.log(`Fetching image from URL: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Cache the image
    await cacheImage(url, blob);
    
    // Return object URL
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error loading image with cache:', error);
    // Return original URL as fallback
    return url;
  }
}

/**
 * Creates an image component that uses the cache
 */
export function CachedImage({ src, alt, className, onLoad, onError }: {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}): JSX.Element {
  // Use React's useState and useEffect to handle the cached image
  const [cachedSrc, setCachedSrc] = React.useState<string>(src);
  
  React.useEffect(() => {
    let isMounted = true;
    
    const loadImage = async () => {
      try {
        const cachedUrl = await loadImageWithCache(src);
        
        if (isMounted) {
          setCachedSrc(cachedUrl);
          onLoad?.();
        }
      } catch (error) {
        console.error('Error loading cached image:', error);
        
        if (isMounted) {
          onError?.();
        }
      }
    };
    
    loadImage();
    
    return () => {
      isMounted = false;
    };
  }, [src, onLoad, onError]);
  
  return (
    <img
      src={cachedSrc}
      alt={alt}
      className={className}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
