import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * US-043: Blocker Notification Trigger
 *
 * Scheduled function that checks for newly blocked tasks and triggers notifications.
 * Respects quiet hours (23:00-08:00 AEST).
 */

// AEST is UTC+10
const AEST_OFFSET_HOURS = 10;

function isQuietHours(): boolean {
  const now = new Date();
  const aestHour = (now.getUTCHours() + AEST_OFFSET_HOURS) % 24;
  // Quiet hours: 23:00-08:00 AEST
  return aestHour >= 23 || aestHour < 8;
}

export const checkBlockedTasks = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();

    // Find tasks that are:
    // 1. Assigned to "dali"
    // 2. Have non-empty blockedBy array
    // 3. Not already done
    const blockedTasks = tasks.filter(
      (t) =>
        t.assignee === "dali" &&
        t.blockedBy.length > 0 &&
        t.status !== "done"
    );

    return blockedTasks.map((t) => ({
      cardId: t.cardId,
      title: t.title,
      blockerCount: t.blockedBy.length,
    }));
  },
});

export const logBlockerNotification = internalMutation({
  args: {
    taskId: v.id("tasks"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      taskId: args.taskId,
      actor: "system",
      action: "blocker_notification",
      comment: args.message,
      timestamp: Date.now(),
    });
  },
});

export const processBlockerNotifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (isQuietHours()) {
      return { sent: 0, reason: "quiet_hours" };
    }

    const tasks = await ctx.db.query("tasks").collect();

    const blockedTasks = tasks.filter(
      (t) =>
        t.assignee === "dali" &&
        t.blockedBy.length > 0 &&
        t.status !== "done"
    );

    let notificationCount = 0;

    for (const task of blockedTasks) {
      // Check if we already sent a notification in the last 4 hours
      const recentLogs = await ctx.db
        .query("auditLogs")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();

      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
      const recentNotification = recentLogs.find(
        (log) =>
          log.action === "blocker_notification" &&
          log.timestamp > fourHoursAgo
      );

      if (!recentNotification) {
        const message = `WOWWAI: ${task.cardId} is blocked — needs your input`;
        await ctx.db.insert("auditLogs", {
          taskId: task._id,
          actor: "system",
          action: "blocker_notification",
          comment: message,
          timestamp: Date.now(),
        });
        notificationCount++;
      }
    }

    return { sent: notificationCount, total: blockedTasks.length };
  },
});
