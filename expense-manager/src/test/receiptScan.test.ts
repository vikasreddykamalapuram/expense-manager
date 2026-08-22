import { describe, it, expect } from 'vitest';
import { scanReceiptText, parseMoney } from '../shared/services/receiptScan';

// A typical Indian retail bill: header, items, subtotal, split GST, grand total.
const SUPERMARKET = `
BIG BAZAAR RETAIL
Shop 12, MG Road, Bengaluru 560001
GSTIN: 29AABCU9603R1ZM
Tax Invoice
Date: 12/05/2026   Time: 19:42

Amul Milk 1L          62.00
Britannia Bread       45.00
Tata Salt 1kg         28.00
Surf Excel 1kg       285.00

Sub Total            420.00
CGST 2.5%             10.50
SGST 2.5%             10.50
Grand Total          441.00

Payment Mode: UPI
UPI Ref: 451209887712
Thank you, visit again!
`;

// A restaurant bill paid by card, with the total label and value on one line.
const RESTAURANT = `
THE FILTER COFFEE HOUSE
Indiranagar

Bill No: 1187
25-Jul-2026

Masala Dosa            180.00
Filter Coffee x2       120.00
Service Charge          30.00

Total Amount           330.00

Card No: XXXX 4521
VISA CREDIT CARD
`;

describe('parseMoney', () => {
  it('reads plain and comma-grouped amounts', () => {
    expect(parseMoney('441.00')).toBe(441);
    expect(parseMoney('1,250.50')).toBe(1250.5);
    expect(parseMoney('₹ 99')).toBe(99);
    expect(parseMoney('Rs.2,00,000.00')).toBe(200000);
  });

  it('recovers from OCR confusing the decimal separator', () => {
    expect(parseMoney('441,00')).toBe(441);
  });

  it('rejects non-money tokens', () => {
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
});

describe('scanReceiptText', () => {
  it('returns an empty low-confidence result for no text', () => {
    const r = scanReceiptText('');
    expect(r.amount).toBeUndefined();
    expect(r.confidence).toBe('low');
    expect(r.lineItems).toEqual([]);
  });

  it('prefers the grand total over the subtotal and line items', () => {
    const r = scanReceiptText(SUPERMARKET);
    expect(r.amount).toBe(441);
    expect(r.confidence).toBe('high');
  });

  it('reads the merchant from the receipt header, not the invoice label', () => {
    expect(scanReceiptText(SUPERMARKET).merchant).toBe('BIG BAZAAR RETAIL');
    expect(scanReceiptText(RESTAURANT).merchant).toBe('THE FILTER COFFEE HOUSE');
  });

  it('detects UPI as the payment mode', () => {
    expect(scanReceiptText(SUPERMARKET).paymentMethod).toBe('upi');
  });

  it('detects a card payment and its last 4 digits', () => {
    const r = scanReceiptText(RESTAURANT);
    expect(r.paymentMethod).toBe('card');
    expect(r.account).toBe('4521');
  });

  it('parses a day-first date to ISO', () => {
    expect(scanReceiptText(SUPERMARKET).date).toBe('2026-05-12');
    expect(scanReceiptText(RESTAURANT).date).toBe('2026-07-25');
  });

  it('sums split GST into a single tax figure', () => {
    expect(scanReceiptText(SUPERMARKET).tax).toBe(21);
  });

  it('captures line items without the totals or tax rows', () => {
    const items = scanReceiptText(SUPERMARKET).lineItems;
    const descriptions = items.map((i) => i.description);
    expect(descriptions).toContain('Amul Milk 1L');
    expect(descriptions).toContain('Surf Excel 1kg');
    expect(descriptions.join(' ')).not.toMatch(/sub total|cgst|grand total/i);
    expect(items.every((i) => i.amount < 441)).toBe(true);
  });

  it('falls back to the largest amount when no total is labelled', () => {
    const r = scanReceiptText(`CORNER STORE\nPens 40.00\nNotebook 120.00\nCash`);
    expect(r.amount).toBe(120);
    expect(r.confidence).toBe('medium');
    expect(r.paymentMethod).toBe('cash');
  });

  it('picks the grand total when both total and grand total are printed', () => {
    const r = scanReceiptText(`SHOP\nTotal 100.00\nCGST 9.00\nGrand Total 109.00`);
    expect(r.amount).toBe(109);
  });
});
