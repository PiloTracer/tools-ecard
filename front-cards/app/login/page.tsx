'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateAuthorizationUrl, getOAuthErrorMessage } from '@/shared/lib/oauth-utils';
import { OAUTH_CONFIG, USER_SUBSCRIPTION_URL } from '@/shared/lib/oauth-config';
import { LanguageSwitcher, useTranslation } from '@/features/i18n';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const errorDetail =
      searchParams.get('error_description') || searchParams.get('description');
    if (errorParam) {
      let detail = '';
      if (errorDetail) {
        try {
          detail = decodeURIComponent(errorDetail);
        } catch {
          detail = errorDetail;
        }
      }
      const base = getOAuthErrorMessage(errorParam);
      setError(detail ? `${base}\n${detail}` : base);
      if (process.env.NODE_ENV === 'development') {
        console.info('[login] OAuth redirect params:', { error: errorParam, description: detail || undefined });
      }
    }

    const hasOAuthParams =
      searchParams.has('client_id') &&
      searchParams.has('state') &&
      searchParams.has('response_type');

    if (hasOAuthParams && !errorParam) {
      const authUrl = `${OAUTH_CONFIG.authorizationEndpoint}?${searchParams.toString()}`;
      setIsLoading(true);
      window.location.href = authUrl;
    }
  }, [searchParams]);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to initiate login');
      }

      const data = await response.json();

      if (!data.success || !data.authorizationUrl) {
        throw new Error(data.error || 'Failed to get authorization URL');
      }

      window.location.href = data.authorizationUrl;
    } catch (err) {
      console.error('Error initiating login:', err);
      setError(
        t('login.loginFailed', {
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-blue-600 rounded-lg mb-4">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('login.title')}</h1>
          <p className="text-gray-600">{t('login.subtitle')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">{t('login.signInTitle')}</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-red-800 whitespace-pre-wrap break-words">{error}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center shadow-md hover:shadow-lg"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {t('common.redirectingToToolsDashboard')}
              </>
            ) : (
              t('login.loginButton')
            )}
          </button>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">{t('login.firstTime')}</p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center space-y-2">
              <a
                href={USER_SUBSCRIPTION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                {t('login.manageSubscription')}
              </a>
              <p className="text-xs text-gray-500">{t('login.securedBy')}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {t('login.termsPrefix')}{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 hover:underline">
              {t('login.terms')}
            </a>{' '}
            {t('login.and')}{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 hover:underline">
              {t('login.privacy')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-600">Loading…</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
