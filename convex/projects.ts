import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// ─── Internal write mutations (SEC-003 extension) ─────────────────────────────
//
// All write mutations are now internalMutation. External callers (browser) must
// go through the authenticated Next.js API route /api/mutations.

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const create = internalMutation({
  args: {
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.name);
    return await ctx.db.insert("projects", {
      name: args.name,
      slug,
      color: args.color,
      description: args.description,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const update = internalMutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, string> = {};
    if (fields.name !== undefined) {
      updates.name = fields.name;
      if (fields.slug === undefined) {
        updates.slug = slugify(fields.name);
      }
    }
    if (fields.slug !== undefined) updates.slug = fields.slug;
    if (fields.color !== undefined) updates.color = fields.color;
    if (fields.description !== undefined) updates.description = fields.description;
    await ctx.db.patch(id, updates);
  },
});

export const archive = internalMutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "archived" as const });
  },
});

// ─── Public queries ────────────────────────────────────────────────────────────

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
