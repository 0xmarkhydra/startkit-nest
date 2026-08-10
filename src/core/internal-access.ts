import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

const bearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const digest = (value: string): Buffer =>
  createHash('sha256').update(value).digest();

const constantTimeEquals = (left: string, right: string): boolean =>
  timingSafeEqual(digest(left), digest(right));

export const assertInternalEndpointAccess = (
  appEnv: string,
  configuredToken: string | undefined,
  authorizationHeader: string | undefined,
): void => {
  if (appEnv !== 'production') {
    return;
  }

  const expectedToken = configuredToken?.trim();
  if (!expectedToken) {
    throw new NotFoundException();
  }

  const providedToken = bearerToken(authorizationHeader);
  if (!providedToken || !constantTimeEquals(providedToken, expectedToken)) {
    throw new UnauthorizedException('Invalid internal endpoint token');
  }
};
