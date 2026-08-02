'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth';
import { isDemoMode } from '@/features/demo/isDemoMode';
import { LanguageSwitcher, useTranslation } from '@/features/i18n';
import { USER_SUBSCRIPTION_URL, TOOLS_DASHBOARD_HOME_URL } from '@/shared/lib/oauth-config';
import { generateAuthorizationUrl } from '@/shared/lib/oauth-utils';
import { useState } from 'react';

export function LandingPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const demoActive = isDemoMode();

  const handleLogin = async () => {
    try {
      setIsRedirecting(true);
      const authUrl = await generateAuthorizationUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      // Failed login goes to the Tools Dashboard home, not an error screen.
      window.location.href = TOOLS_DASHBOARD_HOME_URL;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(120,119,198,0.3),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(34,211,238,0.2),transparent_50%)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-purple-600 via-blue-600 to-teal-600 p-2 shadow-lg">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-wide text-gray-200">E-Cards Designer</span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="landing" />
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-lg bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              {t('common.goToDashboard')}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:py-24">
        <section className="mb-16 text-center">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-200">
              {t('landing.badge')}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300">
              {t('common.workInProgress')}
            </span>
          </div>

          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
              {t('landing.titleLine1')}
            </span>
            <br />
            <span className="text-white">{t('landing.titleLine2')}</span>
          </h1>

          <p className="mx-auto mb-8 max-w-3xl text-lg text-gray-300 md:text-xl">{t('landing.subtitle')}</p>

          <p className="mx-auto max-w-2xl text-sm text-gray-400">{t('common.workInProgressNote')}</p>
        </section>

        <section className="mb-16 grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <h2 className="mb-3 text-xl font-semibold text-purple-300">{t('landing.problemTitle')}</h2>
            <p className="leading-relaxed text-gray-300">{t('landing.problemBody')}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <h2 className="mb-3 text-xl font-semibold text-teal-300">{t('landing.solutionTitle')}</h2>
            <p className="leading-relaxed text-gray-300">{t('landing.solutionBody')}</p>
          </article>
        </section>

        <section className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-semibold text-white">{t('landing.howItWorksTitle')}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '1', titleKey: 'landing.step1Title', bodyKey: 'landing.step1Body' },
              { step: '2', titleKey: 'landing.step2Title', bodyKey: 'landing.step2Body' },
              { step: '3', titleKey: 'landing.step3Title', bodyKey: 'landing.step3Body' },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-teal-600 text-sm font-bold">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{t(item.titleKey)}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 grid gap-6 md:grid-cols-3">
          {[
            { emoji: '🎨', titleKey: 'landing.featureDesignerTitle', bodyKey: 'landing.featureDesignerBody' },
            { emoji: '📊', titleKey: 'landing.featureBatchTitle', bodyKey: 'landing.featureBatchBody' },
            { emoji: '⚡', titleKey: 'landing.featureRenderTitle', bodyKey: 'landing.featureRenderBody' },
          ].map((feature) => (
            <div
              key={feature.titleKey}
              className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:bg-white/10"
            >
              <div className="mb-3 text-3xl">{feature.emoji}</div>
              <h3 className="mb-2 font-semibold text-white">{t(feature.titleKey)}</h3>
              <p className="text-sm text-gray-400">{t(feature.bodyKey)}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 text-center backdrop-blur-sm">
          <p className="mb-6 text-gray-300">{t('landing.footerTagline')}</p>

          {demoActive || isAuthenticated ? (
            <div className="flex flex-col items-center gap-4">
              {demoActive ? (
                <p className="text-sm text-amber-200/90">{t('landing.demoHint')}</p>
              ) : null}
              <Link
                href="/dashboard"
                className="inline-flex h-14 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 px-10 text-lg font-semibold text-white shadow-xl transition hover:scale-[1.02]"
              >
                {demoActive ? t('landing.tryDemoCta') : t('common.goToDashboard')}
              </Link>
            </div>
          ) : (
            <div className="mx-auto flex max-w-md flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={handleLogin}
                disabled={isRedirecting}
                className="group relative h-14 flex-1 overflow-hidden rounded-xl transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600" />
                <span className="relative z-10 flex h-full items-center justify-center text-lg font-semibold text-white">
                  {isRedirecting ? t('common.redirecting') : t('landing.loginCta')}
                </span>
              </button>
              <a
                href={USER_SUBSCRIPTION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 flex-1 items-center justify-center rounded-xl border-2 border-white/20 bg-white/10 px-6 text-lg font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:scale-[1.02]"
              >
                {t('landing.subscribeCta')}
              </a>
            </div>
          )}

          <div className="mt-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-teal-300 underline-offset-4 hover:text-teal-200 hover:underline"
            >
              {t('common.goToDashboard')} →
            </Link>
          </div>
        </section>

        <footer className="mt-16 text-center">
          <p className="text-sm text-gray-500">{t('common.poweredBy')}</p>
          <p className="mt-2 text-xs text-gray-600">
            © {new Date().getFullYear()}{' '}
            <a
              href="https://AIEpicStudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline-offset-2 transition hover:text-blue-300 hover:underline"
            >
              AIEpicStudio.com
            </a>{' '}
            · {t('common.rightsReserved')}
          </p>
        </footer>
      </main>
    </div>
  );
}
