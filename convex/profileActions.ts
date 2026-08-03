/// <reference types="node" />

"use node";

import { createHash, randomBytes } from "node:crypto";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { v } from "convex/values";

import {
  assertAccessKey,
  normalizeHandle,
  normalizeRecoveryCode,
} from "./lib/profileValidation";

const credentialsValidator = v.object({
  handle: v.string(),
  accessKey: v.string(),
  recoveryCode: v.string(),
});

const DEFAULT_PROFILE_HANDLE = "@jotai";

function generateAccessKey(): string {
  return randomBytes(32).toString("base64url");
}

function generateRecoveryCode(): string {
  return randomBytes(12).toString("hex").toUpperCase();
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const bootstrapProfile = action({
  args: {},
  returns: credentialsValidator,
  handler: async (ctx) => {
    const accessKey = assertAccessKey(generateAccessKey());
    const recoveryCode = generateRecoveryCode();

    await ctx.runMutation(internal.profiles.bootstrap, {
      handle: DEFAULT_PROFILE_HANDLE,
      accessKeyHash: hashSecret(accessKey),
      recoveryCodeHash: hashSecret(recoveryCode),
    });

    return {
      handle: DEFAULT_PROFILE_HANDLE,
      accessKey,
      recoveryCode,
    };
  },
});

export const claimProfile = action({
  args: {
    handle: v.string(),
    accessKey: v.optional(v.string()),
  },
  returns: credentialsValidator,
  handler: async (ctx, args) => {
    const handle = normalizeHandle(args.handle);
    const accessKey = assertAccessKey(args.accessKey ?? generateAccessKey());
    const recoveryCode = generateRecoveryCode();

    await ctx.runMutation(internal.profiles.claim, {
      handle,
      accessKeyHash: hashSecret(accessKey),
      recoveryCodeHash: hashSecret(recoveryCode),
    });

    return { handle, accessKey, recoveryCode };
  },
});

export const recoverProfile = action({
  args: {
    handle: v.string(),
    recoveryCode: v.string(),
  },
  returns: credentialsValidator,
  handler: async (ctx, args) => {
    const handle = normalizeHandle(args.handle);
    const recoveryCode = normalizeRecoveryCode(args.recoveryCode);
    const accessKey = assertAccessKey(generateAccessKey());
    const newRecoveryCode = generateRecoveryCode();

    await ctx.runMutation(internal.profiles.recover, {
      handle,
      recoveryCodeHash: hashSecret(recoveryCode),
      accessKeyHash: hashSecret(accessKey),
      newRecoveryCodeHash: hashSecret(newRecoveryCode),
    });

    return { handle, accessKey, recoveryCode: newRecoveryCode };
  },
});
