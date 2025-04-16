import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/lib/database.types';
import { sendCollaborationInvite } from '@/lib/emailService';

export const dynamic = 'force-dynamic';

// GET: List collaborators for a collection group
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

    // Check if user has permission to view collaborators
    const { data: hasPermission } = await supabase.rpc('check_collection_permission', {
      p_collection_group_id: groupId,
      p_user_id: session.user.id,
      p_required_permission: 'read'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: 'You do not have permission to view this collection' }, { status: 403 });
    }

    // Get collection group details
    const { data: collectionGroup, error: groupError } = await supabase
      .from('collection_groups')
      .select('id, name, user_id')
      .eq('id', groupId)
      .single();

    if (groupError || !collectionGroup) {
      return NextResponse.json({ error: 'Collection group not found' }, { status: 404 });
    }

    // Get collaborators
    const { data: collaborators, error: collabError } = await supabase
      .from('collection_collaborators')
      .select(`
        id,
        email,
        permission_level,
        status,
        created_at,
        updated_at,
        last_accessed_at,
        user_id,
        invited_by
      `)
      .eq('collection_group_id', groupId);

    if (collabError) {
      return NextResponse.json({ error: 'Failed to fetch collaborators' }, { status: 500 });
    }

    // Get user profiles for collaborators and owner
    const userIds = [
      collectionGroup.user_id,
      ...collaborators.map(c => c.user_id),
      ...collaborators.map(c => c.invited_by)
    ].filter(Boolean);

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

    // Get presence information
    const { data: presenceData } = await supabase
      .from('collection_presence')
      .select('user_id, status, last_active_at')
      .eq('collection_group_id', groupId)
      .in('user_id', userIds);

    const presenceMap = new Map();
    if (presenceData) {
      presenceData.forEach(presence => {
        presenceMap.set(presence.user_id, presence);
      });
    }

    // Format the response
    const formattedCollaborators = collaborators.map(collab => {
      const profile = profileMap.get(collab.user_id);
      const inviterProfile = profileMap.get(collab.invited_by);
      const presence = presenceMap.get(collab.user_id);

      return {
        id: collab.id,
        user_id: collab.user_id,
        email: collab.email,
        display_name: profile?.display_name || collab.email.split('@')[0],
        avatar_url: profile?.avatar_url || null,
        permission_level: collab.permission_level,
        status: collab.status,
        created_at: collab.created_at,
        updated_at: collab.updated_at,
        last_accessed_at: collab.last_accessed_at,
        invited_by: {
          user_id: collab.invited_by,
          display_name: inviterProfile?.display_name || 'Unknown',
          avatar_url: inviterProfile?.avatar_url || null
        },
        presence: presence ? {
          status: presence.status,
          last_active_at: presence.last_active_at
        } : { status: 'offline', last_active_at: null }
      };
    });

    // Get owner profile
    const ownerProfile = profileMap.get(collectionGroup.user_id);
    const ownerPresence = presenceMap.get(collectionGroup.user_id);

    return NextResponse.json({
      collection_group: {
        id: collectionGroup.id,
        name: collectionGroup.name,
        owner: {
          user_id: collectionGroup.user_id,
          display_name: ownerProfile?.display_name || 'Unknown',
          email: ownerProfile?.email || 'Unknown',
          avatar_url: ownerProfile?.avatar_url || null,
          presence: ownerPresence ? {
            status: ownerPresence.status,
            last_active_at: ownerPresence.last_active_at
          } : { status: 'offline', last_active_at: null }
        }
      },
      collaborators: formattedCollaborators
    });

  } catch (error) {
    console.error('Error fetching collaborators:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
}

// POST: Add a collaborator to a collection group
export async function POST(request: NextRequest) {
  try {
    const { groupId, email, permissionLevel } = await request.json();

    if (!groupId || !email || !permissionLevel) {
      return NextResponse.json({
        error: 'Group ID, email, and permission level are required'
      }, { status: 400 });
    }

    // Validate permission level
    if (!['read', 'write', 'admin'].includes(permissionLevel)) {
      return NextResponse.json({
        error: 'Invalid permission level. Must be read, write, or admin'
      }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user has admin permission for this collection
    const { data: isOwner } = await supabase
      .from('collection_groups')
      .select('id')
      .eq('id', groupId)
      .eq('user_id', session.user.id)
      .single();

    const { data: isAdmin } = await supabase
      .from('collection_collaborators')
      .select('id')
      .eq('collection_group_id', groupId)
      .eq('user_id', session.user.id)
      .eq('permission_level', 'admin')
      .eq('status', 'accepted')
      .single();

    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        error: 'You do not have permission to add collaborators to this collection'
      }, { status: 403 });
    }

    // Check if the email is already a collaborator
    const { data: existingCollaborator } = await supabase
      .from('collection_collaborators')
      .select('id, status')
      .eq('collection_group_id', groupId)
      .eq('email', email)
      .single();

    if (existingCollaborator) {
      if (existingCollaborator.status === 'accepted') {
        return NextResponse.json({
          error: 'This user is already a collaborator on this collection'
        }, { status: 400 });
      } else {
        // Update the existing invitation
        const { error: updateError } = await supabase
          .from('collection_collaborators')
          .update({
            permission_level: permissionLevel,
            invited_by: session.user.id,
            updated_at: new Date().toISOString(),
            status: 'pending'
          })
          .eq('id', existingCollaborator.id);

        if (updateError) {
          return NextResponse.json({
            error: 'Failed to update invitation'
          }, { status: 500 });
        }

        return NextResponse.json({
          message: 'Invitation updated successfully',
          collaborator_id: existingCollaborator.id
        });
      }
    }

    // Find user by email
    const { data: userByEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    const userId = userByEmail?.id || null;

    // Create the collaborator
    const { data: newCollaborator, error: createError } = await supabase
      .from('collection_collaborators')
      .insert({
        collection_group_id: groupId,
        user_id: userId,
        invited_by: session.user.id,
        email: email,
        permission_level: permissionLevel,
        status: 'pending'
      })
      .select('id')
      .single();

    if (createError) {
      return NextResponse.json({
        error: 'Failed to add collaborator'
      }, { status: 500 });
    }

    // Send invitation email
    try {
      // Get inviter's profile
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();

      // Get collection group details
      const { data: groupDetails } = await supabase
        .from('collection_groups')
        .select('name')
        .eq('id', groupId)
        .single();

      // Generate accept URL
      const origin = request.headers.get('origin') || '';
      const acceptUrl = `${origin}/collections/collaborations?groupId=${groupId}&token=${newCollaborator.id}`;

      // Send the email
      const { success, error: emailError } = await sendCollaborationInvite(
        email,
        inviterProfile?.display_name || 'A PokeBinder user',
        groupDetails?.name || 'a Pokémon collection',
        acceptUrl
      );

      if (!success && emailError) {
        console.error('Error sending invitation email:', emailError);
      }
    } catch (emailError) {
      console.error('Error in email sending process:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      message: 'Collaborator added successfully',
      collaborator_id: newCollaborator.id
    });

  } catch (error) {
    console.error('Error adding collaborator:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
}

// PATCH: Update a collaborator's permissions
export async function PATCH(request: NextRequest) {
  try {
    const { collaboratorId, permissionLevel } = await request.json();

    if (!collaboratorId || !permissionLevel) {
      return NextResponse.json({
        error: 'Collaborator ID and permission level are required'
      }, { status: 400 });
    }

    // Validate permission level
    if (!['read', 'write', 'admin'].includes(permissionLevel)) {
      return NextResponse.json({
        error: 'Invalid permission level. Must be read, write, or admin'
      }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the collaborator to check permissions
    const { data: collaborator, error: collabError } = await supabase
      .from('collection_collaborators')
      .select('id, collection_group_id, user_id, permission_level, status')
      .eq('id', collaboratorId)
      .single();

    if (collabError || !collaborator) {
      return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 });
    }

    // Check if user has permission to update this collaborator
    const { data: isOwner } = await supabase
      .from('collection_groups')
      .select('id')
      .eq('id', collaborator.collection_group_id)
      .eq('user_id', session.user.id)
      .single();

    const { data: isAdmin } = await supabase
      .from('collection_collaborators')
      .select('id')
      .eq('collection_group_id', collaborator.collection_group_id)
      .eq('user_id', session.user.id)
      .eq('permission_level', 'admin')
      .eq('status', 'accepted')
      .single();

    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        error: 'You do not have permission to update collaborators for this collection'
      }, { status: 403 });
    }

    // Update the collaborator
    const { error: updateError } = await supabase
      .from('collection_collaborators')
      .update({
        permission_level: permissionLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', collaboratorId);

    if (updateError) {
      return NextResponse.json({
        error: 'Failed to update collaborator'
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Collaborator updated successfully'
    });

  } catch (error) {
    console.error('Error updating collaborator:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
}

// DELETE: Remove a collaborator
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const collaboratorId = url.searchParams.get('id');

  if (!collaboratorId) {
    return NextResponse.json({ error: 'Collaborator ID is required' }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the collaborator to check permissions
    const { data: collaborator, error: collabError } = await supabase
      .from('collection_collaborators')
      .select('id, collection_group_id, user_id')
      .eq('id', collaboratorId)
      .single();

    if (collabError || !collaborator) {
      return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 });
    }

    // Check if user has permission to remove this collaborator
    const { data: isOwner } = await supabase
      .from('collection_groups')
      .select('id')
      .eq('id', collaborator.collection_group_id)
      .eq('user_id', session.user.id)
      .single();

    const { data: isAdmin } = await supabase
      .from('collection_collaborators')
      .select('id')
      .eq('collection_group_id', collaborator.collection_group_id)
      .eq('user_id', session.user.id)
      .eq('permission_level', 'admin')
      .eq('status', 'accepted')
      .single();

    // Users can also remove themselves
    const isSelf = collaborator.user_id === session.user.id;

    if (!isOwner && !isAdmin && !isSelf) {
      return NextResponse.json({
        error: 'You do not have permission to remove this collaborator'
      }, { status: 403 });
    }

    // Delete the collaborator
    const { error: deleteError } = await supabase
      .from('collection_collaborators')
      .delete()
      .eq('id', collaboratorId);

    if (deleteError) {
      return NextResponse.json({
        error: 'Failed to remove collaborator'
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Collaborator removed successfully'
    });

  } catch (error) {
    console.error('Error removing collaborator:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
}
