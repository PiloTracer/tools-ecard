'use client';

/**
 * Client-side Providers
 * Wraps the app with necessary context providers
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { DemoModeProvider } from '@/features/demo/DemoModeProvider';
import { LocaleProvider } from '@/features/i18n';
import { GlobalLanguageAccess } from '@/features/i18n/GlobalLanguageAccess';

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a client instance per component instance
  // This ensures SSR compatibility
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <DemoModeProvider>
          {children}
          <GlobalLanguageAccess />
        </DemoModeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
