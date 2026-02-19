import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE } from "@/lib/auth";

/**
 * Exact public routes that bypass auth.
 * Use precise prefixes — avoids overly broad matching that could
 * let crafted paths like /api/authX slip through.
 */
const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
];

/**
 * Generate CSP header with nonce for script-src.
 * 
 * US-058: Nonce-based CSP replaces 'unsafe-inline' for script-src.
 * - Nonce allows Next.js hydration scripts while blocking arbitrary inline scripts
 * - 'strict-dynamic' trusts scripts loaded by already-trusted scripts (Next.js chunks)
 * - 'unsafe-eval' required in dev for React error stack reconstruction
 */
function generateCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud",
    `script-src 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind/shadcn require inline styles
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Defense-in-depth: block CVE-2025-29927 (x-middleware-subrequest bypass).
  // Next.js 16.1.6 is patched (fix landed in 12.3.5 / 13.5.9 / 14.2.25 / 15.2.3),
  // but we reject this header explicitly as a belt-and-suspenders measure in case
  // the app ever runs behind a proxy or older Next.js version.
  if (request.headers.has("x-middleware-subrequest")) {
    return new NextResponse(null, { status: 403 });
  }

  // Allow public auth routes (strict prefix check — no partial matches)
  if (PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    // Generate nonce for public routes too
    const nonce = crypto.randomUUID();
    const response = NextResponse.next();
    response.headers.set("x-nonce", nonce);
    response.headers.set("Content-Security-Policy", generateCSP(nonce));
    return response;
  }

  // Allow Next.js internals (handled by matcher config, but belt-and-suspenders)
  if (pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Allow the agent/sync HTTP endpoint — used by external sync agent with its own secret auth.
  // This is intentionally unauthenticated at middleware level; convex/http.ts handles the
  // AGENT_SECRET verification for every route on this path.
  if (pathname.startsWith("/api/agent")) {
    return NextResponse.next();
  }

  // NOTE: The original `pathname.includes(".")` check was removed.
  // That check was too broad and could be bypassed via paths like /api/secret/.hidden
  // Static asset extension filtering is now handled exclusively by the matcher regex below.

  // Check session cookie
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    // Generate nonce for login redirect too
    const nonce = crypto.randomUUID();
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.headers.set("x-nonce", nonce);
    response.headers.set("Content-Security-Policy", generateCSP(nonce));
    return response;
  }

  const valid = await verifySessionToken(token);
  if (!valid) {
    // Clear invalid cookie and redirect
    const nonce = crypto.randomUUID();
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(AUTH_COOKIE, "", { maxAge: 0, path: "/" });
    response.headers.set("x-nonce", nonce);
    response.headers.set("Content-Security-Policy", generateCSP(nonce));
    return response;
  }

  // Generate nonce for authenticated requests
  const nonce = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", generateCSP(nonce));
  return response;
}

export const config = {
  matcher: [
    // Protect all routes except Next.js internals and known static file extensions.
    // The negative lookahead excludes _next/static, _next/image, and common static
    // file extensions. Everything else (including /api/*) goes through middleware.
    "/((?!_next/static|_next/image|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Also match /api and /trpc paths explicitly
    "/(api|trpc)(.*)",
  ],
};
