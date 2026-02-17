import { query } from "./_generated/server";

/**
 * US-044: Basic Analytics Queries
 */

export const getCycleTime = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const result: Array<{
      projectId: string;
      projectName: string;
      avgCycleTimeDays: number;
      completedCount: number;
    }> = [];

    for (const project of projects) {
      const projectTasks = tasks.filter(
        (t) =>
          t.projectId === project._id &&
          t.status === "done" &&
          t.completedAt != null
      );

      if (projectTasks.length === 0) {
        result.push({
          projectId: project._id,
          projectName: project.name,
          avgCycleTimeDays: 0,
          completedCount: 0,
        });
        continue;
      }

      const totalMs = projectTasks.reduce((sum, t) => {
        const cycleMs = (t.completedAt ?? t.createdAt) - t.createdAt;
        return sum + cycleMs;
      }, 0);

      const avgMs = totalMs / projectTasks.length;
      const avgDays = Math.round((avgMs / (1000 * 60 * 60 * 24)) * 10) / 10;

      result.push({
        projectId: project._id,
        projectName: project.name,
        avgCycleTimeDays: avgDays,
        completedCount: projectTasks.length,
      });
    }

    return result;
  },
});

export const getThroughput = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    const now = Date.now();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;

    const weeks: Array<{
      weekStart: string;
      count: number;
    }> = [];

    for (let i = 7; i >= 0; i--) {
      const weekEnd = now - i * msPerWeek;
      const weekStart = weekEnd - msPerWeek;

      const count = tasks.filter(
        (t) =>
          t.completedAt != null &&
          t.completedAt >= weekStart &&
          t.completedAt < weekEnd
      ).length;

      const startDate = new Date(weekStart);
      const label = `${startDate.getMonth() + 1}/${startDate.getDate()}`;

      weeks.push({ weekStart: label, count });
    }

    return weeks;
  },
});

export const getBlockerStats = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const projectMap = new Map(projects.map((p) => [p._id, p.name]));

    const blockedTasks = tasks.filter(
      (t) => t.blockedBy.length > 0 && t.status !== "done"
    );

    const byProject: Record<string, { projectName: string; count: number; tasks: Array<{ cardId: string; title: string }> }> = {};

    for (const task of blockedTasks) {
      const projectName = projectMap.get(task.projectId) ?? "Unknown";
      const key = task.projectId;
      if (!byProject[key]) {
        byProject[key] = { projectName, count: 0, tasks: [] };
      }
      byProject[key].count++;
      byProject[key].tasks.push({ cardId: task.cardId, title: task.title });
    }

    return {
      totalBlocked: blockedTasks.length,
      byProject: Object.values(byProject),
    };
  },
});

export const getModelUsage = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();

    const usage: Record<string, number> = {};

    for (const task of tasks) {
      if (task.modelUsed && task.status === "done") {
        usage[task.modelUsed] = (usage[task.modelUsed] ?? 0) + 1;
      }
    }

    return Object.entries(usage)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count);
  },
});
