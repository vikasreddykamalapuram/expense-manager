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

// 2. Inject signingConfigs.release inside the `android { ... }` block.
if (!gradle.includes('signingConfigs')) {
  gradle = gradle.replace(
    /android\s*\{/,
    `android {
    signingConfigs {
        release {
            if (keystoreProperties['storeFile'] != null) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }`,
  );
  console.log('  + signingConfigs.release');
}

// 3. Wire signingConfig into the release buildType.
if (!gradle.match(/release\s*\{[^}]*signingConfig\s+signingConfigs\.release/)) {
  gradle = gradle.replace(
    /release\s*\{/,
    `release {
            signingConfig signingConfigs.release`,
  );
  console.log('  + buildTypes.release.signingConfig');
}

// 4. Allow versionCode / versionName override via -P.
if (!gradle.includes("project.hasProperty('versionCode')")) {
  gradle = gradle.replace(
    /versionCode\s+\d+/,
    "versionCode project.hasProperty('versionCode') ? project.getProperty('versionCode').toInteger() : 1",
  );
  gradle = gradle.replace(
    /versionName\s+"[^"]*"/,
    'versionName project.hasProperty(\'versionName\') ? project.getProperty(\'versionName\') : "3.1.0"',
  );
  console.log('  + versionCode/versionName override');
}

if (gradle !== before) {
  writeFileSync(GRADLE_FILE, gradle, 'utf8');
  console.log('✓ android/app/build.gradle patched');
} else {
  console.log('✓ android/app/build.gradle already up to date');
}
