// @vitest-environment node
/**
 * Middleware tests (Priority 2 — SEC-002)
 *
 * Tests the auth enforcement layer in middleware.ts.
 * Uses NextRequest from next/server and a real (but controlled) token
 * to verify all auth branches.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Known test credentials
const TEST_SECRET = "test-secret-at-least-32-characters-long!!";
const KNOWN_HASH = "9f735e0df9a1ddc702bf0a1a7b83033f9f7153a00c29de82cedadc9957289b05";

// Helper: create a valid signed session token using the test secret
async function makeValidToken(): Promise<string> {
  const payload = JSON.stringify({
    user: "dan",
    iat: Date.now(),
    exp: Date.now() + 60 * 60 * 24 * 30 * 1000, // 30 days
  });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(TEST_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${btoa(payload)}.${sig}`;
}

// Helper: create an expired signed session token
async function makeExpiredToken(): Promise<string> {
  const payload = JSON.stringify({
    user: "dan",
    iat: Date.now() - 60000,
    exp: Date.now() - 1000, // expired
  });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(TEST_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${btoa(payload)}.${sig}`;
}

// Helper: create a NextRequest with optional session cookie
function makeRequest(path: string, options?: { cookie?: string; headers?: Record<string, string> }): NextRequest {
  const url = `http://localhost${path}`;
  const init: RequestInit = {};
  if (options?.headers) {
    init.headers = options.headers;
  }
  const req = new NextRequest(url, init);
  if (options?.cookie) {
    req.cookies.set("wowwai_session", options.cookie);
  }
  return req;
}

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", TEST_SECRET);
  vi.stubEnv("AUTH_PASSWORD_HASH", KNOWN_HASH);
  vi.resetModules(); // ensure env changes take effect in re-imported modules
});

// ---------------------------------------------------------------------------
// Protected routes without auth
// ---------------------------------------------------------------------------

describe("Protected routes without session cookie", () => {
  it("redirects /board to /login", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/board");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects / to /login when not authenticated", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects /settings to /login", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/settings");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects /api/mutations to /login", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/api/mutations");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});

// ---------------------------------------------------------------------------
// Protected routes with valid session
// ---------------------------------------------------------------------------

describe("Protected routes with valid session cookie", () => {
  it("allows /board through with a valid session", async () => {
    const { middleware } = await import("../../middleware");
    const token = await makeValidToken();
    const req = makeRequest("/board", { cookie: token });
    const res = await middleware(req);
    // NextResponse.next() → status 200
    expect(res.status).toBe(200);
  });

  it("allows /settings through with a valid session", async () => {
    const { middleware } = await import("../../middleware");
    const token = await makeValidToken();
    const req = makeRequest("/settings", { cookie: token });
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Protected routes with invalid/expired session
// ---------------------------------------------------------------------------

describe("Protected routes with expired or tampered session cookie", () => {
  it("redirects and clears cookie when session is expired", async () => {
    const { middleware } = await import("../../middleware");
    const token = await makeExpiredToken();
    const req = makeRequest("/board", { cookie: token });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    // Cookie should be cleared (Max-Age=0)
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("wowwai_session=");
    expect(setCookie).toMatch(/max-age=0/i);
  });

  it("redirects and clears cookie when session token is tampered", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/board", { cookie: "tampered.payload.notvalid" });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects when session cookie contains garbage", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/board", { cookie: "not-a-token" });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});

// ---------------------------------------------------------------------------
// Public routes — must pass through without auth
// ---------------------------------------------------------------------------

describe("Public routes pass through without session cookie", () => {
  it("allows /login through", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/login");
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("allows /api/auth/login through", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/api/auth/login");
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("allows /api/auth/logout through", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/api/auth/logout");
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("allows /api/agent through (external agent endpoint)", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/api/agent");
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("allows /api/agent/sync through (sub-path)", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/api/agent/sync");
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Static assets — must pass through
// ---------------------------------------------------------------------------

describe("Static asset paths pass through", () => {
  it("allows /_next/static paths through", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/_next/static/chunks/main.js");
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Security: x-middleware-subrequest header bypass (CVE-2025-29927)
// ---------------------------------------------------------------------------

describe("x-middleware-subrequest header is blocked", () => {
  it("returns 403 when x-middleware-subrequest header is present", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/board", {
      headers: { "x-middleware-subrequest": "1" },
    });
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 even on public routes if subrequest header is set", async () => {
    const { middleware } = await import("../../middleware");
    const req = makeRequest("/login", {
      headers: { "x-middleware-subrequest": "middleware" },
    });
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });
});
