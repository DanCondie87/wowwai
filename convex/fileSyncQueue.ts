import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const enqueue = mutation({
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

export const getPending = query({
  args: { direction: v.string() },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("fileSyncQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return items.filter((item) => item.direction === args.direction);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("fileSyncQueue"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});
