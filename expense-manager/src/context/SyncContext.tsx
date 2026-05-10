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
    return enableSync(user.provider as AuthProvider, profileId);
  }, [user?.provider, profileId]);

  const disableSyncForUser = useCallback(async () => {
    await disableSync();
  }, []);

  const syncNow = useCallback(async () => {
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
