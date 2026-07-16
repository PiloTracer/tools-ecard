'use client';

/**
 * DemoModeProvider — banner + clear/exit controls
 */

import React, { createContext, useCallback, useContext, useMemo, useState, startTransition } from 'react';
import { canExitDemoMode, enterDemoMode, exitDemoMode, isDemoMode, isEnvDemoMode } from './isDemoMode';
import { demoStore } from './demoStore';
import { demoProjectRepository } from './demoProjectRepository';

type DemoContextValue = {
  demo: boolean;
  envForced: boolean;
  refresh: () => void;
  enter: () => void;
  exit: () => void;
  clearData: () => Promise<void>;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function readDemoFlag(): boolean {
  if (typeof window === 'undefined') return isEnvDemoMode();
  return isDemoMode();
}

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState(readDemoFlag);
  const [envForced] = useState(() => isEnvDemoMode());

  const refresh = useCallback(() => {
    startTransition(() => {
      setDemo(readDemoFlag());
    });
  }, []);

  const enter = useCallback(() => {
    enterDemoMode();
    startTransition(() => setDemo(true));
  }, []);

  const exit = useCallback(() => {
    exitDemoMode();
    startTransition(() => setDemo(readDemoFlag()));
  }, []);

  const clearData = useCallback(async () => {
    await demoStore.clearAll();
    await demoProjectRepository.getProjects();
    startTransition(() => setDemo(readDemoFlag()));
  }, []);

  const value = useMemo(
    () => ({ demo, envForced, refresh, enter, exit, clearData }),
    [demo, envForced, refresh, enter, exit, clearData]
  );

  return (
    <DemoContext.Provider value={value}>
      {demo ? <DemoBanner canExit={canExitDemoMode()} onClear={clearData} onExit={exit} /> : null}
      {children}
    </DemoContext.Provider>
  );
}

function DemoBanner({
  canExit,
  onClear,
  onExit,
}: {
  canExit: boolean;
  onClear: () => Promise<void>;
  onExit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10000,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.6rem 1rem',
        background: '#1a1a1a',
        color: '#f5f5f5',
        fontSize: '0.875rem',
        borderBottom: '2px solid #c45c26',
      }}
    >
      <span>
        <strong>Demo</strong> — data stays in this browser (localStorage / IndexedDB). Nothing is saved on
        the server.
      </span>
      <span style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onClear();
            } finally {
              setBusy(false);
            }
          }}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: 4,
            border: '1px solid #888',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          Clear Demo Data
        </button>
        {canExit ? (
          <button
            type="button"
            onClick={onExit}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 4,
              border: '1px solid #c45c26',
              background: '#c45c26',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Exit Demo
          </button>
        ) : null}
      </span>
    </div>
  );
}

export function useDemoMode(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    return {
      demo: isDemoMode(),
      envForced: isEnvDemoMode(),
      refresh: () => undefined,
      enter: enterDemoMode,
      exit: exitDemoMode,
      clearData: async () => {
        await demoStore.clearAll();
      },
    };
  }
  return ctx;
}
