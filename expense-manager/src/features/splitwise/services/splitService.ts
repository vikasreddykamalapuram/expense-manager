import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../shared/services/db';
import type { SplitGroup, SplitMember, SplitExpense, SplitSettlement, SplitShare, MemberBalance, DebtEdge, SplitType } from '../../../shared/types';

// ─── Member CRUD ─────────────────────────────────────────

export async function getMembers(profileId: string): Promise<SplitMember[]> {
  return db.splitMembers
    .where('[profileId+name]')
    .between([profileId, ''], [profileId, '\uffff'])
    .filter(m => !m.isDeleted)
    .toArray();
}

export async function getMember(id: string): Promise<SplitMember | undefined> {
  const m = await db.splitMembers.get(id);
  return m && !m.isDeleted ? m : undefined;
}

export async function addMember(profileId: string, data: Pick<SplitMember, 'name' | 'phone' | 'email' | 'avatarColor'>): Promise<SplitMember> {
  const now = new Date().toISOString();
  const member: SplitMember = {
    id: uuidv4(),
    name: data.name,
    phone: data.phone,
    email: data.email,
    avatarColor: data.avatarColor,
    createdAt: now,
    updatedAt: now,
  };
  await db.splitMembers.put({ ...member, profileId });
  return member;
}

export async function updateMember(profileId: string, id: string, data: Partial<Pick<SplitMember, 'name' | 'phone' | 'email' | 'avatarColor'>>): Promise<void> {
  await db.splitMembers.update(id, { ...data, updatedAt: new Date().toISOString(), profileId });
}

export async function deleteMember(id: string): Promise<void> {
  await db.splitMembers.update(id, { isDeleted: true, deletedAt: new Date().toISOString() });
}

// ─── Group CRUD ──────────────────────────────────────────

export async function getGroups(profileId: string): Promise<SplitGroup[]> {
  return db.splitGroups
    .where('[profileId+createdAt]')
    .between([profileId, ''], [profileId, '\uffff'])
    .filter(g => !g.isDeleted)
    .reverse()
    .toArray();
}

export async function getGroup(id: string): Promise<SplitGroup | undefined> {
  const g = await db.splitGroups.get(id);
  return g && !g.isDeleted ? g : undefined;
}

export async function addGroup(profileId: string, data: Pick<SplitGroup, 'name' | 'description' | 'memberIds' | 'category'>): Promise<SplitGroup> {
  const now = new Date().toISOString();
  const group: SplitGroup = {
    id: uuidv4(),
    name: data.name,
    description: data.description,
    memberIds: data.memberIds,
    category: data.category,
    createdAt: now,
    updatedAt: now,
  };
  await db.splitGroups.put({ ...group, profileId });
  return group;
}

export async function updateGroup(profileId: string, id: string, data: Partial<Pick<SplitGroup, 'name' | 'description' | 'memberIds' | 'category'>>): Promise<void> {
  await db.splitGroups.update(id, { ...data, updatedAt: new Date().toISOString(), profileId });
}

export async function deleteGroup(id: string): Promise<void> {
  await db.splitGroups.update(id, { isDeleted: true, deletedAt: new Date().toISOString() });
}

// ─── Expense CRUD ────────────────────────────────────────

export async function getGroupExpenses(profileId: string, groupId: string): Promise<SplitExpense[]> {
  return db.splitExpenses
    .where('[profileId+groupId]')
    .equals([profileId, groupId])
    .filter(e => !e.isDeleted)
    .reverse()
    .toArray();
}

