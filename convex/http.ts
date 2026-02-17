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

function verifySecret(request: Request): boolean {
  const secret = request.headers.get("x-agent-secret");
  const expected = process.env.AGENT_SECRET;
  if (!expected || !secret) return false;
  return secret === expected;
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
    if (!verifySecret(request)) return unauthorized(origin);

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
    if (!verifySecret(request)) return unauthorized(origin);

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
    if (!verifySecret(request)) return unauthorized(origin);

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
    if (!verifySecret(request)) return unauthorized(origin);

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
    if (!verifySecret(request)) return unauthorized(origin);

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
    if (!verifySecret(request)) return unauthorized(origin);

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

export default http;
