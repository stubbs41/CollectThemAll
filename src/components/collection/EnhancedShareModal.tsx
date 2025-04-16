'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCollections } from '@/context/CollectionContext';
import { QRCodeSVG } from 'qrcode.react';
import {
  LinkIcon,
  ClipboardIcon,
  QrCodeIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilIcon,
  EyeIcon,
  UserGroupIcon,
  CalendarIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

type ExpirationValue = '1h' | '1d' | '7d' | '30d' | 'never';

interface ExpirationOption {
  value: ExpirationValue;
  label: string;
  days: number;
}

interface EnhancedShareModalProps {
  groupName: string;
  collectionType: 'have' | 'want' | 'group';
  onClose: () => void;
}

const EnhancedShareModal: React.FC<EnhancedShareModalProps> = ({
  groupName,
  collectionType,
  onClose
}) => {
  const { shareCollection } = useCollections();

  // State
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Share options
  const [shareExpiration, setShareExpiration] = useState<ExpirationValue>('7d');
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [permissionLevel, setPermissionLevel] = useState<'read' | 'write'>('read');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  // Disable allow comments until database schema is updated
  const [allowComments, setAllowComments] = useState(false);
  const [showFeatureWarning, setShowFeatureWarning] = useState(false);

  // Refs
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Expiration options
  const expirationOptions: ExpirationOption[] = [
    { value: '1h', label: '1 Hour', days: 0.042 },
    { value: '1d', label: '1 Day', days: 1 },
    { value: '7d', label: '7 Days', days: 7 },
    { value: '30d', label: '30 Days', days: 30 },
    { value: 'never', label: 'Never Expires', days: 365 * 10 } // 10 years as "never"
  ];

  // Generate a shareable link
  const handleShare = async () => {
    setIsSharing(true);
    setError(null);
    setSuccess(null);
    setShareLink(null);

    try {
      // Validate password if enabled
      if (isPasswordProtected && !password.trim()) {
        throw new Error('Password is required when password protection is enabled');
      }

      // Get expiration days
      const expirationDays = expirationOptions.find(opt => opt.value === shareExpiration)?.days || 7;

      // Use context function to share collection
      const sharingLevel = collectionType;
      const result = await shareCollection(
        groupName,
        sharingLevel,
        expirationDays,
        {
          is_collaborative: isCollaborative,
          password: isPasswordProtected ? password : undefined,
          permission_level: permissionLevel
          // Removed allow_comments until database schema is updated
          // allow_comments: allowComments
        }
      );

      if (result.success && result.shareId) {
        // Construct share URL
        const shareUrl = `${window.location.origin}/shared/${result.shareId}`;
        setShareLink(shareUrl);
        setSuccess(`Share link created! Expires: ${expirationOptions.find(opt => opt.value === shareExpiration)?.label || 'Default'}`);
      } else {
        throw new Error(result.error || 'Failed to create a shareable link');
      }
    } catch (err: any) {
      console.error('Error creating share link:', err);
      setError(err.message || 'Failed to create a shareable link. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  // Copy share link to clipboard
  const copyShareLink = () => {
    if (shareLink && linkInputRef.current) {
      linkInputRef.current.select();
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // Generate a random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Share Collection</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </div>

          {/* Collection info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Collection:</span> {groupName}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Sharing:</span> {
                collectionType === 'have' ? 'My Collection (I Have)' :
                collectionType === 'want' ? 'My Wishlist (I Want)' :
                'Entire Group (Both Collections)'
              }
            </p>
          </div>

          {/* Share options */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Share Options</h3>

            {/* Expiration */}
            <div className="mb-4">
              <label className="flex items-center text-sm text-gray-600 mb-2">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Expiration
              </label>
              <select
                value={shareExpiration}
                onChange={(e) => setShareExpiration(e.target.value as ExpirationValue)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                aria-label="Share expiration period"
              >
                {expirationOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Permission level */}
            <div className="mb-4">
              <label className="flex items-center text-sm text-gray-600 mb-2">
                {permissionLevel === 'read' ? (
                  <EyeIcon className="w-4 h-4 mr-2" />
                ) : (
                  <PencilIcon className="w-4 h-4 mr-2" />
                )}
                Permission Level
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPermissionLevel('read')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md ${
                    permissionLevel === 'read'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <EyeIcon className="w-4 h-4 mr-2" />
                    Read Only
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPermissionLevel('write')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md ${
                    permissionLevel === 'write'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <PencilIcon className="w-4 h-4 mr-2" />
                    Can Edit
                  </div>
                </button>
              </div>
            </div>

            {/* Collaborative */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm text-gray-600">
                  <UserGroupIcon className="w-4 h-4 mr-2" />
                  Allow Collaboration
                </label>
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="collaborative"
                    checked={isCollaborative}
                    onChange={() => setIsCollaborative(!isCollaborative)}
                    className="sr-only"
                    aria-label="Allow collaboration"
                    title="Toggle collaboration"
                  />
                  <label
                    htmlFor="collaborative"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      isCollaborative ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                        isCollaborative ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    ></span>
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Allow others to collaborate on this collection in real-time
              </p>
            </div>

            {/* Password protection */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center text-sm text-gray-600">
                  {isPasswordProtected ? (
                    <LockClosedIcon className="w-4 h-4 mr-2" />
                  ) : (
                    <LockOpenIcon className="w-4 h-4 mr-2" />
                  )}
                  Password Protection
                </label>
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="password-protected"
                    checked={isPasswordProtected}
                    onChange={() => {
                      setIsPasswordProtected(!isPasswordProtected);
                      if (!isPasswordProtected && !password) {
                        generateRandomPassword();
                      }
                    }}
                    className="sr-only"
                    aria-label="Enable password protection"
                    title="Toggle password protection"
                  />
                  <label
                    htmlFor="password-protected"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      isPasswordProtected ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                        isPasswordProtected ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    ></span>
                  </label>
                </div>
              </div>

              {isPasswordProtected && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
                  >
                    Generate
                  </button>
                </div>
              )}
            </div>

            {/* Allow comments - disabled until database schema is updated */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Allow Comments
                </label>
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="allow-comments"
                    checked={false}
                    disabled={true}
                    onChange={() => {
                      setShowFeatureWarning(true);
                      setTimeout(() => setShowFeatureWarning(false), 5000);
                    }}
                    className="sr-only"
                    aria-label="Allow comments (coming soon)"
                    title="Comments feature not available yet"
                  />
                  <label
                    htmlFor="allow-comments"
                    className="block overflow-hidden h-6 rounded-full cursor-not-allowed bg-gray-200"
                  >
                    <span
                      className="block h-6 w-6 rounded-full bg-white shadow transform transition-transform translate-x-0"
                    ></span>
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Comments feature coming soon (database update required)
              </p>
              {showFeatureWarning && (
                <p className="text-xs text-amber-600 mt-1 p-1 bg-amber-50 rounded">
                  This feature requires a database schema update and will be available soon.
                </p>
              )}
            </div>
          </div>

          {/* Create share link button */}
          {!shareLink && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleShare}
                disabled={isSharing}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {isSharing ? 'Creating Link...' : 'Create Share Link'}
              </button>
            </div>
          )}

          {/* Share link display */}
          {shareLink && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Share Link</h3>

              <div className="flex gap-2 mb-4">
                <input
                  ref={linkInputRef}
                  type="text"
                  value={shareLink}
                  readOnly
                  aria-label="Share link URL"
                  title="Share link URL"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="w-4 h-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setShowQRCode(!showQRCode)}
                  className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center justify-center"
                >
                  <QrCodeIcon className="w-4 h-4 mr-1" />
                  {showQRCode ? 'Hide QR Code' : 'Show QR Code'}
                </button>

                <a
                  href={`mailto:?subject=Check out my Pokémon card collection&body=I wanted to share my Pokémon card collection with you: ${shareLink}`}
                  className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </a>
              </div>

              {showQRCode && (
                <div className="flex justify-center p-4 bg-white border border-gray-200 rounded-md mb-4">
                  <QRCodeSVG value={shareLink} size={200} />
                </div>
              )}

              <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-md">
                <p className="flex items-center">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Expires: {expirationOptions.find(opt => opt.value === shareExpiration)?.label || 'Default'}
                </p>
                {isPasswordProtected && (
                  <p className="flex items-center mt-1">
                    <LockClosedIcon className="w-4 h-4 mr-2" />
                    Password Protected: {password}
                  </p>
                )}
                <p className="flex items-center mt-1">
                  {permissionLevel === 'read' ? (
                    <>
                      <EyeIcon className="w-4 h-4 mr-2" />
                      Read Only
                    </>
                  ) : (
                    <>
                      <PencilIcon className="w-4 h-4 mr-2" />
                      Can Edit
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Error/Success messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && !error && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          {/* Close button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedShareModal;
