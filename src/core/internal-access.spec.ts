import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { assertInternalEndpointAccess } from './internal-access';

describe('assertInternalEndpointAccess', () => {
  it('allows internal endpoints outside production without a token', () => {
    expect(() =>
      assertInternalEndpointAccess('test', undefined, undefined),
    ).not.toThrow();
  });

  it('hides internal endpoints in production when no token is configured', () => {
    expect(() =>
      assertInternalEndpointAccess('production', undefined, undefined),
    ).toThrow(NotFoundException);
  });

  it('rejects an invalid production bearer token', () => {
    expect(() =>
      assertInternalEndpointAccess(
        'production',
        'expected-secret',
        'Bearer wrong-secret',
      ),
    ).toThrow(UnauthorizedException);
  });

  it('accepts the configured production bearer token', () => {
    expect(() =>
      assertInternalEndpointAccess(
        'production',
        'expected-secret',
        'Bearer expected-secret',
      ),
    ).not.toThrow();
  });
});
