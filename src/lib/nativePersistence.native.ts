import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import * as SecureStore from "expo-secure-store";

import { normalizeSnapshot, type CredentialStore, type LocalSnapshot, type LocalStore } from "./sensus";

const DATABASE_NAME = "sensus.db";
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
  return {
    get: (key) => SecureStore.getItemAsync(key, secureStoreOptions),
    set: (key, value) => SecureStore.setItemAsync(key, value, secureStoreOptions),
    remove: (key) => SecureStore.deleteItemAsync(key, secureStoreOptions),
  };
}
