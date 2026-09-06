import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the MoneyIQ Android/iOS shell.
 *
 * `webDir` points at the Vite build output; `npx cap sync` copies it into
 * the native project (android/app/src/main/assets/public) so the shell
 * loads the same PWA bundle we ship to GitHub Pages.
 */
const config: CapacitorConfig = {
  appId: 'io.github.vikasreddykamalapuram.moneyiq',
  appName: 'MoneyIQ',
  webDir: 'dist',
  // Bind to the standard file:// origin inside the WebView. Setting a custom
  // hostname keeps localStorage/IndexedDB namespaced consistently and lets
  // us use the same OAuth-redirect behavior as the PWA.
  //
  // The two schemes differ by platform and that is deliberate, but it is also
  // load-bearing: the scheme IS the origin, and the origin is what namespaces
  // IndexedDB. Every user's entire financial history lives in that database,
  // so changing either value after release orphans real data with no migration
  // path. Treat both as frozen.
  //
  // Android is `https://localhost`; iOS stays on Capacitor's default
  // `capacitor://localhost` rather than matching it, because WKWebView treats
  // an `https` custom scheme as a real network origin and it collides with
  // genuine https requests. Anything that allow-lists an origin therefore has
  // to list BOTH — see docs/IOS_APP_STORE_PUBLISHING.md §7.
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  android: {
    // Fixes text zoom being affected by the OS accessibility text-size setting.
    // We already scale UI with Tailwind + rem; the WebView doesn't need extra scaling.
    allowMixedContent: false,
  },
  ios: {
    // Keep the WebView's own text sizing fixed for the same reason as Android:
    // the UI already scales through Tailwind rem units.
    limitsNavigationsToAppBoundDomains: false,
    // `always` keeps the web content clear of the notch / Dynamic Island and the
    // home indicator. Without it the sticky header renders under the status bar
    // on every notched device, which is an immediate App Review UI rejection.
    contentInset: 'always',
    // Match the app background so over-scroll rubber-banding doesn't flash white
    // in dark/AMOLED themes.
    backgroundColor: '#ffffff',
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
