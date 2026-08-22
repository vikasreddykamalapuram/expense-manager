/**
 * Classifying failures from the native notification bridge.
 *
 * Capacitor rejects calls to a plugin that was never registered natively with
 * "not implemented". That is a *build* problem, not a permission problem: it
 * means the APK shipped without our Kotlin. These errors used to be swallowed,
 * which is why every auto-detect control looked simply dead on device instead
 * of explaining itself.
 */

/** True when the rejection means the native plugin is absent from this build. */
export function isPluginMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /not implemented|unimplemented|not available/i.test(msg);
}

/** A message the user can act on, rather than silence. */
export function describeNativeError(err: unknown): string {
  if (isPluginMissing(err)) {
    return 'This app build is missing the native detection component, so notification detection cannot run. Please install the latest build.';
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return msg ? `Android returned an error: ${msg}` : 'Android returned an unknown error.';
}
