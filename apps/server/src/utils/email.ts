/**
 * Extracts the bare email address from either:
 *   "user@example.com"
 *   "Display Name <user@example.com>"
 */
export function extractEmail(input: string): string {
  const match = input.match(/<([^>]+)>/);
  return (match ? match[1] : input).trim().toLowerCase();
}

/**
 * Zod-compatible validator — accepts both plain and formatted addresses.
 */
export function isValidEmailField(val: string): boolean {
  const email = extractEmail(val);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
