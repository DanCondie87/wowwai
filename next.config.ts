import type { NextConfig } from "next";

/**
 * Security Headers
 *
 * US-058: Nonce-based CSP implemented in middleware.ts.
 *
 * CSP is now dynamically generated per-request in middleware with a unique nonce,
 * replacing the static 'unsafe-inline' approach. This provides stronger XSS protection
 * while allowing Next.js hydration scripts to execute.
 *
 * The CSP header is set in middleware.ts and includes:
 *   - script-src 'nonce-{random}' 'strict-dynamic' — allows Next.js scripts via nonce
 *   - 'strict-dynamic' trusts scripts loaded by already-trusted scripts (Next.js chunks)
 *   - connect-src includes Convex endpoints (wss:// and https://)
 *   - 'unsafe-eval' in dev mode only (for React error stack reconstruction)
 *
 * Other security headers remain here as static config:
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
