import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The app ships a strict CSP in a <meta> tag. Twice now a feature has been
 * built, unit-tested and shipped green — and then done nothing at all on the
 * device, because the CSP silently blocked it at runtime:
 *
 *   - receipt OCR needs WebAssembly, which Chrome refuses to compile unless
 *     script-src carries 'wasm-unsafe-eval'
 *   - the Gmail scan calls gmail.googleapis.com, which is NOT covered by the
 *     www.googleapis.com entry
 *
 * Neither failure is visible to tsc, eslint, vitest or the Android build, so
 * pin the directives that features actually depend on.
 */

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

function directive(name: string): string {
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
  if (!csp) throw new Error('No CSP meta tag found in index.html');
  const found = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  return found ?? '';
}

describe('Content Security Policy', () => {
  it('declares a CSP at all', () => {
    expect(html).toContain('Content-Security-Policy');
  });

  it("allows WebAssembly so receipt OCR can start ('wasm-unsafe-eval')", () => {
    const scriptSrc = directive('script-src');
    expect(scriptSrc).not.toBe('');
    // Either the narrow wasm permission or the broad eval permission works.
    expect(/'wasm-unsafe-eval'|'unsafe-eval'/.test(scriptSrc)).toBe(true);
  });

  it('allows the Tesseract CDN to load and be fetched from', () => {
    expect(directive('script-src')).toContain('https://cdn.jsdelivr.net');
    expect(directive('connect-src')).toContain('https://cdn.jsdelivr.net');
  });

  it('allows blob: workers, which the OCR engine runs in', () => {
    expect(directive('worker-src')).toContain('blob:');
  });

  it('allows the Gmail API host used by the inbox scan', () => {
    // gmail.googleapis.com is a distinct host — www.googleapis.com does not cover it.
    expect(directive('connect-src')).toContain('https://gmail.googleapis.com');
  });

  it('still allows the OAuth endpoints sign-in depends on', () => {
    const connectSrc = directive('connect-src');
    expect(connectSrc).toContain('https://oauth2.googleapis.com');
    expect(connectSrc).toContain('https://login.microsoftonline.com');
  });

  it('keeps the dangerous defaults locked down', () => {
    expect(directive('object-src')).toContain("'none'");
    expect(directive('base-uri')).toContain("'self'");
    expect(directive('default-src')).toContain("'self'");
  });
});
