import { normalizeSnapshot, type CredentialStore, type LocalSnapshot, type LocalStore } from "./sensus";

const WEB_SNAPSHOT_KEY = "sensus.snapshot";
const WEB_CREDENTIAL_PREFIX = "sensus.credential.";

function getWebStorage(): Storage | null {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) return null;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function createNativeLocalStore(): LocalStore {
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
      getWebStorage()?.setItem(WEB_SNAPSHOT_KEY, JSON.stringify(normalizeSnapshot(snapshot)));
    },
  };
}

export function createSecureCredentialStore(): CredentialStore {
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
