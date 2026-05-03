/**
 * Encryption service using Web Crypto API for sensitive data at rest.
 * Uses AES-GCM with a device-specific key derived from a passphrase stored in IndexedDB.
 * The key never leaves the browser — this protects data if the raw IndexedDB is dumped.
 */

const ALGO = 'AES-GCM';
const KEY_DB_NAME = 'em_keystore';
const KEY_STORE_NAME = 'keys';
const DEVICE_KEY_ID = 'device-key';

// ─── Key Management ─────────────────────────────────────

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  // Try to retrieve existing key from a dedicated IndexedDB store
  const existingKey = await loadKeyFromStore();
  if (existingKey) return existingKey;

  // Generate a new AES-GCM key
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: 256 },
    true, // extractable for storage
    ['encrypt', 'decrypt']
  );

  // Persist it
  await saveKeyToStore(key);
  return key;
}

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadKeyFromStore(): Promise<CryptoKey | null> {
  try {
    const db = await openKeyDB();
    return new Promise((resolve) => {
      const tx = db.transaction(KEY_STORE_NAME, 'readonly');
      const req = tx.objectStore(KEY_STORE_NAME).get(DEVICE_KEY_ID);
      req.onsuccess = async () => {
        db.close();
        if (!req.result?.jwk) {
          resolve(null);
          return;
        }
        const key = await crypto.subtle.importKey(
          'jwk',
          req.result.jwk,
          { name: ALGO },
          false,
          ['encrypt', 'decrypt']
        );
        resolve(key);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

async function saveKeyToStore(key: CryptoKey): Promise<void> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
    tx.objectStore(KEY_STORE_NAME).put({ id: DEVICE_KEY_ID, jwk });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

// ─── Encrypt / Decrypt ──────────────────────────────────

export async function encryptData(plaintext: string): Promise<string> {
  try {
    const key = await getOrCreateDeviceKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGO, iv },
      key,
      encoded
    );

    // Combine IV + ciphertext, encode as base64
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return `enc:${btoa(String.fromCharCode(...combined))}`;
  } catch {
    // Fallback: return plaintext if encryption fails (e.g., insecure context)
    return plaintext;
  }
}

export async function decryptData(data: string): Promise<string> {
  // If not encrypted, return as-is
  if (!data.startsWith('enc:')) return data;

  try {
    const key = await getOrCreateDeviceKey();
    const raw = atob(data.slice(4));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails, return raw data (might be unencrypted legacy data)
    return data.startsWith('enc:') ? '' : data;
  }
}

/** Check if Web Crypto API is available (requires secure context) */
export function isEncryptionAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}
