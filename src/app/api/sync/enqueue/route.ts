/**
 * SEC-003: Authenticated file sync enqueue endpoint.
 *
 * Replaces direct useMutation(api.fileSyncQueue.enqueue) calls from the browser,
 * which were unauthenticated Convex mutations callable by anyone with the Convex URL.
 * This was a critical file write injection vector: anyone could enqueue arbitrary
 * content into the sync queue, which the sync-agent would write to disk.
 *
 * This route verifies the session cookie before proxying to the AGENT_SECRET-protected
 * Convex /sync/enqueue HTTP endpoint.
 *
 * Required env vars (server-side only):
 *   NEXT_PUBLIC_CONVEX_SITE_URL — Convex HTTP endpoint base URL
 *   AGENT_SECRET                — Shared secret for Convex HTTP actions
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // Verify session cookie
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const agentSecret = process.env.AGENT_SECRET;

  if (!convexSiteUrl || !agentSecret) {
    console.error("[/api/sync/enqueue] Missing NEXT_PUBLIC_CONVEX_SITE_URL or AGENT_SECRET env vars");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const res = await fetch(`${convexSiteUrl}/sync/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-secret": agentSecret,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[/api/sync/enqueue] Convex endpoint returned ${res.status}: ${text}`);
      return NextResponse.json({ error: "Enqueue failed" }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/sync/enqueue] Failed to call Convex:", err);
    return NextResponse.json({ error: "Enqueue failed" }, { status: 500 });
  }
}
