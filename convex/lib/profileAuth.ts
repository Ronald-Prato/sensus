import type { MutationCtx, QueryCtx } from "../_generated/server";

import {
  assertAccessKey,
  normalizeHandle,
} from "./profileValidation";

type AuthCtx = QueryCtx | MutationCtx;

export async function hashSecret(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function requireProfile(
  ctx: AuthCtx,
  args: { handle: string; accessKey: string },
) {
  const handle = normalizeHandle(args.handle);
  const accessKey = assertAccessKey(args.accessKey);
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique();

  if (!profile || profile.accessKeyHash !== (await hashSecret(accessKey))) {
    throw new Error("INVALID_PROFILE_CREDENTIALS");
  }

  return profile;
}
