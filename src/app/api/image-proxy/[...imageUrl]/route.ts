import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import os from 'os'; // Import os module

// Define the cache directory path using /tmp for Vercel compatibility
const CACHE_DIR = path.join(os.tmpdir(), '.imageCache');
const PLACEHOLDER_PATH = path.resolve(process.cwd(), 'public/placeholder-card.png');
const TMP_PLACEHOLDER_PATH = path.join(os.tmpdir(), 'placeholder-card.png');

// Ensure the cache directory exists
async function ensureCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create image cache directory:', error);
        // Decide if you want to throw or handle this gracefully
        // For now, we'll log and potentially fail later if writing fails.
    }
}

// Ensure the directory is created when the server starts
ensureCacheDir();

// Check if the fallback image exists, and if not, create a simple one
async function ensurePlaceholderImage() {
    try {
        await fs.access(PLACEHOLDER_PATH);
    } catch (accessError) {
        // Placeholder not in public, try creating in /tmp if needed, but prioritize using the public one if possible.
        console.warn('Placeholder image not found in public. Ensure it exists at: ' + PLACEHOLDER_PATH);
        // Attempting to ensure placeholder exists in /tmp as a last resort, though this is less ideal.
        try {
            await fs.access(TMP_PLACEHOLDER_PATH);
        } catch {
             try {
                 // Copy from public if available, otherwise log error. Should ideally exist in public.
                 await fs.copyFile(PLACEHOLDER_PATH, TMP_PLACEHOLDER_PATH);
             } catch (copyError) {
                  console.error('Failed to copy placeholder to /tmp and it does not exist in public. Placeholder functionality might fail.', copyError);
             }
        }
    }
}

// Ensure placeholder is available when the server starts
ensurePlaceholderImage();

