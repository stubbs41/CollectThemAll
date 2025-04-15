'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import AuthForm from '@/components/AuthForm';
import { usePathname } from 'next/navigation';

// Interface for the structure received from the API
interface ApiShare {
  share_id: string;
  collection_name: string;
  group_name?: string; // Might not always be present
  collection_type: string;
  created_at: string;
  expires_at: string | null;
  status: 'active' | 'expired' | 'revoked';
  view_count: number;
  expires_in: string; // e.g., '1d', 'never'
  shareUrl: string;
}

type ShareStatus = 'all' | 'active' | 'expired' | 'revoked';

export default function MySharesPage() {
  const { session, isLoading: authLoading, setRedirectPath } = useAuth();
  const pathname = usePathname();
  const [allShares, setAllShares] = useState<ApiShare[]>([]);
  const [filteredShares, setFilteredShares] = useState<ApiShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShareStatus>('all');

  // Fetch shares from the API
  useEffect(() => {
    async function fetchShares() {
      // Only fetch if authenticated
      if (!session) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/collections/my-shares');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch shares');
        }
        const data = await response.json();
        setAllShares(data.shares || []);
      } catch (err) {
        console.error('Error fetching shares:', err);
        setError((err as Error).message);
        setAllShares([]);
      } finally {
        setLoading(false);
      }
    }
    fetchShares();
  }, [session]);

  // Apply filters and search when dependencies change
  useEffect(() => {
    let shares = allShares;

    // Filter by status
    if (statusFilter !== 'all') {
      shares = shares.filter(share => share.status === statusFilter);
    }

    // Filter by search term (case-insensitive)
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      shares = shares.filter(share =>
        share.collection_name.toLowerCase().includes(lowerSearchTerm) ||
        (share.group_name && share.group_name.toLowerCase().includes(lowerSearchTerm))
      );
    }

    setFilteredShares(shares);
  }, [allShares, statusFilter, searchTerm]);

  // Handle revoking a share
  const handleRevoke = useCallback(async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this share link? It will no longer be accessible.')) {
      return;
    }

    try {
      const response = await fetch(`/api/collections/my-shares?share_id=${shareId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke share');
      }
      // Refresh the list by updating the status locally or re-fetching
      setAllShares(prevShares =>
        prevShares.map(share =>
          share.share_id === shareId ? { ...share, status: 'revoked' } : share
        )
      );
      alert('Share revoked successfully.');
    } catch (err) {
      console.error('Error revoking share:', err);
      alert(`Failed to revoke share: ${(err as Error).message}`);
    }
  }, []);

  // Helper to format dates nicely
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      return format(new Date(dateString), 'PPp'); // e.g., Sep 14, 2023, 2:30:00 PM
    } catch {
      return 'Invalid Date';
    }
  };

  // Helper for status badges
  const getStatusBadge = (status: ApiShare['status']) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">Active</span>;
      case 'expired':
        return <span className="px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">Expired</span>;
      case 'revoked':
        return <span className="px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full">Revoked</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium text-gray-800 bg-gray-100 rounded-full">Unknown</span>;
    }
  };

  // Render loading state during authentication
  if (authLoading) {
    return <div className="text-center py-10">Loading authentication...</div>;
  }

  // Render login form if not authenticated
  if (!session) {
    // Store the current path for redirect after login
    setRedirectPath(pathname);
    
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">Access Your Shared Collections</h2>
        <p className="text-center text-gray-600 mb-6">Please sign in or sign up to view and manage your shared Pokémon card collections.</p>
        <AuthForm />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">My Shared Collections</h1>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-grow">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search by Name
          </label>
          <input
            type="text"
            id="search"
            placeholder="Collection or group name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Status
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ShareStatus)}
            className="w-full md:w-auto px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-10">
          <p className="text-gray-600">Loading your shares...</p>
          {/* Optional: Add a spinner here */}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-700">
          <p>Error loading shares: {error}</p>
        </div>
      )}

      {/* Shares List/Table */}
      {!loading && !error && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <ul role="list" className="divide-y divide-gray-200">
            {filteredShares.length === 0 ? (
              <li className="p-6 text-center text-gray-500">
                {allShares.length === 0 ? "You haven't shared any collections yet." : "No shares match your current filters."}
              </li>
            ) : (
              filteredShares.map((share) => (
                <li key={share.share_id} className="p-4 sm:p-6 hover:bg-gray-50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    {/* Left side: Name, Type, Dates */}
                    <div className="flex-1 min-w-0 mb-4 md:mb-0">
                      <p className="text-lg font-semibold text-indigo-600 truncate">
                        {share.collection_name}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Type: <span className="font-medium">{share.collection_type === 'have' ? 'Have List' : 'Want List'}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        Created: {formatDate(share.created_at)}
                        <span className="mx-2 text-gray-300">|</span>
                        Expires: {formatDate(share.expires_at)}
                         <span className="mx-2 text-gray-300">|</span>
                        Views: {share.view_count}
                      </p>
                    </div>

                    {/* Right side: Status and Actions */}
                    <div className="flex items-center space-x-4 flex-shrink-0">
                      {getStatusBadge(share.status)}
                      {share.status === 'active' && (
                        <>
                          <Link
                            href={`/shared/${share.share_id}`}
                            target="_blank" // Open in new tab
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          >
                            View Link
                          </Link>
                          <button
                            onClick={() => handleRevoke(share.share_id)}
                            className="text-sm font-medium text-red-600 hover:text-red-800 whitespace-nowrap"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                       {/* Optionally add a copy link button here */}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
} 