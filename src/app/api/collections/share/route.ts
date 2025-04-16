import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { CollectionType } from '@/services/CollectionService';
import { Database } from '@/lib/database.types';
import { createRouteClient } from '@/lib/supabaseServerClient';

interface ShareItem {
  card_id: string;
  card_name: string | null;
  card_image_small: string | null;
  quantity: number;
}

interface ShareRequest {
  collection_type: CollectionType;
  group_name: string;
  collection_name: string;
  exported_at?: string;
  items: ShareItem[];
  expires_in: '1h' | '1d' | '7d' | '30d' | 'never';
  is_collaborative?: boolean;
  password?: string;
  permission_level?: 'read' | 'write';
  allow_comments?: boolean;
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const shareData: ShareRequest = await request.json();

    // Validate the data
    if (!shareData.collection_type || !Array.isArray(shareData.items) || shareData.items.length === 0 || !shareData.expires_in) {
      return NextResponse.json({ error: 'Invalid share data format (missing type, items, or expires_in)' }, { status: 400 });
    }

    // Create Supabase client with our singleton pattern
    const supabase = createRouteClient();

    // Check if authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'You must be logged in to share a collection' }, { status: 401 });
    }

    const userId = session.user.id;

    // Generate a unique share ID
    const shareId = uuidv4();

    // Calculate expires_at timestamp
    let expiresAt: string | null = null;
    const now = new Date();
    switch (shareData.expires_in) {
      case '1h':
        expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
        break;
      case '1d':
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30d':
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'never':
        expiresAt = null; // Set to null for never expires
        break;
      default:
        // Default to 30 days if invalid value provided
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Hash password if provided
    let passwordHash = null;
    if (shareData.password) {
      // In a real implementation, you would use a proper password hashing library
      // For this example, we'll use a simple hash function
      passwordHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(shareData.password)
      ).then(hash => {
        return Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      });
    }

    // Store the share data in the shared_collections table
    // Only include fields that exist in the database schema
    const { error } = await supabase
      .from('shared_collections')
      .insert({
        share_id: shareId,
        user_id: userId,
        collection_type: shareData.collection_type,
        group_name: shareData.group_name,
        collection_name: shareData.collection_name || shareData.group_name,
        data: shareData,
        created_at: now.toISOString(),
        expires_at: expiresAt
        // The following fields are not in the current database schema
        // is_collaborative: shareData.is_collaborative || false,
        // password_protected: !!shareData.password,
        // password_hash: passwordHash,
        // sharing_level: shareData.permission_level || 'read'
      });

    if (error) {
      // Log more details about the error object
      console.error('Error creating share (Supabase):',
        JSON.stringify({
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          error: error // Include the raw error too
        }, null, 2));
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? error.message : JSON.stringify(error);
      return NextResponse.json({ error: 'Failed to create share: ' + errorMessage }, { status: 500 });
    }

    // Generate the share URL
    const baseUrl = request.headers.get('origin') || request.nextUrl.origin;
    const shareUrl = `${baseUrl}/shared/${shareId}`;

    return NextResponse.json({
      success: true,
      shareId,
      shareUrl,
      expiresAt: expiresAt
    });

  } catch (error: any) {
    // Log more details about the error object
    console.error('Error in collection share (Catch Block):',
      JSON.stringify({
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        error: error // Include the raw error too
      }, null, 2));
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({
      error: 'Failed to process share request: ' + errorMessage
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const shareId = url.searchParams.get('id');

  if (!shareId) {
    return NextResponse.json({ error: 'Share ID is required' }, { status: 400 });
  }

  // Use our singleton pattern for the Supabase client
  const supabase = createRouteClient();

  try {
    // Retrieve only necessary fields + the data blob
    // Only select fields that exist in the database schema
    const { data: shareRecord, error } = await supabase
      .from('shared_collections')
      .select('share_id, user_id, collection_type, group_name, collection_name, data, created_at, expires_at')
      .eq('share_id', shareId)
      // .eq('status', 'active') // Status field doesn't exist in the schema
      .single();

    // Password protection is not implemented in the current schema
    // This code is left commented for future implementation
    /*
    // Check if the share is password protected
    if (shareRecord?.password_protected) {
      // Check if the user has verified the password
      const verificationCookie = request.cookies.get(`share_access_${shareId}`);

      if (!verificationCookie) {
        // Return limited information about the share
        return NextResponse.json({
          success: false,
          requires_password: true,
          share: {
            share_id: shareRecord.share_id,
            collection_name: shareRecord.collection_name,
            password_protected: true
          }
        });
      }
    }
    */

    if (error || !shareRecord) {
      console.error('Error retrieving share or share not active:', error);
      return NextResponse.json({ error: 'Share not found, expired, or revoked' }, { status: 404 });
    }

    // Log the retrieved share record for debugging
    console.log(`[Share GET ${shareId}] shareRecord.data type:`, typeof shareRecord.data);

    // Check if share has expired (only if expires_at is not null)
    if (shareRecord.expires_at && new Date(shareRecord.expires_at) < new Date()) {
      // Status field doesn't exist in the schema, so we can't mark it as expired
      // Instead, we'll just delete the expired share
      supabase.from('shared_collections').delete().eq('share_id', shareId)
        .then(({error: deleteError}) => {
           if(deleteError) console.error("Failed to delete expired share:", deleteError);
        });
      return NextResponse.json({ error: 'Share has expired' }, { status: 410 });
    }

    // Safely parse the data blob and validate structure
    let parsedItems: any[] = [];
    let originalExpiresIn = 'unknown';

    // Handle different data structures that might be stored
    if (shareRecord.data) {
      // Case 1: data is an object with items array (new format)
      if (typeof shareRecord.data === 'object' && (shareRecord.data as any).items && Array.isArray((shareRecord.data as any).items)) {
        parsedItems = (shareRecord.data as any).items;
        originalExpiresIn = (shareRecord.data as any).expires_in || 'unknown';
        console.log(`[Share GET ${shareId}] Successfully parsed items from data.items. Count: ${parsedItems.length}`);
      }
      // Case 2: data is an array itself (old format)
      else if (Array.isArray(shareRecord.data)) {
        parsedItems = shareRecord.data;
        console.log(`[Share GET ${shareId}] Successfully parsed items from data array. Count: ${parsedItems.length}`);
      }
      // Case 3: data is an object with a data property that is an array
      else if (typeof shareRecord.data === 'object' && (shareRecord.data as any).data && Array.isArray((shareRecord.data as any).data)) {
        parsedItems = (shareRecord.data as any).data;
        console.log(`[Share GET ${shareId}] Successfully parsed items from data.data. Count: ${parsedItems.length}`);
      }
      // No valid structure found
      else {
        console.error(`[Share GET ${shareId}] Invalid data structure:`, typeof shareRecord.data);

        // If we have collection data directly in the record, use that as a fallback
        if (shareRecord.collection_type && shareRecord.group_name) {
          // Try to fetch the collection data directly
          const { data: collectionData, error: collectionError } = await supabase
            .from('collections')
            .select('*')
            .eq('group_name', shareRecord.group_name)
            .eq('collection_type', shareRecord.collection_type);

          if (!collectionError && collectionData && collectionData.length > 0) {
            parsedItems = collectionData;
            console.log(`[Share GET ${shareId}] Recovered items from collections table. Count: ${parsedItems.length}`);
          } else {
            return NextResponse.json({ error: 'Shared data is corrupt and could not be recovered.' }, { status: 500 });
          }
        } else {
          return NextResponse.json({ error: 'Shared data is corrupt or missing items.' }, { status: 500 });
        }
      }
    } else {
      return NextResponse.json({ error: 'Shared data is missing.' }, { status: 500 });
    }

    // View count tracking is not implemented in the current schema
    // This code is left commented for future implementation
    /*
    // Increment view count now that we know it's a valid view
    supabase.rpc('increment_share_view_count', { share_id_to_update: shareId })
      .then(({ error: rpcError }) => {
        if (rpcError) console.error('Error incrementing view count:', rpcError);
      });
    */

    // Construct the final response object precisely
    // Only include fields that exist in the database schema
    const responseData = {
        share_id: shareRecord.share_id,
        collection_name: shareRecord.collection_name,
        group_name: shareRecord.group_name,
        collection_type: shareRecord.collection_type,
        created_at: shareRecord.created_at,
        expires_at: shareRecord.expires_at,
        expires_in: originalExpiresIn, // Send back the original duration setting
        // Fields that don't exist in the schema are commented out
        // status: shareRecord.status,
        // view_count: (shareRecord.view_count ?? 0) + 1,
        // is_collaborative: shareRecord.is_collaborative || false,
        // password_protected: shareRecord.password_protected || false,
        // sharing_level: shareRecord.sharing_level || 'read',
        data: { // Ensure this structure matches frontend expectation
            items: parsedItems
        }
        // user_id is intentionally omitted from the public response
    };

    // Return the share data
    return NextResponse.json({
      success: true,
      share: responseData
    });

  } catch (err) {
      console.error('Unexpected error in GET /api/collections/share:', err);
      const message = err instanceof Error ? err.message : 'Internal server error fetching share';
      return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  // ... (existing DELETE code) ...
}