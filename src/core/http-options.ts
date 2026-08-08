export type TrustProxyOption = boolean | number | string;

export const parseTrustProxy = (
  value: string | undefined = process.env.TRUST_PROXY,
): TrustProxyOption => {
  const normalized = value?.trim();

  if (!normalized || normalized === '0' || normalized.toLowerCase() === 'false') {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    const trustedHops = Number(normalized);
    return trustedHops > 0 ? trustedHops : false;
  }

  if (normalized.toLowerCase() === 'true') {
    return true;
  }

  return normalized;
};

export const parsePositiveIntegerEnv = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
