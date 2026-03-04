/**
 * Formats a US phone number string into E.164 format (+1XXXXXXXXXX).
 * Returns null if the input is not a valid 10-digit US number.
 */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  // Handle 11-digit with leading 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  // Handle 10-digit US number
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  // Already in +1XXXXXXXXXX format
  if (raw.startsWith("+1") && digits.length === 11) {
    return `+${digits}`;
  }
  return null;
}

/**
 * Formats digits into a readable (XXX) XXX-XXXX pattern as user types.
 */
export function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Returns true if the raw input contains a valid 10-digit US phone number.
 */
export function isValidUSPhone(raw: string): boolean {
  return toE164(raw) !== null;
}
