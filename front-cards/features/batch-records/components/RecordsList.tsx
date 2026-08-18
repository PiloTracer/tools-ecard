/**
 * RecordsList Component
 * Batch records in a sortable DataTable with search, render-status badges,
 * inline edit/delete actions, and failed-render retry with confirm (S3 SPEC).
 */

'use client';

import React, { useCallback, useState } from 'react';
import { useRecords } from '../hooks/useRecords';
import { useRecordDelete } from '../hooks/useRecordDelete';
import { RenderStatusBadge, type RenderState } from './RenderStatusBadge';
import { DataTable, SearchBar, Button, StatePanel, Modal } from '@/components/ui';
import { useTranslation } from '@/features/i18n';
import type { ContactRecord } from '../types';

interface RecordsListProps {
  batchId: string;
  onEditRecord: (record: ContactRecord) => void;
  renderTemplateId?: string;
}

const recordName = (r: ContactRecord): string =>
  r.fullName || [r.firstName, r.lastName].filter(Boolean).join(' ') || '—';

export const RecordsList: React.FC<RecordsListProps> = ({
  batchId,
  onEditRecord,
  renderTemplateId,
}) => {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<ContactRecord | null>(null);
  const [retryRecord, setRetryRecord] = useState<ContactRecord | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [badgeNonce, setBadgeNonce] = useState<Record<string, number>>({});

  const { records, isLoading, isError, error, refetch, searchQuery, setSearchQuery } = useRecords({
    batchId,
  });

  const { deleteRecordAsync, isDeleting } = useRecordDelete({ batchId });

  const handleDeleteClick = (record: ContactRecord) => {
    setRecordToDelete(record);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    try {
      await deleteRecordAsync(recordToDelete.batchRecordId);
      setShowDeleteDialog(false);
      setRecordToDelete(null);
    } catch (e) {
      console.error('Failed to delete record:', e);
    }
  };

  const handleStateChange = useCallback(
    (recordId: string) => (state: RenderState) => {
      setFailedIds((prev) => {
        const next = new Set(prev);
        if (state === 'failed') next.add(recordId);
        else next.delete(recordId);
        return next;
      });
    },
    [],
  );

  const handleRetryConfirm = async () => {
    if (!retryRecord || !renderTemplateId?.trim()) return;
    setRetrying(true);
    try {
      const res = await fetch(
        `/api/batches/${batchId}/records/${retryRecord.batchRecordId}/render-retry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: renderTemplateId.trim() }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || json.message || 'Retry failed');
      // Remount the badge so it re-polls from a fresh state
      setBadgeNonce((prev) => ({
        ...prev,
        [retryRecord.batchRecordId]: (prev[retryRecord.batchRecordId] ?? 0) + 1,
      }));
      setRetryRecord(null);
    } catch (e) {
      console.error('Render retry failed:', e);
    } finally {
      setRetrying(false);
    }
  };

  const actionsColumn = {
    id: 'actions',
    label: '',
    render: (record: ContactRecord) => (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onEditRecord(record)}
          aria-label={`${t('records.editTitle', { name: recordName(record) })}`}
          className="rounded-md p-1.5 text-text-muted hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleDeleteClick(record)}
          aria-label={t('records.deleteConfirmTitle')}
          className="rounded-md p-1.5 text-text-muted hover:bg-error-subtle hover:text-status-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    ),
  };

  const statusColumn = {
    id: 'status',
    label: t('records.renderStatus.failed'),
    sortable: true,
    sortValue: (record: ContactRecord) => recordName(record),
    render: (record: ContactRecord) => (
      <div className="flex items-center gap-2">
        <RenderStatusBadge
          key={`${record.batchRecordId}-${badgeNonce[record.batchRecordId] ?? 0}`}
          recordId={record.batchRecordId}
          batchId={batchId}
          initialStatus={record.renderStatus}
          initialProgress={record.renderProgress}
          onStateChange={handleStateChange(record.batchRecordId)}
        />
        {failedIds.has(record.batchRecordId) && (
          <button
            type="button"
            onClick={() => setRetryRecord(record)}
            aria-label={t('records.retry')}
            title={t('records.retryConfirmTitle')}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        )}
      </div>
    ),
  };

  const columns = [
    { id: 'name', label: t('records.name'), sortable: true, sortValue: recordName },
    { id: 'email', label: t('records.email'), sortable: true, sortValue: (r: ContactRecord) => r.email ?? '' },
    {
      id: 'phone',
      label: t('records.phone'),
      sortable: true,
      sortValue: (r: ContactRecord) => r.workPhone ?? r.mobilePhone ?? '',
    },
    statusColumn,
    actionsColumn,
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onDebouncedChange={setSearchQuery}
              placeholder={t('records.searchPlaceholder')}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {t('records.refresh')}
          </Button>
        </div>

        {/* Results Count */}
        {!isLoading && !isError && (
          <p className="text-sm text-text-secondary">
            {searchQuery
              ? t('records.foundCount', { count: records.length })
              : t('records.showingCount', { count: records.length })}
          </p>
        )}

        {/* Loading / Error */}
        {isLoading && <StatePanel kind="loading" title={t('batches.loading')} />}
        {isError && (
          <StatePanel
            kind="error"
            title={t('batches.noBatches')}
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="secondary" onClick={() => refetch()}>
                {t('batches.refresh')}
              </Button>
            }
          />
        )}

        {/* DataTable */}
        {!isLoading && !isError && (
          <DataTable<ContactRecord>
            caption={t('records.title')}
            columns={columns}
            data={records}
            rowKey={(r) => r.batchRecordId}
            emptyState={
              <span>
                {t('records.noRecords')} —{' '}
                {searchQuery ? t('records.noSearchResultsHint') : t('records.noRecordsHint')}
              </span>
            }
          />
        )}
      </div>

      {/* Delete confirm */}
      <Modal
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title={t('records.deleteConfirmTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? t('batches.processing') : t('common.delete')}
            </Button>
          </>
        }
      >
        <p>{t('records.deleteConfirmBody')}</p>
      </Modal>

      {/* Failed-render retry confirm */}
      <Modal
        open={Boolean(retryRecord)}
        onClose={() => !retrying && setRetryRecord(null)}
        title={t('records.retryConfirmTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRetryRecord(null)} disabled={retrying}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleRetryConfirm} disabled={retrying}>
              {retrying ? t('records.retrying') : t('records.retry')}
            </Button>
          </>
        }
      >
        <p>{t('records.retryConfirmBody', { name: retryRecord ? recordName(retryRecord) : '' })}</p>
      </Modal>
    </>
  );
};
