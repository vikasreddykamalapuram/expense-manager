/**
 * First-run setup wizard status.
 *
 * `moneyiq_setup_complete` marks that the user has been through (or dismissed) the
 * guided setup. Kept separate from `moneyiq_onboarded` (the auth/login gate) so the
 * two concerns don't interfere.
 */
export const SETUP_COMPLETE_KEY = 'moneyiq_setup_complete';

export function isSetupComplete(): boolean {
  try {
    return localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
  } catch {
    return true; // if storage is unavailable, never block the app
  }
}

export function markSetupComplete(): void {
  try {
    localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
  } catch {
    /* ignore */
  }
}

export function resetSetup(): void {
  try {
    localStorage.removeItem(SETUP_COMPLETE_KEY);
  } catch {
    /* ignore */
  }
}
