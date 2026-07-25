/** @jest-environment jsdom */

import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from './LocaleProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LOCALE_STORAGE_KEY } from './constants';

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists locale selection across interactions', () => {
    render(
      <LocaleProvider>
        <LanguageSwitcher />
      </LocaleProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Spanish' }));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    expect(document.documentElement.lang).toBe('es');

    fireEvent.click(screen.getByRole('button', { name: 'Inglés' }));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
