import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

import {
  buildSearchText,
  processingResultValidator,
} from "./lib/wordTypes";

const jobArgsValidator = v.object({
  wordId: v.id("words"),
  jobVersion: v.number(),
});

export const claimForProcessing = internalMutation({
  args: jobArgsValidator,
  returns: v.union(
    v.null(),
    v.object({
      word: v.string(),
      jobVersion: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const word = await ctx.db.get(args.wordId);

    if (
      !word ||
      word.jobVersion !== args.jobVersion ||
      (word.status !== "pending" && word.status !== "processing")
    ) {
      return null;
    }

    if (word.status === "pending") {
      await ctx.db.patch(word._id, {
        status: "processing",
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { word: word.word, jobVersion: word.jobVersion };
  },
});

export const completeWord = internalMutation({
  args: {
    wordId: v.id("words"),
    jobVersion: v.number(),
    result: processingResultValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (args.result.definitions.length > 3) {
      throw new Error("TOO_MANY_DEFINITIONS");
    }

    const word = await ctx.db.get(args.wordId);
    if (
      !word ||
      word.jobVersion !== args.jobVersion ||
      word.status !== "processing"
    ) {
      return false;
    }

    const now = Date.now();
    await ctx.db.patch(word._id, {
      status: args.result.status,
      definitions: args.result.definitions,
      grammaticalCategory: args.result.grammaticalCategory,
      searchText: buildSearchText(
        word.word,
        args.result.grammaticalCategory,
        args.result.definitions,
      ),
      failureMessage: null,
      updatedAt: now,
      completedAt: now,
    });

    return true;
  },
});
