import { parsePositiveIntegerEnv, parseTrustProxy } from './http-options';

describe('HTTP runtime options', () => {
  it('treats TRUST_PROXY=1 as one trusted hop, not trust-all', () => {
    expect(parseTrustProxy('1')).toBe(1);
  });

  it('supports explicit trust-all and trusted proxy strings', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
  });

  it('disables proxy trust by default', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('0')).toBe(false);
  });

  it('uses positive integer HTTP settings only', () => {
    expect(parsePositiveIntegerEnv('2048', 1024)).toBe(2048);
    expect(parsePositiveIntegerEnv('0', 1024)).toBe(1024);
    expect(parsePositiveIntegerEnv('1.5', 1024)).toBe(1024);
  });
});
