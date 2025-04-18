import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

export const dynamic = 'force-dynamic'; // Ensure fresh data and auth checks

// GET: Fetch the user's collection groups
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // 1. Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return NextResponse.json({ error: 'Session error' }, { status: 401 });
    }
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Fetch collection groups for this user
    const { data: groups, error: fetchError } = await supabase
      .from('collection_groups')
      .select('*')
      .eq('user_id', session.user.id)
      .order('name');

    if (fetchError) {
      console.error('Error fetching collection groups:', fetchError.message);
      return NextResponse.json({ error: `Database error: ${fetchError.message}` }, { status: 500 });
    }

    // Return the groups as is
    if (!groups || groups.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    return NextResponse.json({ groups: groups ?? [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/collection-groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new collection group
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // 1. Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Parse request body
    const { name, description } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // 3. Check if group already exists
    const { data: existingGroup, error: checkError } = await supabase
      .from('collection_groups')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('name', name)
      .single();

    if (existingGroup) {
      return NextResponse.json({ error: 'A collection group with this name already exists' }, { status: 409 });
    }

    // 4. Create new group
    const { data: newGroup, error: insertError } = await supabase
      .from('collection_groups')
      .insert({
        user_id: session.user.id,
        name,
        description: description || null,
        have_value: 0,
        want_value: 0,
        total_value: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating collection group:', insertError.message);
      return NextResponse.json({ error: `Database error: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({ group: newGroup });
  } catch (error) {
    console.error('Unexpected error in POST /api/collection-groups:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update a collection group
export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // 1. Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Parse request body
    const { id, name, description } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // 3. Check if group exists and belongs to user
    const { data: existingGroup, error: checkError } = await supabase
      .from('collection_groups')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (checkError || !existingGroup) {
      return NextResponse.json({ error: 'Collection group not found' }, { status: 404 });
    }

    // 4. Check if new name already exists (if name is changing)
    if (existingGroup.name !== name) {
      const { data: nameCheck, error: nameCheckError } = await supabase
        .from('collection_groups')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', name)
        .single();

      if (nameCheck) {
        return NextResponse.json({ error: 'A collection group with this name already exists' }, { status: 409 });
      }
    }

    // 5. Update group
    const { data: updatedGroup, error: updateError } = await supabase
      .from('collection_groups')
      .update({
        name,
        description: description !== undefined ? description : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating collection group:', updateError.message);
      return NextResponse.json({ error: `Database error: ${updateError.message}` }, { status: 500 });
    }

    // 6. Update all cards in this group if name changed
    if (existingGroup.name !== name) {
      const { error: updateCardsError } = await supabase
        .from('collections')
        .update({ group_name: name })
        .eq('user_id', session.user.id)
        .eq('group_name', existingGroup.name);

      if (updateCardsError) {
        console.error('Error updating cards in collection group:', updateCardsError.message);
        // Continue anyway, we'll handle this as a partial success
      }
    }

    return NextResponse.json({ group: updatedGroup });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/collection-groups:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a collection group
export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // 1. Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Get group ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }

    // 3. Check if group exists and belongs to user
    const { data: existingGroup, error: checkError } = await supabase
      .from('collection_groups')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (checkError || !existingGroup) {
      return NextResponse.json({ error: 'Collection group not found' }, { status: 404 });
    }

    // No longer preventing deletion of any specific group

    // 5. Delete all cards in this group
    const { error: deleteCardsError } = await supabase
      .from('collections')
      .delete()
      .eq('user_id', session.user.id)
      .eq('group_name', existingGroup.name);

    if (deleteCardsError) {
      console.error('Error deleting cards in collection group:', deleteCardsError.message);
      return NextResponse.json({ error: `Database error: ${deleteCardsError.message}` }, { status: 500 });
    }

    // 6. Delete the group
    const { error: deleteGroupError } = await supabase
      .from('collection_groups')
      .delete()
      .eq('id', id);

    if (deleteGroupError) {
      console.error('Error deleting collection group:', deleteGroupError.message);
      return NextResponse.json({ error: `Database error: ${deleteGroupError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/collection-groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
