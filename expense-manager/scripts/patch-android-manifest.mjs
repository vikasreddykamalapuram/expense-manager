#!/usr/bin/env node
/**
 * Idempotently patches android/app/src/main/AndroidManifest.xml with:
 *   1. INTERNET, VIBRATE, USE_BIOMETRIC, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM
 *   2. VIEW intent-filters for App Links (https) + custom scheme (expenseiq://)
 *   3. SEND / SEND_MULTIPLE intent-filter so users can share bank SMS or
 *      receipt text into ExpenseIQ (parsed by shareParser.ts to prefill /add).
 *   4. <meta-data android:name="android.app.shortcuts" ...> pointer so
 *      long-pressing the launcher icon shows our 4 quick actions.
 *
 * Also copies android/shortcuts.xml (source of truth in the repo) into
 * android/app/src/main/res/xml/shortcuts.xml so gradle can package it.
 *
 * Run after `npx cap sync android`. Safe to run repeatedly — checks for
 * existing entries before adding.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ANDROID_ROOT = join(REPO_ROOT, 'android');
const MAIN_SRC = join(ANDROID_ROOT, 'app', 'src', 'main');
const MANIFEST = join(MAIN_SRC, 'AndroidManifest.xml');
const STRINGS = join(MAIN_SRC, 'res', 'values', 'strings.xml');
const SHORTCUTS_SRC = join(REPO_ROOT, 'android-templates', 'shortcuts.xml');
const SHORTCUTS_DEST = join(MAIN_SRC, 'res', 'xml', 'shortcuts.xml');
const STRINGS_EXTRAS = join(REPO_ROOT, 'android-templates', 'strings-extras.xml');
const WIDGET_TEMPLATE_DIR = join(REPO_ROOT, 'android-templates', 'widget');
const WIDGET_KOTLIN_DEST = join(MAIN_SRC, 'java', 'com', 'expenseiq', 'app', 'ExpenseWidgetProvider.kt');
const WIDGET_BRIDGE_DEST = join(MAIN_SRC, 'java', 'com', 'expenseiq', 'app', 'WidgetBridgePlugin.kt');
const MAIN_ACTIVITY_DEST = join(MAIN_SRC, 'java', 'com', 'expenseiq', 'app', 'MainActivity.kt');
const WIDGET_LAYOUT_DEST = join(MAIN_SRC, 'res', 'layout', 'widget_expense.xml');
const WIDGET_INFO_DEST = join(MAIN_SRC, 'res', 'xml', 'expense_widget_info.xml');

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

// ---------- Deep-link + share intent filters (injected into MainActivity) ----------
const activityMatch = xml.match(/<activity[^>]*MainActivity[^>]*>[\s\S]*?<\/activity>/);
if (!activityMatch) {
  console.warn('  ! MainActivity block not found — skipping intent-filter injection');
} else {
  let activityBlock = activityMatch[0];
  const originalActivity = activityBlock;

  // 1. Deep links (https App Link + expenseiq:// custom scheme)
  if (!activityBlock.includes(`android:host="${HOST}"`)) {
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
    activityBlock = activityBlock.replace(/<\/activity>/, `${filter}        </activity>`);
    console.log('  + deep-link intent filters');
  }

  // 2. Share target — receive text from other apps (bank SMS, receipts, links).
  if (!activityBlock.includes('android.intent.action.SEND')) {
    const shareFilter = `
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.SEND_MULTIPLE" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>
`;
    activityBlock = activityBlock.replace(/<\/activity>/, `${shareFilter}        </activity>`);
    console.log('  + share-target intent filters (SEND / SEND_MULTIPLE)');
  }

  // 3. App Shortcuts meta-data (points at res/xml/shortcuts.xml).
  if (!activityBlock.includes('android.app.shortcuts')) {
    const shortcutsMeta = `            <meta-data android:name="android.app.shortcuts"
                android:resource="@xml/shortcuts" />
`;
    activityBlock = activityBlock.replace(/<\/activity>/, `${shortcutsMeta}        </activity>`);
    console.log('  + shortcuts meta-data');
  }

  if (activityBlock !== originalActivity) {
    xml = xml.replace(originalActivity, activityBlock);
  }
}

// ---------- Widget receiver (sibling of MainActivity inside <application>) ----------
if (!xml.includes('ExpenseWidgetProvider')) {
  const receiver = `
        <receiver
            android:name="com.expenseiq.app.ExpenseWidgetProvider"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/expense_widget_info" />
        </receiver>
`;
  xml = xml.replace(/<\/application>/, `${receiver}    </application>`);
  console.log('  + widget <receiver>');
}

if (xml !== before) {
  writeFileSync(MANIFEST, xml, 'utf8');
  console.log('✓ AndroidManifest.xml patched');
} else {
  console.log('✓ AndroidManifest.xml already up to date');
}

// ---------- Copy shortcuts.xml resource ----------
if (existsSync(SHORTCUTS_SRC)) {
  mkdirSync(dirname(SHORTCUTS_DEST), { recursive: true });
  copyFileSync(SHORTCUTS_SRC, SHORTCUTS_DEST);
  console.log(`✓ shortcuts.xml → ${SHORTCUTS_DEST.replace(REPO_ROOT, '.')}`);
} else {
  console.warn(`  ! shortcuts template missing at ${SHORTCUTS_SRC} — skipping`);
}

// ---------- Copy widget files ----------
const widgetFiles = [
  [join(WIDGET_TEMPLATE_DIR, 'ExpenseWidgetProvider.kt'), WIDGET_KOTLIN_DEST],
  [join(WIDGET_TEMPLATE_DIR, 'WidgetBridgePlugin.kt'), WIDGET_BRIDGE_DEST],
  [join(WIDGET_TEMPLATE_DIR, 'MainActivity.kt'), MAIN_ACTIVITY_DEST],
  [join(WIDGET_TEMPLATE_DIR, 'widget_expense.xml'), WIDGET_LAYOUT_DEST],
  [join(WIDGET_TEMPLATE_DIR, 'expense_widget_info.xml'), WIDGET_INFO_DEST],
];
for (const [src, dest] of widgetFiles) {
  if (existsSync(src)) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    console.log(`✓ ${dest.replace(REPO_ROOT, '.')}`);
  } else {
    console.warn(`  ! widget file missing at ${src}`);
  }
}

// ---------- Merge extra string resources ----------
if (existsSync(STRINGS_EXTRAS) && existsSync(STRINGS)) {
  const extras = readFileSync(STRINGS_EXTRAS, 'utf8');
  let strings = readFileSync(STRINGS, 'utf8');
  const extraStringNames = [...extras.matchAll(/<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)];
  let added = 0;
  for (const [full, name] of extraStringNames) {
    if (!strings.includes(`name="${name}"`)) {
      strings = strings.replace(/<\/resources>/, `    ${full}\n</resources>`);
      added++;
    }
  }
  if (added > 0) {
    writeFileSync(STRINGS, strings, 'utf8');
    console.log(`✓ strings.xml: ${added} new string(s) merged`);
  } else {
    console.log('✓ strings.xml already has all shortcut/widget strings');
  }
}

