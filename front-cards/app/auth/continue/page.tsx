'use client';

/**
 * Same-origin hop after /oauth/complete sets cookies.
 * Browsers may not persist Set-Cookie on a redirect straight to another site;
 * we load this page on the E-Cards origin first, then go to the configured URL.
 */

import { useEffect } from 'react';
import { POST_LOGIN_REDIRECT_URL } from '@/shared/lib/oauth-config';

export default function AuthContinuePage() {
  useEffect(() => {
    const raw = POST_LOGIN_REDIRECT_URL.trim();
    const target =
      raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : `${window.location.origin}${raw.startsWith('/') ? raw : `/${raw}`}`;
    // Defer past React effect flush so layout/auth work stays predictable
    const t = window.setTimeout(() => window.location.replace(target), 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600 text-sm">Signing you in…</p>
    </div>
  );
}
