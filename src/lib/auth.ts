/**
 * Simple single-user auth using Web Crypto API.
 * No external dependencies. Password hash + HMAC-signed cookie.
 */

const AUTH_COOKIE = "wowwai_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET env var is required");
  return secret;
}

function getPasswordHash(): string {
  const hash = process.env.AUTH_PASSWORD_HASH?.trim();
  if (!hash) throw new Error("AUTH_PASSWORD_HASH env var is required");
  return hash;
}

/** SHA-256 hash a string */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Create HMAC signature for a payload */
async function sign(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Timing-safe string comparison using Web Crypto HMAC.
 *
 * Both strings are HMAC'd with a random one-time key before XOR comparison.
 * This prevents timing attacks even with JIT optimization, because:
 *   1. HMAC outputs are always 32 bytes (fixed-length → constant-time XOR)
 *   2. The random key ensures HMAC(k, a) and HMAC(k, b) are unpredictable,
 *      making branch prediction useless to the attacker
 *
 * Works in Edge runtime (no Node.js crypto required).
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const [macA, macB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const a32 = new Uint8Array(macA);
  const b32 = new Uint8Array(macB);
  // XOR all 32 bytes — constant-time for fixed-length HMAC output
  let diff = 0;
  for (let i = 0; i < 32; i++) {
    diff |= a32[i] ^ b32[i];
  }
  return diff === 0;
}

/**
 * Verify password against stored hash.
 *
 * Uses SHA-256 for hashing. Given rate limiting (5 attempts / 15 min)
 * and single-user context, this is acceptable. A brute-force attack at
 * the network layer is bottlenecked by the rate limiter long before
 * the fast-hash risk becomes relevant. See SECURITY-FIXES.md for details.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const hash = await sha256(password);
  return timingSafeEqual(hash, getPasswordHash());
}

/** Create a signed session token */
export async function createSessionToken(): Promise<string> {
  const payload = JSON.stringify({
    user: "dan",
    iat: Date.now(),
    exp: Date.now() + COOKIE_MAX_AGE * 1000,
  });
  const sig = await sign(payload);
  // base64 encode payload + signature
  const token = btoa(payload) + "." + sig;
  return token;
}

/** Verify a session token is valid and not expired */
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return false;

    const payload = atob(payloadB64);
    const expectedSig = await sign(payload);
    // Use timing-safe comparison to prevent signature oracle attacks
    if (!(await timingSafeEqual(sig, expectedSig))) return false;

    const data = JSON.parse(payload);
    if (data.exp && data.exp < Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

export { AUTH_COOKIE, COOKIE_MAX_AGE };
