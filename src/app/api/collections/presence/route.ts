import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

// POST: Update user presence in a collection
export async function POST(request: NextRequest) {
  try {
    const { groupId, status } = await request.json();
    
    if (!groupId) {
      return NextResponse.json({ error: 'Collection group ID is required' }, { status: 400 });
    }
    
    // Validate status
    const validStatus = ['online', 'away', 'offline'];
    const userStatus = status && validStatus.includes(status) ? status : 'online';
    
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    
    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Check if user has access to this collection
    const { data: hasPermission } = await supabase.rpc('check_collection_permission', {
      p_collection_group_id: groupId,
      p_user_id: session.user.id,
      p_required_permission: 'read'
    });
    
    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'You do not have permission to access this collection' 
      }, { status: 403 });
    }
    
    // Update presence
    const { error: presenceError } = await supabase.rpc('update_user_presence', {
      p_collection_group_id: groupId,
      p_status: userStatus
    });
    
    if (presenceError) {
      return NextResponse.json({ 
        error: 'Failed to update presence' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: 'Presence updated successfully',
      status: userStatus
    });
    
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// GET: Get presence for a collection
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const groupId = url.searchParams.get('groupId');
  
  if (!groupId) {
    return NextResponse.json({ error: 'Collection group ID is required' }, { status: 400 });
  }
  
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  
  try {
    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Check if user has access to this collection
    const { data: hasPermission } = await supabase.rpc('check_collection_permission', {
      p_collection_group_id: groupId,
      p_user_id: session.user.id,
      p_required_permission: 'read'
    });
    
    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'You do not have permission to access this collection' 
      }, { status: 403 });
    }
    
    // Get presence data
    const { data: presenceData, error: presenceError } = await supabase
      .from('collection_presence')
      .select(`
        user_id,
        status,
        last_active_at
      `)
      .eq('collection_group_id', groupId);
    
    if (presenceError) {
      return NextResponse.json({ 
        error: 'Failed to fetch presence data' 
      }, { status: 500 });
    }
    
    // Get user profiles
    const userIds = presenceData.map(p => p.user_id).filter(Boolean);
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url')
      .in('id', userIds);
    
    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(profile => {
        profileMap.set(profile.id, profile);
      });
    }
    
    // Format the response
    const formattedPresence = presenceData.map(presence => {
      const profile = profileMap.get(presence.user_id);
      
      return {
        user_id: presence.user_id,
        display_name: profile?.display_name || 'Unknown',
        email: profile?.email || 'Unknown',
        avatar_url: profile?.avatar_url || null,
        status: presence.status,
        last_active_at: presence.last_active_at
      };
    });
    
    return NextResponse.json({
      presence: formattedPresence
    });
    
  } catch (error) {
    console.error('Error fetching presence data:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred' 
    }, { status: 500 });
  }
}
