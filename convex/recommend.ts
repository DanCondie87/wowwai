import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * US-046: "What Should I Work On?" — AI-powered task recommendations
 *
 * Analyzes current task state and returns prioritized recommendations.
 * Uses heuristic scoring (no external AI call needed — keeps it fast and free).
 */

interface TaskForScoring {
  _id: string;
  projectId: string;
  cardId: string;
  title: string;
  status: string;
  assignee: string;
  priority: string;
  blockedBy: string[];
  lastTouchedAt: number;
  createdAt: number;
}

interface Recommendation {
  cardId: string;
  title: string;
  reason: string;
  score: number;
  projectName: string;
}

function scoreTask(task: TaskForScoring, allTasks: TaskForScoring[]): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Priority scoring
  const priorityScores: Record<string, number> = {
    urgent: 40,
    high: 30,
    medium: 15,
    low: 5,
  };
  score += priorityScores[task.priority] ?? 0;

  // Staleness scoring (stale tasks need attention)
  const hoursStale = (Date.now() - task.lastTouchedAt) / (1000 * 60 * 60);
  if (hoursStale > 168) {
    score += 25;
    reasons.push("untouched for over a week");
  } else if (hoursStale > 72) {
    score += 15;
    reasons.push(`stale for ${Math.round(hoursStale / 24)} days`);
  }

  // Tasks that are blocking others should be prioritized
  const blocksCount = allTasks.filter(
    (t) => t.blockedBy.includes(task._id) && t.status !== "done"
  ).length;
  if (blocksCount > 0) {
    score += blocksCount * 20;
    reasons.push(`blocking ${blocksCount} other task${blocksCount > 1 ? "s" : ""}`);
  }

  // In-progress tasks should be finished before starting new ones
  if (task.status === "in-progress") {
    score += 10;
    reasons.push("already in progress");
  }

  // Review tasks need quick turnaround
  if (task.status === "review") {
    score += 15;
    reasons.push("waiting for review");
  }

  const reason = reasons.length > 0
    ? reasons.join(", ")
    : `${task.priority} priority task`;

  return { score, reason };
}

export const getRecommendations = action({
  args: {
    assignee: v.optional(v.union(v.literal("dan"), v.literal("dali"))),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.runQuery(api.tasks.getAll);
    const projects = await ctx.runQuery(api.projects.getAll);
    const projectMap = new Map(projects.map((p: { _id: string; name: string }) => [p._id, p.name]));

    // Filter to actionable tasks (not done, not blocked, top-level only)
    const actionableTasks = tasks.filter(
      (t: TaskForScoring) =>
        t.status !== "done" &&
        t.blockedBy.length === 0 &&
        (!args.assignee || t.assignee === args.assignee)
    );

    const scored: Recommendation[] = actionableTasks.map((task: TaskForScoring) => {
      const { score, reason } = scoreTask(task, tasks);
      return {
        cardId: task.cardId,
        title: task.title,
        reason,
        score,
        projectName: projectMap.get(task.projectId as string) ?? "Unknown",
      };
    });

    // Sort by score descending and take top 3
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3);
  },
});
