/**
 * Sync Key Service — manages the shared AES-256-GCM key for cross-device sync.
 *
 * The sync key is stored in the user's cloud appDataFolder (Google Drive / OneDrive).
 * This folder is hidden from the user's file browser and only accessible by this app.
 *
 * Flow:
 *   First device:  generateSyncKey() → export JWK → upload to cloud
 *   Other devices:  download JWK from cloud → importSyncKey()
 *
 * The key is also cached locally in localStorage for performance.
 */

import { generateSyncKey, exportSyncKey, importSyncKey } from './syncEncryptionService';
import type { AuthProvider } from '../types';

const SYNC_KEY_FILENAME = 'expenseiq-sync-key.json';
const LOCAL_CACHE_KEY = 'em_sync_key_jwk';

// Use sessionStorage for sync key cache — clears on tab close, not accessible after session ends.
// The key is always re-fetched from cloud on new sessions.
const syncKeyStorage = sessionStorage;

// ─── Token Acquisition (reuse from backupService pattern) ──

async function getAccessToken(provider: AuthProvider, promptIfNeeded = false): Promise<string | null> {
  if (provider === 'google') {
    const stored = sessionStorage.getItem('em_google_access_token');
    if (stored) return stored;

    if (!promptIfNeeded) return null;

    return new Promise((resolve) => {
      const google = (window as unknown as { google?: { accounts?: { oauth2?: { initTokenClient: (config: {
        client_id: string; scope: string; callback: (resp: { access_token?: string; error?: string }) => void;
      }) => { requestAccessToken: () => void } } } } })?.google;

      if (!google?.accounts?.oauth2?.initTokenClient) {
        resolve(null);
        return;
      }

      const clientId = localStorage.getItem('em_google_client_id') || sessionStorage.getItem('em_google_client_id');
      if (!clientId) {
        resolve(null);
        return;
      }

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.appdata',
        callback: (tokenResponse) => {
          if (tokenResponse.access_token) {
            sessionStorage.setItem('em_google_access_token', tokenResponse.access_token);
            resolve(tokenResponse.access_token);
          } else {
            resolve(null);
          }
        },
      });

      tokenClient.requestAccessToken();
    });
  }

  // Microsoft
  return sessionStorage.getItem('em_microsoft_access_token');
}

// ─── Google Drive Operations ───────────────────────────

async function findGoogleDriveFile(token: string, filename: string): Promise<string | null> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${filename}'&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.files?.[0]?.id || null;
}

async function uploadToGoogleDrive(token: string, filename: string, content: string, existingFileId?: string): Promise<boolean> {
  const metadata = {
    name: filename,
    ...(existingFileId ? {} : { parents: ['appDataFolder'] }),
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const resp = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  return resp.ok;
}

async function downloadFromGoogleDrive(token: string, fileId: string): Promise<string | null> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  return resp.text();
}

// ─── OneDrive Operations ───────────────────────────────

async function uploadToOneDrive(token: string, filename: string, content: string): Promise<boolean> {
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${filename}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: content,
    }
  );
  return resp.ok;
}

async function downloadFromOneDrive(token: string, filename: string): Promise<string | null> {
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${filename}:/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (resp.status === 404 || !resp.ok) return null;
  return resp.text();
}

// ─── Unified Cloud Operations ──────────────────────────

async function uploadFile(provider: AuthProvider, token: string, filename: string, content: string): Promise<boolean> {
  if (provider === 'google') {
    const existingId = await findGoogleDriveFile(token, filename);
    return uploadToGoogleDrive(token, filename, content, existingId || undefined);
  }
  return uploadToOneDrive(token, filename, content);
}

async function downloadFile(provider: AuthProvider, token: string, filename: string): Promise<string | null> {
  if (provider === 'google') {
    const fileId = await findGoogleDriveFile(token, filename);
    if (!fileId) return null;
    return downloadFromGoogleDrive(token, fileId);
  }
  return downloadFromOneDrive(token, filename);
}

