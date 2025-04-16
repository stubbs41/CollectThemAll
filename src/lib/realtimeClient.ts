import { createClient } from '@supabase/supabase-js';

// Create a Supabase client specifically for realtime subscriptions
// This is separate from the auth-aware client to avoid auth token refreshing issues
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const realtimeClient = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Enable realtime for specific tables
export const enableRealtimeForCollection = (collectionGroupId: string) => {
  // Enable realtime for collection_presence
  realtimeClient
    .channel(`presence-${collectionGroupId}`)
    .on('presence', { event: 'sync' }, () => {
      // Handle presence sync
      console.log('Presence sync');
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      // Handle presence join
      console.log('Presence join', key, newPresences);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      // Handle presence leave
      console.log('Presence leave', key, leftPresences);
    })
    .subscribe();
  
  // Enable realtime for collection changes
  realtimeClient
    .channel(`collection-changes-${collectionGroupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collection_items',
        filter: `collection_group_id=eq.${collectionGroupId}`
      },
      (payload) => {
        console.log('Collection change', payload);
        // The component using this will handle the payload
      }
    )
    .subscribe();
  
  // Enable realtime for collaborator changes
  realtimeClient
    .channel(`collaborator-changes-${collectionGroupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collection_collaborators',
        filter: `collection_group_id=eq.${collectionGroupId}`
      },
      (payload) => {
        console.log('Collaborator change', payload);
        // The component using this will handle the payload
      }
    )
    .subscribe();
};

// Enable realtime for shared collection comments
export const enableRealtimeForComments = (shareId: string) => {
  realtimeClient
    .channel(`comments-${shareId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collection_comments',
        filter: `share_id=eq.${shareId}`
      },
      (payload) => {
        console.log('Comment change', payload);
        // The component using this will handle the payload
      }
    )
    .subscribe();
};

// Track user presence in a collection
export const trackPresence = async (
  collectionGroupId: string,
  userId: string,
  userInfo: { name: string; avatar?: string }
) => {
  const channel = realtimeClient.channel(`presence-${collectionGroupId}`);
  
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    console.log('Presence state', state);
  });
  
  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        ...userInfo
      });
    }
  });
  
  return () => {
    channel.unsubscribe();
  };
};

// Helper to get current presence state
export const getPresenceState = (collectionGroupId: string) => {
  const channel = realtimeClient.channel(`presence-${collectionGroupId}`);
  return channel.presenceState();
};
