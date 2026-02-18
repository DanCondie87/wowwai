/**
 * SEC-003 extension: Authenticated mutations proxy.
 *
 * Replaces all direct useMutation(api.tasks.*) and useMutation(api.projects.*)
 * calls from the browser, which were unauthenticated Convex mutations callable
 * by anyone with the Convex URL (which is in the browser bundle).
 *
 * This route verifies the session cookie, then forwards the mutation call to the
 * AGENT_SECRET-protected Convex /mutations HTTP endpoint.
 *
 * Body: { mutation: "tasks.create" | "tasks.update" | ..., args: { ... } }
 *
 * Required env vars (server-side only):
 *   NEXT_PUBLIC_CONVEX_SITE_URL — Convex HTTP endpoint base URL
 *   AGENT_SECRET                — Shared secret for Convex HTTP actions
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE } from "@/lib/auth";

const ALLOWED_MUTATIONS = new Set([
  "tasks.create",
  "tasks.update",
  "tasks.moveToColumn",
  "tasks.reorder",
  "projects.create",
  "projects.update",
  "projects.archive",
]);

export async function POST(request: NextRequest) {
  // Verify session cookie
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const agentSecret = process.env.AGENT_SECRET;

  if (!convexSiteUrl || !agentSecret) {
    console.error("[/api/mutations] Missing NEXT_PUBLIC_CONVEX_SITE_URL or AGENT_SECRET env vars");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: { mutation: string; args: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Allowlist validation — only permit known safe mutations
  if (!body.mutation || !ALLOWED_MUTATIONS.has(body.mutation)) {
    return NextResponse.json(
      { error: `Unknown or disallowed mutation: ${body.mutation}` },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${convexSiteUrl}/mutations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-secret": agentSecret,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[/api/mutations] Convex endpoint returned ${res.status}: ${text}`);
      return NextResponse.json({ error: "Mutation failed" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/mutations] Failed to call Convex:", err);
    return NextResponse.json({ error: "Mutation failed" }, { status: 500 });
  }
}
