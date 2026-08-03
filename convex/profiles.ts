import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const claim = internalMutation({
  args: {
    handle: v.string(),
    accessKeyHash: v.string(),
    recoveryCodeHash: v.string(),
  },
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .unique();

    if (existing) {
      throw new Error("HANDLE_ALREADY_CLAIMED");
    }

    const now = Date.now();
    return await ctx.db.insert("profiles", {
      handle: args.handle,
      accessKeyHash: args.accessKeyHash,
      recoveryCodeHash: args.recoveryCodeHash,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const bootstrap = internalMutation({
  args: {
    handle: v.string(),
    accessKeyHash: v.string(),
    recoveryCodeHash: v.string(),
  },
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessKeyHash: args.accessKeyHash,
        recoveryCodeHash: args.recoveryCodeHash,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      handle: args.handle,
      accessKeyHash: args.accessKeyHash,
      recoveryCodeHash: args.recoveryCodeHash,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const recover = internalMutation({
  args: {
    handle: v.string(),
    recoveryCodeHash: v.string(),
    accessKeyHash: v.string(),
    newRecoveryCodeHash: v.string(),
  },
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .unique();

    if (!profile || profile.recoveryCodeHash !== args.recoveryCodeHash) {
      throw new Error("INVALID_RECOVERY_CODE");
    }

    await ctx.db.patch(profile._id, {
      accessKeyHash: args.accessKeyHash,
      recoveryCodeHash: args.newRecoveryCodeHash,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});
