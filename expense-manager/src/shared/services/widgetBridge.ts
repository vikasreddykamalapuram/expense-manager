/**
 * Widget bridge — pushes the current month's total expense into the
 * native SharedPreferences that ExpenseWidgetProvider reads, so the
 * Android home-screen widget stays fresh.
 *
 * Web / iOS builds: no-ops silently. On Android native, wires into the
 * WidgetBridgePlugin Kotlin class registered by MainActivity.kt.
 */
import { registerPlugin } from '@capacitor/core';
import { isNativePlatform, isAndroid } from './platform';
import type { Transaction } from '../types';

interface WidgetBridgeApi {
  setMonthSpend(options: { amount: string; currency: string }): Promise<{ ok: boolean }>;
}

const WidgetBridge = registerPlugin<WidgetBridgeApi>('WidgetBridge', {
  web: {
    setMonthSpend: async () => ({ ok: false }),
  },
});

function formatAmount(n: number): string {
  // Indian-style grouping to match the rest of the app (₹1,23,456).
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

function currentMonthSpend(transactions: Transaction[]): number {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return transactions.reduce((sum, tx) => {
    if (tx.type !== 'expense') return sum;
    const d = new Date(tx.date);
    if (d.getFullYear() === y && d.getMonth() === m) return sum + (tx.amount || 0);
    return sum;
  }, 0);
}

/** Called whenever transactions change (guarded — safe to call from any platform). */
export async function refreshWidget(transactions: Transaction[], currency = '₹'): Promise<void> {
  if (!isNativePlatform() || !isAndroid()) return;
  try {
    const total = currentMonthSpend(transactions);
    await WidgetBridge.setMonthSpend({ amount: formatAmount(total), currency });
  } catch {
    /* widget not installed or plugin missing in dev — ignore */
  }
}
