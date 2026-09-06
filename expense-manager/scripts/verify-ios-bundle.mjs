#!/usr/bin/env node
/**
 * Fails the build unless the shipped .ipa actually contains the web bundle and
 * the permission purpose strings the app needs at runtime.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Android side learned this the hard way: Gradle silently ignored every
 * .kt file for months and shipped APKs with none of the app's native code,
 * green build and all (see verify-android-native.mjs). iOS has two failure
 * modes with exactly the same shape — a green `xcodebuild` that produces a
 * broken app:
 *
 *   1. `cap sync ios` did not run, or `webDir` was wrong. Xcode happily
 *      archives the native shell with no web assets inside it. The app
 *      installs, launches, and shows a permanent white screen.
 *
 *   2. A purpose string is missing from Info.plist. iOS does not warn and does
 *      not deny — it kills the process the moment the API is touched. The
 *      receipt scanner is triggered from plain HTML file inputs, so no amount
 *      of tsc / eslint / vitest can catch this.
 *
 * Neither is visible in build output, so this reads the real artifact.
 *
 * Usage:  node scripts/verify-ios-bundle.mjs [path/to/app.ipa | dir]
 * Default: searches the CI export directory, then a local Xcode export.
 *
 * NOTE ON THE DUPLICATED ZIP READER
 * ---------------------------------
 * The minimal ZIP reader below is copied from verify-android-native.mjs rather
 * than shared. That script is the guard that caught a real shipped-broken
 * build and was validated against a known-broken APK; refactoring it to import
 * from here would put a proven check at risk to save 50 lines. Deliberate
 * duplication, not an oversight.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

/**
 * Purpose strings that MUST be in the shipped Info.plist. Keep in sync with
 * scripts/patch-ios-plist.mjs — that script writes them, this one proves they
 * survived into the artifact.
 */
const REQUIRED_PLIST_KEYS = [
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSFaceIDUsageDescription',
];

/**
 * A key guaranteed to exist in EVERY Info.plist. It is not being tested — it
 * tests the test.
 *
 * Info.plist inside a built .app is a BINARY plist, not the XML we patched.
 * Key names survive as ASCII so a substring search does work, but "I searched
 * and found nothing" is worthless without proof the search method can find
 * anything at all. If this control is missing, the reader is broken and every
 * other "missing" result below is a false alarm rather than a finding.
 */
const POSITIVE_CONTROL = 'CFBundleIdentifier';

// ---------------------------------------------------------------------------
// Minimal ZIP reader (no third-party deps; an .ipa is just a ZIP).
// ---------------------------------------------------------------------------
function findEocd(buf) {
  const sig = 0x06054b50;
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
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const uncompressedSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
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
function ipaInDir(dir) {
  if (!existsSync(dir)) return null;
  const hit = readdirSync(dir).find((f) => f.endsWith('.ipa'));
  return hit ? join(dir, hit) : null;
}

/**
 * Accepts a file OR a directory. Directories are preferred in CI because
 * exportArchive names the .ipa after the scheme, and a hardcoded filename
 * turns a scheme rename into a confusing "no .ipa found".
 */
function resolveArtifact() {
  const fromArg = process.argv[2];
  if (fromArg) {
    if (!existsSync(fromArg)) return fromArg;
    return statSync(fromArg).isDirectory() ? ipaInDir(fromArg) : fromArg;
  }
  return ipaInDir(REPO_ROOT) || ipaInDir(join(REPO_ROOT, 'ios', 'export'));
}

const artifact = resolveArtifact();
if (!artifact || !existsSync(artifact)) {
  console.error(`✗ No .ipa found${artifact ? ` at ${artifact}` : ''}. Build one first, or pass a path.`);
  process.exit(1);
}

console.log(`Verifying iOS bundle in ${artifact}`);
const zip = readFileSync(artifact);
const entries = listEntries(zip);

let failures = 0;

// ---------- 1. The app bundle itself ----------
const appRootMatch = entries.find((e) => /^Payload\/[^/]+\.app\//.test(e.name));
if (!appRootMatch) {
  console.error('✗ No Payload/*.app/ inside the archive — this is not a built iOS app.');
  process.exit(1);
}
const appRoot = appRootMatch.name.match(/^(Payload\/[^/]+\.app\/)/)[1];
console.log(`  app bundle: ${appRoot}`);

// ---------- 2. The web bundle actually shipped ----------
// Capacitor copies `webDir` into <App>.app/public/. No index.html means the
// shell launches to a white screen, which is indistinguishable from a hang.
const webEntries = entries.filter((e) => e.name.startsWith(`${appRoot}public/`));
const indexHtml = webEntries.find((e) => e.name === `${appRoot}public/index.html`);
const jsAssets = webEntries.filter((e) => e.name.endsWith('.js'));

if (!indexHtml) {
  console.error(`  ✗ ${appRoot}public/index.html is missing — "npx cap sync ios" did not run.`);
  failures++;
} else {
  console.log(`  ✓ public/index.html (${webEntries.length} web files, ${jsAssets.length} JS chunks)`);
}

// A single index.html with no JS means the copy half-happened. The real build
// emits well over a dozen lazy-loaded route chunks.
if (indexHtml && jsAssets.length < 5) {
  console.error(`  ✗ Only ${jsAssets.length} JS chunk(s) shipped — the web build looks truncated.`);
  failures++;
}

// ---------- 3. capacitor.config.json ----------
if (!entries.some((e) => e.name === `${appRoot}capacitor.config.json`)) {
  console.error('  ✗ capacitor.config.json missing from the bundle.');
  failures++;
} else {
  console.log('  ✓ capacitor.config.json');
}

// ---------- 4. Info.plist purpose strings ----------
const plistEntry = entries.find((e) => e.name === `${appRoot}Info.plist`);
if (!plistEntry) {
  console.error('  ✗ Info.plist missing from the app bundle.');
  failures++;
} else {
  // Built plists are binary; key names remain ASCII, so latin1 substring
  // matching is sound — but only once the control below proves it.
  const plist = readEntry(zip, plistEntry).toString('latin1');
  const isBinary = plist.startsWith('bplist');
  console.log(`  Info.plist: ${isBinary ? 'binary' : 'xml'} format, ${plist.length} bytes`);

  if (!plist.includes(POSITIVE_CONTROL)) {
    console.error(
      `  ✗ Positive control "${POSITIVE_CONTROL}" not found in Info.plist.\n` +
        '    The reader is broken, so no conclusion can be drawn about the keys below.',
    );
    process.exit(1);
  }
  console.log(`  ✓ positive control (${POSITIVE_CONTROL}) — search method works`);

  for (const key of REQUIRED_PLIST_KEYS) {
    const present = plist.includes(key);
    console.log(`  ${present ? '✓' : '✗'} ${key}`);
    if (!present) failures++;
  }
}

if (failures > 0) {
  console.error(
    `\n✗ ${failures} problem(s) in the built .ipa.\n` +
      '  Missing web assets => "npx cap sync ios" did not run before archiving.\n' +
      '  Missing purpose strings => run "node scripts/patch-ios-plist.mjs" after cap sync;\n' +
      '  shipping without them crashes the app the first time a user taps Scan receipt.',
  );
  process.exit(1);
}

console.log('\n✓ iOS bundle contains the web app and all required purpose strings.');
