'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PlusIcon, TrashIcon, UserIcon } from '@heroicons/react/24/outline';

interface Collaborator {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  permission_level: string;
  status: string;
  created_at: string;
  invited_by: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  };
  presence: {
    status: string;
    last_active_at: string | null;
  };
}

interface CollectionOwner {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  presence: {
    status: string;
    last_active_at: string | null;
  };
}

interface CollectionGroup {
  id: string;
  name: string;
  owner: CollectionOwner;
}

interface CollaboratorsManagerProps {
  groupId: string;
  onClose?: () => void;
}

const CollaboratorsManager: React.FC<CollaboratorsManagerProps> = ({ 
  groupId,
  onClose
}) => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collectionGroup, setCollectionGroup] = useState<CollectionGroup | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPermission, setNewPermission] = useState('read');
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Fetch collaborators
  useEffect(() => {
    if (!session || !groupId) return;
    
    const fetchCollaborators = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/collections/collaborators?groupId=${groupId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch collaborators');
        }
        
        const data = await response.json();
        setCollectionGroup(data.collection_group);
        setCollaborators(data.collaborators || []);
      } catch (err) {
        console.error('Error fetching collaborators:', err);
        setError((err as Error).message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCollaborators();
    
    // Set up polling for presence updates
    const intervalId = setInterval(() => {
      fetchCollaborators();
    }, 30000); // Poll every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [session, groupId]);
  
  // Update user presence
  useEffect(() => {
    if (!session || !groupId) return;
    
    const updatePresence = async () => {
      try {
        await fetch('/api/collections/presence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId,
            status: 'online'
          }),
        });
      } catch (err) {
        console.error('Error updating presence:', err);
      }
    };
    
    // Update presence immediately and then every minute
    updatePresence();
    const intervalId = setInterval(updatePresence, 60000);
    
    return () => clearInterval(intervalId);
  }, [session, groupId]);
  
  // Handle adding a collaborator
  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail.trim()) {
      setAddError('Email is required');
      return;
    }
    
    setIsAddingCollaborator(true);
    setAddError(null);
    
    try {
      const response = await fetch('/api/collections/collaborators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId,
          email: newEmail,
          permissionLevel: newPermission
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add collaborator');
      }
      
      // Refresh collaborators list
      const collaboratorsResponse = await fetch(`/api/collections/collaborators?groupId=${groupId}`);
      const data = await collaboratorsResponse.json();
      setCollaborators(data.collaborators || []);
      
      // Reset form
      setNewEmail('');
      setNewPermission('read');
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding collaborator:', err);
      setAddError((err as Error).message || 'Failed to add collaborator');
    } finally {
      setIsAddingCollaborator(false);
    }
  };
  
  // Handle removing a collaborator
  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!confirm('Are you sure you want to remove this collaborator?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/collections/collaborators?id=${collaboratorId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove collaborator');
      }
      
      // Update the collaborators list
      setCollaborators(collaborators.filter(c => c.id !== collaboratorId));
    } catch (err) {
      console.error('Error removing collaborator:', err);
      alert(`Error: ${(err as Error).message || 'Failed to remove collaborator'}`);
    }
  };
  
  // Handle updating a collaborator's permission
  const handleUpdatePermission = async (collaboratorId: string, newPermission: string) => {
    try {
      const response = await fetch('/api/collections/collaborators', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collaboratorId,
          permissionLevel: newPermission
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update collaborator');
      }
      
      // Update the collaborators list
      setCollaborators(collaborators.map(c => 
        c.id === collaboratorId ? { ...c, permission_level: newPermission } : c
      ));
    } catch (err) {
      console.error('Error updating collaborator:', err);
      alert(`Error: ${(err as Error).message || 'Failed to update collaborator'}`);
    }
  };
  
  // Render presence indicator
  const renderPresenceIndicator = (status: string) => {
    const colors = {
      online: 'bg-green-500',
      away: 'bg-yellow-500',
      offline: 'bg-gray-400'
    };
    
    return (
      <span className="relative flex h-3 w-3">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[status as keyof typeof colors]} opacity-75`}></span>
        <span className={`relative inline-flex rounded-full h-3 w-3 ${colors[status as keyof typeof colors]}`}></span>
      </span>
    );
  };
  
  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <p className="text-gray-600">Loading collaborators...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
        <button
          onClick={onClose}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Collaborators for {collectionGroup?.name || 'Collection'}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          &times;
        </button>
      </div>
      
      {/* Owner information */}
      {collectionGroup?.owner && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Owner</h3>
          <div className="flex items-center">
            <div className="relative">
              {collectionGroup.owner.avatar_url ? (
                <img
                  src={collectionGroup.owner.avatar_url}
                  alt={collectionGroup.owner.display_name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-gray-600" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1">
                {renderPresenceIndicator(collectionGroup.owner.presence.status)}
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{collectionGroup.owner.display_name}</p>
              <p className="text-xs text-gray-500">{collectionGroup.owner.email}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Add collaborator form */}
      <div className="mb-6">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Collaborator
          </button>
        ) : (
          <form onSubmit={handleAddCollaborator} className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Collaborator</h3>
            
            <div className="mb-3">
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="collaborator@example.com"
                required
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="permission" className="block text-xs font-medium text-gray-700 mb-1">
                Permission Level
              </label>
              <select
                id="permission"
                value={newPermission}
                onChange={(e) => setNewPermission(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="read">Read Only</option>
                <option value="write">Can Edit</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            {addError && (
              <div className="mb-3 text-sm text-red-600">
                {addError}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAddingCollaborator}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isAddingCollaborator ? 'Adding...' : 'Add Collaborator'}
              </button>
            </div>
          </form>
        )}
      </div>
      
      {/* Collaborators list */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Collaborators</h3>
        
        {collaborators.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
            No collaborators yet. Add someone to collaborate on this collection.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {collaborators.map((collaborator) => (
              <li key={collaborator.id} className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="relative">
                      {collaborator.avatar_url ? (
                        <img
                          src={collaborator.avatar_url}
                          alt={collaborator.display_name}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-gray-600" />
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1">
                        {renderPresenceIndicator(collaborator.presence.status)}
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{collaborator.display_name}</p>
                      <p className="text-xs text-gray-500">{collaborator.email}</p>
                      <p className="text-xs text-gray-400">
                        Invited by {collaborator.invited_by.display_name} • 
                        {collaborator.status === 'pending' ? (
                          <span className="text-yellow-600"> Pending</span>
                        ) : (
                          <span className="text-green-600"> Accepted</span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <select
                      value={collaborator.permission_level}
                      onChange={(e) => handleUpdatePermission(collaborator.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="read">Read Only</option>
                      <option value="write">Can Edit</option>
                      <option value="admin">Admin</option>
                    </select>
                    
                    <button
                      onClick={() => handleRemoveCollaborator(collaborator.id)}
                      className="p-1 text-red-600 hover:text-red-800"
                      title="Remove collaborator"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CollaboratorsManager;
