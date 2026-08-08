import { registerPlugin } from '@capacitor/core';

export interface CapturedNotification {
  package: string;
  title: string;
  text: string;
  postTime: number;
}

export interface NotificationBridgePlugin {
  /** Whether the user has granted notification access to this app. */
  isEnabled(): Promise<{ enabled: boolean }>;
  /** Open the system "Notification access" screen so the user can grant it. */
  openSettings(): Promise<void>;
  /** Drain financial notifications captured on-device since the last call. */
  getPending(): Promise<{ notifications: CapturedNotification[] }>;
}

/**
 * Native bridge to the on-device NotificationListenerService (Android only).
 * On web this proxy exists but its methods reject — always guard calls with
 * `isNativePlatform()`.
 */
export const NotificationBridge = registerPlugin<NotificationBridgePlugin>('NotificationBridge');

/** Pref key: user has turned on the notification detection source. */
export const NOTIF_SOURCE_KEY = 'autodetect_source_notifications';
