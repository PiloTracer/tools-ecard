'use client';

/**
 * Dashboard Page — S1 rebuild (SPEC 20260814-SCREEN-SPEC.md, Approved)
 *
 * Slim IA: quick actions hero (priority 1), then Subscription + Settings as
 * collapsed expandable sections. Account card removed (lives on /profile).
 * Success banner shown once per fresh OAuth login (sessionStorage flag set in
 * /auth/continue), dismissible.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, ProtectedRoute } from '@/features/auth';
import { USER_SUBSCRIPTION_URL } from '@/shared/lib/oauth-config';
import {
  ProjectSelector,
  ProjectSettings,
  ProjectsProvider,
  useProjects,
} from '@/features/simple-projects';
import { QuickActions } from '@/features/simple-quick-actions';
import { PageHeaderActions, useTranslation } from '@/features/i18n';
import { AppShell, Badge, Button, Card, Progress, SectionHeader, type BadgeTone } from '@/components/ui';

const FRESH_LOGIN_KEY = 'ecards_fresh_login';

const statusTone: Record<string, BadgeTone> = {
  active: 'success',
  suspended: 'error',
  cancelled: 'warning',
};

function DashboardInner() {
  const { user, logout } = useAuth();
  const { t, locale } = useTranslation();
  const { ensureDefaultProject, selectedProjectId, loading: projectsLoading, error: projectsError } = useProjects();
  const router = useRouter();
  /** Prevents infinite loop: ensureDefault → loadProjects → loading false triggers this effect again. */
  const defaultEnsureDoneRef = useRef(false);
  const defaultEnsureInFlightRef = useRef(false);

  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Success banner: once per fresh OAuth login, then never again until next login.
  // Flag consumed asynchronously post-mount (hydration-safe; lint: no sync setState in effect).
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(FRESH_LOGIN_KEY) === '1') {
        window.sessionStorage.removeItem(FRESH_LOGIN_KEY);
        const id = window.setTimeout(() => setShowSuccess(true), 0);
        return () => window.clearTimeout(id);
      }
    } catch {
      // storage unavailable — banner simply won't show
    }
  }, []);

  useEffect(() => {
    defaultEnsureDoneRef.current = false;
    defaultEnsureInFlightRef.current = false;
  }, [user?.id]);

  // Once per authenticated user session, after projects list loads OK — not on every loading=false edge.
  useEffect(() => {
    if (!user?.id || projectsLoading || projectsError) {
      return;
    }
    if (defaultEnsureDoneRef.current || defaultEnsureInFlightRef.current) {
      return;
    }
    defaultEnsureInFlightRef.current = true;
    void ensureDefaultProject()
      .then((ok) => {
        if (ok) {
          defaultEnsureDoneRef.current = true;
        }
      })
      .finally(() => {
        defaultEnsureInFlightRef.current = false;
      });
  }, [user?.id, projectsLoading, projectsError, ensureDefaultProject]);

  if (!user) {
    return null;
  }

  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US';
  const subscription = user.subscription;
  // Monthly card limit: external subscription value, or 1000 default when not otherwise set (owner 2026-08-14).
  // Per-batch record limit is enforced server-side (api-server/src/core/limits/batchRecordLimit.ts, demo fallback 50) — not a UI concern.
  const cardsLimit = subscription?.cardsPerMonth || 1000;
  const cardsPct = subscription ? Math.min(100, (subscription.currentUsage / Math.max(1, cardsLimit)) * 100) : 0;

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="rounded-lg bg-accent p-2">
          <svg
            className="h-8 w-8 text-text-on-accent"
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
          <h1 className="text-xl font-bold text-text-primary">{t('dashboard.title')}</h1>
          <p className="text-sm text-text-secondary">
            {t('dashboard.welcomeBack', { username: user.username })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <PageHeaderActions />
        <Button variant="secondary" size="sm" onClick={() => router.push('/profile')}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {t('common.profile')}
        </Button>
        <Button variant="secondary" size="sm" onClick={logout}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          {t('common.logout')}
        </Button>
      </div>
    </div>
  );

  return (
    <AppShell header={header}>
      <div className="space-y-6">
        {/* Success banner — once per fresh login, dismissible */}
        {showSuccess && (
          <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-success-subtle p-4" role="status">
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-success" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium text-text-primary">{t('dashboard.authSuccessTitle')}</p>
              <p className="mt-0.5 text-sm text-text-secondary">{t('dashboard.authSuccessBody')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSuccess(false)}
              aria-label={t('common.close')}
              className="rounded-md p-1 text-text-muted hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Priority 1 — Quick actions (hero, first in DOM/focus order) */}
        <QuickActions
          onCreateTemplate={() => router.push('/template-textile')}
          onViewBatches={() => router.push('/batches')}
        />

        {/* Priority 2 — Subscription (expandable, collapsed by default) */}
        <Card className="p-6">
          <SectionHeader
            title={t('dashboard.subscription')}
            description={
              !subscriptionOpen && subscription ? (
                <span className="mt-1 inline-flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[subscription.status] ?? 'neutral'}>
                    {subscription.status}
                  </Badge>
                  <span className="text-sm text-text-secondary">
                    {subscription.currentUsage} / {cardsLimit} {t('dashboard.cardsGenerated')}
                  </span>
                </span>
              ) : undefined
            }
            toggle={{
              open: subscriptionOpen,
              onToggle: () => setSubscriptionOpen((v) => !v),
              controls: 'dashboard-subscription',
              expandedLabel: t('dashboard.collapse'),
              collapsedLabel: t('dashboard.expand'),
            }}
          />
          <div id="dashboard-subscription" hidden={!subscriptionOpen} className="mt-4">
            {subscription ? (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div>
                    <p className="mb-1 text-sm text-text-secondary">{t('dashboard.currentPlan')}</p>
                    <Badge tone="neutral">{subscription.tier}</Badge>
                  </div>
                  <div>
                    <p className="mb-1 text-sm text-text-secondary">{t('dashboard.status')}</p>
                    <Badge tone={statusTone[subscription.status] ?? 'neutral'}>{subscription.status}</Badge>
                  </div>
                  <div>
                    <p className="mb-1 text-sm text-text-secondary">{t('dashboard.billingResets')}</p>
                    <p className="font-medium text-text-primary">
                      {new Date(subscription.resetDate).toLocaleDateString(dateLocale)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4 border-t border-border-subtle pt-6">
                  <h3 className="text-sm font-semibold text-text-primary">{t('dashboard.usageLimits')}</h3>
                  <Progress
                    value={subscription.currentUsage}
                    max={cardsLimit}
                    label={t('dashboard.cardsGenerated')}
                    tone={cardsPct >= 100 ? 'error' : cardsPct >= 80 ? 'warning' : 'default'}
                  />
                  {/* LLM credits: placeholder value from subscription — show the count, bar stays at 0 (no fake progress) */}
                  <Progress
                    value={0}
                    max={100}
                    label={`${t('dashboard.llmCredits')} · ${t('dashboard.llmCreditsRemaining', {
                      count: subscription.llmCredits,
                    })}`}
                    showValue={false}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-warning-subtle p-4">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-warning" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-medium text-text-primary">{t('dashboard.subscriptionUnavailable')}</p>
                  <p className="mt-1 text-sm text-text-secondary">{t('dashboard.subscriptionUnavailableBody')}</p>
                  <a
                    href={USER_SUBSCRIPTION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
                  >
                    {t('dashboard.manageSubscription')}
                  </a>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Priority 3 — Settings (expandable, collapsed by default): project + prefixes */}
        <Card className="p-6">
          <SectionHeader
            title={t('settings.title')}
            toggle={{
              open: settingsOpen,
              onToggle: () => setSettingsOpen((v) => !v),
              controls: 'dashboard-settings',
              expandedLabel: t('dashboard.collapse'),
              collapsedLabel: t('dashboard.expand'),
            }}
          />
          <div id="dashboard-settings" hidden={!settingsOpen} className="mt-4 space-y-4">
            <ProjectSelector />
            <ProjectSettings key={selectedProjectId || 'no-project'} />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  return (
    <ProjectsProvider sessionUserId={user?.id}>
      <DashboardInner />
    </ProjectsProvider>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
