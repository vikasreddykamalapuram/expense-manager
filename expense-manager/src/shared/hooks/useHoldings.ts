import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db';
import { Holding } from '../types';

/**
 * Self-contained store for net-worth holdings (EPF/PPF/NPS + investments),
 * following the same per-profile Dexie pattern as useSavingsGoals.
 */
export function useHoldings(profileId: string = 'default') {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await db.holdings
        .where('[profileId+updatedAt]')
        .between([profileId, ''], [profileId, '\uffff'])
        .toArray();
      setHoldings(
        data.filter((h) => !h.isDeleted).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    } catch {
      setHoldings([]);
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const addHolding = useCallback(async (h: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const holding: Holding = { ...h, id: uuidv4(), createdAt: now, updatedAt: now };
    await db.holdings.put({ ...holding, profileId });
    setHoldings((prev) => [holding, ...prev]);
    return holding;
  }, [profileId]);

  const updateHolding = useCallback(async (id: string, updates: Partial<Holding>) => {
    const now = new Date().toISOString();
    const fields = { ...updates, updatedAt: now };
    await db.holdings.update(id, fields);
    setHoldings((prev) => prev.map((h) => (h.id === id ? { ...h, ...fields } : h)));
  }, []);

  const deleteHolding = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    await db.holdings.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return { holdings, loading, addHolding, updateHolding, deleteHolding, reload: load };
}
