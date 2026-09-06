#!/usr/bin/env node
/**
 * Idempotently patches ios/App/App/Info.plist with everything Capacitor's
 * template does not know about:
 *   1. Purpose strings for every OS permission the app can actually trigger
 *      (camera, photo library, Face ID).
 *   2. The `moneyiq://` custom URL scheme, mirroring the Android deep-link
 *      intent-filter added by patch-android-manifest.mjs.
 *   3. ITSAppUsesNonExemptEncryption=false so TestFlight stops asking the
 *      export-compliance question on every single upload.
 *
 * Run after `npx cap sync ios`. Safe to run repeatedly — every mutation
 * checks for the key first.
 *
 * WHY PURPOSE STRINGS ARE A BUILD CONCERN AND NOT A DETAIL
 * --------------------------------------------------------
 * On iOS a missing purpose string is not a warning and not a denied
 * permission — the OS kills the process the instant the API is touched. The
 * receipt scanner uses `<input type="file" accept="image/*" capture="environment">`
 * (see ReceiptCapture.tsx / ScanReceiptPage.tsx). That is plain HTML, so
 * nothing in the TypeScript, the lint pass or the unit tests can tell you a
 * plist key is missing; the app builds green, installs fine, and hard-crashes
 * the first time a user taps "Scan receipt".
 *
 * This is the same class of bug as the Kotlin-never-compiled landmine on
 * Android (see verify-android-native.mjs): the build is not evidence, the
 * artifact is. verify-ios-bundle.mjs re-checks these keys in the built .ipa
 * for exactly that reason.
 *
 * WHAT IS DELIBERATELY *NOT* HERE
 * -------------------------------
 * NSMicrophoneUsageDescription / NSSpeechRecognitionUsageDescription are
 * absent on purpose. Voice entry is gated to Android (`nativeSpeech.ts`
 * returns `isNativePlatform() && isAndroid()`), so on iOS the mic is
 * unreachable. Declaring a purpose string for a permission the build cannot
 * exercise invites an App Review question we would have no answer to.
 * When Epic V.4 ships iOS voice via SFSpeechRecognizer, BOTH keys must be
 * added together — missing either one crashes on first use and fails
 * Guideline 5.1.1.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PLIST = join(REPO_ROOT, 'ios', 'App', 'App', 'Info.plist');

const URL_SCHEME = 'moneyiq';

/**
 * Purpose strings are user-facing text shown in the system permission dialog.
 * App Review rejects generic ones ("This app needs camera access"), so each
 * says what is captured and what is done with it. The on-device claim is not
 * marketing: OCR runs locally through tesseract.js and must stay consistent
 * with the Play Data Safety declaration and the privacy policy.
 */
const PURPOSE_STRINGS = {
  NSCameraUsageDescription:
    'MoneyIQ uses the camera so you can photograph a receipt and have its amount, ' +
    'date and merchant read automatically. Photos are processed on your device and ' +
    'are never uploaded.',
  NSPhotoLibraryUsageDescription:
    'MoneyIQ needs access to your photos so you can pick an existing receipt image ' +
    'to scan. Images are processed on your device and are never uploaded.',
  NSFaceIDUsageDescription:
    'MoneyIQ uses Face ID to unlock the app so your financial data stays private if ' +
    'someone else picks up your phone.',
};

/**
 * Simple keys whose value is a plain <string>/<true/>/<false/>.
 * `type` mirrors the plist element name so the writer stays dumb.
 */
const SIMPLE_KEYS = [
  ...Object.entries(PURPOSE_STRINGS).map(([key, value]) => ({ key, value, type: 'string' })),
  {
    // Answering this in the plist stops App Store Connect asking "does your app
    // use encryption?" on every upload, which otherwise blocks the build from
    // reaching testers until a human clicks through it.
    //
    // `false` is the correct answer, not a shortcut: the app's only cryptography
    // is Web Crypto (AES-GCM) used to protect the user's own local data, plus
    // HTTPS. Both are exempt under the standard-encryption exemption. If a
    // future feature adds proprietary or non-exempt cryptography this MUST be
    // revisited — a wrong declaration here is a legal statement, not a setting.
    key: 'ITSAppUsesNonExemptEncryption',
    value: false,
    type: 'boolean',
  },
  {
    // The StatusBar plugin sets style per-screen (light content on the branded
    // header, dark elsewhere). That only works when the view controller owns
    // status-bar appearance; left at the default the plugin's calls are silently
    // ignored and the status bar is unreadable on dark backgrounds.
    key: 'UIViewControllerBasedStatusBarAppearance',
    value: true,
    type: 'boolean',
  },
];

if (!existsSync(PLIST)) {
  console.error(`✗ Info.plist not found at ${PLIST}`);
  console.error('  Run "npx cap add ios" first, then "npx cap sync ios".');
  console.error('  Note: the iOS platform can only be generated on macOS.');
  process.exit(1);
}

let plist = readFileSync(PLIST, 'utf8');
const before = plist;

/** Find the closing tag of the root <dict>, which is where new keys go. */
function insertIntoRootDict(xml, snippet) {
  const idx = xml.lastIndexOf('</dict>');
  if (idx < 0) throw new Error('Malformed Info.plist: no closing </dict>');
  return `${xml.slice(0, idx)}${snippet}${xml.slice(idx)}`;
}

function hasKey(xml, key) {
  // Anchored on the element so a key name appearing inside a <string> value
  // (e.g. prose that mentions Face ID) cannot be mistaken for a declaration.
  return new RegExp(`<key>\\s*${key}\\s*</key>`).test(xml);
}

// ---------- 1 & 3. Simple keys ----------
for (const { key, value, type } of SIMPLE_KEYS) {
  if (hasKey(plist, key)) continue;
  const rendered = type === 'boolean' ? `\t<${value}/>` : `\t<string>${value}</string>`;
  plist = insertIntoRootDict(plist, `\t<key>${key}</key>\n${rendered}\n`);
  console.log(`  + ${key}`);
}

// ---------- 2. Custom URL scheme (moneyiq://) ----------
// Mirrors the Android <data android:scheme="moneyiq" /> intent-filter so a
// single deep link works on both platforms.
//
// Universal Links (the https:// equivalent of Android App Links) are NOT set up
// here: they additionally need an `apple-app-site-association` file served from
// the web host and an Associated Domains entitlement. That is tracked as a
// follow-up because the web host is moving off GitHub Pages — wiring it to a
// domain we are about to stop using would only have to be redone.
if (!hasKey(plist, 'CFBundleURLTypes')) {
  const urlTypes =
    '\t<key>CFBundleURLTypes</key>\n' +
    '\t<array>\n' +
    '\t\t<dict>\n' +
    '\t\t\t<key>CFBundleURLName</key>\n' +
    '\t\t\t<string>io.github.vikasreddykamalapuram.moneyiq</string>\n' +
    '\t\t\t<key>CFBundleTypeRole</key>\n' +
    '\t\t\t<string>Editor</string>\n' +
    '\t\t\t<key>CFBundleURLSchemes</key>\n' +
    '\t\t\t<array>\n' +
    `\t\t\t\t<string>${URL_SCHEME}</string>\n` +
    '\t\t\t</array>\n' +
    '\t\t</dict>\n' +
    '\t</array>\n';
  plist = insertIntoRootDict(plist, urlTypes);
  console.log(`  + CFBundleURLTypes (${URL_SCHEME}://)`);
}

if (plist !== before) {
  writeFileSync(PLIST, plist, 'utf8');
  console.log('✓ Info.plist patched');
} else {
  console.log('✓ Info.plist already up to date');
}
