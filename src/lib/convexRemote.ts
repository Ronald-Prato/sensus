import type { ConvexReactClient } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  ACCESS_KEY_KEY,
  DEFAULT_NICKNAME,
  RECOVERY_CODE_PENDING_KEY,
  mergeLibraryEntries,
  normalizeTermKey,
  RECOVERY_CODE_KEY,
  type CredentialStore,
  type LibraryEntry,
  type RegisterProfileResult,
  type RecoverProfileResult,
  type SensusRemote,
  type SubmitWordInput,
  type SubmitWordResult,
  type WordDetails,
} from "./sensus";
import { normalizeTerm } from "./validation";

type ClaimResponse = FunctionReturnType<typeof api.profileActions.claimProfile>;
type WordPage = FunctionReturnType<typeof api.words.listWords>;
type WordView = WordPage["page"][number];

const PAGE_SIZE = 50;

function toHandle(nickname: string): string {
  const withoutAt = nickname.trim().replace(/^@/u, "");
  return `@${withoutAt}`;
}

function nicknameFromHandle(handle: string): string {
  return handle.replace(/^@/u, "");
}

function profileFromHandle(handle: string) {
  return {
    nickname: nicknameFromHandle(handle),
    createdAt: Date.now(),
  };
}

function statusFromServer(status: WordView["status"]): SubmitWordResult["status"] {
  switch (status) {
    case "pending":
    case "processing":
      return "processing";
    case "ready":
      return "ready";
    case "not_found":
      return "not-found";
    case "failed":
      return "failed";
  }
}

function toDetails(word: WordView): WordDetails {
  const details: WordDetails = { definitions: word.definitions };
  if (word.grammaticalCategory) details.grammaticalCategory = word.grammaticalCategory;
  return details;
}

function toLocalEntry(word: WordView, existingId = `remote-${String(word.wordId)}`): LibraryEntry {
  const entry: LibraryEntry = {
    id: existingId,
    remoteWordId: String(word.wordId),
    term: normalizeTerm(word.word),
    createdAt: word.createdAt,
    status: statusFromServer(word.status),
    details: toDetails(word),
  };
  if (word.failureMessage !== null) entry.errorMessage = word.failureMessage;
  return entry;
}

async function readAccessKey(credentials: CredentialStore): Promise<string> {
  const accessKey = await credentials.get(ACCESS_KEY_KEY);
  if (!accessKey) throw new Error("No encontramos las credenciales de este perfil en el dispositivo.");
  return accessKey;
}

function asWordId(value: string): Id<"words"> {
  return value as Id<"words">;
}

async function listAllWords(
  client: ConvexReactClient,
  handle: string,
  accessKey: string,
): Promise<LibraryEntry[]> {
  const entries: LibraryEntry[] = [];
  let cursor: string | null = null;

  while (true) {
    const page: WordPage = await client.query(api.words.listWords, {
      handle,
      accessKey,
      paginationOpts: { numItems: PAGE_SIZE, cursor },
    });
    entries.push(...page.page.map((word: WordView) => toLocalEntry(word)));
    if (page.isDone) return entries;
    cursor = page.continueCursor;
  }
}

async function searchAllWords(
  client: ConvexReactClient,
  handle: string,
  accessKey: string,
  query: string,
): Promise<LibraryEntry[]> {
  const entries: LibraryEntry[] = [];
  let cursor: string | null = null;

  while (true) {
    const page: WordPage = await client.query(api.words.searchWords, {
      handle,
      accessKey,
      query,
      paginationOpts: { numItems: PAGE_SIZE, cursor },
    });
    entries.push(...page.page.map((word: WordView) => toLocalEntry(word)));
    if (page.isDone) return entries;
    cursor = page.continueCursor;
  }
}

function mapCredentials(response: ClaimResponse, credentials: CredentialStore, showRecoveryCode = true): Promise<void> {
  return Promise.all([
    credentials.set(ACCESS_KEY_KEY, response.accessKey),
    credentials.set(RECOVERY_CODE_KEY, response.recoveryCode),
    showRecoveryCode
      ? credentials.set(RECOVERY_CODE_PENDING_KEY, response.recoveryCode)
      : credentials.remove(RECOVERY_CODE_PENDING_KEY),
  ]).then(() => undefined);
}

