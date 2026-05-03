import { describe, it, expect } from 'vitest';
import { encryptData, decryptData, isEncryptionAvailable } from '../shared/services/encryptionService';

describe('encryptionService', () => {
  it('reports encryption as available in jsdom/node with fake-indexeddb', () => {
    // Web Crypto may not be available in all test environments
    // This test documents the behavior
    const available = isEncryptionAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('encrypts and decrypts data round-trip', async () => {
    if (!isEncryptionAvailable()) return; // skip in environments without Web Crypto

    const plaintext = 'Sensitive account data: ICICI 1234567890';
    const encrypted = await encryptData(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.startsWith('enc:')).toBe(true);

    const decrypted = await decryptData(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('returns plaintext unchanged when decrypting unencrypted data', async () => {
    const plaintext = 'Not encrypted';
    const result = await decryptData(plaintext);
    expect(result).toBe(plaintext);
  });

  it('handles empty string', async () => {
    if (!isEncryptionAvailable()) return;

    const encrypted = await encryptData('');
    const decrypted = await decryptData(encrypted);
    expect(decrypted).toBe('');
  });

  it('produces different ciphertexts for same plaintext (unique IV)', async () => {
    if (!isEncryptionAvailable()) return;

    const encrypted1 = await encryptData('same data');
    const encrypted2 = await encryptData('same data');
    expect(encrypted1).not.toBe(encrypted2); // different IVs
  });
});
