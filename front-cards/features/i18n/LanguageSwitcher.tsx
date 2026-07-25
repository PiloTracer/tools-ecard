'use client';

import { useTranslation } from './LocaleProvider';
import type { Locale } from './types';

type LanguageSwitcherProps = {
  variant?: 'default' | 'compact' | 'landing';
  className?: string;
};

const variantClasses: Record<NonNullable<LanguageSwitcherProps['variant']>, string> = {
  default:
    'inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-1 text-sm shadow-sm',
  compact:
    'inline-flex items-center gap-1 rounded-lg border border-gray-300/80 bg-white/95 p-1 text-xs shadow-md backdrop-blur-sm',
  landing:
    'inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/40 p-1 text-sm backdrop-blur-sm',
};

const buttonBase =
  'rounded-md px-2.5 py-1 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

function localeLabel(locale: Locale, t: (key: string) => string): string {
  return locale === 'es' ? t('common.spanish') : t('common.english');
}

export function LanguageSwitcher({
  variant = 'default',
  className = '',
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  const activeClass =
    variant === 'landing'
      ? 'bg-white/15 text-white'
      : 'bg-blue-600 text-white';
  const inactiveClass =
    variant === 'landing'
      ? 'text-gray-300 hover:bg-white/10 hover:text-white'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  return (
    <div
      className={`${variantClasses[variant]} ${className}`}
      role="group"
      aria-label={t('common.language')}
    >
      {(['en', 'es'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          className={`${buttonBase} ${locale === option ? activeClass : inactiveClass}`}
          aria-pressed={locale === option}
          aria-label={localeLabel(option, t)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
