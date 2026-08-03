import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { Workpool, type WorkId } from "@convex-dev/workpool";
import { v } from "convex/values";

import { requireProfile } from "./lib/profileAuth";
import {
  buildSearchText,
  definitionValidator,
  normalizeSearchQuery,
  normalizeWord,
  wordStatusValidator,
} from "./lib/wordTypes";

const wordPool = new Workpool(components.wordProcessing, {
  maxParallelism: 2,
  retryActionsByDefault: false,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 1_000,
    base: 2,
  },
});

const wordViewValidator = v.object({
  wordId: v.id("words"),
  word: v.string(),
  status: wordStatusValidator,
  definitions: v.array(definitionValidator),
  grammaticalCategory: v.string(),
  failureMessage: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
  startedAt: v.union(v.number(), v.null()),
  completedAt: v.union(v.number(), v.null()),
});

const pageValidator = v.object({
  page: v.array(wordViewValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

const createWordResultValidator = v.object({
  wordId: v.id("words"),
  status: wordStatusValidator,
  created: v.boolean(),
  wordView: v.union(wordViewValidator, v.null()),
});

const retryWordResultValidator = v.object({
  wordId: v.id("words"),
  status: wordStatusValidator,
  queued: v.boolean(),
});

async function enqueueWord(
  ctx: MutationCtx,
  wordId: Id<"words">,
  jobVersion: number,
): Promise<WorkId> {
  return await wordPool.enqueueAction(
    ctx,
    internal.wordProcessing.processWord,
    { wordId, jobVersion },
    {
      retry: {
        maxAttempts: 3,
        initialBackoffMs: 1_000,
        base: 2,
      },
      onComplete: internal.wordProcessingCallbacks.onComplete,
      context: { wordId, jobVersion },
    },
  );
}

function toWordView(word: Doc<"words">) {
  return {
    wordId: word._id,
    word: word.word,
    status: word.status,
    definitions: word.definitions,
    grammaticalCategory: word.grammaticalCategory,
    failureMessage: word.failureMessage,
    createdAt: word.createdAt,
    updatedAt: word.updatedAt,
    startedAt: word.startedAt,
    completedAt: word.completedAt,
  };
}

export const createWord = mutation({
  args: {
    handle: v.string(),
    accessKey: v.string(),
    word: v.string(),
  },
  returns: createWordResultValidator,
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args);
    const normalized = normalizeWord(args.word);
    const existing = await ctx.db
      .query("words")
      .withIndex("by_profile_wordKey", (q) =>
        q.eq("profileId", profile._id).eq("wordKey", normalized.wordKey),
      )
      .unique();

    if (
      existing &&
      existing.status !== "failed" &&
      existing.status !== "not_found"
    ) {
      return {
        wordId: existing._id,
        status: existing.status,
        created: false,
        wordView: toWordView(existing),
      };
    }

    const now = Date.now();
    const jobVersion = existing ? existing.jobVersion + 1 : 1;
    const wordId = existing
      ? existing._id
      : await ctx.db.insert("words", {
          profileId: profile._id,
          word: normalized.word,
          wordKey: normalized.wordKey,
          status: "pending",
          definitions: [],
          grammaticalCategory: "",
          searchText: buildSearchText(normalized.word, "", []),
          jobVersion,
          workId: null,
          failureMessage: null,
          createdAt: now,
          updatedAt: now,
          startedAt: null,
          completedAt: null,
        });

    if (existing) {
      await ctx.db.patch(existing._id, {
        word: normalized.word,
        wordKey: normalized.wordKey,
        status: "pending",
        definitions: [],
        grammaticalCategory: "",
        searchText: buildSearchText(normalized.word, "", []),
        jobVersion,
        workId: null,
        failureMessage: null,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
      });
    }

    const workId = await enqueueWord(ctx, wordId, jobVersion);
    await ctx.db.patch(wordId, { workId });

    const updated = await ctx.db.get(wordId);
    if (!updated) throw new Error("WORD_NOT_FOUND");

    return {
      wordId,
      status: "pending" as const,
      created: !existing,
      wordView: toWordView(updated),
    };
  },
});

export const listWords = query({
  args: {
    handle: v.string(),
    accessKey: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: pageValidator,
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args);
    const page = await ctx.db
      .query("words")
      .withIndex("by_profile_createdAt", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      page: page.page.map(toWordView),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const searchWords = query({
  args: {
    handle: v.string(),
    accessKey: v.string(),
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: pageValidator,
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args);
    const searchQuery = normalizeSearchQuery(args.query);
    const page = await ctx.db
      .query("words")
      .withSearchIndex("search_words", (q) =>
        q.search("searchText", searchQuery).eq("profileId", profile._id),
      )
      .paginate(args.paginationOpts);

    return {
      page: page.page.map(toWordView),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const retryWord = mutation({
  args: {
    handle: v.string(),
    accessKey: v.string(),
    wordId: v.id("words"),
  },
  returns: retryWordResultValidator,
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args);
    const word = await ctx.db.get(args.wordId);

    if (!word || word.profileId !== profile._id) {
      throw new Error("WORD_NOT_FOUND");
    }

    if (word.status === "pending" || word.status === "processing") {
      return { wordId: word._id, status: word.status, queued: false };
    }

    if (word.status === "ready") {
      throw new Error("WORD_ALREADY_READY");
    }

    const now = Date.now();
    const jobVersion = word.jobVersion + 1;
    await ctx.db.patch(word._id, {
      status: "pending",
      definitions: [],
      grammaticalCategory: "",
      searchText: buildSearchText(word.word, "", []),
      jobVersion,
      workId: null,
      failureMessage: null,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    });

    const workId = await enqueueWord(ctx, word._id, jobVersion);
    await ctx.db.patch(word._id, { workId });

    return { wordId: word._id, status: "pending" as const, queued: true };
  },
});

export const deleteWord = mutation({
  args: {
    handle: v.string(),
    accessKey: v.string(),
    wordId: v.id("words"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args);
    const word = await ctx.db.get(args.wordId);

    if (!word || word.profileId !== profile._id) {
      throw new Error("WORD_NOT_FOUND");
    }

    if (
      word.workId !== null &&
      (word.status === "pending" || word.status === "processing")
    ) {
      await wordPool.cancel(ctx, word.workId as WorkId);
    }

    await ctx.db.delete(word._id);
    return null;
  },
});
