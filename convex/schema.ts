import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // US-004: Projects & Ideas
  projects: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("archived")),
    color: v.string(),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  ideas: defineTable({
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    status: v.union(
      v.literal("captured"),
      v.literal("exploring"),
      v.literal("ready"),
      v.literal("parked")
    ),
    source: v.union(v.literal("dan"), v.literal("dali")),
    createdAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_status", ["status"]),

  // US-005: Tasks & Audit Logs
  tasks: defineTable({
    projectId: v.id("projects"),
    parentTaskId: v.optional(v.id("tasks")),
    cardId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in-progress"),
      v.literal("review"),
      v.literal("done")
    ),
    assignee: v.union(v.literal("dan"), v.literal("dali")),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    tags: v.array(v.string()),
    workflowTemplateId: v.optional(v.id("workflowTemplates")),
    modelUsed: v.optional(v.string()),
    blockedBy: v.array(v.id("tasks")),
    definitionOfDone: v.optional(v.string()),
    testingCriteria: v.optional(v.string()),
    figmaLink: v.optional(v.string()),
    position: v.number(),
    sessionSummary: v.optional(v.string()),
    lastTouchedAt: v.number(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_projectId", ["projectId"])
    .index("by_status", ["status"])
    .index("by_assignee", ["assignee"])
    .index("by_parentTaskId", ["parentTaskId"]),

  auditLogs: defineTable({
    taskId: v.id("tasks"),
    actor: v.union(
      v.literal("dan"),
      v.literal("dali"),
      v.literal("system")
    ),
    action: v.string(),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    comment: v.optional(v.string()),
    modelUsed: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_taskId", ["taskId"]),

  // US-006: Workflows, File Sync, Agent Activity
  workflowTemplates: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    sourceFile: v.optional(v.string()),
    createdAt: v.number(),
  }),

  workflowSteps: defineTable({
    templateId: v.id("workflowTemplates"),
    name: v.string(),
    description: v.string(),
    order: v.number(),
    loopGroupId: v.optional(v.string()),
    loopMaxIterations: v.optional(v.number()),
    loopExitCriteria: v.optional(v.string()),
    references: v.array(
      v.object({
        type: v.string(),
        label: v.string(),
        filePath: v.string(),
        section: v.optional(v.string()),
        content: v.optional(v.string()),
      })
    ),
    modelRecommendation: v.optional(v.string()),
    agentType: v.optional(v.string()),
  }).index("by_templateId", ["templateId"]),

  fileVersions: defineTable({
    filePath: v.string(),
    content: v.string(),
    editedBy: v.string(),
    editedVia: v.string(),
    snapshotName: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_filePath", ["filePath"]),

  fileSyncQueue: defineTable({
    filePath: v.string(),
    content: v.string(),
    direction: v.string(),
    status: v.string(),
    timestamp: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_filePath", ["filePath"]),

  agentActivity: defineTable({
    taskId: v.optional(v.id("tasks")),
    sessionKey: v.string(),
    model: v.string(),
    status: v.string(),
    currentAction: v.optional(v.string()),
    startedAt: v.number(),
    lastHeartbeat: v.number(),
  })
    .index("by_taskId", ["taskId"])
    .index("by_sessionKey", ["sessionKey"])
    .index("by_status", ["status"]),
});
