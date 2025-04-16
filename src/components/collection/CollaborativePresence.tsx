'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserIcon, UsersIcon } from '@heroicons/react/24/outline';
import { trackPresence, getPresenceState, realtimeClient } from '@/lib/realtimeClient';
import { formatDistanceToNow } from 'date-fns';

interface PresenceUser {
  user_id: string;
  name: string;
  avatar?: string;
  online_at: string;
}

interface CollaborativePresenceProps {
  collectionGroupId: string;
}

const CollaborativePresence: React.FC<CollaborativePresenceProps> = ({ 
  collectionGroupId 
}) => {
  const { session, profile } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceUser>>({});
  const [showUserList, setShowUserList] = useState(false);
  
  // Set up presence tracking
  useEffect(() => {
    if (!session || !profile || !collectionGroupId) return;
    
    // Track this user's presence
    const cleanup = trackPresence(
      collectionGroupId,
      session.user.id,
      { 
        name: profile.display_name || 'User',
        avatar: profile.avatar_url || undefined
      }
    );
    
    // Set up channel for presence updates
    const channel = realtimeClient.channel(`presence-${collectionGroupId}`);
    
    // Handle presence sync
    const handleSync = () => {
      const state = channel.presenceState();
      
      // Convert presence state to our format
      const users: Record<string, PresenceUser> = {};
      
      Object.entries(state).forEach(([key, presences]) => {
        if (presences && presences.length > 0) {
          const presence = presences[0] as any;
          users[key] = {
            user_id: presence.user_id,
            name: presence.name || 'Unknown User',
            avatar: presence.avatar,
            online_at: presence.online_at
          };
        }
      });
      
      setOnlineUsers(users);
    };
    
    // Handle presence join
    const handleJoin = ({ key, newPresences }: { key: string; newPresences: any[] }) => {
      if (newPresences && newPresences.length > 0) {
        const presence = newPresences[0];
        setOnlineUsers(prev => ({
          ...prev,
          [key]: {
            user_id: presence.user_id,
            name: presence.name || 'Unknown User',
            avatar: presence.avatar,
            online_at: presence.online_at
          }
        }));
      }
    };
    
    // Handle presence leave
    const handleLeave = ({ key }: { key: string }) => {
      setOnlineUsers(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    };
    
    // Subscribe to presence events
    channel
      .on('presence', { event: 'sync' }, handleSync)
      .on('presence', { event: 'join' }, handleJoin)
      .on('presence', { event: 'leave' }, handleLeave)
      .subscribe();
    
    // Also update presence in the database
    const updateDatabasePresence = async () => {
      try {
        await fetch('/api/collections/presence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId: collectionGroupId,
            status: 'online'
          }),
        });
      } catch (err) {
        console.error('Error updating presence:', err);
      }
    };
    
    // Update presence immediately and then every minute
    updateDatabasePresence();
    const intervalId = setInterval(updateDatabasePresence, 60000);
    
    // Initialize with current state
    const initialState = getPresenceState(collectionGroupId);
    if (Object.keys(initialState).length > 0) {
      handleSync();
    }
    
    return () => {
      clearInterval(intervalId);
      cleanup();
      channel.unsubscribe();
    };
  }, [session, profile, collectionGroupId]);
  
  // Count online users (excluding current user)
  const onlineCount = Object.keys(onlineUsers).length;
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowUserList(!showUserList)}
        className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
      >
        <UsersIcon className="w-4 h-4" />
        <span>{onlineCount} online</span>
      </button>
      
      {showUserList && onlineCount > 0 && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Online Users</h3>
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {Object.values(onlineUsers).map(user => (
              <li key={user.user_id} className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50">
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.name} 
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">{user.name}</p>
                  <p className="text-xs text-gray-500">
                    Active {formatDistanceToNow(new Date(user.online_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="ml-auto">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CollaborativePresence;
