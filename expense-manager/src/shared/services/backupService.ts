/**
 * Cloud Backup Service — backs up/restores ExpenseIQ data to Google Drive or OneDrive.
 * Uses the App Data folder (hidden from user's main Drive/OneDrive view).
 *
 * Both providers require the user to be authenticated with the correct scopes:
 *   - Google: https://www.googleapis.com/auth/drive.appdata
 *   - Microsoft: Files.ReadWrite.AppFolder
 */

import { repository } from './repository';

const BACKUP_FILENAME = 'expenseiq-backup.json';

export interface BackupMetadata {
  id: string;
  name: string;
  modifiedTime: string;
  size: number;
  provider: 'google' | 'microsoft';
}

export interface BackupResult {
  success: boolean;
  message: string;
  metadata?: BackupMetadata;
}

// ─── Token Acquisition ─────────────────────────────────

/** Get Google access token from current session (requires gapi or @react-oauth flow) */
async function getGoogleAccessToken(): Promise<string | null> {
  // In production, the GoogleOAuthProvider gives us a credential (ID token).
  // For Drive API access, we need an access_token from the OAuth2 code flow.
  // For now, we check if there's a token stored by the auth flow.
  const stored = sessionStorage.getItem('em_google_access_token');
  return stored;
}

/** Get Microsoft access token using MSAL (acquired during login) */
async function getMicrosoftAccessToken(): Promise<string | null> {
  const stored = sessionStorage.getItem('em_microsoft_access_token');
  return stored;
}

// ─── Google Drive Backup ────────────────────────────────

async function findGoogleDriveFile(token: string): Promise<string | null> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id,name,modifiedTime,size)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.files?.[0]?.id || null;
}

async function googleDriveBackup(profileId: string): Promise<BackupResult> {
  const token = await getGoogleAccessToken();
  if (!token) {
    return { success: false, message: 'Not signed in with Google. Please sign in first.' };
  }

  try {
    const jsonData = await repository.exportData(profileId);
    const existingFileId = await findGoogleDriveFile(token);

    const metadata = {
      name: BACKUP_FILENAME,
      ...(existingFileId ? {} : { parents: ['appDataFolder'] }),
      mimeType: 'application/json',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([jsonData], { type: 'application/json' }));

    const url = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const resp = await fetch(url, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, message: `Google Drive upload failed: ${err}` };
    }

    const file = await resp.json();
    return {
      success: true,
      message: 'Backup saved to Google Drive',
      metadata: {
        id: file.id,
        name: BACKUP_FILENAME,
        modifiedTime: file.modifiedTime || new Date().toISOString(),
        size: jsonData.length,
        provider: 'google',
      },
    };
  } catch (err: unknown) {
    return { success: false, message: `Google Drive backup failed: ${(err as Error).message}` };
  }
}

async function googleDriveRestore(): Promise<{ success: boolean; data?: string; message: string }> {
  const token = await getGoogleAccessToken();
  if (!token) {
    return { success: false, message: 'Not signed in with Google.' };
  }

  try {
    const fileId = await findGoogleDriveFile(token);
    if (!fileId) {
      return { success: false, message: 'No backup found on Google Drive.' };
    }

    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!resp.ok) {
      return { success: false, message: 'Failed to download backup from Google Drive.' };
    }

    const data = await resp.text();
    return { success: true, data, message: 'Backup restored from Google Drive' };
  } catch (err: unknown) {
    return { success: false, message: `Restore failed: ${(err as Error).message}` };
  }
}

async function googleDriveGetInfo(): Promise<BackupMetadata | null> {
  const token = await getGoogleAccessToken();
  if (!token) return null;

  try {
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id,name,modifiedTime,size)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const file = data.files?.[0];
    if (!file) return null;
    return {
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      size: parseInt(file.size || '0', 10),
      provider: 'google',
    };
  } catch {
    return null;
  }
}

// ─── OneDrive Backup ────────────────────────────────────

async function oneDriveBackup(profileId: string): Promise<BackupResult> {
  const token = await getMicrosoftAccessToken();
  if (!token) {
    return { success: false, message: 'Not signed in with Microsoft. Please sign in first.' };
  }

  try {
    const jsonData = await repository.exportData(profileId);

    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${BACKUP_FILENAME}:/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: jsonData,
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, message: `OneDrive upload failed: ${err}` };
    }

    const file = await resp.json();
    return {
      success: true,
      message: 'Backup saved to OneDrive',
      metadata: {
        id: file.id,
        name: BACKUP_FILENAME,
        modifiedTime: file.lastModifiedDateTime || new Date().toISOString(),
        size: jsonData.length,
        provider: 'microsoft',
      },
    };
  } catch (err: unknown) {
    return { success: false, message: `OneDrive backup failed: ${(err as Error).message}` };
  }
}

async function oneDriveRestore(): Promise<{ success: boolean; data?: string; message: string }> {
  const token = await getMicrosoftAccessToken();
  if (!token) {
    return { success: false, message: 'Not signed in with Microsoft.' };
  }

  try {
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${BACKUP_FILENAME}:/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (resp.status === 404) {
      return { success: false, message: 'No backup found on OneDrive.' };
    }

    if (!resp.ok) {
      return { success: false, message: 'Failed to download backup from OneDrive.' };
    }

    const data = await resp.text();
    return { success: true, data, message: 'Backup restored from OneDrive' };
  } catch (err: unknown) {
    return { success: false, message: `Restore failed: ${(err as Error).message}` };
  }
}

async function oneDriveGetInfo(): Promise<BackupMetadata | null> {
  const token = await getMicrosoftAccessToken();
  if (!token) return null;

  try {
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${BACKUP_FILENAME}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return null;
    const file = await resp.json();
    return {
      id: file.id,
      name: file.name,
      modifiedTime: file.lastModifiedDateTime,
      size: file.size || 0,
      provider: 'microsoft',
    };
  } catch {
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────

export const backupService = {
  /** Backup data to the user's cloud provider */
  async backup(provider: 'google' | 'microsoft', profileId: string): Promise<BackupResult> {
    if (provider === 'google') return googleDriveBackup(profileId);
    return oneDriveBackup(profileId);
  },

  /** Restore data from cloud provider — returns JSON string */
  async restore(provider: 'google' | 'microsoft'): Promise<{ success: boolean; data?: string; message: string }> {
    if (provider === 'google') return googleDriveRestore();
    return oneDriveRestore();
  },

  /** Get info about existing backup (if any) */
  async getBackupInfo(provider: 'google' | 'microsoft'): Promise<BackupMetadata | null> {
    if (provider === 'google') return googleDriveGetInfo();
    return oneDriveGetInfo();
  },

  /** Store access token for a provider (called after OAuth login) */
  storeAccessToken(provider: 'google' | 'microsoft', token: string): void {
    const key = provider === 'google' ? 'em_google_access_token' : 'em_microsoft_access_token';
    sessionStorage.setItem(key, token);
  },

  /** Clear stored access token */
  clearAccessToken(provider: 'google' | 'microsoft'): void {
    const key = provider === 'google' ? 'em_google_access_token' : 'em_microsoft_access_token';
    sessionStorage.removeItem(key);
  },
};
