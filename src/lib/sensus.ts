export const MAX_TERM_LENGTH = 64;

export const ENTRY_STATUSES = [
  "offline-pending",
  "syncing",
  "processing",
  "ready",
  "not-found",
  "failed",
] as const;

export type EntryStatus = (typeof ENTRY_STATUSES)[number];
export type ThemeMode = "system" | "light" | "dark";

export interface WordDefinition {
  definition: string;
  example: string;
}

export interface WordDetails {
  definitions: WordDefinition[];
  grammaticalCategory?: string;
}

export interface UserProfile {
  nickname: string;
  createdAt: number;
}

export interface LibraryEntry {
  id: string;
  remoteWordId?: string;
  term: string;
  createdAt: number;
  status: EntryStatus;
  details?: WordDetails;
  errorMessage?: string;
  lastAttemptAt?: number;
}

export interface LocalSnapshot {
  profile: UserProfile | null;
  entries: LibraryEntry[];
  themeMode: ThemeMode;
  /** Normalized terms the user explicitly deleted; prevents stale jobs resurrecting them. */
  deletedTermKeys: string[];
}

export interface LocalStore {
  load(): Promise<LocalSnapshot | null>;
  save(snapshot: LocalSnapshot): Promise<void>;
}

export interface CredentialStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface RegisterProfileResult {
  profile: UserProfile;
  accessKey: string;
  recoveryCode: string;
}

export interface RecoverProfileResult {
  profile: UserProfile;
  entries: LibraryEntry[];
  accessKey: string;
  recoveryCode: string;
}

export interface SubmitWordInput {
  nickname: string;
  entryId: string;
  term: string;
  remoteWordId?: string;
}

export interface SubmitWordResult {
  status: Exclude<EntryStatus, "offline-pending" | "syncing">;
  remoteWordId?: string;
  details?: WordDetails;
  errorMessage?: string;
}

export interface SearchWordsInput {
  nickname: string;
  query: string;
}

export interface ReconcileInput {
  nickname: string;
  entries: LibraryEntry[];
  deletedTermKeys: string[];
}

export interface SensusRemote {
  registerProfile?(input: { nickname: string }): Promise<RegisterProfileResult>;
  recoverProfile?(input: {
    nickname: string;
    recoveryCode: string;
  }): Promise<RecoverProfileResult>;
  createWord?(input: SubmitWordInput): Promise<SubmitWordResult>;
  retryWord?(input: SubmitWordInput & { remoteWordId: string }): Promise<SubmitWordResult>;
  listWords?(input: { nickname: string }): Promise<LibraryEntry[]>;
  searchWords?(input: SearchWordsInput): Promise<LibraryEntry[]>;
  deleteWord?(input: { nickname: string; remoteWordId: string }): Promise<void>;
  reconcile?(input: ReconcileInput): Promise<LibraryEntry[]>;
}

export interface SensusServices {
  localStore?: LocalStore;
  credentialStore?: CredentialStore;
  remote?: SensusRemote;
  getOnlineStatus?: () => boolean | Promise<boolean>;
}

export const EMPTY_SNAPSHOT: LocalSnapshot = {
  profile: null,
  entries: [],
  themeMode: "system",
  deletedTermKeys: [],
};

export const ACCESS_KEY_KEY = "sensus.access-key";
export const RECOVERY_CODE_KEY = "sensus.recovery-code";
export const RECOVERY_CODE_PENDING_KEY = "sensus.recovery-code-pending";

let memorySnapshot: LocalSnapshot = EMPTY_SNAPSHOT;
const memoryCredentials = new Map<string, string>();

export function createMemoryLocalStore(): LocalStore {
  return {
    async load() {
      return memorySnapshot;
    },
    async save(snapshot) {
      memorySnapshot = snapshot;
    },
  };
}

export function createMemoryCredentialStore(): CredentialStore {
  return {
    async get(key) {
      return memoryCredentials.get(key) ?? null;
    },
    async set(key, value) {
      memoryCredentials.set(key, value);
    },
    async remove(key) {
      memoryCredentials.delete(key);
    },
  };
}

export function createEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeTermKey(value: string): string {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("es");
}

