import React from 'react';
import { render } from '@testing-library/react';
import { LocaleProvider } from './LocaleProvider';

export function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}