export async function deleteCloudFile(provider: AuthProvider, token: string, filename: string): Promise<boolean> {
  if (provider === 'google') {
    const fileId = await findGoogleDriveFile(token, filename);
    if (!fileId) return true; // already gone
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    );
    return resp.ok || resp.status === 404;
  }

  // OneDrive: delete the file
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${filename}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  return resp.ok || resp.status === 404;
}

// ─── List/Delete Multiple Cloud Files ──────────────────

export async function listCloudFiles(provider: AuthProvider, token: string, prefix?: string): Promise<{ id: string; name: string }[]> {
  if (provider === 'google') {
    const query = prefix
      ? `name contains '${prefix.replace(/'/g, "\\'")}'`
      : '';
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.files || [];
  }

  // OneDrive: list children of approot
  const resp = await fetch(
    'https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$select=id,name&$top=100',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  const files: { id: string; name: string }[] = data.value || [];
  if (prefix) {
    return files.filter((f: { name: string }) => f.name.startsWith(prefix));
  }
  return files;
}

// ─── Public Sync Key API ───────────────────────────────

export const syncKeyService = {
  /**
   * Get or create the sync key.
   * 1. Check local cache
   * 2. Check cloud
   * 3. Generate new key and upload
   */
  async getOrCreateSyncKey(provider: AuthProvider): Promise<CryptoKey | null> {
    // 1. Try session cache
    const cached = syncKeyStorage.getItem(LOCAL_CACHE_KEY);
    if (cached) {
      try {
        const jwk = JSON.parse(cached) as JsonWebKey;
        return await importSyncKey(jwk);
      } catch {
        syncKeyStorage.removeItem(LOCAL_CACHE_KEY);
      }
    }

    // 2. Try downloading from cloud
    const token = await getAccessToken(provider, true);
    if (!token) return null;

    const cloudContent = await downloadFile(provider, token, SYNC_KEY_FILENAME);
    if (cloudContent) {
      try {
        const jwk = JSON.parse(cloudContent) as JsonWebKey;
        const key = await importSyncKey(jwk);
        syncKeyStorage.setItem(LOCAL_CACHE_KEY, cloudContent);
        return key;
      } catch {
        // Corrupted key in cloud — regenerate
      }
    }

    // 3. Generate new key and upload
    const newKey = await generateSyncKey();
    const jwk = await exportSyncKey(newKey);
    const jwkString = JSON.stringify(jwk);

    const uploaded = await uploadFile(provider, token, SYNC_KEY_FILENAME, jwkString);
    if (!uploaded) return null;

    syncKeyStorage.setItem(LOCAL_CACHE_KEY, jwkString);
    return newKey;
  },

  /** Check if a sync key exists in cloud (without creating one) */
  async hasSyncKey(provider: AuthProvider): Promise<boolean> {
    const cached = syncKeyStorage.getItem(LOCAL_CACHE_KEY);
    if (cached) return true;

    const token = await getAccessToken(provider, false);
    if (!token) return false;

    const content = await downloadFile(provider, token, SYNC_KEY_FILENAME);
    return content !== null;
  },

  /** Clear local sync key cache (on logout) */
  clearLocalCache(): void {
    syncKeyStorage.removeItem(LOCAL_CACHE_KEY);
  },

  /** Delete sync key from cloud (disables sync on all devices) */
  async deleteSyncKey(provider: AuthProvider): Promise<boolean> {
    const token = await getAccessToken(provider, true);
    if (!token) return false;

    const deleted = await deleteCloudFile(provider, token, SYNC_KEY_FILENAME);
    localStorage.removeItem(LOCAL_CACHE_KEY);
    return deleted;
  },

  /** Re-export cloud operations for use by syncService */
  getAccessToken,
  uploadFile,
  downloadFile,
  listCloudFiles,
  deleteCloudFile,
};
