import { internalQuery } from "./_generated/server";

// SEC-003: getFullExport converted from public query to internalQuery.
// It was previously callable by anyone with the Convex URL, exposing all
// projects, tasks, ideas, and audit logs without authentication.
//
// The settings page now fetches export data via the authenticated Next.js
// API route /api/export, which verifies the session cookie before proxying
// to the /agent/backup Convex HTTP endpoint (AGENT_SECRET protected).

export const getFullExport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    const tasks = await ctx.db.query("tasks").collect();
    const ideas = await ctx.db.query("ideas").collect();
    const auditLogs = await ctx.db.query("auditLogs").collect();
    return { projects, tasks, ideas, auditLogs };
  },
});

export const getFullBackup = internalQuery({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    const tasks = await ctx.db.query("tasks").collect();
    const ideas = await ctx.db.query("ideas").collect();
    const auditLogs = await ctx.db.query("auditLogs").collect();
    const workflowTemplates = await ctx.db.query("workflowTemplates").collect();
    const workflowSteps = await ctx.db.query("workflowSteps").collect();
    return { projects, tasks, ideas, auditLogs, workflowTemplates, workflowSteps };
  },
});
