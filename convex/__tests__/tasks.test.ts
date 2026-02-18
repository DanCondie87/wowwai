// @vitest-environment node
/**
 * Convex tasks function tests (Priority 3)
 *
 * Uses convex-test to run queries/mutations against an in-memory Convex backend.
 * Tests cardId generation logic (including the deletion-bug fix), status
 * transitions, and completedAt side-effects.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal, api } from "../_generated/api";

// convex-test needs a module map to load all Convex functions.
// The glob must include _generated/ so convex-test can find function references.
const modules = import.meta.glob("../**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a test project and return its id */
async function createTestProject(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("projects", {
      name: "Test Project",
      slug: "test",
      description: "A project for testing",
      status: "active",
      color: "#0ea5e9",
      createdAt: Date.now(),
    });
  });
}

// ---------------------------------------------------------------------------
// cardId generation
// ---------------------------------------------------------------------------

describe("cardId generation", () => {
  it("first task in a project gets cardId SLUG-1", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);

    await t.mutation(internal.tasks.create, {
      projectId,
      title: "First task",
      assignee: "dan",
      priority: "medium",
    });

    const tasks = await t.query(api.tasks.getByProject, { projectId });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].cardId).toBe("TEST-1");
  });

  it("second task gets cardId SLUG-2", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);

    await t.mutation(internal.tasks.create, {
      projectId,
      title: "Task 1",
      assignee: "dan",
      priority: "medium",
    });
    await t.mutation(internal.tasks.create, {
      projectId,
      title: "Task 2",
      assignee: "dan",
      priority: "medium",
    });

    const tasks = await t.query(api.tasks.getByProject, { projectId });
    const cardIds = tasks.map((t) => t.cardId).sort();
    expect(cardIds).toContain("TEST-1");
    expect(cardIds).toContain("TEST-2");
  });

  it("cardId does not collide after a task is deleted (bug fix verification)", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);

    // Create 3 tasks
    await t.mutation(internal.tasks.create, { projectId, title: "Task 1", assignee: "dan", priority: "medium" });
    await t.mutation(internal.tasks.create, { projectId, title: "Task 2", assignee: "dan", priority: "medium" });
    const task3Id = await t.mutation(internal.tasks.create, { projectId, title: "Task 3", assignee: "dan", priority: "medium" });

    // Delete task 2 (the middle one, so count-based logic would break here)
    const tasks = await t.query(api.tasks.getByProject, { projectId });
    const task2 = tasks.find((t) => t.cardId === "TEST-2");
    expect(task2).toBeDefined();
    await t.run(async (ctx) => {
      await ctx.db.delete(task2!._id);
    });

    // Create a 4th task — with the old (broken) count-based approach it would
    // get cardId TEST-2 again (collision!). With the fix it should be TEST-4.
    await t.mutation(internal.tasks.create, { projectId, title: "Task 4", assignee: "dan", priority: "medium" });

    const finalTasks = await t.query(api.tasks.getByProject, { projectId });
    const finalCardIds = finalTasks.map((t) => t.cardId).sort();

    // TEST-2 should not exist (we deleted it), TEST-4 should exist
    expect(finalCardIds).not.toContain("TEST-2");
    expect(finalCardIds).toContain("TEST-4");
    // All remaining cardIds must be unique
    const uniqueIds = new Set(finalCardIds);
    expect(uniqueIds.size).toBe(finalCardIds.length);
  });

  it("cardId prefix matches project slug (uppercased)", async () => {
    const t = convexTest(schema, modules);
    const projectId = await t.run(async (ctx) => {
      return await ctx.db.insert("projects", {
        name: "My Cool Project",
        slug: "mycoolproject",
        description: undefined,
        status: "active",
        color: "#ff6b6b",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.tasks.create, {
      projectId,
      title: "Task in cool project",
      assignee: "dali",
      priority: "high",
    });

    const tasks = await t.query(api.tasks.getByProject, { projectId });
    expect(tasks[0].cardId).toBe("MYCOOLPROJECT-1");
  });
});

// ---------------------------------------------------------------------------
// Status transitions & completedAt side-effect
// ---------------------------------------------------------------------------

describe("moveToColumn status transitions", () => {
  it("sets completedAt when moved to done", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);
    const taskId = await t.mutation(internal.tasks.create, {
      projectId,
      title: "A task",
      assignee: "dan",
      priority: "medium",
      status: "in-progress",
    });

    const before = await t.query(api.tasks.getById, { id: taskId });
    expect(before?.completedAt).toBeUndefined();

    const before_ts = Date.now();
    await t.mutation(internal.tasks.moveToColumn, {
      id: taskId,
      status: "done",
      position: 1,
    });
    const after_ts = Date.now();

    const after = await t.query(api.tasks.getById, { id: taskId });
    expect(after?.status).toBe("done");
    expect(after?.completedAt).toBeGreaterThanOrEqual(before_ts);
    expect(after?.completedAt).toBeLessThanOrEqual(after_ts);
  });

  it("does not overwrite completedAt when already done", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);
    const taskId = await t.mutation(internal.tasks.create, {
      projectId,
      title: "Done task",
      assignee: "dan",
      priority: "medium",
      status: "in-progress",
    });

    // Move to done first time
    await t.mutation(internal.tasks.moveToColumn, { id: taskId, status: "done", position: 1 });
    const firstDone = await t.query(api.tasks.getById, { id: taskId });
    const firstCompletedAt = firstDone?.completedAt;

    // Move to done again — completedAt should NOT change (no re-assignment when oldStatus is already done)
    await t.mutation(internal.tasks.moveToColumn, { id: taskId, status: "done", position: 2 });
    const secondDone = await t.query(api.tasks.getById, { id: taskId });
    expect(secondDone?.completedAt).toBe(firstCompletedAt);
  });

  it("can move from backlog to in-progress", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);
    const taskId = await t.mutation(internal.tasks.create, {
      projectId,
      title: "Backlog task",
      assignee: "dan",
      priority: "low",
    });

    await t.mutation(internal.tasks.moveToColumn, { id: taskId, status: "in-progress", position: 1 });

    const task = await t.query(api.tasks.getById, { id: taskId });
    expect(task?.status).toBe("in-progress");
    expect(task?.completedAt).toBeUndefined();
  });

  it("can move through all valid status transitions", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);
    const taskId = await t.mutation(internal.tasks.create, {
      projectId,
      title: "Flow task",
      assignee: "dali",
      priority: "high",
    });

    const statuses = ["todo", "in-progress", "review", "done"] as const;
    for (let i = 0; i < statuses.length; i++) {
      await t.mutation(internal.tasks.moveToColumn, { id: taskId, status: statuses[i], position: i + 1 });
      const task = await t.query(api.tasks.getById, { id: taskId });
      expect(task?.status).toBe(statuses[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// Task update
// ---------------------------------------------------------------------------

describe("task update", () => {
  it("updates the title", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);
    const taskId = await t.mutation(internal.tasks.create, {
      projectId,
      title: "Original title",
      assignee: "dan",
      priority: "medium",
    });

    await t.mutation(internal.tasks.update, { id: taskId, title: "Updated title" });

    const task = await t.query(api.tasks.getById, { id: taskId });
    expect(task?.title).toBe("Updated title");
  });

  it("updates tags", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);
    const taskId = await t.mutation(internal.tasks.create, {
      projectId,
      title: "Tagged task",
      assignee: "dan",
      priority: "medium",
      tags: ["alpha"],
    });

    await t.mutation(internal.tasks.update, { id: taskId, tags: ["alpha", "beta", "gamma"] });

    const task = await t.query(api.tasks.getById, { id: taskId });
    expect(task?.tags).toEqual(expect.arrayContaining(["alpha", "beta", "gamma"]));
    expect(task?.tags).toHaveLength(3);
  });

  it("updates lastTouchedAt when a change is made", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);
    const taskId = await t.mutation(internal.tasks.create, {
      projectId,
      title: "Touch me",
      assignee: "dan",
      priority: "medium",
    });

    const original = await t.query(api.tasks.getById, { id: taskId });
    const originalTouched = original?.lastTouchedAt;

    // Small sleep to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 5));

    await t.mutation(internal.tasks.update, { id: taskId, title: "Touched" });

    const updated = await t.query(api.tasks.getById, { id: taskId });
    expect(updated?.lastTouchedAt).toBeGreaterThan(originalTouched!);
  });
});

