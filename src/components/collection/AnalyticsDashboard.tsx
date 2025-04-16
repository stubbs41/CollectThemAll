'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  EyeIcon, 
  UserGroupIcon, 
  ChatBubbleLeftIcon,
  ArrowDownTrayIcon,
  LinkIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

interface AnalyticsData {
  collection: {
    name: string;
    created_at: string;
    total_views: number;
  };
  summary: {
    total_events: number;
    unique_visitors: number;
    event_counts: Record<string, number>;
  };
  daily_views: Record<string, number>;
  referrers: Record<string, number>;
  raw_data: any[];
}

interface AnalyticsDashboardProps {
  shareId: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ shareId }) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  
  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Calculate date range
        let startDate: string | null = null;
        const now = new Date();
        
        if (dateRange === '7d') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          startDate = sevenDaysAgo.toISOString();
        } else if (dateRange === '30d') {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString();
        } else if (dateRange === '90d') {
          const ninetyDaysAgo = new Date(now);
          ninetyDaysAgo.setDate(now.getDate() - 90);
          startDate = ninetyDaysAgo.toISOString();
        }
        
        // Build query params
        const params = new URLSearchParams();
        params.append('shareId', shareId);
        if (startDate) {
          params.append('startDate', startDate);
        }
        
        const response = await fetch(`/api/collections/analytics?${params.toString()}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch analytics data');
        }
        
        const data = await response.json();
        setAnalyticsData(data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError((err as Error).message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [shareId, dateRange]);
  
  // Export analytics data as CSV
  const exportToCsv = () => {
    if (!analyticsData) return;
    
    // Prepare the data
    const headers = ['Date', 'Event Type', 'User ID', 'IP Address', 'Referrer'];
    const rows = analyticsData.raw_data.map(event => [
      new Date(event.created_at).toLocaleString(),
      event.event_type,
      event.user_id || 'Anonymous',
      event.ip_address || 'Unknown',
      event.referrer || 'Direct'
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `collection-analytics-${shareId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Render loading state
  if (loading && !analyticsData) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2" />
          Analytics Dashboard
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500">Loading analytics data...</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2" />
          Analytics Dashboard
        </h3>
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }
  
  // If no data yet
  if (!analyticsData) {
    return null;
  }
  
  // Get event counts
  const viewCount = analyticsData.summary.event_counts['view'] || 0;
  const commentCount = analyticsData.summary.event_counts['comment'] || 0;
  const downloadCount = analyticsData.summary.event_counts['download'] || 0;
  
  // Prepare daily views data for chart
  const dailyViewsData = Object.entries(analyticsData.daily_views)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .slice(-30); // Show last 30 days max
  
  // Get top referrers
  const topReferrers = Object.entries(analyticsData.referrers)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 5);
  
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2" />
          Analytics Dashboard
        </h3>
        
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          
          <button
            type="button"
            onClick={exportToCsv}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
            Export
          </button>
        </div>
      </div>
      
      {/* Collection info */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Collection Information</h4>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Name:</span> {analyticsData.collection.name}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Created:</span> {new Date(analyticsData.collection.created_at).toLocaleDateString()}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Share ID:</span> {shareId}
        </p>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-center mb-2">
            <EyeIcon className="w-5 h-5 text-blue-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-700">Total Views</h4>
          </div>
          <p className="text-2xl font-bold text-blue-700">{analyticsData.collection.total_views}</p>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="flex items-center mb-2">
            <UserGroupIcon className="w-5 h-5 text-purple-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-700">Unique Visitors</h4>
          </div>
          <p className="text-2xl font-bold text-purple-700">{analyticsData.summary.unique_visitors}</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="flex items-center mb-2">
            <ChatBubbleLeftIcon className="w-5 h-5 text-green-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-700">Comments</h4>
          </div>
          <p className="text-2xl font-bold text-green-700">{commentCount}</p>
        </div>
        
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
          <div className="flex items-center mb-2">
            <ArrowDownTrayIcon className="w-5 h-5 text-amber-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-700">Downloads</h4>
          </div>
          <p className="text-2xl font-bold text-amber-700">{downloadCount}</p>
        </div>
      </div>
      
      {/* Daily views chart */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
          <CalendarIcon className="w-4 h-4 mr-1" />
          Daily Views
        </h4>
        
        {dailyViewsData.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500">No daily view data available</p>
          </div>
        ) : (
          <div className="h-60 border border-gray-200 rounded-lg p-4">
            <div className="h-full flex items-end">
              {dailyViewsData.map(([date, count], index) => {
                // Calculate bar height percentage (max 90%)
                const maxCount = Math.max(...Object.values(analyticsData.daily_views));
                const heightPercentage = maxCount > 0 ? (count / maxCount) * 90 : 0;
                
                return (
                  <div key={date} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div 
                      className="w-full bg-blue-500 rounded-t-sm" 
                      style={{ height: `${heightPercentage}%` }}
                      title={`${date}: ${count} views`}
                    ></div>
                    <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                      {new Date(date).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Top referrers */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
          <LinkIcon className="w-4 h-4 mr-1" />
          Top Referrers
        </h4>
        
        {topReferrers.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500">No referrer data available</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topReferrers.map(([referrer, count]) => (
                  <tr key={referrer}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {referrer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
