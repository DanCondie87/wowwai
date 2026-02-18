import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// ─── Internal write mutations (SEC-003 extension) ─────────────────────────────
//
// auditLogs.create was especially dangerous as a public mutation — anyone with
// the Convex URL could insert fake audit log entries, poisoning the audit trail.
// Converted to internalMutation only. Audit entries are created internally by
// tasks.ts mutations (which are themselves now internal).

export const create = internalMutation({
  args: {
    taskId: v.id("tasks"),
    actor: v.union(v.literal("dan"), v.literal("dali"), v.literal("system")),
    action: v.string(),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    comment: v.optional(v.string()),
    modelUsed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", {
      taskId: args.taskId,
      actor: args.actor,
      action: args.action,
      before: args.before,
      after: args.after,
      comment: args.comment,
      modelUsed: args.modelUsed,
      timestamp: Date.now(),
    });
  },
});

// Alias kept for agent compatibility — same implementation
export const createInternal = internalMutation({
  args: {
    taskId: v.id("tasks"),
    actor: v.union(v.literal("dan"), v.literal("dali"), v.literal("system")),
    action: v.string(),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    comment: v.optional(v.string()),
    modelUsed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", {
      taskId: args.taskId,
      actor: args.actor,
      action: args.action,
      before: args.before,
      after: args.after,
      comment: args.comment,
      modelUsed: args.modelUsed,
      timestamp: Date.now(),
    });
  },
});

// ─── Public queries ────────────────────────────────────────────────────────────

export const getByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  },
});
