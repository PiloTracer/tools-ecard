'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  FileUploadProps,
  FileValidationError,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
} from '../types';

export const FileUploadComponent: React.FC<FileUploadProps> = ({
  onSuccess,
  onError,
  acceptedFileTypes = ALLOWED_FILE_EXTENSIONS,
  maxFileSize = MAX_FILE_SIZE_BYTES,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<FileValidationError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const validateFile = useCallback(
    (file: File): FileValidationError | null => {
      // Check file size
      if (file.size > maxFileSize) {
        return {
          type: 'size',
          message: `File size must not exceed ${MAX_FILE_SIZE_MB}MB`,
        };
      }

      // Check file type
      const fileExtension = file.name
        .toLowerCase()
        .substring(file.name.lastIndexOf('.'));

      if (!acceptedFileTypes.includes(fileExtension)) {
        return {
          type: 'type',
          message: `File type must be one of: ${acceptedFileTypes.join(', ')}`,
        };
      }

      return null;
    },
    [acceptedFileTypes, maxFileSize]
  );

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);

      if (error) {
        setValidationError(error);
        setSelectedFile(null);
        if (onError) {
          onError(new Error(error.message));
        }
        return;
      }

      setValidationError(null);
      setSelectedFile(file);
    },
    [validateFile, onError]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Reset the drag counter and state
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
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

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setValidationError(null);

    try {
      // Import the service dynamically to avoid circular dependencies
      const { batchService } = await import('../services/batchService');

      // Use mock for now during development
      const response = await batchService.uploadBatchMock(selectedFile);

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (onSuccess) {
        onSuccess(response);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setValidationError({
        type: 'other',
        message: errorMessage,
      });

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-colors duration-200 ease-in-out
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileSelect}
          disabled={isUploading}
        />

        <div className="text-center" style={{ pointerEvents: 'none' }}>
          {/* Upload Icon */}
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Instructions */}
          <p className="mt-2 text-sm text-gray-600">
            {isDragging ? (
              'Drop the file here'
            ) : (
              <>
                <span className="font-semibold">Click to upload</span> or drag and drop
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {acceptedFileTypes.join(', ')} up to {MAX_FILE_SIZE_MB}MB
          </p>

          {/* Selected File */}
          {selectedFile && !isUploading && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Selected:</span> {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Size: {formatFileSize(selectedFile.size)}
              </p>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="mt-4">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">Uploading...</span>
              </div>
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <div className="mt-4 p-3 bg-red-50 rounded-md">
              <p className="text-sm text-red-600">{validationError.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Button */}
      {selectedFile && !isUploading && !validationError && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleUpload();
          }}
          className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          Upload File
        </button>
      )}
    </div>
  );
};