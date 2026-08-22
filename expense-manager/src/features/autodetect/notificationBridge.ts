import { registerPlugin } from '@capacitor/core';

export interface CapturedNotification {
  package: string;
  title: string;
  text: string;
  postTime: number;
}

export interface NotificationBridgeStatus {
  /** User has granted notification access in system settings. */
  granted: boolean;
  /** Android has actually bound our listener service (granted != bound). */
  connected: boolean;
  /** Captures waiting to be drained right now. */
  buffered: number;
  /** Lifetime count of financial notifications captured on this device. */
  capturedTotal: number;
  /** Epoch ms of the most recent capture, or 0 if nothing has ever been captured. */
  lastCapturedAt: number;
}

export interface NotificationBridgePlugin {
  /** Whether the user has granted notification access to this app. */
  isEnabled(): Promise<{ enabled: boolean }>;
  /** Open the system "Notification access" screen so the user can grant it. */
  openSettings(): Promise<void>;
  /** Drain financial notifications captured on-device since the last call. */
  getPending(): Promise<{ notifications: CapturedNotification[] }>;
  /** Diagnostics — lets Settings show whether detection is actually alive. */
  getStatus(): Promise<NotificationBridgeStatus>;
}

/**
 * Native bridge to the on-device NotificationListenerService (Android only).
 * On web this proxy exists but its methods reject — always guard calls with
 * `isNativePlatform()`.
 */
export const NotificationBridge = registerPlugin<NotificationBridgePlugin>('NotificationBridge');

/** Pref key: user has turned on the notification detection source. */
export const NOTIF_SOURCE_KEY = 'autodetect_source_notifications';
