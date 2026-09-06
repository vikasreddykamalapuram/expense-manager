#!/usr/bin/env node
/**
 * One-command local end-to-end run: build -> emulator -> Maestro -> tear down.
 *
 *   npm run test:e2e:local                       # full flow suite
 *   npm run test:e2e:local -- 01-smoke.yaml      # a single flow
 *   npm run test:e2e:local -- --with-supabase    # also boot local Supabase (Docker)
 *   npm run test:e2e:local -- --keep-up          # leave the emulator running to iterate
 *
 * WHY THIS EXISTS
 * ---------------
 * The Maestro job in CI builds an APK and boots a software-rendered emulator:
 * the longest job in the repository, and until now it could not fail the run.
 * That is the worst combination available — maximum cost for a signal nobody
 * had to read. It is now opt-in (the `run-e2e` label) and blocking.
 *
 * This script is what replaces it day to day, and it is not merely cheaper —
 * it is the higher-fidelity of the two. CI renders through swiftshader on a
 * shared vCPU; this runs a hardware-accelerated emulator on a real GPU, which
 * is much closer to the device a user actually holds. Timing-dependent flows
 * behave differently on the two, and the local one is the honest answer.
 *
 * DESIGN RULE: it must ALWAYS tear down.
 * The easy-to-forget parts — killing the emulator, stopping containers, putting
 * .env back — are exactly the ones that hurt later, and a half-cleaned machine
 * is how a 20-second build turns into a 157-second one. Everything therefore
 * runs inside try/finally and cleans up even when the tests fail, so the trade
 * only depends on the tests being useful, never on the operator being tidy.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const IS_WINDOWS = process.platform === 'win32';

const args = process.argv.slice(2);
const KEEP_UP = args.includes('--keep-up');
const WITH_SUPABASE = args.includes('--with-supabase');
const flowArg = args.find((a) => !a.startsWith('--'));

const ENV_FILE = join(REPO, '.env');
const ENV_BACKUP = join(REPO, '.env.e2e-backup');
const APK = join(REPO, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

const log = (m) => console.log(`\n\u001b[36m▶ ${m}\u001b[0m`);
const warn = (m) => console.log(`\u001b[33m  ! ${m}\u001b[0m`);
const ok = (m) => console.log(`\u001b[32m  ✓ ${m}\u001b[0m`);

/** Run a command, inheriting stdio. Returns exit code rather than throwing. */
function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: REPO,
    stdio: 'inherit',
    shell: IS_WINDOWS,
    ...opts,
  });
  return r.status ?? 1;
}

/** Run a command and capture stdout. Never throws; returns '' on failure. */
function capture(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: REPO,
    encoding: 'utf8',
    shell: IS_WINDOWS,
    ...opts,
  });
  return r.status === 0 ? (r.stdout || '').trim() : '';
}

