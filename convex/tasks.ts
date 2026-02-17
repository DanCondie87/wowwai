import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    assignee: v.union(v.literal("dan"), v.literal("dali")),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    tags: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(
        v.literal("backlog"),
        v.literal("todo"),
        v.literal("in-progress"),
        v.literal("review"),
        v.literal("done")
      )
    ),
    parentTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Count existing tasks in this project to generate cardId
    const existingTasks = await ctx.db
      .query("tasks")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    const nextNumber = existingTasks.length + 1;
    const cardId = `${project.slug.toUpperCase()}-${nextNumber}`;

    // Get max position in the target status column
    const status = args.status ?? "backlog";
    const tasksInColumn = existingTasks.filter((t) => t.status === status);
    const maxPosition =
      tasksInColumn.length > 0
        ? Math.max(...tasksInColumn.map((t) => t.position))
        : 0;

    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      projectId: args.projectId,
      parentTaskId: args.parentTaskId,
      cardId,
      title: args.title,
      description: args.description,
      status,
      assignee: args.assignee,
      priority: args.priority,
      tags: args.tags ?? [],
      blockedBy: [],
      position: maxPosition + 1,
      lastTouchedAt: now,
      createdAt: now,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      taskId,
      actor: "system",
      action: "created",
      after: JSON.stringify({ title: args.title, status, assignee: args.assignee }),
      timestamp: now,
    });

    return taskId;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    assignee: v.optional(v.union(v.literal("dan"), v.literal("dali"))),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      )
    ),
    tags: v.optional(v.array(v.string())),
    modelUsed: v.optional(v.string()),
    blockedBy: v.optional(v.array(v.id("tasks"))),
    definitionOfDone: v.optional(v.string()),
    testingCriteria: v.optional(v.string()),
    figmaLink: v.optional(v.string()),
    sessionSummary: v.optional(v.string()),
    workflowTemplateId: v.optional(v.id("workflowTemplates")),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    const now = Date.now();
    const changes: Record<string, unknown> = {};
    const auditEntries: Array<{ action: string; before?: string; after?: string }> = [];

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        const oldValue = (task as Record<string, unknown>)[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
          changes[key] = value;
          auditEntries.push({
            action: `updated ${key}`,
            before: JSON.stringify(oldValue),
            after: JSON.stringify(value),
          });
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      changes.lastTouchedAt = now;
      await ctx.db.patch(id, changes);

      for (const entry of auditEntries) {
        await ctx.db.insert("auditLogs", {
          taskId: id,
          actor: "dan",
          action: entry.action,
          before: entry.before,
          after: entry.after,
          timestamp: now,
        });
      }
    }
  },
});

export const moveToColumn = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in-progress"),
      v.literal("review"),
      v.literal("done")
    ),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    const now = Date.now();
    const oldStatus = task.status;

    const updates: Record<string, unknown> = {
      status: args.status,
      position: args.position,
      lastTouchedAt: now,
    };

    if (args.status === "done" && oldStatus !== "done") {
      updates.completedAt = now;
    }

    await ctx.db.patch(args.id, updates);

    await ctx.db.insert("auditLogs", {
      taskId: args.id,
      actor: "dan",
      action: "moved",
      before: oldStatus,
      after: args.status,
      timestamp: now,
    });
  },
});

export const reorder = mutation({
  args: {
    id: v.id("tasks"),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      position: args.position,
      lastTouchedAt: Date.now(),
    });
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    return tasks.sort((a, b) => a.position - b.position);
  },
});

export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    return tasks.sort((a, b) => {
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      return a.position - b.position;
    });
  },
});

export const getByStatus = query({
  args: {
    status: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in-progress"),
      v.literal("review"),
      v.literal("done")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const getByAssignee = query({
  args: {
    assignee: v.optional(v.union(v.literal("dan"), v.literal("dali"))),
  },
  handler: async (ctx, args) => {
    let tasks;
    if (args.assignee) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_assignee", (q) => q.eq("assignee", args.assignee!))
        .collect();
    } else {
      tasks = await ctx.db.query("tasks").collect();
    }
    // Filter out done tasks and subtasks
    return tasks.filter((t) => t.status !== "done" && !t.parentTaskId);
  },
});

export const getAllTags = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    const tagSet = new Set<string>();
    for (const task of tasks) {
      for (const tag of task.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  },
});

export const getById = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return null;

    // Fetch subtasks (child tasks)
    const subtasks = await ctx.db
      .query("tasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.id))
      .collect();

    return { ...task, subtasks };
  },
});
