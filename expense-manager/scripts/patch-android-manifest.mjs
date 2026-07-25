#!/usr/bin/env node
/**
 * Idempotently patches android/app/src/main/AndroidManifest.xml with:
 *   1. INTERNET, VIBRATE, USE_BIOMETRIC, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM
 *   2. An android.intent.action.VIEW <intent-filter> so tapping
 *      https://expenseiq.app/* links open the installed app
 *      (Android App Links — requires assetlinks.json at
 *       https://expenseiq.app/.well-known/assetlinks.json for auto-verify).
 *   3. A custom scheme fallback (expenseiq://) so deep links from local
 *      notifications work even without the App-Links verification.
 *
 * Run after `npx cap sync android`. Safe to run repeatedly — checks for
 * existing entries before adding.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const MANIFEST = join(REPO_ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const HOST = 'vikasreddykamalapuram.github.io';
const PATH_PREFIX = '/expense-manager';
const SCHEME = 'expenseiq';

if (!existsSync(MANIFEST)) {
  console.error(`✗ AndroidManifest.xml not found at ${MANIFEST}`);
  console.error('  Run "npx cap add android" first, then "npx cap sync android".');
  process.exit(1);
}

let xml = readFileSync(MANIFEST, 'utf8');
const before = xml;

const permissions = [
  'android.permission.INTERNET',
  'android.permission.VIBRATE',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
];

for (const perm of permissions) {
  if (!xml.includes(`android:name="${perm}"`)) {
    xml = xml.replace(
      /<application\b/,
      `<uses-permission android:name="${perm}" />\n    <application`,
    );
    console.log(`  + permission ${perm}`);
  }
}

// Deep-link intent filter. We inject it into the MainActivity <activity> block.
// Locate the first <activity ... android:name="...MainActivity"> and check
// whether an intent-filter with our host already exists.
const alreadyPatched = xml.includes(`android:host="${HOST}"`);
if (!alreadyPatched) {
  const filter = `
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https"
                      android:host="${HOST}"
                      android:pathPrefix="${PATH_PREFIX}" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${SCHEME}" />
            </intent-filter>
`;
  // Inject right before </activity> of MainActivity.
  const activityMatch = xml.match(/<activity[^>]*MainActivity[^>]*>[\s\S]*?<\/activity>/);
  if (activityMatch) {
    const original = activityMatch[0];
    const patched = original.replace(/<\/activity>/, `${filter}        </activity>`);
    xml = xml.replace(original, patched);
    console.log('  + deep-link intent filters');
  } else {
    console.warn('  ! MainActivity block not found — skipping deep-link injection');
  }
}

if (xml !== before) {
  writeFileSync(MANIFEST, xml, 'utf8');
  console.log('✓ AndroidManifest.xml patched');
} else {
  console.log('✓ AndroidManifest.xml already up to date');
}