function must(condition, message, hint) {
  if (condition) return;
  console.error(`\u001b[31m✗ ${message}\u001b[0m`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Preflight. Fail in seconds with an actionable message, rather than 10 minutes
// later inside Gradle with one that names nothing.
// ---------------------------------------------------------------------------
log('Preflight');

const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
must(
  androidHome && existsSync(androidHome),
  'ANDROID_HOME / ANDROID_SDK_ROOT is not set or does not exist.',
  'Install Android Studio, then set ANDROID_HOME to e.g. %LOCALAPPDATA%\\Android\\Sdk',
);
ok(`Android SDK: ${androidHome}`);

const emulatorBin = join(androidHome, 'emulator', IS_WINDOWS ? 'emulator.exe' : 'emulator');
const adbBin = join(androidHome, 'platform-tools', IS_WINDOWS ? 'adb.exe' : 'adb');
must(existsSync(emulatorBin), `emulator not found at ${emulatorBin}`, 'Android Studio > SDK Manager > SDK Tools > Android Emulator');
must(existsSync(adbBin), `adb not found at ${adbBin}`, 'Android Studio > SDK Manager > SDK Tools > Android SDK Platform-Tools');

const avds = capture(emulatorBin, ['-list-avds']).split(/\r?\n/).filter(Boolean);
must(
  avds.length > 0,
  'No Android Virtual Device found.',
  'Create one in Android Studio > Device Manager (a Pixel 6 / API 33 image matches CI).',
);
const avd = process.env.MONEYIQ_AVD || avds[0];
ok(`AVD: ${avd}${avds.length > 1 ? `  (of ${avds.length}; override with MONEYIQ_AVD)` : ''}`);

must(
  capture('maestro', ['--version']) !== '',
  'Maestro is not on PATH.',
  IS_WINDOWS
    ? 'Install via PowerShell:  iwr -useb https://get.maestro.mobile.dev | iex'
    : 'Install via:  curl -Ls https://get.maestro.mobile.dev | bash',
);
ok('Maestro available');

// Docker Desktop can be INSTALLED but not RUNNING, and `docker --version` will
// happily answer either way because it only reports the client. `docker info`
// is the one that actually talks to the engine.
if (WITH_SUPABASE) {
  must(
    capture('docker', ['info', '--format', '{{.ServerVersion}}']) !== '',
    'Docker Desktop is installed but the engine is not responding.',
    'Start Docker Desktop and wait ~15s for the engine, then re-run.',
  );
  ok('Docker engine responding');
}

// ---------------------------------------------------------------------------
let emulatorProc = null;
let supabaseStarted = false;
let envBackedUp = false;
let exitCode = 0;

try {
  // ---------- Optional: local Supabase for cloud-sync flows ----------
  if (WITH_SUPABASE) {
    log('Starting local Supabase (Docker)');
    must(run('npx', ['--yes', 'supabase@2', 'start', '-x', 'imgproxy,pooler']) === 0, 'supabase start failed.');
    supabaseStarted = true;

    const statusJson = capture('npx', ['--yes', 'supabase@2', 'status', '-o', 'json']);
    must(statusJson !== '', 'Could not read supabase status.');
    const status = JSON.parse(statusJson);
    const apiUrl = status.API_URL || 'http://127.0.0.1:54321';

    // Refuse to point the suite at anything that is not loopback. Without this
    // guard a stale .env silently aims a destructive E2E run at the real
    // project — the sibling repo shipped exactly that and only got away with it
    // because the suite happened to be read-only at the time.
    must(
      /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(apiUrl),
      `Refusing to run: Supabase URL is not loopback (${apiUrl}).`,
      'E2E must never touch the production project.',
    );

    if (existsSync(ENV_FILE)) {
      copyFileSync(ENV_FILE, ENV_BACKUP);
      envBackedUp = true;
      ok('.env backed up');
    }
    writeFileSync(
      ENV_FILE,
      [
        '# Written by scripts/e2e-local.mjs — restored automatically on exit.',
        `VITE_SUPABASE_URL=${apiUrl}`,
        `VITE_SUPABASE_ANON_KEY=${status.ANON_KEY || ''}`,
        '',
      ].join('\n'),
      'utf8',
    );
    ok(`.env -> local Supabase (${apiUrl})`);
  }

  // ---------- Build ----------
  log('Building web bundle');
  must(run('npm', ['run', 'build:capacitor']) === 0, 'Web build failed.');

  log('Syncing Capacitor + patching Android project');
  if (!existsSync(join(REPO, 'android'))) {
    must(run('npx', ['cap', 'add', 'android']) === 0, 'cap add android failed.');
  }
  must(run('npx', ['cap', 'sync', 'android']) === 0, 'cap sync failed.');
  must(run('node', ['scripts/patch-android-manifest.mjs']) === 0, 'Manifest patch failed.');
  must(run('node', ['scripts/patch-android-build.mjs']) === 0, 'Gradle patch failed.');

  log('Building debug APK');
  const gradlew = IS_WINDOWS ? 'gradlew.bat' : './gradlew';
  must(
    run(gradlew, ['assembleDebug', '--no-daemon'], { cwd: join(REPO, 'android') }) === 0,
    'Gradle build failed.',
  );

  // The same guard CI runs. A green Gradle build does not prove the Kotlin
  // compiled — that assumption shipped ~79 APKs with no native code in them.
  log('Verifying native Kotlin is in the APK');
  must(run('node', ['scripts/verify-android-native.mjs']) === 0, 'Native verification failed.');

  // ---------- Emulator ----------
  log(`Booting emulator (${avd})`);
  emulatorProc = spawn(
    emulatorBin,
    ['-avd', avd, '-no-snapshot-save', '-no-boot-anim', '-noaudio', '-gpu', 'host'],
    { cwd: REPO, detached: false, stdio: 'ignore' },
  );

  must(run(adbBin, ['wait-for-device']) === 0, 'Emulator never came up.');
  process.stdout.write('  waiting for boot');
  const bootDeadline = Date.now() + 180_000;
  let booted = false;
  while (Date.now() < bootDeadline) {
    if (capture(adbBin, ['shell', 'getprop', 'sys.boot_completed']) === '1') {
      booted = true;
      break;
    }
    process.stdout.write('.');
    spawnSync(IS_WINDOWS ? 'powershell' : 'sleep', IS_WINDOWS ? ['-c', 'Start-Sleep 3'] : ['3'], { shell: IS_WINDOWS });
  }
  console.log('');
  must(booted, 'Emulator did not finish booting within 3 minutes.');
  ok('Emulator booted');

  run(adbBin, ['shell', 'input', 'keyevent', '82']); // dismiss lock screen
  // Animations make Maestro's waits flaky for reasons that have nothing to do
  // with the app; CI disables them too, so match it.
  for (const scale of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
    run(adbBin, ['shell', 'settings', 'put', 'global', scale, '0']);
  }

  log('Installing APK');
  must(existsSync(APK), `APK not found at ${APK}`);
  must(run(adbBin, ['install', '-r', APK]) === 0, 'adb install failed.');

  // ---------- Maestro ----------
  const target = flowArg ? join('.maestro', 'flows', flowArg) : join('.maestro', 'flows');
  log(`Running Maestro: ${target}`);
  exitCode = run('maestro', ['test', target]);

  if (exitCode === 0) ok('All Maestro flows passed');
  else warn(`Maestro exited ${exitCode}`);
} finally {
  // ---------- Teardown (runs even when the tests fail) ----------
  log('Cleaning up');

  if (envBackedUp) {
    copyFileSync(ENV_BACKUP, ENV_FILE);
    rmSync(ENV_BACKUP, { force: true });
    ok('.env restored');
  } else if (WITH_SUPABASE && existsSync(ENV_FILE)) {
    // There was no .env before this script wrote one; leaving it behind would
    // silently point the next plain `npm run dev` at a stopped local stack.
    rmSync(ENV_FILE, { force: true });
    ok('.env removed (none existed before)');
  }

  if (KEEP_UP) {
    warn('--keep-up: leaving the emulator and containers running.');
    warn('Stop them yourself:  adb emu kill   and   npx supabase stop');
  } else {
    if (emulatorProc) {
      run(adbBin, ['emu', 'kill']);
      try { emulatorProc.kill(); } catch { /* already gone */ }
      ok('Emulator stopped');
    }
    if (supabaseStarted) {
      run('npx', ['--yes', 'supabase@2', 'stop']);
      ok('Supabase containers stopped');
    }
  }

  console.log(
    exitCode === 0
      ? '\n\u001b[32m✓ Local E2E passed. Put the flow names and counts in the PR description.\u001b[0m\n'
      : '\n\u001b[31m✗ Local E2E failed. Screenshots are under ~/.maestro/tests/.\u001b[0m\n',
  );
}

process.exit(exitCode);
