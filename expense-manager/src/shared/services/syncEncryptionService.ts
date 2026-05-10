/**
 * Sync Encryption Service — E2E encryption for cross-device sync.
 * Uses AES-256-GCM with a shared sync key (stored in cloud appDataFolder).
 * Separate from device-local encryptionService.ts which uses a device-specific key.
 */

const SYNC_ALGO = 'AES-GCM';
const IV_LENGTH = 12;

/**
 * Generate a new AES-256-GCM key for sync encryption.
 * Called once when sync is first enabled on any device.
 */
export async function generateSyncKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: SYNC_ALGO, length: 256 },
    true, // extractable — needed for export to cloud
    ['encrypt', 'decrypt']
  );
}

/** Export sync key as JWK for cloud storage */
export async function exportSyncKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

/** Import sync key from JWK (downloaded from cloud) */
export async function importSyncKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: SYNC_ALGO },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data for sync upload.
 * Returns base64-encoded string: IV (12 bytes) + ciphertext.
 */
export async function encryptForSync(plaintext: string, syncKey: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: SYNC_ALGO, iv },
    syncKey,
    encoded
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt data from sync download.
 * Expects base64-encoded string: IV (12 bytes) + ciphertext.
 */
export async function decryptFromSync(encryptedBase64: string, syncKey: CryptoKey): Promise<string> {
  const combined = base64ToArrayBuffer(encryptedBase64);
  const bytes = new Uint8Array(combined);

  const iv = bytes.slice(0, IV_LENGTH);
  const ciphertext = bytes.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: SYNC_ALGO, iv },
    syncKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ─── Helpers ────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
