#!/usr/bin/env node
/**
 * Idempotently injects a `signingConfigs.release` block into
 * android/app/build.gradle and wires it into the release buildType.
 *
 * Expects a keystore.properties file at android/keystore.properties with:
 *   storeFile=release.keystore
 *   storePassword=...
 *   keyAlias=...
 *   keyPassword=...
 *
 * Also lets CI override versionCode/versionName via -PversionCode / -PversionName.
 * Run once locally after `npx cap add android`, or from CI before ./gradlew bundleRelease.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const GRADLE_FILE = join(REPO_ROOT, 'android', 'app', 'build.gradle');

if (!existsSync(GRADLE_FILE)) {
  console.error(`✗ build.gradle not found at ${GRADLE_FILE}`);
  console.error('  Run "npx cap add android" first.');
  process.exit(1);
}

let gradle = readFileSync(GRADLE_FILE, 'utf8');
const before = gradle;

// 1. Load keystore.properties at the top of the file.
if (!gradle.includes('keystore.properties')) {
  const loader = `
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

`;
  gradle = loader + gradle;
  console.log('  + keystore.properties loader');
}

// 2. Inject signingConfigs.release.
//
// IMPORTANT: patch-android-build.mjs may have already added
// `signingConfigs { debug { ... } }`. If so, we insert `release { ... }` INSIDE
// that existing block. Otherwise we create a fresh `signingConfigs { release { ... } }`
// inside `android { ... }`.
const releaseSigningBlock = `        release {
            if (keystoreProperties['storeFile'] != null) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
`;

// Detect an existing signingConfigs.release{} that we (or somebody) already added.
const hasReleaseSigning = /signingConfigs\s*\{[\s\S]*?release\s*\{[\s\S]*?storeFile/.test(gradle);

if (!hasReleaseSigning) {
  if (/signingConfigs\s*\{/.test(gradle)) {
    // signingConfigs exists (e.g. debug from patch-android-build.mjs).
    // Insert `release { ... }` right after the opening brace of signingConfigs.
    gradle = gradle.replace(
      /(signingConfigs\s*\{\n)/,
      `$1${releaseSigningBlock}`,
    );
    console.log('  + signingConfigs.release (inside existing signingConfigs)');
  } else {
    // No signingConfigs block yet — create the whole thing inside android { ... }.
    gradle = gradle.replace(
      /android\s*\{/,
      `android {
    signingConfigs {
${releaseSigningBlock}    }`,
    );
    console.log('  + signingConfigs { release { ... } } (new)');
  }
}

// 3. Wire signingConfigs.release into buildTypes.release.
//
// Anchor specifically on `buildTypes { ... release {` — NOT the bare
// `release {` (which would match signingConfigs.release we just added).
const buildTypesReleaseRe = /(buildTypes\s*\{[\s\S]*?release\s*\{)/;
const alreadyWired = /buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/.test(gradle);

if (!alreadyWired) {
  if (buildTypesReleaseRe.test(gradle)) {
    gradle = gradle.replace(
      buildTypesReleaseRe,
      `$1
            signingConfig signingConfigs.release`,
    );
    console.log('  + buildTypes.release.signingConfig');
  } else {
    console.error('✗ Could not find buildTypes.release {} block — build.gradle shape is unexpected.');
    process.exit(1);
  }
}

// 4. Allow versionCode / versionName override via -P.
// (Skipped when patch-android-build.mjs has already replaced the literals with
// concrete numbers — that path uses ORG_GRADLE_PROJECT_versionCode env instead.)
if (!gradle.includes("project.hasProperty('versionCode')") && /versionCode\s+\d+/.test(gradle)) {
  gradle = gradle.replace(
    /versionCode\s+\d+/,
    "versionCode project.hasProperty('versionCode') ? project.getProperty('versionCode').toInteger() : 1",
  );
  gradle = gradle.replace(
    /versionName\s+"[^"]*"/,
    'versionName project.hasProperty(\'versionName\') ? project.getProperty(\'versionName\') : "3.2.0"',
  );
  console.log('  + versionCode/versionName override');
}

if (gradle !== before) {
  writeFileSync(GRADLE_FILE, gradle, 'utf8');
  console.log('✓ android/app/build.gradle patched');
} else {
  console.log('✓ android/app/build.gradle already up to date');
}