// ---------------------------------------------------------------------------
// Task queries
// ---------------------------------------------------------------------------

describe("task queries", () => {
  it("getByProject returns only tasks for the given project", async () => {
    const t = convexTest(schema, modules);
    const project1 = await createTestProject(t);
    const project2 = await t.run(async (ctx) => {
      return await ctx.db.insert("projects", {
        name: "Other Project",
        slug: "other",
        status: "active",
        color: "#aabbcc",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.tasks.create, { projectId: project1, title: "Task P1", assignee: "dan", priority: "medium" });
    await t.mutation(internal.tasks.create, { projectId: project2, title: "Task P2", assignee: "dan", priority: "medium" });

    const tasks1 = await t.query(api.tasks.getByProject, { projectId: project1 });
    const tasks2 = await t.query(api.tasks.getByProject, { projectId: project2 });

    expect(tasks1).toHaveLength(1);
    expect(tasks1[0].title).toBe("Task P1");
    expect(tasks2).toHaveLength(1);
    expect(tasks2[0].title).toBe("Task P2");
  });

  it("getAllTags returns a deduplicated sorted list of tags", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);

    await t.mutation(internal.tasks.create, { projectId, title: "T1", assignee: "dan", priority: "medium", tags: ["alpha", "beta"] });
    await t.mutation(internal.tasks.create, { projectId, title: "T2", assignee: "dan", priority: "medium", tags: ["beta", "gamma"] });

    const tags = await t.query(api.tasks.getAllTags);
    expect(tags).toEqual(["alpha", "beta", "gamma"]); // sorted, deduplicated
  });

  it("getById returns task with embedded subtasks array", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);
    const parentId = await t.mutation(internal.tasks.create, {
      projectId,
      title: "Parent task",
      assignee: "dan",
      priority: "medium",
    });

    await t.mutation(internal.tasks.create, {
      projectId,
      parentTaskId: parentId,
      title: "Subtask 1",
      assignee: "dan",
      priority: "low",
    });
    await t.mutation(internal.tasks.create, {
      projectId,
      parentTaskId: parentId,
      title: "Subtask 2",
      assignee: "dali",
      priority: "low",
    });

    const task = await t.query(api.tasks.getById, { id: parentId });
    expect(task).not.toBeNull();
    expect(task?.subtasks).toHaveLength(2);
    const subtaskTitles = task?.subtasks.map((s: { title: string }) => s.title).sort();
    expect(subtaskTitles).toEqual(["Subtask 1", "Subtask 2"]);
  });
});

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------

describe("reorder", () => {
  it("updates position", async () => {
    const t = convexTest(schema, modules);
    const projectId = await createTestProject(t);
    const taskId = await t.mutation(internal.tasks.create, {
      projectId,
      title: "Reorder me",
      assignee: "dan",
      priority: "medium",
    });

    await t.mutation(internal.tasks.reorder, { id: taskId, position: 42 });

    const task = await t.query(api.tasks.getById, { id: taskId });
    expect(task?.position).toBe(42);
  });
});
