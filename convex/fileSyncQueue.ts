import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

// SEC-003: enqueue, getPending, and updateStatus have been converted from
// public mutations/queries to internal-only. They are now accessible only via:
//   - The authenticated Next.js API route /api/sync/enqueue (for web UI edits)
//   - The authenticated Convex HTTP action /sync/enqueue (called by the API route)
//   - The authenticated Convex HTTP actions /sync/getPending and /sync/markSynced
//     (called by the sync-agent with AGENT_SECRET)
//
// Previously these were public Convex mutations callable by anyone with the Convex URL,
// which would allow arbitrary file content to be injected into the sync queue
// (and subsequently written to disk by the sync-agent).

export const enqueueInternal = internalMutation({
  args: {
    filePath: v.string(),
    content: v.string(),
    direction: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("fileSyncQueue", {
      filePath: args.filePath,
      content: args.content,
      direction: args.direction,
      status: args.status,
      timestamp: Date.now(),
    });
  },
});

export const getPendingInternal = internalQuery({
  args: { direction: v.string() },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("fileSyncQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return items.filter((item) => item.direction === args.direction);
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    id: v.id("fileSyncQueue"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});
