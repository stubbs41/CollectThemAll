import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/lib/database.types';
import { sendCommentNotification } from '@/lib/emailService';

export const dynamic = 'force-dynamic';

// GET: Get comments for a shared collection
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const shareId = url.searchParams.get('shareId');
  const parentId = url.searchParams.get('parentId');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const page = parseInt(url.searchParams.get('page') || '1');
  
  if (!shareId) {
    return NextResponse.json({ error: 'Share ID is required' }, { status: 400 });
  }
  
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  
  try {
    // Check if the shared collection exists and is active
    const { data: shareData, error: shareError } = await supabase
      .from('shared_collections')
      .select('share_id, allow_comments, user_id')
      .eq('share_id', shareId)
      .eq('status', 'active')
      .single();
    
    if (shareError || !shareData) {
      return NextResponse.json({ error: 'Shared collection not found or inactive' }, { status: 404 });
    }
    
    if (!shareData.allow_comments) {
      return NextResponse.json({ error: 'Comments are not enabled for this collection' }, { status: 403 });
    }
    
    // Build the query
    let query = supabase
      .from('collection_comments')
      .select(`
        id, 
        comment, 
        created_at, 
        updated_at, 
        user_id, 
        guest_name, 
        parent_id,
        is_deleted,
        profiles:user_id (
          display_name,
          avatar_url
        )
      `)
      .eq('share_id', shareId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    // Filter by parent_id if provided
    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else {
      query = query.is('parent_id', null); // Only get top-level comments
    }
    
    const { data: comments, error: commentsError, count } = await query;
    
    if (commentsError) {
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }
    
    // Get the total count of comments
    const { count: totalCount, error: countError } = await supabase
      .from('collection_comments')
      .select('id', { count: 'exact' })
      .eq('share_id', shareId);
    
    if (countError) {
      console.error('Error getting comment count:', countError);
    }
    
    // Format the comments
    const formattedComments = comments.map(comment => {
      // For deleted comments, only return minimal information
      if (comment.is_deleted) {
        return {
          id: comment.id,
          is_deleted: true,
          created_at: comment.created_at,
          parent_id: comment.parent_id
        };
      }
      
      // For regular comments, return full information
      return {
        id: comment.id,
        comment: comment.comment,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        parent_id: comment.parent_id,
        is_deleted: comment.is_deleted,
        author: comment.user_id ? {
          user_id: comment.user_id,
          display_name: comment.profiles?.display_name || 'Unknown User',
          avatar_url: comment.profiles?.avatar_url
        } : {
          display_name: comment.guest_name || 'Guest',
          avatar_url: null
        }
      };
    });
    
    return NextResponse.json({
      comments: formattedComments,
      total: totalCount || 0,
      page,
      limit,
      has_more: totalCount ? (page * limit) < totalCount : false
    });
    
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// POST: Add a comment to a shared collection
export async function POST(request: NextRequest) {
  try {
    const { shareId, comment, parentId, guestName, guestEmail } = await request.json();
    
    if (!shareId || !comment) {
      return NextResponse.json({ 
        error: 'Share ID and comment are required' 
      }, { status: 400 });
    }
    
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    
    // Check if the shared collection exists, is active, and allows comments
    const { data: shareData, error: shareError } = await supabase
      .from('shared_collections')
      .select('share_id, allow_comments, user_id, collection_name')
      .eq('share_id', shareId)
      .eq('status', 'active')
      .single();
    
    if (shareError || !shareData) {
      return NextResponse.json({ error: 'Shared collection not found or inactive' }, { status: 404 });
    }
    
    if (!shareData.allow_comments) {
      return NextResponse.json({ error: 'Comments are not enabled for this collection' }, { status: 403 });
    }
    
    // Check if parent comment exists if parentId is provided
    if (parentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('collection_comments')
        .select('id')
        .eq('id', parentId)
        .eq('share_id', shareId)
        .single();
      
      if (parentError || !parentComment) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }
    }
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    let userId = null;
    let userName = guestName;
    
    if (session && session.user) {
      userId = session.user.id;
      
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();
      
      userName = profile?.display_name || 'User';
    } else if (!guestName) {
      return NextResponse.json({ error: 'Guest name is required for unauthenticated users' }, { status: 400 });
    }
    
    // Create the comment
    const { data: newComment, error: commentError } = await supabase
      .from('collection_comments')
      .insert({
        share_id: shareId,
        user_id: userId,
        guest_name: userId ? null : guestName,
        guest_email: userId ? null : guestEmail,
        comment,
        parent_id: parentId || null
      })
      .select()
      .single();
    
    if (commentError) {
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }
    
    // Track the comment event in analytics
    await supabase
      .from('collection_analytics')
      .insert({
        share_id: shareId,
        event_type: 'comment',
        user_id: userId,
        metadata: { comment_id: newComment.id }
      });
    
    // Send email notification to the collection owner if they're not the commenter
    if (shareData.user_id !== userId) {
      // Get owner's email
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', shareData.user_id)
        .single();
      
      if (ownerData?.email) {
        const viewUrl = `${request.headers.get('origin') || ''}/shared/${shareId}`;
        
        await sendCommentNotification(
          ownerData.email,
          userName,
          shareData.collection_name,
          comment.substring(0, 100) + (comment.length > 100 ? '...' : ''),
          viewUrl
        );
      }
    }
    
    // Format the response
    const formattedComment = {
      id: newComment.id,
      comment: newComment.comment,
      created_at: newComment.created_at,
      updated_at: newComment.updated_at,
      parent_id: newComment.parent_id,
      is_deleted: false,
      author: userId ? {
        user_id: userId,
        display_name: userName,
        avatar_url: null // We don't have this info yet
      } : {
        display_name: guestName,
        avatar_url: null
      }
    };
    
    return NextResponse.json({ 
      comment: formattedComment,
      success: true
    });
    
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// DELETE: Delete a comment
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const commentId = url.searchParams.get('id');
  
  if (!commentId) {
    return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
  }
  
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  
  try {
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Get the comment to check permissions
    const { data: comment, error: commentError } = await supabase
      .from('collection_comments')
      .select('id, share_id, user_id')
      .eq('id', commentId)
      .single();
    
    if (commentError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    
    // Check if user is the comment author or the collection owner
    const isAuthor = comment.user_id === session.user.id;
    
    if (!isAuthor) {
      // Check if user is the collection owner
      const { data: shareData, error: shareError } = await supabase
        .from('shared_collections')
        .select('user_id')
        .eq('share_id', comment.share_id)
        .single();
      
      if (shareError || shareData.user_id !== session.user.id) {
        return NextResponse.json({ error: 'You do not have permission to delete this comment' }, { status: 403 });
      }
    }
    
    // Soft delete the comment (mark as deleted but keep in database)
    const { error: updateError } = await supabase
      .from('collection_comments')
      .update({ is_deleted: true })
      .eq('id', commentId);
    
    if (updateError) {
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Comment deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred' 
    }, { status: 500 });
  }
}