export function buildEntrySearchText(entry: LibraryEntry): string {
  return [
    entry.term,
    entry.details?.grammaticalCategory ?? "",
    ...(entry.details?.definitions ?? []).flatMap(({ definition, example }) => [definition, example]),
  ]
    .map(normalizeTermKey)
    .filter(Boolean)
    .join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEntryStatus(value: unknown): value is EntryStatus {
  return typeof value === "string" && (ENTRY_STATUSES as readonly string[]).includes(value);
}

function normalizeDetails(value: unknown): WordDetails | undefined {
  if (!isRecord(value) || !Array.isArray(value.definitions)) return undefined;

  const definitions = value.definitions.filter(isRecord).filter(
    (definition): definition is { definition: string; example: string } =>
      typeof definition.definition === "string" && typeof definition.example === "string",
  );
  const details: WordDetails = { definitions };
  if (typeof value.grammaticalCategory === "string" && value.grammaticalCategory) {
    details.grammaticalCategory = value.grammaticalCategory;
  }
  return details;
}

function normalizeEntry(value: unknown): LibraryEntry | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.term !== "string" || !isEntryStatus(value.status)) {
    return null;
  }

  const term = value.term.normalize("NFC").replace(/\s+/gu, " ").trim().slice(0, MAX_TERM_LENGTH);
  if (!term) return null;

  const entry: LibraryEntry = {
    id: value.id,
    term,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    status: value.status,
  };
  if (typeof value.remoteWordId === "string" && value.remoteWordId) entry.remoteWordId = value.remoteWordId;
  const details = normalizeDetails(value.details);
  if (details) entry.details = details;
  if (typeof value.errorMessage === "string" && value.errorMessage) entry.errorMessage = value.errorMessage;
  if (typeof value.lastAttemptAt === "number") entry.lastAttemptAt = value.lastAttemptAt;
  return entry;
}

export function normalizeSnapshot(snapshot: LocalSnapshot | null): LocalSnapshot {
  if (!snapshot) return EMPTY_SNAPSHOT;

  const entries = new Map<string, LibraryEntry>();
  if (Array.isArray(snapshot.entries)) {
    for (const candidate of snapshot.entries) {
      const entry = normalizeEntry(candidate);
      if (!entry) continue;
      const key = normalizeTermKey(entry.term);
      if (!entries.has(key)) entries.set(key, entry);
    }
  }

  const rawDeletedTermKeys = (snapshot as LocalSnapshot & { deletedTermKeys?: unknown }).deletedTermKeys;
  const deletedTermKeys = Array.isArray(rawDeletedTermKeys)
    ? Array.from(
        new Set(
          rawDeletedTermKeys
            .filter((value): value is string => typeof value === "string")
            .map(normalizeTermKey)
            .filter(Boolean),
        ),
      )
    : [];

  return {
    profile: snapshot.profile ?? null,
    entries: Array.from(entries.values()).sort((left, right) => right.createdAt - left.createdAt),
    themeMode: snapshot.themeMode === "light" || snapshot.themeMode === "dark" ? snapshot.themeMode : "system",
    deletedTermKeys,
  };
}

export function mergeLibraryEntries(localEntries: LibraryEntry[], remoteEntries: LibraryEntry[]): LibraryEntry[] {
  const merged = normalizeSnapshot({ ...EMPTY_SNAPSHOT, entries: localEntries }).entries;

  for (const remoteEntry of remoteEntries) {
    const remoteKey = normalizeTermKey(remoteEntry.term);
    const index = merged.findIndex(
      (entry) =>
        (remoteEntry.remoteWordId && entry.remoteWordId === remoteEntry.remoteWordId) ||
        normalizeTermKey(entry.term) === remoteKey,
    );

    if (index === -1) {
      merged.push(remoteEntry);
      continue;
    }

    const localEntry = merged[index];
    const next: LibraryEntry = {
      ...localEntry,
      ...remoteEntry,
      id: localEntry.id,
      createdAt: localEntry.createdAt,
    };
    if (remoteEntry.details) next.details = remoteEntry.details;
    else delete next.details;
    if (remoteEntry.errorMessage) next.errorMessage = remoteEntry.errorMessage;
    else delete next.errorMessage;
    merged[index] = next;
  }

  return merged.sort((left, right) => right.createdAt - left.createdAt);
}
