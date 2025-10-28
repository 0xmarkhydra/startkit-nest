/**
 * Normalize Ethereum address to lowercase
 * ERC-20 addresses should always be stored and compared in lowercase
 */
export function normalizeAddress(address: string): string {
  if (!address) return address;
  return address.toLowerCase();
}

/**
 * Check if two addresses are equal (case-insensitive)
 */
export function isAddressEqual(address1: string, address2: string): boolean {
  if (!address1 || !address2) return false;
  return normalizeAddress(address1) === normalizeAddress(address2);
}
