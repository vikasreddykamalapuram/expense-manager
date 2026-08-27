#!/usr/bin/env node
/**
 * Fails the build unless the app's native Kotlin classes are actually present
 * inside the produced APK/AAB.
 *
 * WHY THIS EXISTS
 * ---------------
 * Capacitor's Android template is Java-only. For months every APK built green
 * while silently shipping none of our Kotlin: Gradle without the Kotlin plugin
 * ignores `.kt` files instead of failing on them. The manifest still declared
 * the notification-listener <service> and the widget <receiver>, so the app
 * looked correct — users could grant notification access — but Android could
 * never instantiate the classes, so auto-detection captured nothing and every
 * native bridge call from JS rejected.
 *
 * A green Gradle build proves nothing here. The only real proof is the shipped
 * artifact, so that is what this script checks.
 *
 * Usage:  node scripts/verify-android-native.mjs [path/to/app.apk]
 * Default: android/app/build/outputs/apk/debug/app-debug.apk
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

/** Classes that MUST be compiled into the artifact for the app to work. */
const REQUIRED = [
  'io/github/vikasreddykamalapuram/moneyiq/MainActivity',
  'io/github/vikasreddykamalapuram/moneyiq/NotificationBridgePlugin',
  'io/github/vikasreddykamalapuram/moneyiq/MoneyIqNotificationListener',
  'io/github/vikasreddykamalapuram/moneyiq/WidgetBridgePlugin',
  'io/github/vikasreddykamalapuram/moneyiq/ExpenseWidgetProvider',
  'io/github/vikasreddykamalapuram/moneyiq/SpeechBridgePlugin',
];

/**
 * `MainActivity` is a meaningful check only because patch-android-manifest.mjs
 * deletes Capacitor's generated MainActivity.java. Our MainActivity.kt is then
 * the sole source for that class, so if Kotlin does not compile there is no
 * MainActivity in the artifact at all.
 *
 * Deliberately NOT checked: the presence of `Lkotlin/Metadata;`. Several
 * dependency AARs are written in Kotlin, so that marker is present even when
 * none of OUR Kotlin compiled — it passes on a known-broken APK and would give
 * false confidence.
 */

// ---------------------------------------------------------------------------
// Minimal ZIP reader (no third-party deps; an APK is just a ZIP).
// ---------------------------------------------------------------------------
function findEocd(buf) {
  const sig = 0x06054b50;
  // EOCD is at most 22 bytes + 64KB comment.
  const start = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === sig) return i;
  }
  return -1;
}

function listEntries(buf) {
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error('Not a ZIP archive (no end-of-central-directory record)');
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break; // central header signature
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    entries.push({ name, method, compressedSize, localOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf, entry) {
  const lo = entry.localOffset;
  if (buf.readUInt32LE(lo) !== 0x04034b50) throw new Error(`Bad local header for ${entry.name}`);
  const nameLen = buf.readUInt16LE(lo + 26);
  const extraLen = buf.readUInt16LE(lo + 28);
  const dataStart = lo + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + entry.compressedSize);
  return entry.method === 0 ? raw : inflateRawSync(raw);
}

// ---------------------------------------------------------------------------
/** Pick the single .apk/.aab inside a directory, ignoring stray files. */
function artifactInDir(dir) {
  if (!existsSync(dir)) return null;
  const hit = readdirSync(dir).find((f) => f.endsWith('.apk') || f.endsWith('.aab'));
  return hit ? join(dir, hit) : null;
}

/**
 * Accepts a file OR a directory. Passing the directory is preferred in CI:
 * AGP's output filename varies (app-release.apk vs app-release-unsigned.apk
 * depending on whether a signingConfig is present), and a hardcoded name turns
 * a rename into a confusing "no APK found" failure.
 */
function resolveArtifact() {
  const fromArg = process.argv[2];
  if (fromArg) {
    if (!existsSync(fromArg)) return fromArg; // report the path the caller asked for
    return statSync(fromArg).isDirectory() ? artifactInDir(fromArg) : fromArg;
  }
  const out = join(REPO_ROOT, 'android', 'app', 'build', 'outputs');
  return artifactInDir(join(out, 'apk', 'debug'));
}

const artifact = resolveArtifact();
if (!artifact || !existsSync(artifact)) {
  console.error(`✗ No APK/AAB found${artifact ? ` at ${artifact}` : ''}. Build one first, or pass a path.`);
  process.exit(1);
}

console.log(`Verifying native classes in ${artifact}`);
const zip = readFileSync(artifact);
// APKs hold `classes.dex` at the root; AABs nest them per-module under
// `base/dex/`. The AAB is what Play Store actually receives, so it must be
// verifiable too — matching only the root form would silently skip it.
const dexEntries = listEntries(zip).filter((e) => /(^|\/)classes\d*\.dex$/.test(e.name));
if (dexEntries.length === 0) {
  console.error('✗ No classes*.dex inside the artifact — this is not a built Android app.');
  process.exit(1);
}

// Dex string tables are MUTF-8, so ASCII/latin1 matching is safe for our
// (ASCII-only) fully-qualified class names.
const dex = dexEntries.map((e) => readEntry(zip, e).toString('latin1'));
const haystack = dex.join('\u0000');
console.log(`  ${dexEntries.length} dex file(s), ${(haystack.length / 1e6).toFixed(1)} MB of bytecode`);

let missing = 0;
for (const cls of REQUIRED) {
  // Dex type descriptors look like `Lpkg/Name;`.
  const present = haystack.includes(`L${cls};`);
  console.log(`  ${present ? '✓' : '✗'} ${cls.split('/').pop()}`);
  if (!present) missing++;
}

if (missing > 0) {
  console.error(
    `\n✗ ${missing} required native component(s) missing from the artifact.\n` +
      '  The Kotlin Gradle plugin is almost certainly not applied — Gradle ignores\n' +
      '  .kt sources silently when it is absent. See scripts/patch-android-build.mjs.',
  );
  process.exit(1);
}

console.log('\n✓ All native Kotlin components are present in the artifact.');
