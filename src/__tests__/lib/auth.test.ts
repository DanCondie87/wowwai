// @vitest-environment node
/**
 * Auth unit tests (Priority 1 — SEC-001)
 *
 * These tests run in Node environment (not jsdom) because
 * auth.ts uses Web Crypto API (crypto.subtle), which is available
 * natively in Node.js v20+.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Pre-computed SHA-256 of "testpassword" for deterministic test setup
const KNOWN_PASSWORD = "testpassword";
const KNOWN_HASH = "9f735e0df9a1ddc702bf0a1a7b83033f9f7153a00c29de82cedadc9957289b05";
const TEST_SECRET = "test-secret-at-least-32-characters-long!!";

beforeEach(() => {
  // Set required env vars before each test (module re-reads them via getter)
  vi.stubEnv("AUTH_SECRET", TEST_SECRET);
  vi.stubEnv("AUTH_PASSWORD_HASH", KNOWN_HASH);
});

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const { verifyPassword } = await import("@/lib/auth");
    await expect(verifyPassword(KNOWN_PASSWORD)).resolves.toBe(true);
  });

  it("returns false for a wrong password", async () => {
    const { verifyPassword } = await import("@/lib/auth");
    await expect(verifyPassword("wrongpassword")).resolves.toBe(false);
  });

  it("returns false for an empty string", async () => {
    const { verifyPassword } = await import("@/lib/auth");
    await expect(verifyPassword("")).resolves.toBe(false);
  });

  it("is case-sensitive (Password ≠ password)", async () => {
    const { verifyPassword } = await import("@/lib/auth");
    await expect(verifyPassword("Testpassword")).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hashPassword — tested indirectly via verifyPassword with a known hash
// ---------------------------------------------------------------------------

describe("hashPassword (via verifyPassword)", () => {
  it("produces consistent SHA-256 hex output for the same input", async () => {
    // We verify by checking that the same password produces the same hash
    // by running verifyPassword twice — both must pass
    const { verifyPassword } = await import("@/lib/auth");
    const first = await verifyPassword(KNOWN_PASSWORD);
    const second = await verifyPassword(KNOWN_PASSWORD);
    expect(first).toBe(true);
    expect(second).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createSessionToken
// ---------------------------------------------------------------------------

describe("createSessionToken", () => {
  it("returns a string in the format base64payload.hexsig", async () => {
    const { createSessionToken } = await import("@/lib/auth");
    const token = await createSessionToken();
    // Must contain exactly one dot
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    const [payloadB64, sig] = parts;
    // Payload must be valid base64
    expect(() => atob(payloadB64)).not.toThrow();
    // Signature must be a hex string (64 chars for SHA-256 HMAC)
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("payload decodes to valid JSON with user, iat, and exp", async () => {
    const { createSessionToken } = await import("@/lib/auth");
    const token = await createSessionToken();
    const [payloadB64] = token.split(".");
    const payload = JSON.parse(atob(payloadB64));
    expect(payload).toHaveProperty("user", "dan");
    expect(payload).toHaveProperty("iat");
    expect(payload).toHaveProperty("exp");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
  });

  it("exp is set to approximately 30 days from now", async () => {
    const { createSessionToken, COOKIE_MAX_AGE } = await import("@/lib/auth");
    const before = Date.now();
    const token = await createSessionToken();
    const after = Date.now();
    const [payloadB64] = token.split(".");
    const payload = JSON.parse(atob(payloadB64));
    const expectedMaxAge = COOKIE_MAX_AGE * 1000; // 30 days in ms
    expect(payload.exp).toBeGreaterThanOrEqual(before + expectedMaxAge - 1000);
    expect(payload.exp).toBeLessThanOrEqual(after + expectedMaxAge + 1000);
  });
});

// ---------------------------------------------------------------------------
// verifySessionToken
// ---------------------------------------------------------------------------

describe("verifySessionToken", () => {
  it("accepts a fresh token from createSessionToken", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/auth");
    const token = await createSessionToken();
    await expect(verifySessionToken(token)).resolves.toBe(true);
  });

  it("rejects a token with a tampered payload", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/auth");
    const token = await createSessionToken();
    const [, sig] = token.split(".");
    // Tamper: encode a different payload but keep the original signature
    const tamperedPayload = btoa(JSON.stringify({ user: "attacker", iat: Date.now(), exp: Date.now() + 9999999 }));
    const tamperedToken = `${tamperedPayload}.${sig}`;
    await expect(verifySessionToken(tamperedToken)).resolves.toBe(false);
  });

  it("rejects a token with a tampered signature", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/auth");
    const token = await createSessionToken();
    const [payloadB64] = token.split(".");
    // Replace last char of sig to break it
    const badSig = "0".repeat(64);
    const tamperedToken = `${payloadB64}.${badSig}`;
    await expect(verifySessionToken(tamperedToken)).resolves.toBe(false);
  });

  it("rejects a token with no dot separator", async () => {
    const { verifySessionToken } = await import("@/lib/auth");
    await expect(verifySessionToken("nodothere")).resolves.toBe(false);
  });

  it("rejects an empty string", async () => {
    const { verifySessionToken } = await import("@/lib/auth");
    await expect(verifySessionToken("")).resolves.toBe(false);
  });

  it("rejects a token with invalid base64 payload", async () => {
    const { verifySessionToken } = await import("@/lib/auth");
    // "!!!" is not valid base64
    await expect(verifySessionToken("!!!.deadbeef")).resolves.toBe(false);
  });

  it("rejects an expired token (exp in the past)", async () => {
    const { verifySessionToken } = await import("@/lib/auth");
    // Build an expired payload manually and sign it with the test secret
    const expiredPayload = JSON.stringify({
      user: "dan",
      iat: Date.now() - 60000,
      exp: Date.now() - 1000, // expired 1 second ago
    });
    // We need to sign it ourselves to produce a valid-but-expired token.
    // Use the same HMAC logic as auth.ts:
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(TEST_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(expiredPayload));
    const sig = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const token = `${btoa(expiredPayload)}.${sig}`;
    await expect(verifySessionToken(token)).resolves.toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const { verifySessionToken } = await import("@/lib/auth");
    const payload = JSON.stringify({ user: "dan", iat: Date.now(), exp: Date.now() + 9999999 });
    // Sign with a DIFFERENT secret
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode("completely-different-secret-abcdefghijklmnopqrstuvwxyz"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const sig = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const token = `${btoa(payload)}.${sig}`;
    await expect(verifySessionToken(token)).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// timingSafeEqual (tested indirectly via verifyPassword/verifySessionToken)
// ---------------------------------------------------------------------------

describe("timingSafeEqual (via verifyPassword)", () => {
  it("returns true when comparing equal values", async () => {
    const { verifyPassword } = await import("@/lib/auth");
    // Both hashes are the same (correct password) → timingSafeEqual returns true
    await expect(verifyPassword(KNOWN_PASSWORD)).resolves.toBe(true);
  });

  it("returns false when comparing different values", async () => {
    const { verifyPassword } = await import("@/lib/auth");
    // Different hashes → timingSafeEqual returns false
    await expect(verifyPassword("definitelywrong")).resolves.toBe(false);
  });
});
