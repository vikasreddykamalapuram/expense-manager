/**
 * Runtime helpers for detecting whether we're running inside the Capacitor
 * native shell (Android/iOS APK/IPA) vs a plain web browser or PWA.
 *
 * All Capacitor plugin calls are lazy-imported in nativeShell.ts so the web
 * build never actually loads the native adapters — the plugins ship
 * web-fallback implementations, but skipping the import keeps the vendor
 * bundle smaller and avoids `Capacitor is not defined`-style warnings.
 */
import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getPlatform(): 'android' | 'ios' | 'web' {
  try {
    const p = Capacitor.getPlatform();
    if (p === 'android' || p === 'ios') return p;
    return 'web';
  } catch {
    return 'web';
  }
}

export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

export function isIos(): boolean {
  return getPlatform() === 'ios';
}
