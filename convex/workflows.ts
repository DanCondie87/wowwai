import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAllTemplates = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query("workflowTemplates").collect();
    // Enrich with step count
    const enriched = await Promise.all(
      templates.map(async (t) => {
        const steps = await ctx.db
          .query("workflowSteps")
          .withIndex("by_templateId", (q) => q.eq("templateId", t._id))
          .collect();
        return { ...t, stepCount: steps.length };
      })
    );
    return enriched;
  },
});

export const getTemplateWithSteps = query({
  args: { templateId: v.id("workflowTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;

    const steps = await ctx.db
      .query("workflowSteps")
      .withIndex("by_templateId", (q) => q.eq("templateId", args.templateId))
      .collect();

    const sortedSteps = steps.sort((a, b) => a.order - b.order);
    return { ...template, steps: sortedSteps };
  },
});

export const createTemplate = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sourceFile: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workflowTemplates", {
      name: args.name,
      description: args.description,
      sourceFile: args.sourceFile,
      createdAt: Date.now(),
    });
  },
});

export const createStep = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workflowSteps", {
      templateId: args.templateId,
      name: args.name,
      description: args.description,
      order: args.order,
      loopGroupId: args.loopGroupId,
      loopMaxIterations: args.loopMaxIterations,
      loopExitCriteria: args.loopExitCriteria,
      references: args.references,
      modelRecommendation: args.modelRecommendation,
      agentType: args.agentType,
    });
  },
});
