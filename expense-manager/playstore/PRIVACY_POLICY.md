# MoneyIQ — Privacy Policy

_Last updated: 2026-08-08_

## Summary

MoneyIQ is a **local-first** personal-finance manager. Your data lives on your device by default. When you optionally sign in, a real-time synced copy is kept in a private database that only your account can read.

## Data we do NOT collect

- Your bank credentials or SMS messages. (We do not read your SMS. We do not connect to your bank.)
- Advertising identifiers. (There are no ads in MoneyIQ.)
- Anything at all if you use the app without signing in.

## Data stored on your device

The app stores everything you enter (transactions, accounts, budgets, portfolio, receipts, settings) locally in the browser's IndexedDB store. Uninstalling the app or clearing app data deletes it permanently. You can use the app fully offline, forever, without ever signing in.

## Optional cloud sync (when you sign in)

You may optionally sign in with **your own** Google or Microsoft account to enable cross-device sync. When enabled, MoneyIQ uses a private Supabase Postgres database hosted by the developer to sync your data between your devices in real time.

Data that leaves your device when sync is on:

- **Account info:** your email address and provider-issued user ID, used to identify your row in the sync database.
- **Financial data:** transactions, accounts, categories, budgets, recurring rules, stock transactions, bill reminders. This is uploaded in structured form so that changes on one device can appear on another.
- **Sync metadata:** device name (e.g. "Windows 7/28/2026") and last-sync timestamps.

How it is protected:

- **In transit:** TLS 1.3 between your device and Supabase.
- **At rest:** encrypted by Supabase (AES-256) on their managed Postgres instance.
- **Isolation:** every table has row-level security. Postgres will refuse to return any row whose `user_id` does not match the JWT of the requesting session. You cannot see anyone else's data and no one can see yours.
- **No sale, no sharing:** your data is never sold, shared, or used for advertising. The developer does not read your rows and there is no analytics on your financial content.

You can turn sync off any time (Settings → Cross-device sync → Sign out), and delete your cloud data with **Settings → Advanced → Delete cloud sync data**, which removes all your rows from the sync database while your local data is preserved.

## Optional local file backup (legacy)

An older backup feature lets you save an AES-256-GCM encrypted snapshot to your own Google Drive or OneDrive appdata folder. Only opaque ciphertext is uploaded; even Google/Microsoft cannot read it. This feature is optional and lives under Settings → Advanced.

## Optional crash reporting

If enabled, anonymous crash reports may be sent to Sentry to help fix bugs. Reports strip email, IP address, URL query strings, and free-text input. You can disable this at any time.

## Auto-detect transactions (optional, off by default)

MoneyIQ can help you capture transactions faster. Every source below is **opt-in**, runs
**entirely on your device**, and produces suggestions in an in-app **review queue** —
**nothing is saved as a transaction, transmitted, or shared until you confirm it.**

- **Shared messages:** when *you* share a bank SMS or payment message into MoneyIQ from
  another app, we parse it on-device to pre-fill a transaction.
- **Bank notifications (Android, opt-in):** if you enable it and grant Android "notification
  access", the app reads transaction-style notifications **on your device** to suggest
  transactions. It ignores non-financial notifications, keeps only a short in-memory buffer,
  and never stores or uploads notification content.
- **Gmail (read-only, opt-in):** if you tap "Scan Gmail" and grant read-only access, the app
  reads **previews** of recent bank/payment emails **on your device** to suggest transactions.
  MoneyIQ's use of information received from Google APIs adheres to the
  [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
  including the **Limited Use** requirements: Gmail data is used only on-device for this
  user-facing feature, is never transferred to others, and is never used for advertising.

You can turn any of these off at any time in Settings → Notifications → Auto-detect.

## Notifications

The app schedules local notifications on your device for daily reminders and bill due dates. These fire locally — no server is involved.

## Permissions requested

- **Internet:** to load the app, fetch live stock prices from a public GitHub-hosted file, and (if you enable it) sync with the MoneyIQ database.
- **Biometric / Fingerprint:** for app-lock, entirely on-device.
- **Vibrate:** for haptic feedback.
- **Post notifications:** to fire bill reminders you configure.
- **Schedule exact alarms:** to fire reminders on time.
- **Notification access (optional, Android):** only if you enable "Bank notifications" under
  Auto-detect. Used on-device to detect transactions; revocable anytime in system settings.
- **Gmail read-only (optional):** only if you tap "Scan Gmail". Read-only access used on-device
  to detect transactions; revocable in your Google Account permissions.

## Data deletion

- **Local:** uninstall the app, or Settings → Advanced → Clear all data.
- **Cloud:** Settings → Advanced → Delete cloud sync data. Or email the address below to request deletion.
- **Account:** Sign out on all devices, then use "Delete cloud sync data" to remove your rows.

## Contact

Questions: file an issue at https://github.com/vikasreddykamalapuram/expense-manager/issues

## Changes

We will update this page and bump the "Last updated" date if anything changes materially.
