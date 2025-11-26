/**
 * BatchStatusBadge Component
 * Reusable status badge for batches
 */

'use client';

import React from 'react';
import type { BatchStatus } from '../types';

interface BatchStatusBadgeProps {
  status: BatchStatus;
  className?: string;
}

export const BatchStatusBadge: React.FC<BatchStatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusColor = (status: BatchStatus): string => {
    switch (status) {
      case 'UPLOADED':
        return 'text-blue-700 bg-blue-100';
      case 'PARSING':
        return 'text-yellow-700 bg-yellow-100';
      case 'PARSED':
        return 'text-purple-700 bg-purple-100';
      case 'LOADED':
        return 'text-green-700 bg-green-100';
      case 'ERROR':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status: BatchStatus): React.ReactNode => {
    switch (status) {
      case 'UPLOADED':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
          </svg>
        );
      case 'PARSING':
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
        );
      case 'PARSED':
      case 'LOADED':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'ERROR':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(status)} ${className}`}
    >
      <span className="mr-1.5">{getStatusIcon(status)}</span>
      {status}
    </div>
  );
};
