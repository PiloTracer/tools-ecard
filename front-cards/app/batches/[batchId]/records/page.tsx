'use client';

/**
 * Batch Records Page
 * View and edit contact records for a specific batch
 */

import { ProtectedRoute } from '@/features/auth';
import { RecordsList, RecordEditModal, type ContactRecord } from '@/features/batch-records';
import { BatchStatusBadge } from '@/features/batch-view';
import { useRecords } from '@/features/batch-records';
import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';

function BatchRecordsContent() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.batchId as string;

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
    setEditingRecord(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/batches')}
                className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="Back to batches"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {batchFileName || 'Batch Records'}
                  </h1>
                  {batchStatus && <BatchStatusBadge status={batchStatus as any} />}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  View and edit contact records in this batch
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push('/batches')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              View All Batches
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RecordsList batchId={batchId} onEditRecord={handleEditRecord} />
      </main>

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
    </div>
  );
}

export default function BatchRecordsPage() {
  return (
    <ProtectedRoute>
      <BatchRecordsContent />
    </ProtectedRoute>
  );
}
