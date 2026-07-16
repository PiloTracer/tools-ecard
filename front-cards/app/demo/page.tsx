'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { enterDemoMode } from '@/features/demo/isDemoMode';

/**
 * /demo — enable browser Demo mode and redirect to dashboard
 */
export default function DemoEntryPage() {
  const router = useRouter();

  useEffect(() => {
    enterDemoMode();
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-700">Entering Demo mode…</p>
    </div>
  );
}
