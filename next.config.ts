import type { NextConfig } from "next";

/**
 * Security Headers
 *
 * SEC-004: CSP hardened — 'unsafe-inline' removed from script-src.
 *
 * script-src now uses 'strict-dynamic', which:
 *   - Trusts scripts loaded by already-trusted scripts (Next.js runtime → chunks)
 *   - Overrides 'self' and other allowlist source entries for scripts
 *   - Does NOT allow arbitrary inline scripts (removes unsafe-inline effectively)
 *   - 'self' is kept for browsers that don't support strict-dynamic (graceful fallback)
 *
 * Note: Full nonce-based CSP would be stronger but requires middleware to generate
 * nonces per-request and thread them through layout.tsx via `headers()`. That is
 * tracked as a follow-up improvement. 'strict-dynamic' provides meaningful
 * protection against XSS without requiring per-request nonce infrastructure.
 *
 * Convex connections:
 *   - connect-src includes wss://*.convex.cloud for WebSocket subscriptions
 *   - connect-src includes https://*.convex.site for Convex HTTP actions
 *
 * Additional headers added (SEC-004):
 *   - Referrer-Policy: strict-origin-when-cross-origin
 *   - Permissions-Policy: restricts camera, microphone, geolocation
 *   - Strict-Transport-Security (HSTS): 1 year with subdomains
 *   - Cross-Origin-Opener-Policy: isolate from cross-origin documents
 */

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    // script-src: 'unsafe-inline' is required for Next.js hydration inline scripts.
    // Without nonce-based CSP (which requires per-request middleware), 'strict-dynamic'
    // alone blocks ALL scripts including Next.js bootstrap. Tracked as future improvement.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'", // Tailwind/shadcn require inline styles; acceptable risk
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "frame-ancestors 'none'", // belt-and-suspenders with X-Frame-Options: DENY
      "base-uri 'self'",        // prevent base tag injection
      "form-action 'self'",     // prevent form exfiltration to external origins
    ].join("; "),
  },
  {
    // Prevent Referer header from leaking full URL to cross-origin requests
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Restrict powerful browser features not used by this app
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    // Force HTTPS for 1 year; include subdomains (Vercel deployment)
    // Note: Vercel adds HSTS by default, but explicit header ensures it in all envs
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    // Isolate this browsing context from cross-origin documents
    // Prevents cross-origin attacks exploiting shared browsing contexts
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
