'use client';

/**
 * Batch Records Page
 * View and edit contact records for a specific batch (S3 SPEC).
 */

import { ProtectedRoute } from '@/features/auth';
import { RecordsList, RecordEditModal, type ContactRecord } from '@/features/batch-records';
import { BatchStatusBadge } from '@/features/batch-view';
import { useRecords } from '@/features/batch-records';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { AppShell, Button, StatePanel } from '@/components/ui';
import { PageHeaderActions, useTranslation } from '@/features/i18n';

function BatchRecordsContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const batchId = params.batchId as string;
  const renderTemplateId = searchParams.get('templateId') ?? undefined;

  const [editingRecord, setEditingRecord] = useState<ContactRecord | null>(null);

  const { batchFileName, batchStatus, refetch } = useRecords({ batchId });

  const handleEditRecord = (record: ContactRecord) => {
    setEditingRecord(record);
  };

  const handleCloseEdit = () => {
    setEditingRecord(null);
  };

  const handleEditSuccess = () => {
    refetch();
  };

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-md p-2 text-text-secondary hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={t('records.homeAria')}
          title={t('common.home')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </button>
        <button
          onClick={() => router.push('/batches')}
          className="rounded-md p-2 text-text-secondary hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={t('records.backToBatches')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              {batchFileName || t('records.title')}
            </h1>
            {batchStatus && <BatchStatusBadge status={batchStatus as never} />}
          </div>
          <p className="mt-1 text-sm text-text-secondary">{t('records.subtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <PageHeaderActions />
        <Button variant="secondary" size="sm" onClick={() => router.push('/batches')}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {t('records.viewAllBatches')}
        </Button>
      </div>
    </div>
  );

  return (
    <AppShell header={header}>
      <RecordsList
        batchId={batchId}
        onEditRecord={handleEditRecord}
        renderTemplateId={renderTemplateId}
      />

      {/* Edit Modal */}
      {editingRecord && (
        <RecordEditModal
          key={editingRecord.batchRecordId}
          record={editingRecord}
          batchId={batchId}
          isOpen={true}
          onClose={handleCloseEdit}
          onSuccess={handleEditSuccess}
        />
      )}
    </AppShell>
  );
}

export default function BatchRecordsPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-surface-base p-8">
            <StatePanel kind="loading" title="Loading records…" />
          </div>
        }
      >
        <BatchRecordsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
