import { query, internalQuery } from "./_generated/server";

export const getFullExport = query({
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
