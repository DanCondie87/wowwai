import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = [
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    "http://localhost:3000",
    "http://localhost:3001",
  ].filter(Boolean);

  const effectiveOrigin =
    origin && allowed.some((a) => origin.startsWith(a)) ? origin : allowed[0];

  return {
    "Access-Control-Allow-Origin": effectiveOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-agent-secret",
    "Vary": "Origin",
  };
}

/**
 * Timing-safe secret verification for Convex HTTP actions.
 *
 * Uses HMAC-SHA256 with a random one-time key to prevent timing attacks.
 * Convex HTTP actions have access to the Web Crypto API (crypto.subtle).
 */
async function verifySecret(request: Request): Promise<boolean> {
  const secret = request.headers.get("x-agent-secret");
  const expected = process.env.AGENT_SECRET;
  if (!expected || !secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const [macA, macB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(secret)),
    crypto.subtle.sign("HMAC", key, encoder.encode(expected)),
  ]);
  const a32 = new Uint8Array(macA);
  const b32 = new Uint8Array(macB);
  let diff = 0;
  for (let i = 0; i < 32; i++) {
    diff |= a32[i] ^ b32[i];
  }
  return diff === 0;
}

function unauthorized(origin: string | null): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function tooManyRequests(origin: string | null, retryAt?: number): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...corsHeaders(origin),
  };
  if (retryAt) {
    headers["Retry-After"] = String(Math.ceil((retryAt - Date.now()) / 1000));
  }
  return new Response(
    JSON.stringify({ error: "Too Many Requests" }),
    { status: 429, headers }
  );
}