export function createConvexRemote(client: ConvexReactClient, credentials: CredentialStore): SensusRemote {
  return {
    async bootstrapProfile(): Promise<RecoverProfileResult> {
      const response = await client.action(api.profileActions.bootstrapProfile, {});
      await mapCredentials(response, credentials, false);
      const entries = await listAllWords(client, response.handle, response.accessKey);
      return {
        profile: { ...profileFromHandle(response.handle), nickname: DEFAULT_NICKNAME },
        entries,
        accessKey: response.accessKey,
        recoveryCode: response.recoveryCode,
      };
    },

    async registerProfile(input): Promise<RegisterProfileResult> {
      const response = await client.action(api.profileActions.claimProfile, {
        handle: toHandle(input.nickname),
      });
      await mapCredentials(response, credentials);
      return {
        profile: profileFromHandle(response.handle),
        accessKey: response.accessKey,
        recoveryCode: response.recoveryCode,
      };
    },

    async recoverProfile(input): Promise<RecoverProfileResult> {
      const response = await client.action(api.profileActions.recoverProfile, {
        handle: toHandle(input.nickname),
        recoveryCode: input.recoveryCode,
      });
      await mapCredentials(response, credentials);
      const entries = await listAllWords(client, response.handle, response.accessKey);
      return {
        profile: profileFromHandle(response.handle),
        entries,
        accessKey: response.accessKey,
        recoveryCode: response.recoveryCode,
      };
    },

    async createWord(input: SubmitWordInput): Promise<SubmitWordResult> {
      const accessKey = await readAccessKey(credentials);
      const response = await client.mutation(api.words.createWord, {
        handle: toHandle(input.nickname),
        accessKey,
        word: normalizeTerm(input.term),
      });
      const result: SubmitWordResult = {
        status: statusFromServer(response.status),
        remoteWordId: String(response.wordId),
      };
      if (response.wordView?.status === "ready") result.details = toDetails(response.wordView);
      if (response.wordView?.failureMessage) result.errorMessage = response.wordView.failureMessage;
      return result;
    },

    async retryWord(input: SubmitWordInput & { remoteWordId: string }): Promise<SubmitWordResult> {
      const accessKey = await readAccessKey(credentials);
      const response = await client.mutation(api.words.retryWord, {
        handle: toHandle(input.nickname),
        accessKey,
        wordId: asWordId(input.remoteWordId),
      });
      return {
        status: statusFromServer(response.status),
        remoteWordId: String(response.wordId),
      };
    },

    async listWords(input): Promise<LibraryEntry[]> {
      const accessKey = await readAccessKey(credentials);
      return listAllWords(client, toHandle(input.nickname), accessKey);
    },

    async searchWords(input): Promise<LibraryEntry[]> {
      const query = normalizeTermKey(input.query);
      if (!query) return [];
      const accessKey = await readAccessKey(credentials);
      return searchAllWords(client, toHandle(input.nickname), accessKey, query);
    },

    async deleteWord(input): Promise<void> {
      const accessKey = await readAccessKey(credentials);
      await client.mutation(api.words.deleteWord, {
        handle: toHandle(input.nickname),
        accessKey,
        wordId: asWordId(input.remoteWordId),
      });
    },

    async reconcile(input): Promise<LibraryEntry[]> {
      const accessKey = await readAccessKey(credentials);
      const handle = toHandle(input.nickname);

      for (const entry of input.entries) {
        // Only entries explicitly queued while offline are automatic jobs. Failed and
        // not-found results are terminal until the user taps Reintentar.
        const shouldRetry = entry.status === "offline-pending";
        try {
          if (entry.remoteWordId && shouldRetry) {
            await client.mutation(api.words.retryWord, {
              handle,
              accessKey,
              wordId: asWordId(entry.remoteWordId),
            });
          } else if (!entry.remoteWordId && entry.status === "offline-pending") {
            await client.mutation(api.words.createWord, {
              handle,
              accessKey,
              word: normalizeTerm(entry.term),
            });
          }
        } catch (error) {
          if (entry.status === "offline-pending" || entry.status === "failed" || entry.status === "not-found") {
            continue;
          }
          throw error;
        }
      }

      // This also refreshes processing/syncing entries so completed Workpool jobs reach the UI.
      const remoteEntries = await listAllWords(client, handle, accessKey);
      // Tombstones are applied by the provider against the latest local snapshot.
      // Do not delete here: this request may have started before the user re-added
      // the same term, in which case deleting the captured remote row would erase
      // the new intent. Known remote rows are deleted immediately by deleteEntry;
      // an in-flight create is cleaned up by submitEntry when its response arrives.
      const deletedTermKeys = new Set(input.deletedTermKeys);
      return mergeLibraryEntries(
        input.entries,
        remoteEntries.filter((entry) => !deletedTermKeys.has(normalizeTermKey(entry.term))),
      );
    },
  };
}
