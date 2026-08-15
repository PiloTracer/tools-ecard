'use client';

import { ProtectedRoute } from '@/features/auth';
import { BatchList } from '@/features/batch-view';
import { PageHeaderActions, useTranslation } from '@/features/i18n';
import { AppShell, Button } from '@/components/ui';
import { useRouter } from 'next/navigation';

function BatchesContent() {
  const router = useRouter();
  const { t } = useTranslation();

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-md p-2 text-text-secondary hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={t('batches.homeAria')}
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
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('batches.title')}</h1>
          <p className="text-sm text-text-secondary">{t('batches.subtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <PageHeaderActions />
        <Button size="sm" onClick={() => router.push('/dashboard')}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('batches.uploadNew')}
        </Button>
      </div>
    </div>
  );

  return (
    <AppShell header={header}>
      <BatchList />
    </AppShell>
  );
}

export default function BatchesPage() {
  return (
    <ProtectedRoute>
      <BatchesContent />
    </ProtectedRoute>
  );
}
