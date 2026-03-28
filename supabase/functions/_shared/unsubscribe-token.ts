/**
 * Unsubscribe token helpers — HMAC-SHA256 via Web Crypto API.
 * crypto.subtle is available natively in Deno; no external imports needed.
 *
 * Timing safety: crypto.subtle.verify() is constant-time by the Web Crypto
 * API specification — safe against timing attacks on the signature comparison.
 */

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Encode an ArrayBuffer as a lowercase hex string. */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Decode a lowercase hex string to Uint8Array. Returns null on malformed input. */
function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

/**
 * Generate an HMAC-SHA256 unsubscribe token for the given userId.
 * Returns a lowercase hex string.
 */
export async function generateUnsubscribeToken(
  userId: string,
  secret: string,
): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(userId),
  );
  return toHex(sig);
}

/**
 * Verify an unsubscribe token.
 * Uses crypto.subtle.verify() — constant-time comparison, safe against
 * timing attacks. Returns false on any invalid input rather than throwing.
 */
export async function verifyUnsubscribeToken(
  userId: string,
  token: string,
  secret: string,
): Promise<boolean> {
  try {
    const sigBytes = fromHex(token);
    if (!sigBytes) return false;
    const key = await importHmacKey(secret);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(userId),
    );
  } catch {
    return false;
  }
}
