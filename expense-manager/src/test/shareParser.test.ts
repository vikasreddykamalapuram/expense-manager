import { describe, it, expect } from 'vitest';
import { parseSharedText, buildAddDeepLink } from '../shared/services/shareParser';

describe('parseSharedText', () => {
  it('returns empty result for empty input', () => {
    expect(parseSharedText('')).toEqual({});
    expect(parseSharedText(null)).toEqual({});
    expect(parseSharedText(undefined)).toEqual({});
  });

  it('extracts amount + expense type from Indian bank debit SMS', () => {
    const sms = 'INR 1,234.50 debited from A/c XX1234 at BigBasket on 25-Jul-26. Ref 987654.';
    const parsed = parseSharedText(sms);
    expect(parsed.amount).toBe(1234.5);
    expect(parsed.type).toBe('expense');
    expect(parsed.merchant).toContain('BigBasket');
  });

  it('extracts amount + income type from credit SMS', () => {
    const sms = 'Rs. 50000 credited to your account as salary from ACME CORP';
    const parsed = parseSharedText(sms);
    expect(parsed.amount).toBe(50000);
    expect(parsed.type).toBe('income');
  });

  it('handles rupee-symbol prefix', () => {
    const text = 'Paid ₹500 to Uber';
    const parsed = parseSharedText(text);
    expect(parsed.amount).toBe(500);
    expect(parsed.type).toBe('expense');
  });

  it('handles amount-total keyword pattern', () => {
    const text = 'Order Total: 799.00 from Zomato';
    const parsed = parseSharedText(text);
    expect(parsed.amount).toBe(799);
  });

  it('uses merchant as note when found', () => {
    const parsed = parseSharedText('Rs 300 debited at STARBUCKS on 25-Jul');
    expect(parsed.note).toBe('STARBUCKS');
  });

  it('falls back to raw text as note when merchant missing', () => {
    const parsed = parseSharedText('Rs 300 debited');
    expect(parsed.note).toBe('Rs 300 debited');
  });
});

describe('buildAddDeepLink', () => {
  it('builds a query-only path when only amount is present', () => {
    expect(buildAddDeepLink({ amount: 500 })).toBe('/add?amount=500');
  });

  it('includes all fields', () => {
    const url = buildAddDeepLink({ amount: 500, note: 'Uber ride', type: 'expense' });
    expect(url).toContain('amount=500');
    expect(url).toContain('note=Uber+ride');
    expect(url).toContain('type=expense');
  });

  it('honors basePath prefix', () => {
    expect(buildAddDeepLink({ amount: 100 }, '/expense-manager')).toBe('/expense-manager/add?amount=100');
  });

  it('returns /add with no query when parsed is empty', () => {
    expect(buildAddDeepLink({})).toBe('/add');
  });
});
