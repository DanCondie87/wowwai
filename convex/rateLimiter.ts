import { defineRateLimits } from "convex-helpers/server/rateLimit";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const RATE_LIMITS = defineRateLimits({
  agentApi: {
    kind: "token bucket",
    rate: 10,
    period: 60_000, // 10 per minute
    capacity: 20,   // burst to 20
  },
});

export const checkAgentRateLimit = internalMutation({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const result = await RATE_LIMITS.rateLimit(ctx, {
      name: "agentApi",
      key: args.key ?? "global",
    });
    return result;
  },
});
