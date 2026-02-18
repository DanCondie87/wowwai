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

/** Verify password against stored hash */
export async function verifyPassword(password: string): Promise<boolean> {
  const hash = await sha256(password);
  return hash === getPasswordHash();
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
    if (sig !== expectedSig) return false;

    const data = JSON.parse(payload);
    if (data.exp && data.exp < Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

export { AUTH_COOKIE, COOKIE_MAX_AGE };
