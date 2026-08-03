import { Platform } from "react-native";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import * as SecureStore from "expo-secure-store";

import { normalizeSnapshot, type CredentialStore, type LocalSnapshot, type LocalStore } from "./sensus";

const DATABASE_NAME = "sensus.db";
const WEB_SNAPSHOT_KEY = "sensus.snapshot";
const WEB_CREDENTIAL_PREFIX = "sensus.credential.";
const secureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(
        "CREATE TABLE IF NOT EXISTS sensus_state (id INTEGER PRIMARY KEY NOT NULL, snapshot TEXT NOT NULL)",
      );
      return database;
    });
  }

  try {
    return await databasePromise;
  } catch (error) {
    databasePromise = null;
    throw error;
  }
}

export function createNativeLocalStore(): LocalStore {
  if (Platform.OS === "web") return createWebLocalStore();

  return {
    async load() {
      const database = await getDatabase();
      const row = await database.getFirstAsync<{ snapshot: string }>(
        "SELECT snapshot FROM sensus_state WHERE id = 1",
      );
      if (!row) return null;

      try {
        const parsed: unknown = JSON.parse(row.snapshot);
        if (typeof parsed !== "object" || parsed === null) return null;
        return normalizeSnapshot(parsed as LocalSnapshot);
      } catch {
        return null;
      }
    },

    async save(snapshot) {
      const database = await getDatabase();
      // Credentials intentionally do not exist in LocalSnapshot and are never serialized here.
      const persistedSnapshot: LocalSnapshot = {
        profile: snapshot.profile,
        entries: snapshot.entries,
        themeMode: snapshot.themeMode,
        deletedTermKeys: snapshot.deletedTermKeys,
      };
      await database.runAsync(
        "INSERT INTO sensus_state (id, snapshot) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot",
        [JSON.stringify(persistedSnapshot)],
      );
    },
  };
}

export function createSecureCredentialStore(): CredentialStore {
  if (Platform.OS === "web") return createWebCredentialStore();

  return {
    get: (key) => SecureStore.getItemAsync(key, secureStoreOptions),
    set: (key, value) => SecureStore.setItemAsync(key, value, secureStoreOptions),
    remove: (key) => SecureStore.deleteItemAsync(key, secureStoreOptions),
  };
}

function getWebStorage(): Storage | null {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) return null;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function createWebLocalStore(): LocalStore {
  return {
    async load() {
      const storage = getWebStorage();
      if (!storage) return null;

      try {
        const raw = storage.getItem(WEB_SNAPSHOT_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return null;
        return normalizeSnapshot(parsed as LocalSnapshot);
      } catch {
        return null;
      }
    },

    async save(snapshot) {
      const storage = getWebStorage();
      if (!storage) return;
      storage.setItem(WEB_SNAPSHOT_KEY, JSON.stringify(normalizeSnapshot(snapshot)));
    },
  };
}

function createWebCredentialStore(): CredentialStore {
  return {
    async get(key) {
      return getWebStorage()?.getItem(`${WEB_CREDENTIAL_PREFIX}${key}`) ?? null;
    },
    async set(key, value) {
      getWebStorage()?.setItem(`${WEB_CREDENTIAL_PREFIX}${key}`, value);
    },
    async remove(key) {
      getWebStorage()?.removeItem(`${WEB_CREDENTIAL_PREFIX}${key}`);
    },
  };
}
