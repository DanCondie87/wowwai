import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

/**
 * US-047: Agent Activity queries and mutations
 */

export const getActiveByTaskId = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query("agentActivity")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    // Only return activities that are "working" and have a recent heartbeat
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    return activities.find(
      (a) => a.status === "working" && a.lastHeartbeat > thirtyMinAgo
    ) ?? null;
  },
});

export const getAllActive = query({
  args: {},
  handler: async (ctx) => {
    const activities = await ctx.db
      .query("agentActivity")
      .withIndex("by_status", (q) => q.eq("status", "working"))
      .collect();

    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    return activities.filter((a) => a.lastHeartbeat > thirtyMinAgo);
  },
});

export const upsertActivity = internalMutation({
  args: {
    taskId: v.optional(v.id("tasks")),
    sessionKey: v.string(),
    model: v.string(),
    status: v.string(),
    currentAction: v.union(v.string(), v.null()),
    startedAt: v.number(),
    lastHeartbeat: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if there's an existing activity for this session
    const existing = await ctx.db
      .query("agentActivity")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        taskId: args.taskId,
        model: args.model,
        status: args.status,
        currentAction: args.currentAction ?? undefined,
        lastHeartbeat: args.lastHeartbeat,
      });
    } else {
      await ctx.db.insert("agentActivity", {
        taskId: args.taskId,
        sessionKey: args.sessionKey,
        model: args.model,
        status: args.status,
        currentAction: args.currentAction ?? undefined,
        startedAt: args.startedAt,
        lastHeartbeat: args.lastHeartbeat,
      });
    }
  },
});

export const heartbeat = internalMutation({
  args: {
    sessionKey: v.string(),
    currentAction: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentActivity")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastHeartbeat: Date.now(),
        currentAction: args.currentAction ?? undefined,
      });
    }
  },
});

export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const activities = await ctx.db
      .query("agentActivity")
      .withIndex("by_status", (q) => q.eq("status", "working"))
      .collect();

    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    let expired = 0;

    for (const activity of activities) {
      if (activity.lastHeartbeat < thirtyMinAgo) {
        await ctx.db.patch(activity._id, { status: "idle" });
        expired++;
      }
    }

    return { expired };
  },
});
