'use client';

import { usePathname } from 'next/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';

export function GlobalLanguageAccess() {
  const pathname = usePathname();

  if (pathname === '/') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      <LanguageSwitcher variant="compact" />
    </div>
  );
}
