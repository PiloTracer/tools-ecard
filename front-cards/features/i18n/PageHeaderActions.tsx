'use client';

import Link from 'next/link';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from './LocaleProvider';

type PageHeaderActionsProps = {
  variant?: 'light' | 'dark';
  showDashboardLink?: boolean;
  className?: string;
};

export function PageHeaderActions({
  variant = 'light',
  showDashboardLink = false,
  className = '',
}: PageHeaderActionsProps) {
  const { t } = useTranslation();

  const switcherVariant = variant === 'dark' ? 'compact' : 'default';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LanguageSwitcher variant={switcherVariant} />
      {showDashboardLink ? (
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
        >
          {t('common.goToDashboard')}
        </Link>
      ) : null}
    </div>
  );
}