export async function addExpense(profileId: string, data: {
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  splits: SplitShare[];
  category?: string;
  date: string;
  notes?: string;
}): Promise<SplitExpense> {
  const now = new Date().toISOString();
  const expense: SplitExpense = {
    id: uuidv4(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await db.splitExpenses.put({ ...expense, profileId });
  return expense;
}

export async function deleteExpense(id: string): Promise<void> {
  await db.splitExpenses.update(id, { isDeleted: true, deletedAt: new Date().toISOString() });
}

// ─── Settlement CRUD ─────────────────────────────────────

export async function getGroupSettlements(profileId: string, groupId: string): Promise<SplitSettlement[]> {
  return db.splitSettlements
    .where('[profileId+groupId]')
    .equals([profileId, groupId])
    .filter(s => !s.isDeleted)
    .reverse()
    .toArray();
}

export async function addSettlement(profileId: string, data: {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
  notes?: string;
}): Promise<SplitSettlement> {
  const now = new Date().toISOString();
  const settlement: SplitSettlement = {
    id: uuidv4(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await db.splitSettlements.put({ ...settlement, profileId });
  return settlement;
}

export async function deleteSettlement(id: string): Promise<void> {
  await db.splitSettlements.update(id, { isDeleted: true, deletedAt: new Date().toISOString() });
}

// ─── Split Calculation Helpers ───────────────────────────

export function computeEqualSplits(amount: number, memberIds: string[]): SplitShare[] {
  const share = Math.round((amount / memberIds.length) * 100) / 100;
  const shares = memberIds.map(id => ({ memberId: id, amount: share }));
  // Fix rounding: adjust first member to absorb the difference
  const total = shares.reduce((s, x) => s + x.amount, 0);
  const diff = Math.round((amount - total) * 100) / 100;
  if (diff !== 0 && shares.length > 0) {
    shares[0].amount = Math.round((shares[0].amount + diff) * 100) / 100;
  }
  return shares;
}

export function computePercentageSplits(amount: number, percentages: { memberId: string; percent: number }[]): SplitShare[] {
  return percentages.map(p => ({
    memberId: p.memberId,
    amount: Math.round((amount * p.percent / 100) * 100) / 100,
  }));
}

export function computeSharesSplits(amount: number, shares: { memberId: string; shareCount: number }[]): SplitShare[] {
  const totalShares = shares.reduce((s, x) => s + x.shareCount, 0);
  if (totalShares === 0) return shares.map(s => ({ memberId: s.memberId, amount: 0 }));
  return shares.map(s => ({
    memberId: s.memberId,
    amount: Math.round((amount * s.shareCount / totalShares) * 100) / 100,
  }));
}

// ─── Balance Calculation ─────────────────────────────────

export function computeGroupBalances(
  expenses: SplitExpense[],
  settlements: SplitSettlement[],
  members: SplitMember[]
): MemberBalance[] {
  // net balance: positive = owed money (creditor), negative = owes money (debtor)
  const balanceMap: Record<string, number> = {};
  members.forEach(m => { balanceMap[m.id] = 0; });

  for (const exp of expenses) {
    // Payer gets credited the full amount
    balanceMap[exp.paidBy] = (balanceMap[exp.paidBy] || 0) + exp.amount;
    // Each split member gets debited their share
    for (const split of exp.splits) {
      balanceMap[split.memberId] = (balanceMap[split.memberId] || 0) - split.amount;
    }
  }

  // Apply settlements
  for (const s of settlements) {
    balanceMap[s.fromMemberId] = (balanceMap[s.fromMemberId] || 0) + s.amount;
    balanceMap[s.toMemberId] = (balanceMap[s.toMemberId] || 0) - s.amount;
  }

  return members.map(m => ({
    memberId: m.id,
    memberName: m.name,
    balance: Math.round((balanceMap[m.id] || 0) * 100) / 100,
  }));
}

// ─── Debt Simplification (Greedy Algorithm) ──────────────

export function simplifyDebts(balances: MemberBalance[]): DebtEdge[] {
  // Separate into debtors and creditors
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const b of balances) {
    if (b.balance < -0.01) {
      debtors.push({ id: b.memberId, amount: Math.abs(b.balance) });
    } else if (b.balance > 0.01) {
      creditors.push({ id: b.memberId, amount: b.balance });
    }
  }

  // Sort descending by amount for greedy matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const edges: DebtEdge[] = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const settleAmount = Math.min(debtors[i].amount, creditors[j].amount);
    if (settleAmount > 0.01) {
      edges.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: Math.round(settleAmount * 100) / 100,
      });
    }
    debtors[i].amount -= settleAmount;
    creditors[j].amount -= settleAmount;

    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return edges;
}

// ─── Utility ─────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
  '#ef4444', '#10b981', '#3b82f6', '#f97316', '#06b6d4',
];

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function getGroupTotal(expenses: SplitExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}
