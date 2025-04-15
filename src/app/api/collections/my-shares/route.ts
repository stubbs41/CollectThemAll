// TEMPORARY - Contents for src/app/api/collections/my-shares/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session Error:', sessionError.message);
      return NextResponse.json({ error: 'Failed to get session' }, { status: 401 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('shared_collections')
      .select('share_id, collection_name, collection_type, created_at, expires_at, data, status, view_count')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user shares:', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    const baseUrl = request.headers.get('origin') || new URL(request.url).origin;
    
    const sharesWithUrls = data.map(share => {
        const shareData = share.data as { expires_in?: string };
        return {
            ...share,
            expires_in: shareData?.expires_in || 'unknown',
            shareUrl: `${baseUrl}/shared/${share.share_id}`,
            data: undefined
        }
    });

    return NextResponse.json({ shares: sharesWithUrls ?? [] });

  } catch (error) {
    console.error('Unexpected error in GET /api/collections/my-shares:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get('share_id');

    if (!shareId) {
      return NextResponse.json({ error: 'Missing share_id query parameter' }, { status: 400 });
    }

    const { error, count } = await supabase
      .from('shared_collections')
      .update({ status: 'revoked' })
      .eq('share_id', shareId)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error revoking share:', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Share not found or you do not own it' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Share revoked successfully' }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/collections/my-shares:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// End TEMPORARY
