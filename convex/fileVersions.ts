import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByFilePath = query({
  args: { filePath: v.string() },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("fileVersions")
      .withIndex("by_filePath", (q) => q.eq("filePath", args.filePath))
      .collect();
    return versions.sort((a, b) => b.timestamp - a.timestamp);
  },
});

export const getLatestByFilePath = query({
  args: { filePath: v.string() },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("fileVersions")
      .withIndex("by_filePath", (q) => q.eq("filePath", args.filePath))
      .collect();
    if (versions.length === 0) return null;
    return versions.sort((a, b) => b.timestamp - a.timestamp)[0];
  },
});

export const createVersion = mutation({
  args: {
    filePath: v.string(),
    content: v.string(),
    editedBy: v.string(),
    editedVia: v.string(),
    snapshotName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("fileVersions", {
      filePath: args.filePath,
      content: args.content,
      editedBy: args.editedBy,
      editedVia: args.editedVia,
      snapshotName: args.snapshotName,
      timestamp: Date.now(),
    });
  },
});

export const getVersionCount = query({
  args: { filePath: v.string() },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("fileVersions")
      .withIndex("by_filePath", (q) => q.eq("filePath", args.filePath))
      .collect();
    return versions.length;
  },
});
