import { isIP } from 'net';

export type TrustProxyOption = boolean | number | string;

export const isValidProxyAddress = (value: string): boolean => {
  const [address, prefix, ...extra] = value.split('/');
  if (!address || extra.length > 0) {
    return false;
  }

  const family = isIP(address);
  if (family === 0) {
    return false;
  }

  if (prefix === undefined) {
    return true;
  }
  if (!/^\d+$/.test(prefix)) {
    return false;
  }

  const prefixLength = Number(prefix);
  return prefixLength >= 0 && prefixLength <= (family === 4 ? 32 : 128);
};

export const parseTrustProxy = (
  value: string | undefined = process.env.TRUST_PROXY,
): TrustProxyOption => {
  const normalized = value?.trim();
  const lowercase = normalized?.toLowerCase();

  if (!normalized || normalized === '0' || lowercase === 'false') {
    return false;
  }

  if (/^[1-9]\d*$/.test(normalized)) {
    return Number(normalized);
  }

  if (lowercase === 'true') {
    return true;
  }

  if (isValidProxyAddress(normalized)) {
    return normalized;
  }

  throw new Error(`Invalid TRUST_PROXY value: ${value}`);
};

export const parsePositiveIntegerEnv = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
