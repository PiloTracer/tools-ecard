'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BatchStatusTrackerProps, BatchStatus, BatchStatusResponse } from '../types';
import { batchService } from '../services/batchService';

export const BatchStatusTracker: React.FC<BatchStatusTrackerProps> = ({
  batchId,
  onComplete,
  onError,
  className = '',
}) => {
  const [status, setStatus] = useState<BatchStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      // Use real API
      const response = await batchService.getBatchStatus(batchId);
      setStatus(response);
      setError(null);

      // Check if processing is complete
      if (response.status === BatchStatus.LOADED) {
        if (onComplete) {
          onComplete(response);
        }
      } else if (response.status === BatchStatus.ERROR) {
        const error = new Error(response.errorMessage || 'Batch processing failed');
        setError(error.message);
        if (onError) {
          onError(error);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch status';
      setError(errorMessage);
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [batchId, onComplete, onError]);

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Set up polling for status updates
    const pollInterval = setInterval(() => {
      if (status && (status.status === BatchStatus.LOADED || status.status === BatchStatus.ERROR)) {
        // Stop polling if processing is complete
        return;
      }
      fetchStatus();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [fetchStatus, status]);

  const getStatusColor = (status: BatchStatus): string => {
    switch (status) {
      case BatchStatus.UPLOADED:
        return 'text-blue-600 bg-blue-100';
      case BatchStatus.PARSING:
        return 'text-yellow-600 bg-yellow-100';
      case BatchStatus.PARSED:
        return 'text-purple-600 bg-purple-100';
      case BatchStatus.LOADED:
        return 'text-green-600 bg-green-100';
      case BatchStatus.ERROR:
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: BatchStatus): React.ReactNode => {
    switch (status) {
      case BatchStatus.UPLOADED:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
          </svg>
        );
      case BatchStatus.PARSING:
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent"></div>
        );
      case BatchStatus.PARSED:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case BatchStatus.LOADED:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case BatchStatus.ERROR:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className={`p-4 bg-red-50 rounded-lg border border-red-200 ${className}`}>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">{status.fileName}</h3>
          <p className="text-sm text-gray-500">{formatFileSize(status.fileSize)}</p>
        </div>

        {/* Status Badge */}
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>
          <span className="mr-2">{getStatusIcon(status.status)}</span>
          {status.status}
        </div>
      </div>

      {/* Progress Bar */}
      {status.progress !== undefined && status.status !== BatchStatus.ERROR && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {status.errorMessage && (
        <div className="mt-3 p-3 bg-red-50 rounded-md">
          <p className="text-sm text-red-600">{status.errorMessage}</p>
        </div>
      )}

      {/* Timestamps */}
      <div className="mt-4 space-y-1 text-xs text-gray-500">
        <div>
          <span className="font-medium">Created:</span>{' '}
          {new Date(status.createdAt).toLocaleString()}
        </div>
        <div>
          <span className="font-medium">Updated:</span>{' '}
          {new Date(status.updatedAt).toLocaleString()}
        </div>
        {status.processedAt && (
          <div>
            <span className="font-medium">Completed:</span>{' '}
            {new Date(status.processedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};