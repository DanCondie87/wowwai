/**
 * SEC-003: Authenticated export endpoint.
 *
 * Replaces direct useQuery(api.export.getFullExport) calls from the browser,
 * which were unauthenticated Convex queries callable by anyone with the Convex URL.
 *
 * This route verifies the session cookie before proxying to the AGENT_SECRET-protected
 * Convex /agent/backup HTTP endpoint.
 *
 * Required env vars (server-side only):
 *   NEXT_PUBLIC_CONVEX_SITE_URL — Convex HTTP endpoint base URL
 *   AGENT_SECRET                — Shared secret for Convex HTTP actions
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Verify session cookie
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const agentSecret = process.env.AGENT_SECRET;

  if (!convexSiteUrl || !agentSecret) {
    console.error("[/api/export] Missing NEXT_PUBLIC_CONVEX_SITE_URL or AGENT_SECRET env vars");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const res = await fetch(`${convexSiteUrl}/agent/backup`, {
      headers: {
        "x-agent-secret": agentSecret,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[/api/export] Convex backup endpoint returned ${res.status}: ${text}`);
      return NextResponse.json({ error: "Export failed" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/export] Failed to fetch from Convex:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
