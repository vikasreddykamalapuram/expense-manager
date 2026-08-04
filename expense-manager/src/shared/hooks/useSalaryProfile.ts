import { useState, useEffect, useCallback } from 'react';
import { db, type DbSalaryProfile } from '../services/db';
import type { SalaryProfile, SalaryComponent } from '../types';

/** Derived salary figures from a set of monthly components. */
export interface SalaryTotals {
  gross: number;          // sum of earnings (monthly)
  deductions: number;     // sum of deductions (monthly)
  net: number;            // gross - deductions (monthly in-hand)
  annualGross: number;
  annualNet: number;
  inHandPct: number;      // net / gross * 100
}

export function computeSalaryTotals(components: SalaryComponent[]): SalaryTotals {
  const gross = components.filter(c => c.kind === 'earning').reduce((s, c) => s + (c.amount || 0), 0);
  const deductions = components.filter(c => c.kind === 'deduction').reduce((s, c) => s + (c.amount || 0), 0);
  const net = gross - deductions;
  return {
    gross,
    deductions,
    net,
    annualGross: gross * 12,
    annualNet: net * 12,
    inHandPct: gross > 0 ? Math.round((net / gross) * 1000) / 10 : 0,
  };
}

/**
 * Self-contained salary-profile store (one record per profile), following the
 * same pattern as useSavingsGoals — reads/writes its own Dexie table without
 * touching the global AppContext reducer.
 */
export function useSalaryProfile(profileId: string = 'default') {
  const [profile, setProfile] = useState<SalaryProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rec = await db.salaryProfiles.get(profileId);
      setProfile(rec && !rec.isDeleted ? rec : null);
    } catch {
      // Table may not exist yet on first load
      setProfile(null);
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (data: Omit<SalaryProfile, 'updatedAt'>) => {
    const now = new Date().toISOString();
    const rec: DbSalaryProfile = { ...data, profileId, updatedAt: now, isDeleted: false };
    await db.salaryProfiles.put(rec);
    setProfile(rec);
    return rec;
  }, [profileId]);

  const clear = useCallback(async () => {
    const now = new Date().toISOString();
    await db.salaryProfiles.update(profileId, { isDeleted: true, deletedAt: now, updatedAt: now });
    setProfile(null);
  }, [profileId]);

  return { profile, loading, save, clear, reload: load };
}
