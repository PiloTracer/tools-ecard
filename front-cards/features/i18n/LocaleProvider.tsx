'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from 'react';
import { DEFAULT_LOCALE } from './constants';
import { messagesByLocale } from './messages';
import { persistLocale, resolveInitialLocale } from './localeStorage';
import { resolveMessage } from './resolveMessage';
import type { Locale, MessageParams } from './types';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: MessageParams) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Always start at DEFAULT_LOCALE so the first client render matches the
  // server-rendered HTML (the server has no access to localStorage/cookies).
  // The persisted/browser locale is applied in a post-mount effect below.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const initial = resolveInitialLocale();
    if (initial !== DEFAULT_LOCALE) {
      startTransition(() => {
        setLocaleState(initial);
      });
    }
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    persistLocale(nextLocale);
    startTransition(() => {
      setLocaleState(nextLocale);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string, params?: MessageParams) => resolveMessage(messagesByLocale[locale], key, params),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

export function useTranslation() {
  const { locale, setLocale, t } = useLocale();
  return { locale, setLocale, t };
}
