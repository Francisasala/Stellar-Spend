'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { SyncStorage } from '@/lib/sync-storage';
import type { SyncSettings } from '@/lib/sync-storage';
import { apiPost } from '@/lib/api/client';
import { formatDateTime } from '@/lib/format';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export interface SyncStatus {
  lastSyncAt: number;
  isPending: boolean;
  formattedLastSync: string;
}

export interface UseSyncSettingsReturn {
  settings: SyncSettings;
  loading: boolean;
  error: string | null;
  toggleSync: (enabled: boolean) => Promise<boolean>;
  syncStatus: SyncStatus;
}

/**
 * Hook for managing transaction sync settings.
 *
 * Returns a stable object with named fields (`settings`, `loading`, `error`,
 * `toggleSync`, `syncStatus`). The shape is unchanged from previous versions
 * to preserve backwards compatibility.
 */
export function useSyncSettings(userAddress?: string): UseSyncSettingsReturn {
  const [settings, setSettings] = useState<SyncSettings>(() => SyncStorage.getDefaultSettings());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const [queueLength, setQueueLength] = useState(0);

  // Load settings on mount
  useEffect(() => {
    const loaded = SyncStorage.getSettings();
    setSettings(loaded);
    setQueueLength(SyncStorage.getQueue().length);
  }, []);

  const toggleSync = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      if (!userAddress) {
        setError('User address is required');
        return false;
      }

      if (!isOnline) {
        setError('Cannot update sync settings while offline');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        // Update server settings
        await apiPost(
          '/api/v1/sync/settings',
          { wallet: userAddress, syncEnabled: enabled },
          { credentials: 'include' },
        );

        // Update local settings
        const updated = SyncStorage.toggleSync(enabled);
        setSettings(updated);
        setQueueLength(SyncStorage.getQueue().length);

        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userAddress, isOnline],
  );

  const syncStatus = useMemo<SyncStatus>(
    () => ({
      lastSyncAt: settings.lastSyncAt,
      isPending: queueLength > 0,
      formattedLastSync: settings.lastSyncAt > 0 ? formatDateTime(settings.lastSyncAt) : 'Never',
    }),
    [settings.lastSyncAt, queueLength],
  );

  return {
    settings,
    loading,
    error,
    toggleSync,
    syncStatus,
  };
}
