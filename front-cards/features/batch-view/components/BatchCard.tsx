/**
 * BatchCard Component
 * Individual batch display card with actions
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Batch } from '../types';
import { BatchStatusBadge } from './BatchStatusBadge';
import { useBatchDelete } from '../hooks/useBatchDelete';

interface BatchCardProps {
  batch: Batch;
  onDeleted?: () => void;
}

export const BatchCard: React.FC<BatchCardProps> = ({ batch, onDeleted }) => {
  const router = useRouter();
  const { deleteBatchAsync, isDeleting } = useBatchDelete();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewRecords = () => {
    router.push(`/batches/${batch.id}/records`);
  };

  const handleDelete = async () => {
    try {
      await deleteBatchAsync(batch.id);
      setShowDeleteDialog(false);
      if (onDeleted) {
        onDeleted();
      }
    } catch (error) {
      console.error('Failed to delete batch:', error);
    }
  };

  const getProgressPercentage = (): number | null => {
    if (batch.recordsCount && batch.recordsProcessed !== null) {
      return Math.round((batch.recordsProcessed / batch.recordsCount) * 100);
    }
    return null;
  };

  const progress = getProgressPercentage();

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {batch.fileName}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {formatFileSize(batch.fileSize)} • {batch.recordsCount || 0}{' '}
              record{batch.recordsCount !== 1 ? 's' : ''}
            </p>
          </div>
          <BatchStatusBadge status={batch.status} />
        </div>

        {/* Progress Bar (for PARSING status) */}
        {batch.status === 'PARSING' && progress !== null && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Processing...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-yellow-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {batch.errorMessage && (
          <div className="mb-4 p-3 bg-red-50 rounded-md">
            <p className="text-sm text-red-700">{batch.errorMessage}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="space-y-1 mb-4">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Uploaded:</span> {formatDate(batch.createdAt)}
          </p>
          {batch.parsingCompletedAt && (
            <p className="text-xs text-gray-600">
              <span className="font-medium">Completed:</span>{' '}
              {formatDate(batch.parsingCompletedAt)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={handleViewRecords}
            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            View Records
          </button>

          <button
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            className="inline-flex items-center justify-center px-3 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900">Delete Batch</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Are you sure you want to delete "{batch.fileName}"? This will permanently delete{' '}
                  {batch.recordsCount || 0} record(s). This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
