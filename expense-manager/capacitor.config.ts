import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the ExpenseIQ Android/iOS shell.
 *
 * `webDir` points at the Vite build output; `npx cap sync` copies it into
 * the native project (android/app/src/main/assets/public) so the shell
 * loads the same PWA bundle we ship to GitHub Pages.
 */
const config: CapacitorConfig = {
  appId: 'com.expenseiq.app',
  appName: 'ExpenseIQ',
  webDir: 'dist',
  // Bind to the standard file:// origin inside the WebView. Setting a custom
  // hostname keeps localStorage/IndexedDB namespaced consistently and lets
  // us use the same OAuth-redirect behavior as the PWA.
  server: {
    androidScheme: 'https',
  },
  android: {
    // Fixes text zoom being affected by the OS accessibility text-size setting.
    // We already scale UI with Tailwind + rem; the WebView doesn't need extra scaling.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#2563eb',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
