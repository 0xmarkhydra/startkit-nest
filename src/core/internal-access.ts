import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

const bearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const constantTimeEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

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