// CORS preflight
http.route({
  path: "/agent/updateTask",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/agent/createAuditLog",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/agent/getTask",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

// POST /agent/updateTask
http.route({
  path: "/agent/updateTask",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const rl = await ctx.runMutation(internal.rateLimiter.checkAgentRateLimit, {});
    if (!rl.ok) return tooManyRequests(origin, rl.retryAt);

    const body = await request.json();
    const { cardId, status, modelUsed, sessionSummary, comment } = body;

    if (!cardId) {
      return new Response(
        JSON.stringify({ error: "cardId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    const task = await ctx.runQuery(internal.tasks.getByCardId, { cardId });
    if (!task) {
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    await ctx.runMutation(internal.tasks.agentUpdate, {
      id: task._id,
      status,
      modelUsed,
      sessionSummary,
    });

    if (comment) {
      await ctx.runMutation(internal.auditLogs.createInternal, {
        taskId: task._id,
        actor: "dali",
        action: "comment",
        comment,
        modelUsed,
      });
    }

    return new Response(
      JSON.stringify({ success: true, taskId: task._id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
    );
  }),
});

// POST /agent/createAuditLog
http.route({
  path: "/agent/createAuditLog",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const rl = await ctx.runMutation(internal.rateLimiter.checkAgentRateLimit, {});
    if (!rl.ok) return tooManyRequests(origin, rl.retryAt);

    const body = await request.json();
    const { cardId, actor, action, comment, modelUsed } = body;

    if (!cardId || !action) {
      return new Response(
        JSON.stringify({ error: "cardId and action are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    const task = await ctx.runQuery(internal.tasks.getByCardId, { cardId });
    if (!task) {
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    await ctx.runMutation(internal.auditLogs.createInternal, {
      taskId: task._id,
      actor: actor ?? "dali",
      action,
      comment,
      modelUsed,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
    );
  }),
});

// GET /agent/getTask
http.route({
  path: "/agent/getTask",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const rl = await ctx.runMutation(internal.rateLimiter.checkAgentRateLimit, {});
    if (!rl.ok) return tooManyRequests(origin, rl.retryAt);

    const url = new URL(request.url);
    const cardId = url.searchParams.get("cardId");

    if (!cardId) {
      return new Response(
        JSON.stringify({ error: "cardId query param is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    const task = await ctx.runQuery(internal.tasks.getByCardId, { cardId });
    if (!task) {
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    return new Response(JSON.stringify(task), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }),
});

// --- File Sync Endpoints (for sync-agent) ---

// CORS preflight for sync endpoints
http.route({
  path: "/sync/upsertFile",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/sync/getPending",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/sync/markSynced",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

// POST /sync/upsertFile — sync agent pushes file changes to Convex
http.route({
  path: "/sync/upsertFile",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const body = await request.json();
    const { filePath, content, editedBy } = body;

    if (!filePath || content === undefined) {
      return new Response(
        JSON.stringify({ error: "filePath and content are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    await ctx.runMutation(internal.fileVersions.createVersionInternal, {
      filePath,
      content,
      editedBy: editedBy ?? "sync-agent",
      editedVia: "file-watcher",
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
    );
  }),
});

// GET /sync/getPending — sync agent polls for pending to-local items
http.route({
  path: "/sync/getPending",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const items = await ctx.runQuery(internal.fileSyncQueue.getPendingInternal, {
      direction: "to-local",
    });

    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }),
});

// POST /sync/markSynced — sync agent marks queue item as synced
http.route({
  path: "/sync/markSynced",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return new Response(
        JSON.stringify({ error: "id and status are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    await ctx.runMutation(internal.fileSyncQueue.updateStatusInternal, {
      id,
      status,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
    );
  }),
});

// POST /sync/enqueue — web UI queues a to-local file sync (SEC-003)
// Called by the Next.js /api/sync/enqueue route (session-verified) with AGENT_SECRET.
// The public fileSyncQueue.enqueue mutation was removed to prevent unauthenticated
// file write injection via direct Convex API calls.
http.route({
  path: "/sync/enqueue",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/sync/enqueue",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const body = await request.json();
    const { filePath, content, direction, status } = body;

    if (!filePath || content === undefined || !direction || !status) {
      return new Response(
        JSON.stringify({ error: "filePath, content, direction, and status are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    await ctx.runMutation(internal.fileSyncQueue.enqueueInternal, {
      filePath,
      content,
      direction,
      status,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
    );
  }),
});

// --- Agent Activity Endpoints (US-047) ---

http.route({
  path: "/agent/startActivity",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/agent/startActivity",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const body = await request.json();
    const { cardId, sessionKey, model, currentAction } = body;

    if (!sessionKey || !model) {
      return new Response(
        JSON.stringify({ error: "sessionKey and model are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    let taskId = undefined;
    if (cardId) {
      const task = await ctx.runQuery(internal.tasks.getByCardId, { cardId });
      if (task) taskId = task._id;
    }

    const now = Date.now();
    await ctx.runMutation(internal.agentActivity.upsertActivity, {
      taskId,
      sessionKey,
      model,
      status: "working",
      currentAction: currentAction ?? null,
      startedAt: now,
      lastHeartbeat: now,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
    );
  }),
});

http.route({
  path: "/agent/heartbeat",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/agent/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const body = await request.json();
    const { sessionKey, currentAction } = body;

    if (!sessionKey) {
      return new Response(
        JSON.stringify({ error: "sessionKey is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    await ctx.runMutation(internal.agentActivity.heartbeat, {
      sessionKey,
      currentAction: currentAction ?? null,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
    );
  }),
});

// --- Authenticated Mutations Endpoint (SEC-003 extension) ---
//
// Batch endpoint for all protected task/project write mutations.
// Called by the Next.js /api/mutations route (session-verified) with AGENT_SECRET.
// The public task/project mutations were removed to prevent unauthenticated writes
// by anyone who has the Convex URL (which is in the browser bundle).
//
// Supported mutations:
//   tasks.create, tasks.update, tasks.moveToColumn, tasks.reorder
//   projects.create, projects.update, projects.archive

http.route({
  path: "/mutations",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/mutations",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    let body: { mutation: string; args: Record<string, unknown> };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const { mutation: mutationName, args } = body;

    try {
      let result: unknown;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = args as any;
      switch (mutationName) {
        case "tasks.create":
          result = await ctx.runMutation(internal.tasks.create, a);
          break;
        case "tasks.update":
          result = await ctx.runMutation(internal.tasks.update, a);
          break;
        case "tasks.moveToColumn":
          result = await ctx.runMutation(internal.tasks.moveToColumn, a);
          break;
        case "tasks.reorder":
          result = await ctx.runMutation(internal.tasks.reorder, a);
          break;
        case "projects.create":
          result = await ctx.runMutation(internal.projects.create, a);
          break;
        case "projects.update":
          result = await ctx.runMutation(internal.projects.update, a);
          break;
        case "projects.archive":
          result = await ctx.runMutation(internal.projects.archive, a);
          break;
        default:
          return new Response(JSON.stringify({ error: `Unknown mutation: ${mutationName}` }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
          });
      }

      return new Response(JSON.stringify({ result }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mutation failed";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
  }),
});

// --- Backup Endpoint (US-051) ---

http.route({
  path: "/agent/backup",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/agent/backup",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    if (!(await verifySecret(request))) return unauthorized(origin);

    const data = await ctx.runQuery(internal.export.getFullBackup, {});

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }),
});

export default http;
