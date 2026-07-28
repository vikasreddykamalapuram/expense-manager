import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { SyncStatus, AuthProvider } from '../shared/types';
import {
  getSyncStatus,
  onSyncStatusChange,
  enableSync,
  disableSync,
  fullSync,
  isSyncEnabled,
  deleteAllCloudSyncData,
  getDeviceId,
  getDeviceName,
} from '../shared/services/syncService';
import { syncKeyService } from '../shared/services/syncKeyService';
import { backendSync } from '../shared/services/supabaseSyncService';
import { isBackendConnected } from '../shared/services/supabaseAuthService';
import { isNativePlatform } from '../shared/services/platform';
import { useAuth } from './AuthContext';

interface SyncContextType {
  syncStatus: SyncStatus;
  enableSyncForUser: () => Promise<boolean>;
  disableSyncForUser: () => Promise<void>;
  syncNow: () => Promise<boolean>;
  deleteCloudData: () => Promise<boolean>;
  deviceId: string;
  deviceName: string;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children, profileId }: { children: ReactNode; profileId: string }) {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus);

  // Listen for sync state changes
  useEffect(() => {
    const unsubscribe = onSyncStatusChange(setSyncStatus);
    return unsubscribe;
  }, []);

  const enableSyncForUser = useCallback(async () => {
    if (!user?.provider) return false;
    // On native platforms, sync runs entirely through Supabase — the mobile
    // OAuth flow doesn't fetch a Drive access_token, so the Drive-based
    // enable path can't work. As long as the Supabase session is live
    // (bridged automatically on sign-in), sync is considered enabled.
    if (isNativePlatform()) {
      return isBackendConnected();
    }
    return enableSync(user.provider as AuthProvider, profileId);
  }, [user?.provider, profileId]);

  const disableSyncForUser = useCallback(async () => {
    await disableSync();
  }, []);

  /**
   * Trigger a sync now.
   *
   * Priority order:
   *   1. Supabase Postgres (`backendSync`) — used whenever the Supabase session
   *      is live. Works on web + mobile, doesn't require Drive OAuth scope,
   *      and is the primary cross-device sync path.
   *   2. Google Drive appdata (`fullSync`) — legacy path. On mobile it can't
   *      obtain a Drive access_token (mobile OAuth only fetches an id_token),
   *      so we intentionally skip it there and rely on Supabase.
   *
   * Both paths are attempted on web when both are available, so Drive stays
   * usable as an encrypted backup for users who set it up before Supabase.
   */
  const syncNow = useCallback(async () => {
    const backendReady = isBackendConnected();
    const onNative = isNativePlatform();

    if (backendReady) {
      const backendResult = await backendSync(profileId);
      if (onNative) {
        // Mobile: skip Drive entirely — it can't work without a Drive access_token.
        return backendResult.success;
      }
      // Web: also run Drive sync if it was previously enabled, but don't
      // let a Drive failure mask a successful Supabase sync.
      try {
        await fullSync(profileId);
      } catch { /* Drive path is best-effort */ }
      return backendResult.success;
    }

    if (onNative) {
      // Backend not connected AND we're on mobile — Drive path can't work
      // either. Surface a clean "sign in to enable sync" instead of the
      // misleading "Failed to initialize sync key" error.
      return false;
    }

    // Web fallback: legacy Drive appdata sync.
    return fullSync(profileId);
  }, [profileId]);

  const deleteCloudData = useCallback(async () => {
    if (!user?.provider) return false;
    return deleteAllCloudSyncData(user.provider as AuthProvider);
  }, [user?.provider]);

  return (
    <SyncContext.Provider
      value={{
        syncStatus,
        enableSyncForUser,
        disableSyncForUser,
        syncNow,
        deleteCloudData,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextType {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

/** Check if sync is currently enabled (can be called outside React) */
export { isSyncEnabled, syncKeyService };
