/**
 * BatchCard Component
 * Individual batch display card with actions (S2: Card primitive, Badge status,
 * Modal delete confirm).
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Batch } from '../types';
import { BatchStatusBadge } from './BatchStatusBadge';
import { useBatchDelete } from '../hooks/useBatchDelete';
import { Card, Button, Modal } from '@/components/ui';
import { useTranslation } from '@/features/i18n';

interface BatchCardProps {
  batch: Batch;
  onDeleted?: () => void;
}

export const BatchCard: React.FC<BatchCardProps> = ({ batch, onDeleted }) => {
  const router = useRouter();
  const { t } = useTranslation();
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
    if (batch.recordsCount && batch.recordsProcessed !== null && batch.recordsProcessed !== undefined) {
      return Math.round((batch.recordsProcessed / batch.recordsCount) * 100);
    }
    return null;
  };

  const progress = getProgressPercentage();
  const recordsLabel =
    batch.recordsCount === 1
      ? t('batches.recordsCountOne', { count: batch.recordsCount })
      : t('batches.recordsCount', { count: batch.recordsCount || 0 });

  return (
    <>
      <Card className="flex flex-col p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-text-primary">{batch.fileName}</h3>
            <p className="mt-1 text-sm text-text-secondary">
              {formatFileSize(batch.fileSize)} • {recordsLabel}
            </p>
          </div>
          <BatchStatusBadge status={batch.status} />
        </div>

        {/* Progress Bar (for PARSING status) */}
        {batch.status === 'PARSING' && progress !== null && (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-text-secondary">
              <span>{t('batches.processing')}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-inset">
              <div
                className="h-1.5 rounded-full bg-status-warning transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {batch.errorMessage && (
          <div className="mb-4 rounded-md bg-error-subtle p-3">
            <p className="text-sm text-status-error">{batch.errorMessage}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="mb-4 space-y-1">
          <p className="text-xs text-text-secondary">
            <span className="font-medium">{t('batches.uploadedLabel')}</span> {formatDate(batch.createdAt)}
          </p>
          {batch.parsingCompletedAt && (
            <p className="text-xs text-text-secondary">
              <span className="font-medium">{t('batches.completedLabel')}</span>{' '}
              {formatDate(batch.parsingCompletedAt)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-border-subtle pt-3">
          <Button variant="secondary" size="sm" className="flex-1" onClick={handleViewRecords}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {t('batches.viewRecords')}
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            aria-label={t('batches.deleteConfirmTitle')}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </Button>
        </div>
      </Card>

      {/* Delete confirm — Modal primitive (focus trap, Esc) */}
      <Modal
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title={t('batches.deleteConfirmTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t('batches.processing') : t('common.delete')}
            </Button>
          </>
        }
      >
        <p>
          {t('batches.deleteConfirmBody', {
            fileName: batch.fileName,
            count: batch.recordsCount || 0,
          })}
        </p>
      </Modal>
    </>
  );
};
