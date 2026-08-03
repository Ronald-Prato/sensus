import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { vOnCompleteArgs } from "@convex-dev/workpool";

const completionContextValidator = v.object({
  wordId: v.id("words"),
  jobVersion: v.number(),
});

export const onComplete = internalMutation({
  args: vOnCompleteArgs(completionContextValidator),
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind === "success") {
      return null;
    }

    const word = await ctx.db.get(args.context.wordId);
    if (
      !word ||
      word.jobVersion !== args.context.jobVersion ||
      (word.status !== "pending" && word.status !== "processing")
    ) {
      return null;
    }

    await ctx.db.patch(word._id, {
      status: "failed",
      failureMessage:
        args.result.kind === "canceled"
          ? "Procesamiento cancelado."
          : "No se pudo procesar la palabra.",
      updatedAt: Date.now(),
      completedAt: Date.now(),
    });

    return null;
  },
});
