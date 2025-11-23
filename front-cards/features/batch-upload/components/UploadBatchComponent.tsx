'use client';

/**
 * UploadBatchComponent - Self-contained upload component for dashboard
 *
 * Direct drag-and-drop area that functions as the "Import Batch" button
 */

import React, { useState, useCallback, useRef } from 'react';
import { BatchStatusTracker } from './BatchStatusTracker';
import { useProjects } from '@/features/simple-projects';
import type {
  BatchUploadResponse,
  FileValidationError,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB
} from '../types';

export interface UploadBatchComponentProps {
  className?: string;
}

export const UploadBatchComponent: React.FC<UploadBatchComponentProps> = ({ className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<FileValidationError | null>(null);
  const [uploadedBatch, setUploadedBatch] = useState<BatchUploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { selectedProjectId, loading } = useProjects();

  const isDisabled = !selectedProjectId || loading;

  // File type constants
  const ALLOWED_EXTENSIONS = ['.csv', '.txt', '.vcf', '.xls', '.xlsx'];
  const MAX_SIZE_MB = 10;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): FileValidationError | null => {
      // Check file size
      if (file.size > MAX_SIZE_BYTES) {
        return {
          type: 'size',
          message: `File size must not exceed ${MAX_SIZE_MB}MB`,
        };
      }

      // Check file type
      const fileExtension = file.name
        .toLowerCase()
        .substring(file.name.lastIndexOf('.'));

      if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
        return {
          type: 'type',
          message: `File type must be one of: ${ALLOWED_EXTENSIONS.join(', ')}`,
        };
      }

      return null;
    },
    []
  );

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);

      if (error) {
        setValidationError(error);
        setSelectedFile(null);
        return;
      }

      setValidationError(null);
      setSelectedFile(file);
      // Auto-upload the file
      uploadFile(file);
    },
    [validateFile]
  );

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setValidationError(null);

    try {
      // Import the service dynamically to avoid circular dependencies
      const { batchService } = await import('../services/batchService');

      // Use real API to upload to SeaweedFS
      const response = await batchService.uploadBatch(file);

      setUploadedBatch(response);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setValidationError({
        type: 'other',
        message: errorMessage,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDisabled) {
      setIsDragging(true);
    }
  }, [isDisabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (isDisabled) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile, isDisabled]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleClick = () => {
    if (!isDisabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      e.preventDefault();

      if (isDisabled || isUploading) return;

      const clipboardData = e.clipboardData;

      // Check if there are files in the clipboard
      const files = clipboardData.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
        return;
      }

      // Check if there's text content
      const text = clipboardData.getData('text/plain');
      if (text && text.trim()) {
        // Create a file from the pasted text
        const blob = new Blob([text], { type: 'text/plain' });
        const file = new File([blob], 'pasted-content.txt', { type: 'text/plain' });
        handleFile(file);
      }
    },
    [handleFile, isDisabled, isUploading]
  );

  // Set up paste event listener - works on hover
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || isDisabled || isUploading) return;

    let isHovering = false;

    const handleMouseEnter = () => {
      isHovering = true;
    };

    const handleMouseLeave = () => {
      isHovering = false;
    };

    const handleDocumentPaste = (e: ClipboardEvent) => {
      // Only handle paste if hovering over the container
      if (!isHovering) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // Check for files
      const files = clipboardData.files;
      if (files && files.length > 0) {
        e.preventDefault();
        handleFile(files[0]);
        return;
      }

      // Check for text
      const text = clipboardData.getData('text/plain');
      if (text && text.trim()) {
        e.preventDefault();
        const blob = new Blob([text], { type: 'text/plain' });
        const file = new File([blob], 'pasted-content.txt', { type: 'text/plain' });
        handleFile(file);
      }
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('paste', handleDocumentPaste);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('paste', handleDocumentPaste);
    };
  }, [handleFile, isDisabled, isUploading]);

  // Button classes
  const getButtonClasses = () => {
    const baseClasses = "flex items-center p-4 border-2 border-dashed rounded-lg transition-all duration-200";

    if (isDisabled) {
      return `${baseClasses} border-gray-200 bg-gray-50 cursor-not-allowed opacity-50`;
    }

    if (isDragging) {
      return `${baseClasses} border-blue-500 bg-blue-50`;
    }

    if (isUploading) {
      return `${baseClasses} border-blue-400 bg-blue-50`;
    }

    return `${baseClasses} border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer`;
  };

  const getIconClasses = () => {
    return isDisabled
      ? "w-6 h-6 text-gray-300 mr-3"
      : "w-6 h-6 text-gray-400 mr-3";
  };

  const getTitleClasses = () => {
    return isDisabled
      ? "font-medium text-gray-400"
      : "font-medium text-gray-900";
  };

  const getDescriptionClasses = () => {
    return isDisabled
      ? "text-sm text-gray-300"
      : "text-sm text-gray-500";
  };

  return (
    <div className={className} ref={containerRef}>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        disabled={isDisabled || isUploading}
      />

      {/* Drag-and-Drop Area / Button */}
      <div
        className={getButtonClasses()}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="Import Batch"
        aria-disabled={isDisabled}
        title={isDisabled ? "Select a project to import batches" : "Click, drag and drop, or paste content"}
      >
        <svg
          className={getIconClasses()}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <div className="text-left flex-1">
          <p className={getTitleClasses()}>
            {isUploading ? 'Uploading...' : isDragging ? 'Drop file here' : 'Import Batch'}
          </p>
          <p className={getDescriptionClasses()}>
            .csv, .txt, .vcf, .xls, .xlsx up to {MAX_SIZE_MB}MB
          </p>
          {!isDisabled && !isUploading && !isDragging && (
            <p className="text-xs text-gray-400 mt-1">
              Click, drag & drop, or hover and paste (Ctrl+V)
            </p>
          )}
        </div>
        {isUploading && (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
        )}
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="mt-2 p-3 bg-red-50 rounded-md border border-red-200">
          <p className="text-sm text-red-600">{validationError.message}</p>
        </div>
      )}

      {/* Upload Status Tracker */}
      {uploadedBatch && (
        <div className="mt-4">
          <BatchStatusTracker batchId={uploadedBatch.id} />
        </div>
      )}
    </div>
  );
};
