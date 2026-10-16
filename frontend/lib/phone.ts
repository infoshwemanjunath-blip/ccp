/**
 * Normalizes Indian mobile number input by stripping spaces, symbols, and country prefixes (+91, 91, 0)
 * Returns the 10-digit mobile number for regex validation.
 */
export function normalizeIndianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return cleaned.slice(2);
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return cleaned.slice(1);
  }
  return cleaned;
}

export function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizeIndianPhone(phone));
}
