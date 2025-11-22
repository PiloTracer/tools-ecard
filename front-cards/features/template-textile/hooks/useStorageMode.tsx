/**
 * Storage Mode Detection Hook
 * React hook for detecting and monitoring storage mode
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

export type StorageMode = 'FULL' | 'FALLBACK' | 'LOCAL_ONLY';

interface StorageModeState {
  mode: StorageMode | null;
  isLoading: boolean;
  error: Error | null;
  isOnline: boolean;
}

interface UseStorageModeOptions {
  refreshInterval?: number; // milliseconds, 0 to disable auto-refresh
  onModeChange?: (mode: StorageMode) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7400';

export function useStorageMode(options: UseStorageModeOptions = {}) {
  const { refreshInterval = 30000, onModeChange } = options; // Default 30 seconds

  const [state, setState] = useState<StorageModeState>({
    mode: null,
    isLoading: true,
    error: null,
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true
  });

  const [previousMode, setPreviousMode] = useState<StorageMode | null>(null);

  /**
   * Detect storage mode from API
   */
  const detectMode = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`${API_BASE_URL}/api/v1/template-textile/mode`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const newMode = data.data?.mode as StorageMode;

        setState(prev => ({
          ...prev,
          mode: newMode,
          isLoading: false,
          error: null
        }));

        // Notify of mode change
        if (newMode && newMode !== previousMode && onModeChange) {
          onModeChange(newMode);
          setPreviousMode(newMode);
        }

        return newMode;
      } else {
        // API error - assume fallback mode
        const fallbackMode: StorageMode = 'FALLBACK';

        setState(prev => ({
          ...prev,
          mode: fallbackMode,
          isLoading: false,
          error: new Error(`API returned status ${response.status}`)
        }));

        if (fallbackMode !== previousMode && onModeChange) {
          onModeChange(fallbackMode);
          setPreviousMode(fallbackMode);
        }

        return fallbackMode;
      }
    } catch (error) {
      // Network error - check if completely offline
      const offlineMode: StorageMode = navigator.onLine ? 'FALLBACK' : 'LOCAL_ONLY';

      setState(prev => ({
        ...prev,
        mode: offlineMode,
        isLoading: false,
        error: error as Error
      }));

      if (offlineMode !== previousMode && onModeChange) {
        onModeChange(offlineMode);
        setPreviousMode(offlineMode);
      }

      return offlineMode;
    }
  }, [onModeChange, previousMode]);

  /**
   * Handle online/offline events
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      detectMode(); // Re-detect mode when coming online
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        isOnline: false,
        mode: 'LOCAL_ONLY' // Force local-only when offline
      }));

      if (previousMode !== 'LOCAL_ONLY' && onModeChange) {
        onModeChange('LOCAL_ONLY');
        setPreviousMode('LOCAL_ONLY');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [detectMode, onModeChange, previousMode]);

  /**
   * Initial detection and periodic refresh
   */
  useEffect(() => {
    // Initial detection
    detectMode();

    // Set up periodic refresh if enabled
    if (refreshInterval > 0) {
      const intervalId = setInterval(detectMode, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [detectMode, refreshInterval]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    return detectMode();
  }, [detectMode]);

  /**
   * Get mode display information
   */
  const getModeInfo = useCallback(() => {
    switch (state.mode) {
      case 'FULL':
        return {
          label: 'Full Mode',
          description: 'All features available with cloud sync',
          color: 'green',
          icon: '☁️'
        };
      case 'FALLBACK':
        return {
          label: 'Fallback Mode',
          description: 'Limited features, local storage with partial sync',
          color: 'yellow',
          icon: '⚠️'
        };
      case 'LOCAL_ONLY':
        return {
          label: 'Offline Mode',
          description: 'Working offline, changes saved locally only',
          color: 'red',
          icon: '🔌'
        };
      default:
        return {
          label: 'Unknown',
          description: 'Storage mode not detected',
          color: 'gray',
          icon: '❓'
        };
    }
  }, [state.mode]);

  /**
   * Check if a feature is available in current mode
   */
  const isFeatureAvailable = useCallback((feature: 'save' | 'load' | 'list' | 'delete' | 'sync') => {
    switch (feature) {
      case 'save':
      case 'load':
        return true; // Always available (local at minimum)

      case 'list':
        return state.mode !== 'LOCAL_ONLY';

      case 'delete':
        return state.mode === 'FULL';

      case 'sync':
        return state.mode === 'FULL';

      default:
        return false;
    }
  }, [state.mode]);

  return {
    mode: state.mode,
    isLoading: state.isLoading,
    error: state.error,
    isOnline: state.isOnline,
    refresh,
    getModeInfo,
    isFeatureAvailable
  };
}

/**
 * Storage mode context for sharing state across components
 */

interface StorageModeContextValue {
  mode: StorageMode | null;
  isLoading: boolean;
  error: Error | null;
  isOnline: boolean;
  refresh: () => Promise<StorageMode | undefined>;
  getModeInfo: () => {
    label: string;
    description: string;
    color: string;
    icon: string;
  };
  isFeatureAvailable: (feature: 'save' | 'load' | 'list' | 'delete' | 'sync') => boolean;
}

const StorageModeContext = createContext<StorageModeContextValue | undefined>(undefined);

export function StorageModeProvider({
  children,
  refreshInterval = 30000,
  onModeChange
}: {
  children: ReactNode;
  refreshInterval?: number;
  onModeChange?: (mode: StorageMode) => void;
}) {
  const value = useStorageMode({ refreshInterval, onModeChange });

  return (
    <StorageModeContext.Provider value={value}>
      {children}
    </StorageModeContext.Provider>
  );
}

export function useStorageModeContext() {
  const context = useContext(StorageModeContext);
  if (!context) {
    throw new Error('useStorageModeContext must be used within StorageModeProvider');
  }
  return context;
}