import { useState, useCallback, useEffect } from 'react';
import { TaxDeductions, EMPTY_DEDUCTIONS } from '../utils/taxEngine';
import { DEFAULT_FY } from '../constants/taxConfig';

export interface TaxInputs {
  fy: string;
  /** Annual gross income (salary + other) used for the estimate. */
  grossIncome: number;
  deductions: TaxDeductions;
}

const KEY_PREFIX = 'moneyiq_tax_inputs';

function storageKey(profileId: string): string {
  return `${KEY_PREFIX}_${profileId}`;
}

function load(profileId: string): TaxInputs {
  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TaxInputs>;
      return {
        fy: parsed.fy || DEFAULT_FY,
        grossIncome: parsed.grossIncome ?? 0,
        deductions: { ...EMPTY_DEDUCTIONS, ...(parsed.deductions || {}) },
      };
    }
  } catch {
    /* ignore corrupt/unavailable storage */
  }
  return { fy: DEFAULT_FY, grossIncome: 0, deductions: { ...EMPTY_DEDUCTIONS } };
}

/**
 * Persists the user's tax planning inputs on-device (localStorage), keyed per
 * profile. Non-sensitive planning estimates — kept out of the synced Dexie DB
 * to avoid a schema migration; can be promoted to a synced table later.
 */
export function useTaxInputs(profileId: string = 'default') {
  const [inputs, setInputs] = useState<TaxInputs>(() => load(profileId));

  useEffect(() => {
    setInputs(load(profileId));
  }, [profileId]);

  const persist = useCallback(
    (next: TaxInputs) => {
      setInputs(next);
      try {
        localStorage.setItem(storageKey(profileId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [profileId]
  );

  const setFy = useCallback((fy: string) => persist({ ...inputs, fy }), [inputs, persist]);
  const setGrossIncome = useCallback(
    (grossIncome: number) => persist({ ...inputs, grossIncome }),
    [inputs, persist]
  );
  const setDeduction = useCallback(
    (key: keyof TaxDeductions, value: number) =>
      persist({ ...inputs, deductions: { ...inputs.deductions, [key]: value } }),
    [inputs, persist]
  );

  return { inputs, setFy, setGrossIncome, setDeduction, persist };
}
