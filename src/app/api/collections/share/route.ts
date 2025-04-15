import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { CollectionType } from '@/services/CollectionService';
import { Database } from '@/lib/database.types';

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

    // Create Supabase client with cookie-based auth
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
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
    
    // Store the share data in the shared_collections table
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
  
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  
  try {
    // Retrieve only necessary fields + the data blob
    const { data: shareRecord, error } = await supabase
      .from('shared_collections')
      .select('share_id, user_id, collection_type, group_name, collection_name, data, created_at, expires_at, status, view_count') 
      .eq('share_id', shareId)
      .eq('status', 'active') // Only fetch active shares
      .single();
    
    if (error || !shareRecord) {
      console.error('Error retrieving share or share not active:', error);
      return NextResponse.json({ error: 'Share not found, expired, or revoked' }, { status: 404 });
    }
    
    // -- ADD LOGGING START --
    console.log(`[Share GET ${shareId}] Raw shareRecord retrieved:`, JSON.stringify(shareRecord, null, 2));
    console.log(`[Share GET ${shareId}] shareRecord.data type:`, typeof shareRecord.data);
    console.log(`[Share GET ${shareId}] shareRecord.data value:`, JSON.stringify(shareRecord.data, null, 2));
    // -- ADD LOGGING END --

    // Check if share has expired (only if expires_at is not null)
    if (shareRecord.expires_at && new Date(shareRecord.expires_at) < new Date()) {
      // Update status to 'expired' in the DB (don't await, let it happen in background)
      supabase.from('shared_collections').update({ status: 'expired' }).eq('share_id', shareId)
        .then(({error: updateError}) => {
           if(updateError) console.error("Failed to mark share as expired:", updateError);
        });
      return NextResponse.json({ error: 'Share has expired' }, { status: 410 });
    }

    // Safely parse the data blob and validate structure
    let parsedItems: any[] = [];
    let originalExpiresIn = 'unknown';

    // -- ADD LOGGING START --
    console.log(`[Share GET ${shareId}] Attempting to access items from data blob.`);
    // -- ADD LOGGING END --

    if (shareRecord.data && typeof shareRecord.data === 'object' && Array.isArray((shareRecord.data as any).items)) {
        parsedItems = (shareRecord.data as any).items;
        originalExpiresIn = (shareRecord.data as any).expires_in || 'unknown';
        // -- ADD LOGGING START --
        console.log(`[Share GET ${shareId}] Successfully parsed items. Count: ${parsedItems.length}`);
        // -- ADD LOGGING END --
    } else {
        // -- MODIFY LOGGING START --
        console.error(`[Share GET ${shareId}] Invalid or missing data structure. shareRecord.data:`, JSON.stringify(shareRecord.data, null, 2));
        // -- MODIFY LOGGING END --
        // Decide if we should error out or return empty items
        // Returning empty items might be confusing if the share *should* have data
        // Let's return an error for now, as this indicates a problem during share creation.
        return NextResponse.json({ error: 'Shared data is corrupt or missing items.' }, { status: 500 });
    }

    // Increment view count now that we know it's a valid view
    supabase.rpc('increment_share_view_count', { share_id_to_update: shareId })
      .then(({ error: rpcError }) => {
        if (rpcError) console.error('Error incrementing view count:', rpcError);
      });

    // Construct the final response object precisely
    const responseData = {
        share_id: shareRecord.share_id,
        collection_name: shareRecord.collection_name,
        group_name: shareRecord.group_name,
        collection_type: shareRecord.collection_type,
        created_at: shareRecord.created_at,
        expires_at: shareRecord.expires_at,
        status: shareRecord.status,
        view_count: (shareRecord.view_count ?? 0) + 1, // Return incremented count optimistically
        expires_in: originalExpiresIn, // Send back the original duration setting
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