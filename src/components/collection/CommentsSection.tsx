'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserIcon, PaperAirplaneIcon, ChatBubbleLeftIcon, TrashIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
  is_deleted: boolean;
  author: {
    user_id?: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface CommentsSectionProps {
  shareId: string;
  isOwner: boolean;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ shareId, isOwner }) => {
  const { session } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalComments, setTotalComments] = useState(0);
  
  // Fetch comments
  const fetchComments = async (pageNum = 1, append = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/collections/comments?shareId=${shareId}&page=${pageNum}&limit=10`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch comments');
      }
      
      const data = await response.json();
      
      if (append) {
        setComments(prev => [...prev, ...data.comments]);
      } else {
        setComments(data.comments);
      }
      
      setHasMore(data.has_more);
      setTotalComments(data.total);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError((err as Error).message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Load initial comments
  useEffect(() => {
    fetchComments();
    
    // Track view event for analytics
    const trackView = async () => {
      try {
        await fetch('/api/collections/analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shareId,
            eventType: 'comments_view'
          }),
        });
      } catch (err) {
        console.error('Error tracking comments view:', err);
      }
    };
    
    trackView();
  }, [shareId]);
  
  // Handle comment submission
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim()) return;
    
    // Validate guest info if not logged in
    if (!session && (!guestName.trim() || guestName.length < 2)) {
      setError('Please enter your name (at least 2 characters)');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/collections/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareId,
          comment: newComment,
          parentId: replyingTo,
          guestName: !session ? guestName : undefined,
          guestEmail: !session ? guestEmail : undefined
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post comment');
      }
      
      const data = await response.json();
      
      // Add the new comment to the list
      if (replyingTo) {
        // For replies, we need to refetch to get the proper structure
        fetchComments();
      } else {
        setComments(prev => [data.comment, ...prev]);
        setTotalComments(prev => prev + 1);
      }
      
      // Reset form
      setNewComment('');
      setReplyingTo(null);
      
      // Track comment event for analytics
      try {
        await fetch('/api/collections/analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shareId,
            eventType: 'comment_add',
            metadata: { comment_id: data.comment.id }
          }),
        });
      } catch (err) {
        console.error('Error tracking comment add:', err);
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      setError((err as Error).message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle comment deletion
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/collections/comments?id=${commentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete comment');
      }
      
      // Update the comments list
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, is_deleted: true, comment: 'This comment has been deleted' } 
            : comment
        )
      );
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert(`Error: ${(err as Error).message || 'Failed to delete comment'}`);
    }
  };
  
  // Load more comments
  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchComments(page + 1, true);
    }
  };
  
  // Render a comment
  const renderComment = (comment: Comment) => {
    if (comment.is_deleted) {
      return (
        <div key={comment.id} className="py-3 px-4 bg-gray-50 rounded-lg opacity-70">
          <p className="text-gray-500 italic text-sm">This comment has been deleted</p>
        </div>
      );
    }
    
    const isAuthor = session?.user?.id === comment.author.user_id;
    const canDelete = isAuthor || isOwner;
    
    return (
      <div key={comment.id} className="py-3 px-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-shrink-0">
            {comment.author.avatar_url ? (
              <img
                src={comment.author.avatar_url}
                alt={comment.author.display_name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{comment.author.display_name}</p>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        
        <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
          {comment.comment}
        </div>
        
        <div className="mt-2 flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setReplyingTo(comment.id)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <ArrowUturnLeftIcon className="w-3 h-3" />
            Reply
          </button>
          
          {canDelete && (
            <button
              type="button"
              onClick={() => handleDeleteComment(comment.id)}
              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <TrashIcon className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <ChatBubbleLeftIcon className="w-5 h-5 mr-2" />
        Comments ({totalComments})
      </h3>
      
      {/* Comment form */}
      <form onSubmit={handleSubmitComment} className="mb-6">
        {replyingTo && (
          <div className="mb-2 p-2 bg-blue-50 rounded-md flex justify-between items-center">
            <span className="text-sm text-blue-700">Replying to a comment</span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Cancel Reply
            </button>
          </div>
        )}
        
        {!session && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name *
              </label>
              <input
                type="text"
                id="guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="guest-email" className="block text-sm font-medium text-gray-700 mb-1">
                Your Email (optional)
              </label>
              <input
                type="email"
                id="guest-email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        )}
        
        <div className="mb-2">
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
            Your Comment
          </label>
          <textarea
            id="comment"
            rows={3}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Write your comment here..."
            required
          />
        </div>
        
        {error && (
          <div className="mb-3 text-sm text-red-600">
            {error}
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              'Posting...'
            ) : (
              <>
                <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                Post Comment
              </>
            )}
          </button>
        </div>
      </form>
      
      {/* Comments list */}
      {loading && comments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading comments...</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <ChatBubbleLeftIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => renderComment(comment))}
          
          {hasMore && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loading}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                {loading ? 'Loading...' : 'Load More Comments'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentsSection;
