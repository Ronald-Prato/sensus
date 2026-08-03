import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { definitionValidator, wordStatusValidator } from "./lib/wordTypes";

export default defineSchema({
  profiles: defineTable({
    handle: v.string(),
    accessKeyHash: v.string(),
    recoveryCodeHash: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_handle", ["handle"]),

  words: defineTable({
    profileId: v.id("profiles"),
    word: v.string(),
    wordKey: v.string(),
    status: wordStatusValidator,
    definitions: v.array(definitionValidator),
    grammaticalCategory: v.string(),
    searchText: v.string(),
    jobVersion: v.number(),
    workId: v.union(v.string(), v.null()),
    failureMessage: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.union(v.number(), v.null()),
    completedAt: v.union(v.number(), v.null()),
  })
    .index("by_profile_createdAt", ["profileId", "createdAt"])
    .index("by_profile_wordKey", ["profileId", "wordKey"])
    .searchIndex("search_words", {
      searchField: "searchText",
      filterFields: ["profileId"],
    }),
});
