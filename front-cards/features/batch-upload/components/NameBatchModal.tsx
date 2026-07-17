'use client';

import { useEffect, useState } from 'react';

interface NameBatchModalProps {
  isOpen: boolean;
  suggestedName: string;
  sourceLabel?: string;
  onClose: () => void;
  onConfirm: (batchFileName: string) => Promise<void>;
}

/**
 * Lets the user confirm or edit the batch display name before upload,
 * mirroring SaveTemplateModal for template imports.
 */
export function NameBatchModal({
  isOpen,
  suggestedName,
  sourceLabel,
  onClose,
  onConfirm,
}: NameBatchModalProps) {
  const [batchName, setBatchName] = useState(suggestedName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setBatchName(suggestedName);
    setError(null);
  }, [isOpen, suggestedName]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const trimmed = batchName.trim();
    if (!trimmed) {
      setError('Batch name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      void handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="mx-4 w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-2xl pointer-events-auto"
          onKeyDown={handleKeyDown}
        >
          <h2 className="mb-1 text-xl font-bold text-white">Name Batch</h2>
          {sourceLabel ? (
            <p className="mb-4 text-sm text-slate-400">Source: {sourceLabel}</p>
          ) : (
            <p className="mb-4 text-sm text-slate-400">
              Choose a name for this batch before uploading.
            </p>
          )}

          <div className="mb-4">
            <label htmlFor="batchName" className="mb-2 block text-sm font-medium text-slate-300">
              Batch Name
            </label>
            <input
              id="batchName"
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g., Staff contacts Q3"
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
              autoFocus
            />
            <p className="mt-1 text-xs text-slate-400">
              Shown in the batch list and used for export file names.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-700 bg-red-900/50 p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Uploading...' : 'Upload Batch'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
