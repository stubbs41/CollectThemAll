import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

// GET: Get analytics for a shared collection
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const shareId = url.searchParams.get('shareId');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const eventType = url.searchParams.get('eventType');

  if (!shareId) {
    return NextResponse.json({ error: 'Share ID is required' }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is the collection owner
    const { data: shareData, error: shareError } = await supabase
      .from('shared_collections')
      .select('user_id, collection_name, created_at, view_count')
      .eq('share_id', shareId)
      .single();

    if (shareError || !shareData) {
      return NextResponse.json({ error: 'Shared collection not found' }, { status: 404 });
    }

    if (shareData.user_id !== session.user.id) {
      return NextResponse.json({ error: 'You do not have permission to view analytics for this collection' }, { status: 403 });
    }

    // Build the query
    let query = supabase
      .from('collection_analytics')
      .select('*')
      .eq('share_id', shareId);

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    // Get the analytics data
    const { data: analyticsData, error: analyticsError } = await query;

    if (analyticsError) {
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }

    // Get event counts by type
    const eventCounts = analyticsData.reduce((acc, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    }, {});

    // Get unique visitors count
    const uniqueVisitors = new Set();
    analyticsData.forEach(event => {
      if (event.user_id) {
        uniqueVisitors.add(event.user_id);
      } else if (event.ip_address) {
        uniqueVisitors.add(event.ip_address);
      }
    });

    // Get daily view counts
    const dailyViews = analyticsData
      .filter(event => event.event_type === 'view')
      .reduce((acc, event) => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

    // Get referrer counts
    const referrerCounts = analyticsData
      .filter(event => event.referrer)
      .reduce((acc, event) => {
        const referrer = new URL(event.referrer).hostname;
        acc[referrer] = (acc[referrer] || 0) + 1;
        return acc;
      }, {});

    return NextResponse.json({
      collection: {
        name: shareData.collection_name,
        created_at: shareData.created_at,
        total_views: shareData.view_count
      },
      summary: {
        total_events: analyticsData.length,
        unique_visitors: uniqueVisitors.size,
        event_counts: eventCounts
      },
      daily_views: dailyViews,
      referrers: referrerCounts,
      raw_data: analyticsData
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
}

// POST: Track an analytics event
export async function POST(request: NextRequest) {
  try {
    const { shareId, eventType, metadata } = await request.json();

    if (!shareId || !eventType) {
      return NextResponse.json({
        error: 'Share ID and event type are required'
      }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // Check if the shared collection exists and is active
    const { data: shareData, error: shareError } = await supabase
      .from('shared_collections')
      .select('share_id')
      .eq('share_id', shareId)
      .eq('status', 'active')
      .single();

    if (shareError || !shareData) {
      return NextResponse.json({ error: 'Shared collection not found or inactive' }, { status: 404 });
    }

    // Get user info if authenticated
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // Get request info
    const userAgent = request.headers.get('user-agent') || null;
    const referrer = request.headers.get('referer') || null;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';

    try {
      // Check if the analytics table exists
      const { error: tableCheckError } = await supabase
        .from('collection_analytics')
        .select('id')
        .limit(1);

      // If the table exists, create the analytics event
      if (!tableCheckError) {
        await supabase
          .from('collection_analytics')
          .insert({
            share_id: shareId,
            event_type: eventType,
            user_id: userId,
            ip_address: ipAddress,
            user_agent: userAgent,
            referrer: referrer,
            metadata: metadata || {}
          });
      }

      // If this is a view event, update the view count in shared_collections
      if (eventType === 'view') {
        // Just update the view count directly since the RPC might not exist yet
        await supabase
          .from('shared_collections')
          .update({ view_count: supabase.rpc('increment', { value: 1 }) })
          .eq('share_id', shareId);
      }
    } catch (analyticsError) {
      console.error('Analytics tracking error:', analyticsError);
      // Continue even if analytics fails - don't block the user experience
    }

    return NextResponse.json({
      success: true,
      message: 'Analytics event tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking analytics event:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
}
