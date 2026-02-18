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
    return NextResponse.next();
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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const valid = await verifySessionToken(token);
  if (!valid) {
    // Clear invalid cookie and redirect
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(AUTH_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  }

  return NextResponse.next();
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
