'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { LandingPage } from '@/features/i18n/components/LandingPage';
import { useTranslation } from '@/features/i18n';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const hasOAuthParams =
      searchParams.has('client_id') &&
      searchParams.has('state') &&
      searchParams.has('response_type');

    if (hasOAuthParams && !isAuthenticated && !isLoading) {
      setIsRedirecting(true);
      router.push(`/login?${searchParams.toString()}`);
    }
  }, [isAuthenticated, isLoading, searchParams, router]);

  if (isLoading || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-gradient-to-br from-purple-600 via-blue-600 to-teal-600 p-4 shadow-2xl">
            <svg
              className="h-12 w-12 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="font-medium text-gray-400">
            {isRedirecting ? t('common.redirectingToToolsDashboard') : t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  return <LandingPage />;
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <p className="text-white">Loading…</p>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
