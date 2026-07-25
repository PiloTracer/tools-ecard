/** @jest-environment jsdom */

import { LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY } from './constants';
import {
  detectBrowserLocale,
  persistLocale,
  readStoredLocale,
  resolveInitialLocale,
} from './localeStorage';

describe('localeStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${LOCALE_COOKIE_NAME}=;path=/;max-age=0`;
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'en-US',
    });
  });

  it('persists locale to localStorage and cookie', () => {
    persistLocale('es');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=es`);
    expect(readStoredLocale()).toBe('es');
  });

  it('reads cookie when localStorage is empty', () => {
    document.cookie = `${LOCALE_COOKIE_NAME}=es;path=/`;
    expect(readStoredLocale()).toBe('es');
  });

  it('detects Spanish from browser language', () => {
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'es-MX',
    });
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      value: ['es-MX'],
    });
    expect(detectBrowserLocale()).toBe('es');
  });

  it('resolves stored locale before browser detection', () => {
    persistLocale('en');
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'es-MX',
    });
    expect(resolveInitialLocale()).toBe('en');
  });
});
