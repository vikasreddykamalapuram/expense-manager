import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db';
import { SavingsGoal } from '../types';

export function useSavingsGoals(profileId: string = 'default') {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    try {
      const data = await db.savingsGoals
        .where('[profileId+updatedAt]')
        .between([profileId, ''], [profileId, '\uffff'])
        .toArray();
      setGoals(data.filter(g => !g.isDeleted).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      // Table might not exist yet on first load
      setGoals([]);
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const addGoal = useCallback(async (goal: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt' | 'savedAmount'>) => {
    const now = new Date().toISOString();
    const newGoal: SavingsGoal = {
      ...goal,
      id: uuidv4(),
      savedAmount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.savingsGoals.put({ ...newGoal, profileId });
    setGoals(prev => [newGoal, ...prev]);
    return newGoal;
  }, [profileId]);

  const updateGoal = useCallback(async (id: string, updates: Partial<SavingsGoal>) => {
    const now = new Date().toISOString();
    const updatedFields = { ...updates, updatedAt: now };
    
    // Check for completion
    const existing = goals.find(g => g.id === id);
    if (existing) {
      const newSaved = updates.savedAmount ?? existing.savedAmount;
      if (newSaved >= existing.targetAmount && !existing.completedAt) {
        (updatedFields as Partial<SavingsGoal>).completedAt = now;
      }
    }

    await db.savingsGoals.update(id, updatedFields);
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updatedFields } : g));
  }, [goals, profileId]);

  const deleteGoal = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    await db.savingsGoals.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
    setGoals(prev => prev.filter(g => g.id !== id));
  }, [profileId]);

  const addContribution = useCallback(async (id: string, amount: number) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newSaved = goal.savedAmount + amount;
    await updateGoal(id, { savedAmount: newSaved });
  }, [goals, updateGoal]);

  return { goals, loading, addGoal, updateGoal, deleteGoal, addContribution, reload: loadGoals };
}
