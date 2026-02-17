import { v } from "convex/values";
import { query } from "./_generated/server";

export const searchTasks = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const searchQuery = args.query.trim();
    if (!searchQuery) return [];

    // Search by title
    const titleResults = await ctx.db
      .query("tasks")
      .withSearchIndex("search_title", (q) => q.search("title", searchQuery))
      .take(20);

    // Search by cardId
    const cardIdResults = await ctx.db
      .query("tasks")
      .withSearchIndex("search_cardId", (q) =>
        q.search("cardId", searchQuery)
      )
      .take(10);

    // Merge and deduplicate
    const seen = new Set<string>();
    const merged = [];
    for (const task of [...titleResults, ...cardIdResults]) {
      if (!seen.has(task._id)) {
        seen.add(task._id);
        merged.push(task);
      }
    }

    // Enrich with project info
    const results = await Promise.all(
      merged.slice(0, 20).map(async (task) => {
        const project = await ctx.db.get(task.projectId);
        return {
          ...task,
          projectName: project?.name ?? "Unknown",
          projectColor: project?.color ?? "#888",
        };
      })
    );

    return results;
  },
});
