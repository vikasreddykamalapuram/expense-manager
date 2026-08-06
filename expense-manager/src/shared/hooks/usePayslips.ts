import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db, type DbPayslip } from '../services/db';
import type { Payslip } from '../types';

/** Self-contained payslip-history store (multiple per profile), keyed by month. */
export function usePayslips(profileId: string = 'default') {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await db.payslips
        .where('[profileId+updatedAt]')
        .between([profileId, ''], [profileId, '\uffff'])
        .toArray();
      setPayslips(data.filter((p) => !p.isDeleted).sort((a, b) => b.month.localeCompare(a.month)));
    } catch {
      setPayslips([]);
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  /** Insert or update the payslip for a given month (one snapshot per month). */
  const upsertForMonth = useCallback(async (data: Omit<Payslip, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    let existing: DbPayslip | undefined;
    try {
      existing = await db.payslips.where('[profileId+month]').equals([profileId, data.month]).first();
    } catch {
      existing = undefined;
    }
    const rec: DbPayslip = existing
      ? { ...existing, ...data, updatedAt: now, isDeleted: false }
      : { ...data, id: uuidv4(), profileId, createdAt: now, updatedAt: now, isDeleted: false };
    await db.payslips.put(rec);
    await load();
    return rec;
  }, [profileId, load]);

  const remove = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    await db.payslips.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
    setPayslips((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { payslips, loading, upsertForMonth, remove, reload: load };
}
