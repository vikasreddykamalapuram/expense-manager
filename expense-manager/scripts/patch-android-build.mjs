#!/usr/bin/env node
/**
 * Patches android/app/build.gradle after `npx cap sync android` so that
 *
 *   1. Debug builds are signed with a STABLE keystore committed to the repo
 *      (android-templates/debug.keystore).
 *
 *      Without this, every CI runner auto-generates a fresh
 *      ~/.android/debug.keystore → each APK has a different signature →
 *      Android refuses in-place upgrade and shows "package conflicts with
 *      existing package". A committed debug keystore fixes that. Debug
 *      keystores are non-secret by convention (Android's own default uses
 *      "android"/"androiddebugkey"/"android"); NEVER use this for release.
 *
 *   2. versionCode / versionName are bumped every CI run so consecutive
 *      installs behave like real upgrades. Version code is taken from
 *      GITHUB_RUN_NUMBER when set, else Unix-seconds mod 2^31.
 *
 * Idempotent — safe to re-run.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ANDROID_ROOT = join(REPO_ROOT, 'android');
const BUILD_GRADLE = join(ANDROID_ROOT, 'app', 'build.gradle');
const KEYSTORE_SRC = join(REPO_ROOT, 'android-templates', 'debug.keystore');
const KEYSTORE_DEST = join(ANDROID_ROOT, 'app', 'debug.keystore');
const PKG_JSON = join(REPO_ROOT, 'package.json');

if (!existsSync(BUILD_GRADLE)) {
  console.error(`✗ android/app/build.gradle not found. Run "npx cap sync android" first.`);
  process.exit(1);
}
if (!existsSync(KEYSTORE_SRC)) {
  console.error(`✗ debug keystore missing at ${KEYSTORE_SRC}`);
  process.exit(1);
}

// 1) Copy stable debug keystore into the Android project ---------------------
copyFileSync(KEYSTORE_SRC, KEYSTORE_DEST);
console.log(`✓ debug.keystore → android/app/debug.keystore`);

// 2) Compute version info ----------------------------------------------------
const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
const baseVersion = (pkg.version || '1.0.0').split('-')[0]; // strip any -alpha etc.
const runNumber = process.env.GITHUB_RUN_NUMBER
  ? parseInt(process.env.GITHUB_RUN_NUMBER, 10)
  : Math.floor(Date.now() / 1000) % 2_000_000_000;
const versionCode = runNumber;
const versionName = `${baseVersion}.${runNumber}`;

// 3) Patch build.gradle ------------------------------------------------------
let gradle = readFileSync(BUILD_GRADLE, 'utf8');
const before = gradle;

// 3a) versionCode
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
// 3b) versionName
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

// 3c) signingConfigs.debug — insert if absent
if (!/signingConfigs\s*\{[\s\S]*?debug\s*\{/.test(gradle)) {
  const signingBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
`;
  // Inject inside `android { ... }` — right before buildTypes.
  if (/buildTypes\s*\{/.test(gradle)) {
    gradle = gradle.replace(/(\n\s*)buildTypes\s*\{/, `\n${signingBlock}$1buildTypes {`);
  } else {
    // Fallback: append near the end of `android { ... }`
    gradle = gradle.replace(/android\s*\{/, `android {\n${signingBlock}`);
  }
  console.log(`  + signingConfigs.debug block`);
}

// 3d) buildTypes.debug.signingConfig — bind to signingConfigs.debug
if (!/buildTypes\s*\{[\s\S]*?debug\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/.test(gradle)) {
  if (/buildTypes\s*\{[\s\S]*?debug\s*\{/.test(gradle)) {
    // Debug buildType exists — add signingConfig inside it.
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?debug\s*\{)/,
      `$1\n            signingConfig signingConfigs.debug`,
    );
  } else {
    // Debug buildType missing entirely — add one.
    gradle = gradle.replace(
      /buildTypes\s*\{/,
      `buildTypes {\n        debug {\n            signingConfig signingConfigs.debug\n        }`,
    );
  }
  console.log(`  + buildTypes.debug.signingConfig`);
}

if (gradle !== before) {
  writeFileSync(BUILD_GRADLE, gradle, 'utf8');
}
console.log(`✓ build.gradle patched (versionCode=${versionCode}, versionName=${versionName})`);

// Note: Capacitor 8 targets compileSdk/targetSdk 36 natively, so the previous
// androidx.browser 1.8.0 downgrade (which existed only to keep the project on
// compileSdk 35) is no longer needed and has been removed.
