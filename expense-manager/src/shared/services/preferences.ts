/**
 * Cross-platform key/value storage.
 *
 * On native (Android/iOS) uses @capacitor/preferences, which persists in
 * SharedPreferences (Android) / UserDefaults (iOS) — survives web-view
 * cache clears and gives us a stable place to keep PIN hashes, salts,
 * and the biometric-enabled flag independent of IndexedDB.
 *
 * On web falls back to localStorage. Keys are namespaced so we don't
 * collide with other localStorage users.
 */
import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from './platform';

const NS = 'expenseiq_';

async function nativeGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key: NS + key });
  return value;
}

async function nativeSet(key: string, value: string): Promise<void> {
  await Preferences.set({ key: NS + key, value });
}

async function nativeRemove(key: string): Promise<void> {
  await Preferences.remove({ key: NS + key });
}

function webGet(key: string): string | null {
  try { return localStorage.getItem(NS + key); } catch { return null; }
}
function webSet(key: string, value: string): void {
  try { localStorage.setItem(NS + key, value); } catch { /* ignore */ }
}
function webRemove(key: string): void {
  try { localStorage.removeItem(NS + key); } catch { /* ignore */ }
}

export const prefs = {
  async get(key: string): Promise<string | null> {
    return isNativePlatform() ? nativeGet(key) : webGet(key);
  },
  async set(key: string, value: string): Promise<void> {
    return isNativePlatform() ? nativeSet(key, value) : webSet(key, value);
  },
  async remove(key: string): Promise<void> {
    return isNativePlatform() ? nativeRemove(key) : webRemove(key);
  },
  async getBool(key: string, fallback = false): Promise<boolean> {
    const v = await this.get(key);
    if (v === null) return fallback;
    return v === 'true';
  },
  async setBool(key: string, value: boolean): Promise<void> {
    return this.set(key, String(value));
  },
  async getNumber(key: string, fallback = 0): Promise<number> {
    const v = await this.get(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  },
  async setNumber(key: string, value: number): Promise<void> {
    return this.set(key, String(value));
  },
};
