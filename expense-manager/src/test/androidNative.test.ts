import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPluginMissing, describeNativeError } from '../features/autodetect/nativeErrors';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/**
 * Regression tests for the class of bug where the Android build succeeds but
 * ships none of our Kotlin.
 *
 * Capacitor's Android template is Java-only. Gradle without the Kotlin plugin
 * does not fail on `.kt` sources — it silently drops them. Every APK built
 * before this guard therefore had no notification listener, no widget and no
 * native bridge, while still declaring them in the manifest, so the app looked
 * installed and permission could be granted but nothing ever worked.
 */
describe('android build patching keeps Kotlin compiling', () => {
  const buildPatch = read('scripts/patch-android-build.mjs');
  const manifestPatch = read('scripts/patch-android-manifest.mjs');

  it('applies the kotlin-android plugin to the app module', () => {
    expect(buildPatch).toContain("apply plugin: 'kotlin-android'");
  });

  it('puts the Kotlin Gradle plugin on the root buildscript classpath', () => {
    expect(buildPatch).toContain('org.jetbrains.kotlin:kotlin-gradle-plugin');
  });

  it('pins a JVM target so Kotlin and Java agree', () => {
    // AGP hard-fails with "Inconsistent JVM-target compatibility" when Kotlin
    // defaults to 1.8 while Capacitor compiles Java at 21.
    expect(buildPatch).toContain('kotlinOptions');
    expect(buildPatch).toContain('jvmTarget');
  });

  it('removes the generated MainActivity.java that would clash with our Kotlin one', () => {
    // Both declare io.github.vikasreddykamalapuram.moneyiq.MainActivity, so
    // leaving the Java file in place is a duplicate-class build failure once
    // Kotlin is enabled — and, before that, it silently won.
    expect(manifestPatch).toContain('MainActivity.java');
    expect(manifestPatch).toContain('rmSync');
  });

  it('still copies every native Kotlin source into the Android project', () => {
    for (const file of [
      'MainActivity.kt',
      'NotificationBridgePlugin.kt',
      'MoneyIqNotificationListener.kt',
      'WidgetBridgePlugin.kt',
      'ExpenseWidgetProvider.kt',
    ]) {
      expect(manifestPatch).toContain(file);
    }
  });
});

describe('CI verifies the artifact, not just the build result', () => {
  const verifier = read('scripts/verify-android-native.mjs');

  it('checks every native class the app depends on', () => {
    for (const cls of [
      'MainActivity',
      'NotificationBridgePlugin',
      'MoneyIqNotificationListener',
      'WidgetBridgePlugin',
      'ExpenseWidgetProvider',
    ]) {
      expect(verifier).toContain(cls);
    }
  });

  it('does not rely on kotlin.Metadata, which dependency AARs also provide', () => {
    // This marker is present even in a known-broken APK, so treating it as
    // proof of our Kotlin compiling would give false confidence.
    expect(verifier).not.toContain("includes(KOTLIN_MARKER)");
  });

  it('is wired into both Android workflows', () => {
    expect(read('../.github/workflows/android-debug.yml')).toContain('verify-android-native.mjs');
    expect(read('../.github/workflows/android-release.yml')).toContain('verify-android-native.mjs');
  });

  it('verifies the AAB too, since that is what Play Store receives', () => {
    // Checking only the APK would leave the actual shipped artifact unproven.
    expect(read('../.github/workflows/android-release.yml')).toContain(
      'android/app/build/outputs/bundle/release',
    );
  });

  it('matches dex nested inside an AAB, not just at an APK root', () => {
    // An AAB stores dex under `base/dex/classes.dex`; a root-anchored pattern
    // would find nothing and false-fail on a perfectly good bundle.
    const pattern = verifier.match(/const dexEntries = .*?filter\(\(e\) => (\/.*?\/)\.test/)?.[1];
    expect(pattern).toBeTruthy();
    const re = new RegExp(pattern!.slice(1, -1));
    expect(re.test('classes.dex')).toBe(true);
    expect(re.test('classes2.dex')).toBe(true);
    expect(re.test('base/dex/classes.dex')).toBe(true);
    expect(re.test('base/dex/classes3.dex')).toBe(true);
    expect(re.test('res/classes.dex.png')).toBe(false);
  });

  it('does not hardcode an AGP output filename', () => {
    // `app-release.apk` vs `app-release-unsigned.apk` depends on whether a
    // signingConfig was injected; resolving the directory avoids that trap.
    expect(read('../.github/workflows/android-release.yml')).not.toContain('app-release.apk');
    expect(verifier).toContain('isDirectory()');
  });
});

describe('isPluginMissing', () => {
  it('recognises Capacitor\'s "not implemented" rejection', () => {
    expect(isPluginMissing(new Error('NotificationBridge does not have an implementation'))).toBe(false);
    expect(isPluginMissing(new Error('"NotificationBridge" plugin is not implemented on android'))).toBe(true);
    expect(isPluginMissing(new Error('UNIMPLEMENTED'))).toBe(true);
    expect(isPluginMissing(new Error('Plugin not available'))).toBe(true);
  });

  it('does not misclassify ordinary runtime errors', () => {
    expect(isPluginMissing(new Error('Settings screen could not be opened'))).toBe(false);
    expect(isPluginMissing(undefined)).toBe(false);
  });
});

describe('describeNativeError', () => {
  it('tells the user the build is missing native code, not that access is denied', () => {
    const msg = describeNativeError(new Error('"NotificationBridge" plugin is not implemented on android'));
    expect(msg).toMatch(/missing the native detection component/i);
  });

  it('passes through a genuine Android error so it can be diagnosed', () => {
    expect(describeNativeError(new Error('ActivityNotFoundException'))).toContain('ActivityNotFoundException');
  });

  it('never returns an empty string', () => {
    expect(describeNativeError(undefined).length).toBeGreaterThan(0);
  });
});
