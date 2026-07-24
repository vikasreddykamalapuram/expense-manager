/**
 * App-lock service — biometric + PIN gate for a finance app.
 *
 * Storage layout (all in @capacitor/preferences on native, localStorage on web):
 *  - lock.enabled       (bool) — master toggle
 *  - lock.biometric     (bool) — try biometric first
 *  - lock.pinSalt       (hex)  — per-install PBKDF2 salt
 *  - lock.pinHash       (hex)  — PBKDF2(pin, salt, 200_000 iters, SHA-256)
 *  - lock.idleTimeoutMs (num)  — how long the app can be backgrounded before we re-lock
 *
 * The PIN hash + salt live only on-device; we never sync them. If the user
 * loses their PIN they must factory-reset their local data (documented in
 * Settings). The stored hash is *only* an auth check — encryption of Dexie
 * data itself is a separate layer (see encryptionService.ts).
 */
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { prefs } from './preferences';
import { isNativePlatform } from './platform';

const K = {
  enabled: 'lock.enabled',
  biometric: 'lock.biometric',
  salt: 'lock.pinSalt',
  hash: 'lock.pinHash',
  idle: 'lock.idleTimeoutMs',
};

const DEFAULT_IDLE_MS = 60_000; // 1 minute in the background → re-lock
const PBKDF2_ITERS = 200_000;
const PIN_LENGTH = 6;

// ─── Hex helpers ──────────────────────────────────────────
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
function hexToBuf(hex: string): ArrayBuffer {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr.buffer;
}

// ─── PIN hashing ──────────────────────────────────────────
async function derivePinHash(pin: string, saltBuf: ArrayBuffer): Promise<ArrayBuffer> {
  const enc = new TextEncoder().encode(pin);
  const baseKey = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    baseKey,
    256,
  );
}

function newSalt(): ArrayBuffer {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytes.buffer;
}

// ─── Public API ───────────────────────────────────────────

export interface AppLockStatus {
  enabled: boolean;
  hasPin: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  biometryType: 'faceId' | 'touchId' | 'fingerprint' | 'face' | 'iris' | 'none';
  idleTimeoutMs: number;
}

async function detectBiometry(): Promise<{ available: boolean; type: AppLockStatus['biometryType'] }> {
  if (!isNativePlatform()) return { available: false, type: 'none' };
  try {
    const r = await NativeBiometric.isAvailable();
    if (!r.isAvailable) return { available: false, type: 'none' };
    switch (r.biometryType) {
      case BiometryType.FACE_ID: return { available: true, type: 'faceId' };
      case BiometryType.TOUCH_ID: return { available: true, type: 'touchId' };
      case BiometryType.FINGERPRINT: return { available: true, type: 'fingerprint' };
      case BiometryType.FACE_AUTHENTICATION: return { available: true, type: 'face' };
      case BiometryType.IRIS_AUTHENTICATION: return { available: true, type: 'iris' };
      default: return { available: true, type: 'fingerprint' };
    }
  } catch {
    return { available: false, type: 'none' };
  }
}

export const appLock = {
  DEFAULT_IDLE_MS,
  PIN_LENGTH,

  async status(): Promise<AppLockStatus> {
    const [enabled, biometricEnabled, hash, idle, bio] = await Promise.all([
      prefs.getBool(K.enabled, false),
      prefs.getBool(K.biometric, true),
      prefs.get(K.hash),
      prefs.getNumber(K.idle, DEFAULT_IDLE_MS),
      detectBiometry(),
    ]);
    return {
      enabled,
      hasPin: !!hash,
      biometricEnabled,
      biometricAvailable: bio.available,
      biometryType: bio.type,
      idleTimeoutMs: idle,
    };
  },

  /** Enable the lock — requires a PIN to be set first. */
  async enable(): Promise<void> { await prefs.setBool(K.enabled, true); },
  async disable(): Promise<void> { await prefs.setBool(K.enabled, false); },

  async setBiometricEnabled(v: boolean): Promise<void> { await prefs.setBool(K.biometric, v); },
  async setIdleTimeout(ms: number): Promise<void> { await prefs.setNumber(K.idle, ms); },

  /** Set (or replace) the PIN. Validates length. */
  async setPin(pin: string): Promise<void> {
    if (!/^\d{6}$/.test(pin)) throw new Error(`PIN must be ${PIN_LENGTH} digits`);
    const saltBuf = newSalt();
    const hashBuf = await derivePinHash(pin, saltBuf);
    await prefs.set(K.salt, bufToHex(saltBuf));
    await prefs.set(K.hash, bufToHex(hashBuf));
  },

  async clearPin(): Promise<void> {
    await prefs.remove(K.salt);
    await prefs.remove(K.hash);
  },

  async verifyPin(pin: string): Promise<boolean> {
    const [saltHex, hashHex] = await Promise.all([prefs.get(K.salt), prefs.get(K.hash)]);
    if (!saltHex || !hashHex) return false;
    const derived = await derivePinHash(pin, hexToBuf(saltHex));
    // Constant-time compare
    const a = new Uint8Array(derived);
    const b = new Uint8Array(hexToBuf(hashHex));
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  },

  /** Prompt the OS biometric dialog. Resolves true on success. */
  async promptBiometric(reason = 'Unlock ExpenseIQ'): Promise<boolean> {
    if (!isNativePlatform()) return false;
    try {
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'ExpenseIQ',
        subtitle: 'Authenticate to continue',
        description: reason,
        useFallback: false,
        negativeButtonText: 'Use PIN',
      });
      return true;
    } catch {
      return false;
    }
  },
};
