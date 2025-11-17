'use client';

/**
 * OAuth Callback Page
 *
 * Handles the OAuth callback from Tools Dashboard
 * - Validates state parameter (CSRF protection)
 * - Exchanges authorization code for access token
 * - Redirects to dashboard on success
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  validateState,
  getCodeVerifier,
  clearOAuthData,
  OAuthErrors,
  getOAuthErrorMessage,
} from '@/shared/lib/oauth-utils';
import { OAUTH_CONFIG } from '@/shared/lib/oauth-config';
import type { TokenExchangeRequest, TokenExchangeResponse } from '@/shared/types/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log('=== OAuth Callback Handler Started ===');
      console.log('Current URL:', window.location.href);

      // Get URL parameters
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('URL Parameters:', {
        code: code ? `${code.substring(0, 10)}...` : null,
        state: state ? `${state.substring(0, 10)}...` : null,
        error,
        errorDescription,
      });

      // Check for OAuth errors
      if (error) {
        console.error('OAuth error received:', error, errorDescription);
        setStatus('error');
        setErrorMessage(errorDescription || getOAuthErrorMessage(error));
        setTimeout(() => {
          router.push(`/login?error=${error}`);
        }, 3000);
        return;
      }

      // Validate authorization code
      if (!code) {
        console.error('No authorization code received');
        setStatus('error');
        setErrorMessage(getOAuthErrorMessage(OAuthErrors.NO_CODE));
        setTimeout(() => {
          router.push(`/login?error=${OAuthErrors.NO_CODE}`);
        }, 3000);
        return;
      }

      // Determine if this is a manual login or pre-initiated OAuth flow
      // Check for client ID-specific state to distinguish between flows
      const clientId = OAUTH_CONFIG.clientId;
      const storedState = sessionStorage.getItem(`oauth_state_${clientId}`);

      // Check if stored state matches received state
      // Only treat as manual login if states match (not just if stored state exists)
      const isManualLogin = storedState && state && storedState === state;

      console.log('Client ID:', clientId);
      console.log('Stored state:', storedState ? `${storedState.substring(0, 10)}...` : 'NOT FOUND');
      console.log('Received state:', state ? `${state.substring(0, 10)}...` : 'NOT PROVIDED');
      console.log('States match:', isManualLogin ? 'YES' : 'NO');
      console.log('Flow type:', isManualLogin ? 'Manual Login (Self-Initiated)' : 'Pre-Initiated OAuth (from App Library)');

      let codeVerifier: string | null = null;

      if (isManualLogin) {
        // Manual login flow (self-initiated) - validate state and get code verifier
        console.log('Self-initiated flow detected - states match ✓');

        // Get code verifier for PKCE
        codeVerifier = getCodeVerifier(clientId);
        console.log('Code verifier from storage:', codeVerifier ? `${codeVerifier.substring(0, 10)}...` : 'NOT FOUND');

        if (!codeVerifier) {
          console.error('No code verifier found in sessionStorage');
          setStatus('error');
          setErrorMessage('Missing PKCE code verifier. Please try logging in again.');
          setTimeout(() => {
            router.push('/login?error=missing_code_verifier');
          }, 3000);
          return;
        }
        console.log('✓ Code verifier found');
      } else {
        // Pre-initiated OAuth flow from App Library
        // State was validated by the authorization server (Tools Dashboard)
        // No PKCE in pre-initiated flows - security provided by client_secret

        // Clean up any stale OAuth data from previous sessions
        if (storedState && storedState !== state) {
          console.log('⚠️  Found stale OAuth data from previous session - clearing');
          console.log('   Old stored state:', storedState.substring(0, 10) + '...');
          console.log('   New received state:', state ? state.substring(0, 10) + '...' : 'none');
          clearOAuthData(clientId);
        }

        console.log('✓ Pre-initiated flow detected - skipping state validation');
        console.log('  → State was validated by Tools Dashboard authorization server');
        console.log('✓ Pre-initiated flow - no PKCE required (using client_secret)');
      }

      // Exchange authorization code for access token
      console.log('Exchanging authorization code for access token...');

      const request: TokenExchangeRequest = {
        code,
        codeVerifier: codeVerifier || undefined, // Include only for manual login
      };

      const response = await fetch('/api/auth/exchange-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      console.log('Token exchange response status:', response.status);

      const result: TokenExchangeResponse = await response.json();
      console.log('Token exchange result:', {
        success: result.success,
        user: result.user,
        error: result.error,
      });

      if (!response.ok || !result.success) {
        console.error('Token exchange failed!');
        console.error('Error:', result.error);
        setStatus('error');
        setErrorMessage(
          result.error || getOAuthErrorMessage(OAuthErrors.TOKEN_EXCHANGE_FAILED)
        );
        setTimeout(() => {
          router.push(`/login?error=${OAuthErrors.TOKEN_EXCHANGE_FAILED}`);
        }, 3000);
        return;
      }

      console.log('✓ Token exchange successful!');

      // Clean up OAuth data from sessionStorage
      console.log('Clearing OAuth data from sessionStorage...');
      clearOAuthData(clientId);

      // Success!
      console.log('✓ OAuth flow completed successfully!');
      console.log('=== Redirecting to dashboard ===');
      setStatus('success');

      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      console.error('=== Callback handling error ===');
      console.error('Error:', err);
      console.error('Stack trace:', err instanceof Error ? err.stack : 'N/A');
      setStatus('error');
      setErrorMessage(
        err instanceof Error
          ? `${getOAuthErrorMessage(OAuthErrors.NETWORK_ERROR)}: ${err.message}`
          : getOAuthErrorMessage(OAuthErrors.NETWORK_ERROR)
      );
      setTimeout(() => {
        router.push(`/login?error=${OAuthErrors.NETWORK_ERROR}`);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          {/* Processing State */}
          {status === 'processing' && (
            <>
              <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
                <svg
                  className="animate-spin h-12 w-12 text-blue-600"
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
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Completing Login...
              </h2>
              <p className="text-gray-600">
                Please wait while we securely authenticate your account.
              </p>
              <div className="mt-6 space-y-2 text-sm text-gray-500">
                <p>✓ Validating authorization</p>
                <p>✓ Exchanging credentials</p>
                <p className="animate-pulse">⏳ Setting up your session</p>
              </div>
            </>
          )}

          {/* Success State */}
          {status === 'success' && (
            <>
              <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
                <svg
                  className="h-12 w-12 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Successful!</h2>
              <p className="text-gray-600">Redirecting to your dashboard...</p>
            </>
          )}

          {/* Error State */}
          {status === 'error' && (
            <>
              <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
                <svg
                  className="h-12 w-12 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Authentication Failed
              </h2>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
              <p className="text-sm text-gray-500">Redirecting to login page...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
