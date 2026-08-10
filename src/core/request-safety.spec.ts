import { safeRequestPath } from './request-safety';

describe('safeRequestPath', () => {
  it('removes query strings from logged request paths', () => {
    expect(safeRequestPath('/callback?token=secret&code=123')).toBe('/callback');
  });

  it('preserves paths without a query string', () => {
    expect(safeRequestPath('/health/ready')).toBe('/health/ready');
  });

  it('returns a stable fallback for a missing URL', () => {
    expect(safeRequestPath(undefined)).toBe('unknown');
  });
});
