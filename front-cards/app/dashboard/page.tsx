'use client';

/**
 * Dashboard Page
 *
 * Main authenticated landing page for E-Cards application
 * Shows user info, subscription status, and quick actions
 */

import { useAuth } from '@/features/auth';
import { ProtectedRoute } from '@/features/auth';
import { USER_SUBSCRIPTION_URL } from '@/shared/lib/oauth-config';
import { ProjectSelector, useProjects } from '@/features/simple-projects';
import { QuickActions } from '@/features/simple-quick-actions';
import { useEffect } from 'react';

function DashboardContent() {
  const { user, logout } = useAuth();
  const { ensureDefaultProject } = useProjects();

  // Ensure user has a default project on first login
  useEffect(() => {
    if (user) {
      ensureDefaultProject();
    }
  }, [user, ensureDefaultProject]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">E-Cards Designer</h1>
                <p className="text-sm text-gray-500">Welcome back, {user.username}</p>
              </div>
            </div>

            <button
              onClick={logout}
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Username</p>
              <p className="font-medium text-gray-900">{user.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Display Name</p>
              <p className="font-medium text-gray-900">{user.display_name || user.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">User ID</p>
              <p className="font-mono text-sm text-gray-600">{user.id}</p>
            </div>
          </div>
        </div>

        {/* Subscription Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
            <a
              href={USER_SUBSCRIPTION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Manage Subscription →
            </a>
          </div>

          {user.subscription ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tier */}
                <div>
                  <p className="text-sm text-gray-500 mb-1">Current Plan</p>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                    {user.subscription.tier}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <p className="text-sm text-gray-500 mb-1">Status</p>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${
                      user.subscription.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : user.subscription.status === 'suspended'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {user.subscription.status}
                  </span>
                </div>

                {/* Reset Date */}
                <div>
                  <p className="text-sm text-gray-500 mb-1">Billing Cycle Resets</p>
                  <p className="font-medium text-gray-900">
                    {new Date(user.subscription.resetDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Usage & Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cards Usage */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Cards Generated</span>
                      <span className="text-sm font-medium text-gray-900">
                        {user.subscription.currentUsage} / {user.subscription.cardsPerMonth}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (user.subscription.currentUsage / user.subscription.cardsPerMonth) * 100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* LLM Credits */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">LLM Credits</span>
                      <span className="text-sm font-medium text-gray-900">
                        {user.subscription.llmCredits} remaining
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          user.subscription.llmCredits > 10 ? 'bg-green-600' : 'bg-orange-600'
                        }`}
                        style={{
                          width: `${Math.min(100, user.subscription.llmCredits)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-medium text-yellow-900">Subscription data not available</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Your subscription information could not be loaded. Please visit the{' '}
                    <a
                      href={USER_SUBSCRIPTION_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-yellow-800"
                    >
                      Tools Dashboard
                    </a>{' '}
                    to view your subscription details.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Project Selector - Positioned right above Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <ProjectSelector />
        </div>

        {/* Quick Actions */}
        <QuickActions
          onCreateTemplate={() => console.log('Create Template clicked')}
          onImportBatch={() => console.log('Import Batch clicked')}
          onViewBatches={() => console.log('View Batches clicked')}
        />

        {/* Success Message */}
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-600 mt-0.5 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-green-900">
                ✨ Successfully authenticated with OAuth 2.0 + PKCE!
              </p>
              <p className="text-sm text-green-700 mt-1">
                You're now logged in securely via the Tools Dashboard. Your session is
                protected with httpOnly cookies and refresh tokens.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