export async function GET(
    request: NextRequest,
    context: { params: { imageUrl: string[] } }
) {
    // Await the params object from context before accessing properties
    const params = await context.params;
    // Access params just before use
    const encodedImageUrl = params.imageUrl.join('/');
    let originalUrl: string;

    try {
        // Access params just before use
        originalUrl = decodeURIComponent(encodedImageUrl);
        // Basic validation for the URL format
        if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
            throw new Error('Invalid URL format');
        }
        // Restrict to the expected domain for security
        if (!originalUrl.includes('images.pokemontcg.io')) {
             return NextResponse.json({ error: 'Invalid image domain' }, { status: 400 });
        }

    } catch (error) {
        console.error('Error decoding image URL:', error);
        return NextResponse.json({ error: 'Invalid image URL parameter' }, { status: 400 });
    }

    // Generate a safe filename for caching (e.g., hash the URL or use a structured path)
    // Using a simple approach: replace non-alphanumeric chars. Consider hashing for robustness.
    const cacheFileName = originalUrl
        .replace(/^https?:\/\//, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_'); // Remove the hardcoded + '.png'
    const cacheFilePath = path.join(CACHE_DIR, cacheFileName);
    
    // Check for special case of known missing image
    const isMarkedAsMissing = cacheFileName.endsWith('_MISSING');
    if (isMarkedAsMissing) {
        return servePlaceholderImage();
    }

    try {
        // 1. Check if the image exists in the cache
        await fs.access(cacheFilePath);
        console.log(`[Image Cache] HIT: ${originalUrl}`);
        // Serve the cached file
        const fileBuffer = await fs.readFile(cacheFilePath);
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'image/png', // Adjust content type if needed
                'Cache-Control': 'public, max-age=31536000, immutable', // Cache aggressively
            },
        });
    } catch (error) {
        // Check if it's an error object with a code property
        if (error && typeof error === 'object' && 'code' in error) {
            const fsError = error as { code: string }; // Type assertion
            // 2. If not in cache (fs.access throws error), fetch and cache it
            if (fsError.code === 'ENOENT') {
                console.log(`[Image Cache] MISS: ${originalUrl}`);
                try {
                    const response = await fetch(originalUrl);
                    
                    // Check if response is ok and is an image
                    if (!response.ok) {
                        console.warn(`[Image Cache] Image not found: ${originalUrl} (${response.status})`);
                        
                        // Mark this URL as known missing for future requests
                        const missingMarker = path.join(CACHE_DIR, cacheFileName + '_MISSING');
                        await fs.writeFile(missingMarker, 'This URL returns an error');
                        
                        // Serve fallback placeholder
                        return servePlaceholderImage();
                    }
                    
                    // Verify content type is an image
                    const contentType = response.headers.get('Content-Type') || '';
                    if (!contentType.startsWith('image/')) {
                        console.warn(`[Image Cache] Not an image: ${originalUrl} (${contentType})`);
                        
                        // Mark this URL as known missing for future requests
                        const missingMarker = path.join(CACHE_DIR, cacheFileName + '_MISSING');
                        await fs.writeFile(missingMarker, 'Content type is not an image');
                        
                        // Serve fallback placeholder
                        return servePlaceholderImage();
                    }
                    
                    if (!response.body) {
                        throw new Error(`No response body received for ${originalUrl}`);
                    }

                    // Ensure directory exists (might have failed initially)
                    await ensureCacheDir();

                    // Clone the response so we can use one for streaming to client and one for caching
                    const clonedResponse = response.clone();
                    
                    // Start a background task to cache the image (don't await it)
                    cacheImageInBackground(clonedResponse.body as unknown as NodeJS.ReadableStream, cacheFilePath, cacheFileName)
                        .catch(err => console.error(`[Image Cache] Error caching in background: ${err.message}`));

                    // Return the original response directly to the client without waiting for caching
                    return new NextResponse(response.body, {
                        status: 200,
                        headers: {
                            'Content-Type': contentType || 'image/png',
                            'Cache-Control': 'public, max-age=31536000, immutable',
                        },
                    });

                } catch (fetchError) {
                    console.error(`[Image Cache] FAILED to fetch ${originalUrl}:`, fetchError);
                    // Serve the placeholder image instead
                    return servePlaceholderImage();
                }
            } else {
                // Handle non-filesystem errors or errors without a code
                console.error(`[Image Cache] Unexpected error for ${cacheFilePath}:`, error);
                return servePlaceholderImage();
            }
        } else {
            // Handle non-filesystem errors or errors without a code
            console.error(`[Image Cache] Unexpected error for ${cacheFilePath}:`, error);
            return servePlaceholderImage();
        }
    }
}

/**
 * Function to cache an image in the background without blocking the response
 */
async function cacheImageInBackground(responseBody: NodeJS.ReadableStream, cacheFilePath: string, cacheFileName: string) {
    try {
        // Stream the image data to the file system
        await pipeline(
            responseBody,
            (await fs.open(cacheFilePath, 'w')).createWriteStream()
        );
        console.log(`[Image Cache] SAVED: ${cacheFileName}`);
    } catch (error) {
        console.error(`[Image Cache] Failed to cache in background: ${cacheFilePath}`, error);
        // Optionally clean up partially written file if saving failed
        try { await fs.unlink(cacheFilePath); } catch { /* ignore cleanup error */ }
    }
}

/**
 * Helper function to serve the placeholder image
 */
async function servePlaceholderImage() {
    let placeholderToServe = PLACEHOLDER_PATH;
    try {
        // Prefer serving from public
        await fs.access(PLACEHOLDER_PATH);
    } catch {
        // Fallback to /tmp if public one isn't accessible (less ideal, should be fixed in deployment)
        console.warn('Serving placeholder from /tmp as public one is inaccessible.');
        placeholderToServe = TMP_PLACEHOLDER_PATH;
    }

    try {
        const placeholderBuffer = await fs.readFile(placeholderToServe);
        return new NextResponse(placeholderBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=3600', // Cache for an hour
            },
        });
    } catch (error) {
        // If that fails too, return a simple error
        console.error('Failed to read placeholder image from both public and /tmp:', error);
        return NextResponse.json(
            { error: 'The requested resource isn\'t a valid image and placeholder is missing' },
            { status: 404 }
        );
    }
} 