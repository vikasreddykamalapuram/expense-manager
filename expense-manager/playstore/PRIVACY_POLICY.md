# ExpenseIQ — Privacy Policy

_Last updated: 2026-07-25_

## Summary

ExpenseIQ is a **local-first** personal-finance manager. We do not run a server that stores your financial data. We do not have accounts. We do not sell your data because we do not have your data.

## Data we do NOT collect

- Your transactions, balances, categories, budgets, receipts, or portfolio holdings.
- Your bank credentials or SMS messages. (We do not read your SMS. We do not connect to your bank.)
- Your name, email, phone number, or any personally identifying information — unless you explicitly sign in with Google or Microsoft to enable cloud backup.

## Data stored on your device

The app stores everything you enter (transactions, accounts, budgets, portfolio, receipts, settings) locally on your device in the browser's IndexedDB store. Uninstalling the app or clearing app data deletes it permanently.

## Optional cloud backup

You may optionally sign in with **your own** Google or Microsoft account to enable end-to-end encrypted cloud backup. When enabled:

- Your data is encrypted on your device using AES-256-GCM before upload, with a key derived from a passphrase you set.
- Only opaque ciphertext is uploaded to your Google Drive or OneDrive.
- We (the developer) never see your data or your encryption key.
- Sign-in tokens are stored locally and used only to authenticate directly with Google / Microsoft. No third party sees them.

## Optional crash reporting

If enabled, anonymous crash reports may be sent to Sentry to help fix bugs. Reports strip email, IP address, URL query strings, and free-text input. You can disable this at any time.

## Notifications

The app schedules local notifications on your device for daily reminders and bill due dates. These fire locally — no server is involved.

## Permissions requested

- **Internet:** to load the app, fetch live stock prices from a public GitHub-hosted file, and (if you enable it) sync with your own cloud storage.
- **Biometric / Fingerprint:** for app-lock, entirely on-device.
- **Vibrate:** for haptic feedback.
- **Post notifications:** to fire bill reminders you configure.
- **Schedule exact alarms:** to fire reminders on time.

## Contact

Questions: file an issue at https://github.com/vikasreddykamalapuram/expense-manager/issues

## Changes

We will update this page and bump the "Last updated" date if anything changes materially.
