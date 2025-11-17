'use client';

/**
 * Login Page
 *
 * Entry point for user authentication via Tools Dashboard OAuth
 */

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateAuthorizationUrl, getOAuthErrorMessage } from '@/shared/lib/oauth-utils';
import { OAUTH_CONFIG, USER_SUBSCRIPTION_URL } from '@/shared/lib/oauth-config';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for error in URL params (redirected from callback with error)
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(getOAuthErrorMessage(errorParam));
      console.error('OAuth error:', errorParam);
    }

    // Check if OAuth parameters are present (pre-initiated from Tools Dashboard)
    // Note: Pre-initiated flows do NOT include PKCE parameters (code_challenge)
    const hasOAuthParams = searchParams.has('client_id') &&
                          searchParams.has('state') &&
                          searchParams.has('response_type');

    if (hasOAuthParams && !errorParam) {
      console.log('OAuth parameters detected from Tools Dashboard - using provided parameters...');
      console.log('Parameters:', {
        client_id: searchParams.get('client_id'),
        redirect_uri: searchParams.get('redirect_uri'),
        state: searchParams.get('state'),
        scope: searchParams.get('scope'),
        response_type: searchParams.get('response_type'),
      });

      // Use the OAuth parameters that Tools Dashboard already sent
      // Don't generate new ones - just redirect with the same parameters
      const authUrl = `${OAUTH_CONFIG.authorizationEndpoint}?${searchParams.toString()}`;

      console.log('Redirecting to:', authUrl);
      setIsLoading(true);
      window.location.href = authUrl;
    }
  }, [searchParams]);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Initiating OAuth flow...');

      // Generate OAuth authorization URL with PKCE and state
      const authUrl = await generateAuthorizationUrl();

      console.log('Redirecting to OAuth authorization endpoint:', authUrl);

      // Redirect to Tools Dashboard for authentication
      window.location.href = authUrl;
    } catch (err) {
      console.error('Error initiating login:', err);
      setError(`Failed to initiate login: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">E-Cards Designer</h1>
          <p className="text-gray-600">Create and manage personalized e-cards at scale</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Sign in to get started
          </h2>

          {/* Error Message */}
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
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Login Button */}
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
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Redirecting to Tools Dashboard...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Login with Tools Dashboard
              </>
            )}
          </button>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>First time here?</strong> You'll be redirected to the Tools Dashboard
              to authenticate. If you don't have an account, you can sign up there.
            </p>
          </div>

          {/* Footer Links */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center space-y-2">
              <a
                href={USER_SUBSCRIPTION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                Manage Subscription
              </a>
              <p className="text-xs text-gray-500">
                Secured by OAuth 2.0 with PKCE
              </p>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            By signing in, you agree to our{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
